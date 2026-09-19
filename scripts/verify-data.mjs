import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
const dbPath = process.env.RADAR_DB_PATH ?? resolve('data/runtime/radar.sqlite');
assert.ok(existsSync(dbPath), 'Database missing: run data:seed.');
const db = new DatabaseSync(dbPath);
try {
  const dataset = db.prepare('SELECT dataset_id, manifest_json FROM datasets LIMIT 1').get(); assert.ok(dataset, 'No dataset metadata.');
  const manifest = JSON.parse(dataset.manifest_json); assert.equal(manifest.mode, 'public'); assert.deepEqual(manifest.markets.sort(), ['CHICAGO','NYC']);
  for (const [market, source] of [['CHICAGO','CHICAGO_PERMIT'], ['NYC','NYC_DOB_NOW']]) {
    const report = JSON.parse(db.prepare('SELECT report_json FROM source_reports WHERE market=? AND source=?').get(market,source).report_json);
    const row = db.prepare('SELECT COUNT(*) n, SUM(h3_cell IS NOT NULL) mapped, SUM(h3_cell IS NULL) unmapped FROM permits WHERE market=?').get(market);
    assert.equal(row.n, report.acceptedRows, `${market} accepted accounting`); assert.equal(row.mapped, report.resolvedRows, `${market} mapped accounting`); assert.equal(row.unmapped, report.unresolvedRows, `${market} unmapped accounting`);
    assert.equal(report.rowsRead, report.acceptedRows + report.rejectedRows + report.duplicateRows + report.outOfScopeRows, `${market} source accounting`);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM permits WHERE market=? AND (event_date < ? OR event_date >= ?)').get(market,'2024-07-01','2026-07-01').n, 0, `${market} out-of-window rows`);
    assert.ok(row.mapped > 0, `${market} needs mapped evidence`);
    const cell = db.prepare('SELECT h3_cell FROM permits WHERE market=? AND h3_cell IS NOT NULL LIMIT 1').get(market).h3_cell;
    const counts = db.prepare('SELECT COUNT(*) n FROM permits WHERE market=? AND h3_cell=?').get(market,cell).n;
    assert.ok(counts > 0, `${market} cell evidence`);
  }
  for (const market of ['CHICAGO','NYC']) { const report = JSON.parse(db.prepare('SELECT report_json FROM source_reports WHERE market=? AND source=?').get(market,'SBA_504').report_json); const n = db.prepare('SELECT COUNT(*) n FROM approvals WHERE market=?').get(market).n; assert.equal(n, report.acceptedRows, `${market} SBA accounting`); assert.equal(report.rowsRead, report.acceptedRows + report.rejectedRows + report.duplicateRows + report.outOfScopeRows, `${market} SBA source accounting`); }
  if (existsSync('data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl')) { const sidecar=JSON.parse(readFileSync('data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl.manifest.json')); const sha=createHash('sha256').update(readFileSync('data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl')).digest('hex'); assert.equal(sha,sidecar.sha256,'Chicago raw checksum'); }
  if (existsSync('data/raw/nyc-permits-2024-07-01_2026-07-01.jsonl')) { const sidecar=JSON.parse(readFileSync('data/raw/nyc-permits-2024-07-01_2026-07-01.jsonl.manifest.json')); const sha=createHash('sha256').update(readFileSync('data/raw/nyc-permits-2024-07-01_2026-07-01.jsonl')).digest('hex'); assert.equal(sha,sidecar.sha256,'NYC raw checksum'); }
  if (!existsSync('data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl')) { const demo=JSON.parse(readFileSync('data/demo/manifest.json')); for (const item of demo.sources) { const sha=createHash('sha256').update(readFileSync(`data/demo/${item.file}`)).digest('hex'); assert.equal(sha,item.sha256,`${item.source} bundled sample checksum`); } }
  console.log(`Verified ${dataset.dataset_id}: permit, SBA, raw checksum, mapped/unmapped, window and evidence accounting.`);
} finally { db.close(); }
