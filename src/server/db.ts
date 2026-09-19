import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const databasePath = process.env.RADAR_DB_PATH ?? resolve('data/runtime/radar.sqlite');

export function openDatabase(): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  return database;
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
