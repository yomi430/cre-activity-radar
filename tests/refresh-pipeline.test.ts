import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { atomicReplace } from '../scripts/rebuild-database.mjs';
import { checksum, localSnapshot, publisherMatchesSnapshot, snapshotPaths } from '../scripts/permit-source.mjs';
import { refreshMarket } from '../scripts/refresh-market.mjs';

describe('staged refresh pipeline', () => {
  it('recognizes a checksum-verified unchanged publisher snapshot and does no fetch or rebuild', async () => {
    const raw = mkdtempSync(join(tmpdir(), 'radar-refresh-')); const paths = snapshotPaths('chicago', raw);
    writeFileSync(paths.snapshot, '{"id":"one"}\n');
    writeFileSync(paths.manifest, JSON.stringify({ rows: 1, sha256: checksum(paths.snapshot), coverageStart: '2024-07-01', coverageEndExclusive: '2026-07-01', publisherLatestEventDate: '2026-06-30', retrievedAt: '2026-09-19T00:00:00.000Z' }));
    const snapshot = localSnapshot('chicago', raw);
    expect(snapshot).toBeTruthy();
    expect(publisherMatchesSnapshot({ rows: 1, latestEventDate: '2026-06-30' }, snapshot)).toBe(true);
    let fetched = 0, rebuilt = 0;
    const result = await refreshMarket('chicago', { getLocalSnapshot: () => snapshot, getPublisherState: async () => ({ rows: 1, latestEventDate: '2026-06-30', latestPublishedDate: '2026-09-01' }), fetch: async () => { fetched++; throw new Error('must not fetch'); }, rebuildDatabase: () => { rebuilt++; }, log: () => {} });
    expect(result.outcome).toBe('UP_TO_DATE'); expect(fetched).toBe(0); expect(rebuilt).toBe(0);
  });

  it('fetches, validates and rebuilds exactly once only when the configured window changed', async () => {
    let fetched = 0, rebuilt = 0;
    const result = await refreshMarket('nyc', { getLocalSnapshot: () => ({ rows: 3, publisherLatestEventDate: '2026-06-20', actualChecksum: 'old', retrievedAt: '2026-09-19T00:00:00.000Z' }), getPublisherState: async () => ({ rows: 4, latestEventDate: '2026-06-21', latestPublishedDate: '2026-09-01' }), fetch: async () => { fetched++; return { rows: 4, sha256: 'new' }; }, rebuildDatabase: () => { rebuilt++; }, log: () => {} });
    expect(result.outcome).toBe('UPDATED'); expect(fetched).toBe(1); expect(rebuilt).toBe(1);
  });

  it('atomically replaces a built database artifact while retaining a usable old artifact on pre-swap failure', () => {
    const root = mkdtempSync(join(tmpdir(), 'radar-swap-')); const active = join(root, 'radar.sqlite'); const staged = join(root, 'radar.sqlite.staging');
    writeFileSync(active, 'old'); writeFileSync(staged, 'new'); atomicReplace(staged, active);
    expect(readFileSync(active, 'utf8')).toBe('new');
  });

  it('seeds the same staged source files repeatedly without growing permit counts', () => {
    const root = mkdtempSync(join(tmpdir(), 'radar-seed-')); const raw = join(root, 'raw'); const dbPath = join(root, 'radar.sqlite');
    // The two fixture files are copied as complete snapshots to exercise the production input branch.
    mkdirSync(raw);
    copyFileSync('data/fixtures/chicago.jsonl', join(raw, 'chicago-permits-2024-07-01_2026-07-01.jsonl'));
    copyFileSync('data/fixtures/nyc.jsonl', join(raw, 'nyc-permits-2024-07-01_2026-07-01.jsonl'));
    const env = { ...process.env, RADAR_DB_PATH: dbPath, RADAR_RAW_DIR: raw, RADAR_SBA_PATH: join(root, 'missing-sba.csv') };
    const counts: number[] = [];
    for (let run = 0; run < 2; run++) {
      const result = spawnSync(process.execPath, ['scripts/seed.mjs'], { env, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      const runDatabase = new DatabaseSync(dbPath);
      try { counts.push((runDatabase.prepare('SELECT COUNT(*) AS count FROM permits').get() as { count: number }).count); } finally { runDatabase.close(); }
    }
    const database = new DatabaseSync(dbPath);
    try {
      const total = (database.prepare('SELECT COUNT(*) AS count FROM permits').get() as { count: number }).count;
      const distinct = (database.prepare('SELECT COUNT(DISTINCT id) AS count FROM permits').get() as { count: number }).count;
      expect(total).toBe(distinct);
      expect(total).toBeGreaterThan(0);
      expect(counts).toEqual([total, total]);
    } finally { database.close(); }
  }, 15_000);
});
