import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { latLngToCell } from 'h3-js';

const fixture = (name, directory) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
const canonicalBbl = value => {
  const source = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)(?:\.0+)?$/.exec(source);
  if (!match) return null;
  try { const integer = BigInt(match[1]); return integer > 0n && integer <= 9_999_999_999n ? integer.toString().padStart(10, '0') : null; } catch { return null; }
};
const status = value => ({ active: 'ACTIVE', 'on-hold': 'ON_HOLD', 'withdrawn-other': 'WITHDRAWN', terminated: 'TERMINATED', 'terminated-applicant unresponsive': 'TERMINATED', complete: 'COMPLETED_OTHER', 'record closed': 'COMPLETED_OTHER' })[typeof value === 'string' ? value.trim().toLowerCase() : ''] ?? 'UNKNOWN';
const valid = raw => raw.validated === true || raw.validated === 1 || raw.validated === 'true' || raw.validated === '1' || Boolean(raw.validated_borough);
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

/**
 * Deterministic, small ZAP fixture used by the local demo. It exercises the same
 * project/BBL/PLUTO joins as production ingestion without implying a live refresh.
 */
export function seedZapRows(db, { snapshotId, retrievedAt, publisherUpdatedAt, projects, bbls, parcels, reset = true }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS zap_snapshots (snapshot_id TEXT PRIMARY KEY, retrieved_at TEXT NOT NULL, project_updated_at TEXT, bbl_updated_at TEXT, pluto_updated_at TEXT, project_rows INTEGER NOT NULL, bbl_rows INTEGER NOT NULL, pluto_rows INTEGER NOT NULL, complete INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS zap_projects (project_id TEXT PRIMARY KEY, project_status_raw TEXT, project_status TEXT NOT NULL, public_status TEXT, app_filed_date TEXT, raw_json TEXT NOT NULL, first_snapshot_id TEXT NOT NULL, last_snapshot_id TEXT NOT NULL, possibly_removed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS zap_project_bbls (association_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, bbl TEXT, validated INTEGER NOT NULL, raw_json TEXT NOT NULL, first_snapshot_id TEXT NOT NULL, last_snapshot_id TEXT NOT NULL, possibly_removed INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(project_id) REFERENCES zap_projects(project_id));
    CREATE TABLE IF NOT EXISTS zap_parcels (bbl TEXT PRIMARY KEY, lat REAL, lng REAL, h3_cell TEXT, raw_json TEXT NOT NULL, snapshot_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS zap_project_cells (project_id TEXT NOT NULL, h3_cell TEXT NOT NULL, precision TEXT NOT NULL, snapshot_id TEXT NOT NULL, PRIMARY KEY(project_id, h3_cell), FOREIGN KEY(project_id) REFERENCES zap_projects(project_id));
    CREATE TABLE IF NOT EXISTS zap_rejections (snapshot_id TEXT NOT NULL, kind TEXT NOT NULL, row_count INTEGER NOT NULL, PRIMARY KEY(snapshot_id, kind), FOREIGN KEY(snapshot_id) REFERENCES zap_snapshots(snapshot_id));
  `);
  if (reset) db.exec('DELETE FROM zap_project_cells; DELETE FROM zap_rejections; DELETE FROM zap_project_bbls; DELETE FROM zap_projects; DELETE FROM zap_parcels; DELETE FROM zap_snapshots;');
  const updated = typeof publisherUpdatedAt === 'string' ? publisherUpdatedAt : null;
  const updates = typeof publisherUpdatedAt === 'object' && publisherUpdatedAt !== null ? publisherUpdatedAt : { projects: updated, bbls: updated, pluto: updated };
  db.prepare('INSERT INTO zap_snapshots VALUES(?,?,?,?,?,?,?,?,?)').run(snapshotId, retrievedAt, updates.projects ?? null, updates.bbls ?? null, updates.pluto ?? null, projects.length, bbls.length, parcels.length, 1);
  const knownProjects = new Set();
  const insertProject = db.prepare(`INSERT INTO zap_projects(project_id,project_status_raw,project_status,public_status,app_filed_date,raw_json,first_snapshot_id,last_snapshot_id,possibly_removed)
    VALUES(?,?,?,?,?,?,?,?,0) ON CONFLICT(project_id) DO UPDATE SET project_status_raw=excluded.project_status_raw,project_status=excluded.project_status,public_status=excluded.public_status,app_filed_date=excluded.app_filed_date,raw_json=excluded.raw_json,last_snapshot_id=excluded.last_snapshot_id,possibly_removed=0`);
  for (const raw of projects) {
    const projectId = typeof raw.project_id === 'string' ? raw.project_id.trim() : '';
    if (!projectId || knownProjects.has(projectId)) continue;
    knownProjects.add(projectId);
    insertProject.run(projectId, typeof raw.project_status === 'string' ? raw.project_status.trim() : null, status(raw.project_status), typeof raw.public_status === 'string' ? raw.public_status.trim() || null : null, day(raw.app_filed_date), JSON.stringify(raw), snapshotId, snapshotId);
  }
  const insertParcel = db.prepare(`INSERT INTO zap_parcels(bbl,lat,lng,h3_cell,raw_json,snapshot_id) VALUES(?,?,?,?,?,?)
    ON CONFLICT(bbl) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,h3_cell=excluded.h3_cell,raw_json=excluded.raw_json,snapshot_id=excluded.snapshot_id`);
  for (const raw of parcels) {
    const bbl = canonicalBbl(raw.bbl); if (!bbl) continue;
    const lat = Number(raw.latitude), lng = Number(raw.longitude), mapped = Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.45 && lat <= 40.95 && lng >= -74.3 && lng <= -73.65;
    insertParcel.run(bbl, mapped ? lat : null, mapped ? lng : null, mapped ? latLngToCell(lat, lng, 8) : null, JSON.stringify(raw), snapshotId);
  }
  const insertBbl = db.prepare(`INSERT INTO zap_project_bbls(association_id,project_id,bbl,validated,raw_json,first_snapshot_id,last_snapshot_id,possibly_removed)
    VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(association_id) DO UPDATE SET project_id=excluded.project_id,bbl=excluded.bbl,validated=excluded.validated,raw_json=excluded.raw_json,last_snapshot_id=excluded.last_snapshot_id,possibly_removed=0`); let orphan = 0;
  for (const raw of bbls) {
    const projectId = typeof raw.project_id === 'string' ? raw.project_id.trim() : '';
    if (!knownProjects.has(projectId)) { orphan++; continue; }
    const bbl = canonicalBbl(raw.bbl), validated = valid(raw);
    if (validated && !bbl) continue;
    const associationId = bbl ? `${projectId}:${bbl}` : `${projectId}:UNVALIDATED:${createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0, 20)}`;
    insertBbl.run(associationId, projectId, bbl, validated ? 1 : 0, JSON.stringify(raw), snapshotId, snapshotId);
  }
  if (orphan) db.prepare('INSERT INTO zap_rejections VALUES(?,?,?)').run(snapshotId, 'ORPHAN_BBL', orphan);
  if (!reset) {
    db.prepare('UPDATE zap_projects SET possibly_removed=1 WHERE last_snapshot_id<>?').run(snapshotId);
    db.prepare('UPDATE zap_project_bbls SET possibly_removed=1 WHERE last_snapshot_id<>?').run(snapshotId);
  }
  db.exec('DELETE FROM zap_project_cells;');
  db.prepare(`INSERT INTO zap_project_cells SELECT DISTINCT b.project_id,p.h3_cell,'PARCEL_CENTROID',? FROM zap_project_bbls b JOIN zap_projects project ON project.project_id=b.project_id JOIN zap_parcels p ON p.bbl=b.bbl WHERE b.validated=1 AND b.possibly_removed=0 AND project.possibly_removed=0 AND p.h3_cell IS NOT NULL`).run(snapshotId);
  return { snapshotId, projects: knownProjects.size, bblRows: bbls.length, parcelRows: parcels.length };
}

/** The fixture stays the deterministic fallback; a checksum-verified immutable raw
 * snapshot takes the exact same ingestion path when one has been staged locally. */
export function seedZapFixture(db, directory = resolve('data/fixtures')) {
  return seedZapRows(db, { snapshotId: 'bundled-zap-fixture-v1', retrievedAt: '2026-09-20T00:00:00.000Z', publisherUpdatedAt: '2026-09-19T00:00:00.000Z', projects: fixture('zap-projects.json', directory), bbls: fixture('zap-bbl.json', directory), parcels: fixture('zap-pluto.json', directory) });
}
export function seedZapLiveSnapshot(db, snapshot, reset = true) {
  const rows = name => readFileSync(resolve(snapshot.directory, snapshot.files[name].file), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const publisherUpdatedAt = Object.fromEntries(['projects', 'bbls', 'pluto'].map(name => [name, snapshot.publisher?.[name]?.apiUpdatedAt ?? null]));
  return seedZapRows(db, { snapshotId: snapshot.snapshotId, retrievedAt: snapshot.retrievedAt, publisherUpdatedAt, projects: rows('projects'), bbls: rows('bbls'), parcels: rows('pluto'), reset });
}
