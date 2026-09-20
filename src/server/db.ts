import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const databasePath = process.env.RADAR_DB_PATH ?? resolve('data/runtime/radar.sqlite');

export function openDatabase(): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  // Existing permit databases predate the optional ZAP tables.  Schema creation is
  // idempotent, so every reader gets the additive entitlement foundation safely.
  createSchema(database);
  return database;
}

export function createSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS datasets (dataset_id TEXT PRIMARY KEY, imported_at TEXT NOT NULL, manifest_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS permits (
      id TEXT PRIMARY KEY, market TEXT NOT NULL, source TEXT NOT NULL, source_record_id TEXT NOT NULL, event_date TEXT NOT NULL,
      permit_number TEXT, permit_type TEXT NOT NULL, reported_cost_cents INTEGER, address TEXT, description TEXT, community_area TEXT,
      lat REAL, lng REAL, h3_cell TEXT, raw_json TEXT NOT NULL, warnings_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS permits_market_cell_date ON permits(market, h3_cell, event_date);
    CREATE INDEX IF NOT EXISTS permits_market_cell_date_cost_address ON permits(market, h3_cell, event_date, reported_cost_cents, address);
    CREATE INDEX IF NOT EXISTS permits_market_type_date ON permits(market, permit_type, event_date);
    CREATE INDEX IF NOT EXISTS permits_market_date_cell ON permits(market, event_date, h3_cell);
    CREATE TABLE IF NOT EXISTS permit_window_counts (
      market TEXT NOT NULL, period TEXT NOT NULL, total INTEGER NOT NULL, mapped INTEGER NOT NULL,
      PRIMARY KEY(market, period)
    );
    -- Property use is deliberately a separate, immutable enrichment. Permit rows
    -- retain source identity and source-coordinate placement regardless of join outcome.
    CREATE TABLE IF NOT EXISTS property_use_snapshots (
      snapshot_id TEXT PRIMARY KEY, permit_snapshot_sha256 TEXT NOT NULL, pluto_rows_updated_at TEXT,
      retrieved_at TEXT NOT NULL, manifest_json TEXT NOT NULL, complete INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pluto_property_use_parcels (
      snapshot_id TEXT NOT NULL, bbl TEXT NOT NULL, landuse_raw TEXT, bldgclass_raw TEXT,
      unitsres_raw TEXT, unitstotal_raw TEXT, borough_raw TEXT, block_raw TEXT, lot_raw TEXT,
      latitude_raw TEXT, longitude_raw TEXT, raw_json TEXT NOT NULL,
      PRIMARY KEY(snapshot_id, bbl), FOREIGN KEY(snapshot_id) REFERENCES property_use_snapshots(snapshot_id)
    );
    CREATE TABLE IF NOT EXISTS permit_property_use (
      permit_id TEXT NOT NULL, snapshot_id TEXT, canonical_bbl TEXT, category TEXT NOT NULL,
      provenance TEXT NOT NULL, confidence TEXT NOT NULL, reason TEXT, landuse_raw TEXT, bldgclass_raw TEXT,
      PRIMARY KEY(permit_id), FOREIGN KEY(permit_id) REFERENCES permits(id),
      FOREIGN KEY(snapshot_id) REFERENCES property_use_snapshots(snapshot_id)
    );
    CREATE INDEX IF NOT EXISTS permit_property_use_category ON permit_property_use(category, permit_id);
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY, market TEXT NOT NULL, event_date TEXT NOT NULL, borrower_name TEXT, approval_amount_cents INTEGER NOT NULL,
      loan_status TEXT, city TEXT NOT NULL, state TEXT NOT NULL, raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS approvals_market_date ON approvals(market, event_date);
    CREATE TABLE IF NOT EXISTS source_reports (source TEXT NOT NULL, market TEXT NOT NULL, report_json TEXT NOT NULL, PRIMARY KEY(source, market));
    CREATE TABLE IF NOT EXISTS zap_snapshots (
      snapshot_id TEXT PRIMARY KEY, retrieved_at TEXT NOT NULL, project_updated_at TEXT, bbl_updated_at TEXT, pluto_updated_at TEXT,
      project_rows INTEGER NOT NULL, bbl_rows INTEGER NOT NULL, pluto_rows INTEGER NOT NULL, complete INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS zap_projects (
      project_id TEXT PRIMARY KEY, project_status_raw TEXT, project_status TEXT NOT NULL, public_status TEXT, app_filed_date TEXT,
      raw_json TEXT NOT NULL, first_snapshot_id TEXT NOT NULL, last_snapshot_id TEXT NOT NULL, possibly_removed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS zap_project_bbls (
      association_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, bbl TEXT, validated INTEGER NOT NULL, raw_json TEXT NOT NULL,
      first_snapshot_id TEXT NOT NULL, last_snapshot_id TEXT NOT NULL, possibly_removed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(project_id) REFERENCES zap_projects(project_id)
    );
    CREATE TABLE IF NOT EXISTS zap_parcels (
      bbl TEXT PRIMARY KEY, lat REAL, lng REAL, h3_cell TEXT, raw_json TEXT NOT NULL, snapshot_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS zap_project_cells (
      project_id TEXT NOT NULL, h3_cell TEXT NOT NULL, precision TEXT NOT NULL, snapshot_id TEXT NOT NULL,
      PRIMARY KEY(project_id, h3_cell), FOREIGN KEY(project_id) REFERENCES zap_projects(project_id)
    );
    CREATE INDEX IF NOT EXISTS zap_project_cells_cell ON zap_project_cells(h3_cell);
    CREATE INDEX IF NOT EXISTS zap_projects_filed_date ON zap_projects(app_filed_date);
    CREATE TABLE IF NOT EXISTS zap_rejections (
      snapshot_id TEXT NOT NULL, kind TEXT NOT NULL, row_count INTEGER NOT NULL,
      PRIMARY KEY(snapshot_id, kind), FOREIGN KEY(snapshot_id) REFERENCES zap_snapshots(snapshot_id)
    );
    CREATE TABLE IF NOT EXISTS acris_snapshots (
      snapshot_id TEXT PRIMARY KEY, retrieved_at TEXT NOT NULL, master_updated_at TEXT, legals_updated_at TEXT, pluto_updated_at TEXT,
      master_rows INTEGER NOT NULL, legal_rows INTEGER NOT NULL, pluto_rows INTEGER NOT NULL, complete INTEGER NOT NULL, manifest_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS acris_documents (
      document_id TEXT PRIMARY KEY, recorded_date TEXT NOT NULL, document_date TEXT, raw_json TEXT NOT NULL, snapshot_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS acris_legal_associations (
      association_id TEXT PRIMARY KEY, document_id TEXT NOT NULL, bbl TEXT, easement TEXT NOT NULL, partial_lot TEXT NOT NULL, air_rights TEXT NOT NULL, subterranean_rights TEXT NOT NULL, raw_json TEXT NOT NULL,
      FOREIGN KEY(document_id) REFERENCES acris_documents(document_id)
    );
    CREATE TABLE IF NOT EXISTS acris_parcels (
      bbl TEXT PRIMARY KEY, lat REAL, lng REAL, h3_cell TEXT, raw_json TEXT NOT NULL, snapshot_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS acris_document_cells (
      document_id TEXT NOT NULL, h3_cell TEXT NOT NULL, precision TEXT NOT NULL, PRIMARY KEY(document_id,h3_cell), FOREIGN KEY(document_id) REFERENCES acris_documents(document_id)
    );
    CREATE TABLE IF NOT EXISTS acris_quality (snapshot_id TEXT NOT NULL, kind TEXT NOT NULL, value_json TEXT NOT NULL, PRIMARY KEY(snapshot_id,kind));
    CREATE INDEX IF NOT EXISTS acris_documents_recorded_date ON acris_documents(recorded_date);
    CREATE INDEX IF NOT EXISTS acris_document_cells_cell ON acris_document_cells(h3_cell);
  `);
}

export function seededDatasetId(): string | null {
  if (!existsSync(databasePath)) return null;
  const database = openDatabase();
  try {
    const result = database.prepare('SELECT dataset_id AS datasetId FROM datasets ORDER BY imported_at DESC LIMIT 1').get() as { datasetId?: string } | undefined;
    return result?.datasetId ?? null;
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export function seededMarkets(): Array<'CHICAGO' | 'NYC'> {
  if (!existsSync(databasePath)) return [];
  const database = openDatabase();
  try {
    const result = database.prepare('SELECT manifest_json AS manifestJson FROM datasets ORDER BY imported_at DESC LIMIT 1').get() as { manifestJson?: string } | undefined;
    const markets = result?.manifestJson ? JSON.parse(result.manifestJson).markets : [];
    return Array.isArray(markets) ? markets.filter((market): market is 'CHICAGO' | 'NYC' => market === 'CHICAGO' || market === 'NYC') : [];
  } catch { return []; } finally { database.close(); }
}
