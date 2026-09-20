import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createSchema } from '../src/server/db.js';
import { ingestZapSnapshot, zapSummaryFor } from '../src/server/zap.js';
import { fetchZapSnapshot, zapLocalSnapshot, zapSnapshotPaths } from '../scripts/zap-source.mjs';
import { refreshZap } from '../scripts/refresh-zap.mjs';

type Row = Record<string, unknown>;
type Fixture = { projects: Row[]; bbls: Row[]; pluto: Row[]; updated?: number };

function sourceId(url: URL) {
  const match = /resource\/([^/]+)\.json$/.exec(url.pathname);
  return match?.[1] ?? null;
}

/** A complete Socrata double: metadata, count queries, pages, and BBL-scoped PLUTO. */
function publisher(fixture: Fixture, calls: URL[] = []) {
  const updated = fixture.updated ?? 1_726_800_000;
  const rowsFor = (id: string) => id === 'hgx4-8ukb' ? fixture.projects : id === '2iga-a6mk' ? fixture.bbls : fixture.pluto;
  return async (input: URL | string) => {
    const url = new URL(String(input)); calls.push(url);
    const view = /\/api\/views\/([^/]+)$/.exec(url.pathname);
    if (view) return new Response(JSON.stringify({ rowsUpdatedAt: updated }), { status: 200 });
    const id = sourceId(url); if (!id) return new Response('unknown url', { status: 404 });
    let rows = rowsFor(id);
    const where = url.searchParams.get('$where');
    if (id === '64uk-42ks' && where) {
      const values = [...where.matchAll(/\d+/g)].map(match => BigInt(match[0]!));
      rows = rows.filter(row => values.includes(BigInt(String(row.bbl).split('.')[0]!)));
    }
    if (url.searchParams.get('$select')?.includes('count(*)')) return new Response(JSON.stringify([{ count: String(rows.length) }]), { status: 200 });
    const offset = Number(url.searchParams.get('$offset') ?? '0'); const limit = Number(url.searchParams.get('$limit') ?? '5000');
    return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { status: 200 });
  };
}

function fixture(count = 2): Fixture {
  const projects = Array.from({ length: count }, (_, index) => ({ project_id: `project-${index}`, project_status: 'Active', app_filed_date: index === 0 ? '2025-01-01T00:00:00.000' : null }));
  const bbls = projects.map((project, index) => ({ project_id: project.project_id, bbl: String(1_000_000_001 + index), validated: 'true' }));
  const pluto = bbls.map((association, index) => ({ bbl: `${association.bbl}.00000000`, latitude: String(40.7 + index / 10_000), longitude: '-74.0000' }));
  return { projects, bbls, pluto };
}

describe('NYC ZAP live refresh boundary', () => {
  it('paginates official resources, batches PLUTO by ZAP BBL, and activates only a checksum-verified immutable snapshot', async () => {
    const raw = mkdtempSync(join(tmpdir(), 'radar-zap-live-')); const calls: URL[] = [];
    // More than the fixed 5,000-row page makes the pagination contract observable.
    const data = fixture(5_001);
    const manifest = await fetchZapSnapshot({ rawDirectory: raw, fetchImpl: publisher(data, calls), log: () => {} });
    const local = zapLocalSnapshot(raw);
    expect(local).toMatchObject({ snapshotId: manifest.snapshotId, complete: true, counts: { projects: { expected: 5_001, fetched: 5_001 }, bbls: { expected: 5_001, fetched: 5_001 }, pluto: { fetched: 5_001, requestedBbls: 5_001 } } });
    expect(calls.filter(url => sourceId(url) === 'hgx4-8ukb' && url.searchParams.has('$offset')).length).toBeGreaterThan(1);
    expect(calls.filter(url => sourceId(url) === '2iga-a6mk' && url.searchParams.has('$offset')).length).toBeGreaterThan(1);
    expect(calls.filter(url => sourceId(url) === '64uk-42ks' && url.searchParams.has('$where')).length).toBeGreaterThan(1);
    for (const file of Object.values(manifest.files)) expect(existsSync(join(manifest.directory, file.file))).toBe(true);
    // The pointer is not trusted alone: a file checksum mismatch deactivates the snapshot.
    const projectFile = join(manifest.directory, manifest.files.projects.file);
    const original = readFileSync(projectFile, 'utf8');
    await import('node:fs').then(({ writeFileSync }) => writeFileSync(projectFile, `${original}tampered\n`));
    expect(zapLocalSnapshot(raw)).toBeNull();
  });

  it('retains the prior pointer when a publisher response is partial or malformed', async () => {
    const raw = mkdtempSync(join(tmpdir(), 'radar-zap-atomic-'));
    const first = await fetchZapSnapshot({ rawDirectory: raw, fetchImpl: publisher(fixture()), log: () => {} });
    const existingPointer = readFileSync(zapSnapshotPaths(raw).latest, 'utf8');
    const badFetch = async (input: URL | string) => {
      const url = new URL(String(input));
      if (/\/api\/views\//.test(url.pathname)) return new Response(JSON.stringify({ rowsUpdatedAt: 1_726_800_001 }), { status: 200 });
      if (sourceId(url) === 'hgx4-8ukb' && url.searchParams.get('$select')?.includes('count(*)')) return new Response(JSON.stringify([{ count: '2' }]), { status: 200 });
      if (sourceId(url) === 'hgx4-8ukb') return new Response(JSON.stringify([{ project_id: 'only-one', project_status: 'Active' }]), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    };
    await expect(fetchZapSnapshot({ rawDirectory: raw, fetchImpl: badFetch, log: () => {} })).rejects.toThrow(/completeness mismatch/i);
    expect(readFileSync(zapSnapshotPaths(raw).latest, 'utf8')).toBe(existingPointer);
    expect(zapLocalSnapshot(raw)?.snapshotId).toBe(first.snapshotId);
  });

  it('accounts for duplicate project rows and orphan BBL rows without allowing either into the active totals', () => {
    const db = new DatabaseSync(':memory:'); createSchema(db);
    try {
      const result = ingestZapSnapshot(db, {
        snapshotId: 'accounting-1', retrievedAt: '2026-09-20T00:00:00.000Z', complete: true,
        projects: [{ project_id: 'known', project_status: 'Active' }, { project_id: 'known', project_status: 'Active' }],
        bbls: [{ project_id: 'known', bbl: '1000000001', validated: true }, { project_id: 'gone', bbl: '1000000002', validated: true }],
        parcels: [{ bbl: '1000000001', latitude: '40.7', longitude: '-74.0' }],
      });
      expect(result).toMatchObject({ acceptedProjects: 1, rejectedProjects: 1, orphanBblRows: 1, validatedBblRows: 1 });
      expect(zapSummaryFor(db).coverage).toMatchObject({ allTrackedProjects: 1, orphanBblRows: 1, validatedBblRows: 1 });
    } finally { db.close(); }
  });

  it('keeps an unchanged metadata refresh idempotent and never rebuilds, while a changed complete snapshot rebuilds once', async () => {
    const publisherState = { projects: { rowsUpdatedAt: 10 }, bbls: { rowsUpdatedAt: 11 }, pluto: { rowsUpdatedAt: 12 } };
    const snapshot = { snapshotId: 'same', publisher: publisherState };
    let fetched = 0; let rebuilt = 0; const unchangedStages: string[] = [];
    const unchanged = await refreshZap({ getLocalSnapshot: () => snapshot, getPublisherState: async () => publisherState, fetchSnapshot: async () => { fetched++; throw new Error('must not fetch'); }, rebuildDatabase: () => { rebuilt++; }, log: line => unchangedStages.push(line) });
    expect(unchanged.outcome).toBe('UP_TO_DATE'); expect(fetched).toBe(0); expect(rebuilt).toBe(0); expect(unchangedStages).toContain('OUTCOME UP_TO_DATE');
    const updatedStages: string[] = [];
    const updated = await refreshZap({ getLocalSnapshot: () => null, getPublisherState: async () => publisherState, fetchSnapshot: async () => { fetched++; return { snapshotId: 'next', complete: true }; }, rebuildDatabase: () => { rebuilt++; }, log: line => updatedStages.push(line) });
    expect(updated.outcome).toBe('UPDATED'); expect(fetched).toBe(1); expect(rebuilt).toBe(1);
    expect(updatedStages).toEqual(expect.arrayContaining(['STAGE CHECKING_LOCAL_SNAPSHOT', 'STAGE CHECKING_PUBLISHER', 'STAGE FETCHING_ZAP_SNAPSHOT', 'STAGE VALIDATED_ZAP_SNAPSHOT snapshot=next', 'STAGE REBUILDING_DATABASE', 'OUTCOME UPDATED']));
  });

  it('rolls back the activated pointer when the staged database rebuild fails', async () => {
    const raw = mkdtempSync(join(tmpdir(), 'radar-zap-rebuild-'));
    const first = await fetchZapSnapshot({ rawDirectory: raw, fetchImpl: publisher(fixture()), log: () => {} });
    const next = await fetchZapSnapshot({ rawDirectory: raw, fetchImpl: publisher({ ...fixture(), updated: 2 }), activate: false, log: () => {} });
    await expect(refreshZap({
      rawDirectory: raw,
      getPublisherState: async () => next.publisher,
      fetchSnapshot: async () => next,
      rebuildDatabase: () => { throw new Error('fixture rebuild failure'); },
      log: () => {},
    })).rejects.toThrow(/fixture rebuild failure/);
    expect(zapLocalSnapshot(raw)?.snapshotId).toBe(first.snapshotId);
    const retry = await refreshZap({
      rawDirectory: raw,
      getPublisherState: async () => next.publisher,
      fetchSnapshot: async () => next,
      rebuildDatabase: () => {},
      log: () => {},
    });
    // The failed build did not falsely advance the metadata checkpoint: retrying
    // the same publisher version remains an UPDATE, not an UP_TO_DATE no-op.
    expect(retry.outcome).toBe('UPDATED');
    expect(zapLocalSnapshot(raw)?.snapshotId).toBe(next.snapshotId);
  });
});
