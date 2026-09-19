import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync('data/demo/manifest.json', 'utf8'));
if (manifest.mode !== 'synthetic') throw new Error('Bootstrap expects explicitly synthetic data.');
const db = new DatabaseSync(process.env.RADAR_DB_PATH ?? resolve('data/runtime/radar.sqlite'));
try {
  const row = db.prepare('SELECT dataset_id AS datasetId FROM datasets LIMIT 1').get();
  if (row?.datasetId !== manifest.id) throw new Error('The local database is not seeded with the bundled demo manifest.');
  console.log(`Verified explicitly synthetic bootstrap dataset: ${manifest.id}`);
} finally { db.close(); }
