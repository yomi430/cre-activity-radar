import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ZapCellCount, ZapCoverage, ZapProjectCount, ZapProjectStatus, ZapSourceMetadata, ZapSummaryData, ZapWindow } from '../shared/contracts.js';
import { normalizePlutoParcel, normalizeZapBbl, normalizeZapProject } from '../sources/nyc-zap.js';

const PROJECT_DATASET = 'https://data.cityofnewyork.us/resource/hgx4-8ukb.json';
const BBL_DATASET = 'https://data.cityofnewyork.us/resource/2iga-a6mk.json';
const PLUTO_DATASET = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';
const statusIds: ZapProjectStatus[] = ['ACTIVE', 'ON_HOLD', 'WITHDRAWN', 'TERMINATED', 'COMPLETED_OTHER', 'UNKNOWN'];
/** Kept aligned to the app's fixed 24-month comparison horizon. */
export const ZAP_FILED_WINDOW = { start: '2024-07-01', endExclusive: '2026-07-01' } as const;

export interface ZapSnapshotInput {
  snapshotId: string;
  retrievedAt: string;
  publisherUpdatedAt?: Partial<Record<'projects' | 'bbl' | 'pluto', string | null>>;
  /** A complete source snapshot is required before soft-removal reconciliation runs. */
  complete: boolean;
  projects: Record<string, unknown>[];
  bbls: Record<string, unknown>[];
  parcels: Record<string, unknown>[];
}
export interface ZapIngestResult {
  snapshotId: string;
  projectRows: number;
  acceptedProjects: number;
  rejectedProjects: number;
  bblRows: number;
  validatedBblRows: number;
  unvalidatedBblRows: number;
  invalidValidatedBblRows: number;
  orphanBblRows: number;
  parcelRows: number;
  acceptedParcels: number;
  nullCoordinateParcels: number;
  unmappedValidatedBblRows: number;
  placedProjectCells: number;
}

function associationId(projectId: string, bbl: string | null, raw: Record<string, unknown>): string {
  return bbl ? `${projectId}:${bbl}` : `${projectId}:UNVALIDATED:${createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0, 20)}`;
}
function countStatuses(rows: Array<{ project_status: ZapProjectStatus }>): Record<ZapProjectStatus, number> {
  const result = Object.fromEntries(statusIds.map(status => [status, 0])) as Record<ZapProjectStatus, number>;
  for (const row of rows) result[row.project_status] += 1;
  return result;
}
function windowWhere(window: ZapWindow): { clause: string; params: string[] } {
  return window === 'FILED_24_MONTHS' ? { clause: ' AND app_filed_date >= ? AND app_filed_date < ?', params: [ZAP_FILED_WINDOW.start, ZAP_FILED_WINDOW.endExclusive] } : { clause: '', params: [] };
}

/**
 * Atomically stores one complete publisher observation. ZAP is mutable, so missing
 * records are soft flagged only after a complete snapshot; no permit tables are read
 * or changed here.
 */
export function ingestZapSnapshot(db: DatabaseSync, input: ZapSnapshotInput): ZapIngestResult {
  const result: ZapIngestResult = { snapshotId: input.snapshotId, projectRows: input.projects.length, acceptedProjects: 0, rejectedProjects: 0, bblRows: input.bbls.length, validatedBblRows: 0, unvalidatedBblRows: 0, invalidValidatedBblRows: 0, orphanBblRows: 0, parcelRows: input.parcels.length, acceptedParcels: 0, nullCoordinateParcels: 0, unmappedValidatedBblRows: 0, placedProjectCells: 0 };
  const duplicate = db.prepare('SELECT snapshot_id FROM zap_snapshots WHERE snapshot_id = ?').get(input.snapshotId);
  // Snapshot identity is idempotent. A retry must not reinterpret all prior rows as removed.
  if (duplicate) return result;
  const seenProjects = new Set<string>(), seenAssociations = new Set<string>();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO zap_snapshots VALUES(?,?,?,?,?,?,?,?,?)').run(input.snapshotId, input.retrievedAt, input.publisherUpdatedAt?.projects ?? null, input.publisherUpdatedAt?.bbl ?? null, input.publisherUpdatedAt?.pluto ?? null, input.projects.length, input.bbls.length, input.parcels.length, input.complete ? 1 : 0);
    // A partial publisher response is retained for audit only. It cannot overwrite the
    // latest usable state or trigger soft removal reconciliation.
    if (!input.complete) { db.exec('COMMIT'); return result; }
    const upsertProject = db.prepare(`INSERT INTO zap_projects(project_id,project_status_raw,project_status,public_status,app_filed_date,raw_json,first_snapshot_id,last_snapshot_id,possibly_removed)
      VALUES(?,?,?,?,?,?,?,?,0) ON CONFLICT(project_id) DO UPDATE SET project_status_raw=excluded.project_status_raw,project_status=excluded.project_status,public_status=excluded.public_status,app_filed_date=excluded.app_filed_date,raw_json=excluded.raw_json,last_snapshot_id=excluded.last_snapshot_id,possibly_removed=0`);
    for (const raw of input.projects) {
      const normalized = normalizeZapProject(raw);
      if ('reason' in normalized || seenProjects.has(normalized.projectId)) { result.rejectedProjects += 1; continue; }
      seenProjects.add(normalized.projectId); result.acceptedProjects += 1;
      upsertProject.run(normalized.projectId, normalized.rawStatus, normalized.status, normalized.publicStatus, normalized.appFiledDate, JSON.stringify(normalized.raw), input.snapshotId, input.snapshotId);
    }
    const upsertParcel = db.prepare(`INSERT INTO zap_parcels(bbl,lat,lng,h3_cell,raw_json,snapshot_id) VALUES(?,?,?,?,?,?)
      ON CONFLICT(bbl) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,h3_cell=excluded.h3_cell,raw_json=excluded.raw_json,snapshot_id=excluded.snapshot_id`);
    for (const raw of input.parcels) {
      const normalized = normalizePlutoParcel(raw); if ('reason' in normalized) continue;
      result.acceptedParcels += 1; if (!normalized.h3Cell) result.nullCoordinateParcels += 1;
      upsertParcel.run(normalized.bbl, normalized.lat, normalized.lng, normalized.h3Cell, JSON.stringify(normalized.raw), input.snapshotId);
    }
    const upsertBbl = db.prepare(`INSERT INTO zap_project_bbls(association_id,project_id,bbl,validated,raw_json,first_snapshot_id,last_snapshot_id,possibly_removed)
      VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(association_id) DO UPDATE SET raw_json=excluded.raw_json,last_snapshot_id=excluded.last_snapshot_id,possibly_removed=0`);
    for (const raw of input.bbls) {
      const normalized = normalizeZapBbl(raw);
      if ('reason' in normalized) { result.invalidValidatedBblRows += 1; continue; }
      if (!seenProjects.has(normalized.projectId)) { result.orphanBblRows += 1; continue; }
      if (normalized.validated) result.validatedBblRows += 1; else result.unvalidatedBblRows += 1;
      const key = associationId(normalized.projectId, normalized.bbl, normalized.raw);
      if (seenAssociations.has(key)) continue;
      seenAssociations.add(key);
      upsertBbl.run(key, normalized.projectId, normalized.bbl, normalized.validated ? 1 : 0, JSON.stringify(normalized.raw), input.snapshotId, input.snapshotId);
    }
    if (result.orphanBblRows) db.prepare("INSERT INTO zap_rejections(snapshot_id,kind,row_count) VALUES(?,?,?)").run(input.snapshotId, 'ORPHAN_BBL', result.orphanBblRows);
    if (input.complete) {
      db.prepare('UPDATE zap_projects SET possibly_removed = 1 WHERE last_snapshot_id <> ?').run(input.snapshotId);
      db.prepare('UPDATE zap_project_bbls SET possibly_removed = 1 WHERE last_snapshot_id <> ?').run(input.snapshotId);
    }
    db.prepare('DELETE FROM zap_project_cells').run();
    db.prepare(`INSERT INTO zap_project_cells(project_id,h3_cell,precision,snapshot_id)
      SELECT DISTINCT b.project_id, p.h3_cell, 'PARCEL_CENTROID', ? FROM zap_project_bbls b
      JOIN zap_projects project ON project.project_id = b.project_id
      JOIN zap_parcels p ON p.bbl = b.bbl
      WHERE b.validated = 1 AND b.possibly_removed = 0 AND project.possibly_removed = 0 AND p.h3_cell IS NOT NULL`).run(input.snapshotId);
    result.placedProjectCells = (db.prepare('SELECT COUNT(*) AS n FROM zap_project_cells').get() as { n: number }).n;
    result.unmappedValidatedBblRows = (db.prepare(`SELECT COUNT(*) AS n FROM zap_project_bbls b
      LEFT JOIN zap_parcels p ON p.bbl = b.bbl WHERE b.validated = 1 AND b.possibly_removed = 0 AND (p.bbl IS NULL OR p.h3_cell IS NULL)`).get() as { n: number }).n;
    db.exec('COMMIT'); return result;
  } catch (error) { try { db.exec('ROLLBACK'); } catch { /* no-op */ } throw error; }
}

function sourcesFor(db: DatabaseSync): ZapSourceMetadata[] {
  const row = db.prepare('SELECT snapshot_id,retrieved_at,project_updated_at,bbl_updated_at,pluto_updated_at FROM zap_snapshots WHERE complete = 1 ORDER BY retrieved_at DESC LIMIT 1').get() as { snapshot_id: string; retrieved_at: string; project_updated_at: string | null; bbl_updated_at: string | null; pluto_updated_at: string | null } | undefined;
  if (!row) return [];
  const metadata = (source: ZapSourceMetadata['source'], datasetId: ZapSourceMetadata['datasetId'], datasetUrl: string, publisherUpdatedAt: string | null): ZapSourceMetadata => ({ source, datasetId, datasetUrl, publisherUpdatedAt, retrievedAt: row.retrieved_at, snapshotId: row.snapshot_id, caveat: 'Publisher data is a current mutable snapshot. Change history is unavailable until two complete local snapshots are compared.' });
  return [metadata('NYC_ZAP_PROJECT_DATA', 'hgx4-8ukb', PROJECT_DATASET, row.project_updated_at), metadata('NYC_ZAP_BBL', '2iga-a6mk', BBL_DATASET, row.bbl_updated_at), metadata('NYC_PLUTO', '64uk-42ks', PLUTO_DATASET, row.pluto_updated_at)];
}
function coverageFor(db: DatabaseSync, window: ZapWindow): ZapCoverage {
  const project = db.prepare('SELECT COUNT(*) AS allCount, SUM(CASE WHEN app_filed_date IS NOT NULL THEN 1 ELSE 0 END) AS filed, SUM(CASE WHEN possibly_removed = 1 THEN 1 ELSE 0 END) AS removed FROM zap_projects').get() as { allCount: number; filed: number | null; removed: number | null };
  const filter = windowWhere(window);
  const included = (db.prepare(`SELECT COUNT(*) AS n FROM zap_projects WHERE possibly_removed = 0${filter.clause}`).get(...filter.params) as { n: number }).n;
  const bbl = db.prepare(`SELECT SUM(CASE WHEN validated=1 AND possibly_removed=0 THEN 1 ELSE 0 END) AS validated, SUM(CASE WHEN validated=0 AND possibly_removed=0 THEN 1 ELSE 0 END) AS unvalidated, SUM(CASE WHEN possibly_removed=1 THEN 1 ELSE 0 END) AS removed FROM zap_project_bbls`).get() as { validated: number | null; unvalidated: number | null; removed: number | null };
  const unmatched = (db.prepare(`SELECT COUNT(*) AS n FROM zap_project_bbls b LEFT JOIN zap_parcels p ON p.bbl=b.bbl WHERE b.validated=1 AND b.possibly_removed=0 AND (p.bbl IS NULL OR p.h3_cell IS NULL)`).get() as { n: number }).n;
  const nullCoordinates = (db.prepare('SELECT COUNT(*) AS n FROM zap_parcels WHERE h3_cell IS NULL').get() as { n: number }).n;
  const placed = (db.prepare('SELECT COUNT(*) AS n FROM zap_project_cells').get() as { n: number }).n;
  const completeSnapshots = (db.prepare('SELECT COUNT(*) AS n FROM zap_snapshots WHERE complete = 1').get() as { n: number }).n;
  const latestComplete = db.prepare('SELECT snapshot_id FROM zap_snapshots WHERE complete = 1 ORDER BY retrieved_at DESC LIMIT 1').get() as { snapshot_id?: string } | undefined;
  const orphan = latestComplete?.snapshot_id ? (db.prepare("SELECT row_count AS n FROM zap_rejections WHERE snapshot_id = ? AND kind = 'ORPHAN_BBL'").get(latestComplete.snapshot_id) as { n?: number } | undefined)?.n ?? 0 : 0;
  const filed = project.filed ?? 0;
  return { window, allTrackedProjects: project.allCount, includedProjects: included, projectsWithAppFiledDate: filed, missingAppFiledDate: project.allCount - filed, filedDateCoverage: project.allCount ? filed / project.allCount : null, validatedBblRows: bbl.validated ?? 0, unvalidatedBblRows: bbl.unvalidated ?? 0, unmatchedParcelRows: unmatched, nullCoordinateParcelRows: nullCoordinates, placedProjectCells: placed, possiblyRemovedProjects: project.removed ?? 0, possiblyRemovedBblRows: bbl.removed ?? 0, orphanBblRows: orphan, changeHistoryAvailable: completeSnapshots >= 2, caveats: ['ZAP is a separate entitlement-stage layer and does not affect permit ranking.', 'FILED_24_MONTHS is restricted to rows with app_filed_date and must disclose filed-date coverage.', 'PLUTO placement uses parcel centroids at H3 resolution 8; large parcels may span more than one cell.', 'Missing source associations are soft flagged as POSSIBLY_REMOVED until publisher-history behavior is observed.'] };
}
function countsFor(db: DatabaseSync, window: ZapWindow, cell?: string): ZapProjectCount {
  const filter = windowWhere(window); const cellJoin = cell ? ' JOIN zap_project_cells cells ON cells.project_id = project.project_id AND cells.h3_cell = ?' : '';
  const rows = db.prepare(`SELECT project.project_status FROM zap_projects project${cellJoin} WHERE project.possibly_removed=0${filter.clause}`).all(...(cell ? [cell, ...filter.params] : filter.params)) as Array<{ project_status: ZapProjectStatus }>;
  return { projectCount: rows.length, statusCounts: countStatuses(rows) };
}
export function zapSummaryFor(db: DatabaseSync, window: ZapWindow = 'ALL_RECORDS'): ZapSummaryData { return { window, counts: countsFor(db, window), coverage: coverageFor(db, window), sources: sourcesFor(db), permitRankingTreatment: 'SEPARATE_ENTITLEMENT_LAYER' }; }
export function zapCellsFor(db: DatabaseSync, window: ZapWindow = 'ALL_RECORDS'): ZapCellCount[] {
  const filter = windowWhere(window); const rows = db.prepare(`SELECT cells.h3_cell, project.project_status FROM zap_project_cells cells JOIN zap_projects project ON project.project_id=cells.project_id WHERE project.possibly_removed=0${filter.clause} ORDER BY cells.h3_cell`).all(...filter.params) as Array<{ h3_cell: string; project_status: ZapProjectStatus }>;
  const grouped = new Map<string, Array<{ project_status: ZapProjectStatus }>>(); for (const row of rows) grouped.set(row.h3_cell, [...(grouped.get(row.h3_cell) ?? []), row]);
  return [...grouped.entries()].map(([h3Cell, items]) => ({ h3Cell, precision: 'PARCEL_CENTROID' as const, ...{ projectCount: items.length, statusCounts: countStatuses(items) } })).sort((a, b) => b.projectCount - a.projectCount || a.h3Cell.localeCompare(b.h3Cell));
}
