import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath = process.env.RADAR_DB_PATH ?? resolve('data/runtime/radar.sqlite');
const manifest = JSON.parse(readFileSync('data/demo/manifest.json', 'utf8'));
for (const file of ['data/demo/chicago.jsonl', 'data/demo/nyc.jsonl', 'data/demo/sba504.jsonl']) if (!existsSync(file)) throw new Error(`${file} is missing. Run npm.cmd run data:fixture.`);
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
try {
  db.exec('PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS datasets (dataset_id TEXT PRIMARY KEY, imported_at TEXT NOT NULL, manifest_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS bootstrap_rows (source TEXT NOT NULL, payload_json TEXT NOT NULL); BEGIN');
  db.prepare('DELETE FROM bootstrap_rows').run(); db.prepare('DELETE FROM datasets').run();
  db.prepare('INSERT INTO datasets (dataset_id, imported_at, manifest_json) VALUES (?, ?, ?)').run(manifest.id, new Date().toISOString(), JSON.stringify(manifest));
  for (const [source, file] of [['CHICAGO_PERMIT', 'data/demo/chicago.jsonl'], ['NYC_PERMIT', 'data/demo/nyc.jsonl'], ['SBA_504', 'data/demo/sba504.jsonl']]) for (const line of readFileSync(file, 'utf8').trim().split(/\r?\n/)) db.prepare('INSERT INTO bootstrap_rows (source, payload_json) VALUES (?, ?)').run(source, line);
  db.exec('COMMIT'); console.log(`Seeded ${manifest.id}.`);
} catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; } finally { db.close(); }

