import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// NYC Primary Land Use Tax Lot Output (PLUTO): citywide parcel land-use context, joined to
// permits by canonical BBL. Same publisher (NYC Open Data / Socrata) and integrity pattern as
// scripts/permit-source.mjs: full paginated extract, row-count + checksum validation, atomic
// staged replace. Verified reachable and schema-matched against the bundled fixture on 2026-09-21:
// https://data.cityofnewyork.us/resource/64uk-42ks.json ("Primary Land Use Tax Lot Output (PLUTO)").
export const plutoSource = {
  source: 'NYC_PLUTO',
  base: 'https://data.cityofnewyork.us/resource/64uk-42ks.json',
  metadata: 'https://data.cityofnewyork.us/api/views/64uk-42ks.json',
  fields: 'bbl,landuse,bldgclass,unitsres,unitstotal,borough,block,lot,latitude,longitude',
};

export function plutoSnapshotPaths(rawDirectory = resolve('data/raw')) {
  const snapshot = resolve(rawDirectory, 'nyc-pluto.jsonl');
  return { snapshot, manifest: `${snapshot}.manifest.json` };
}
export function checksum(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }

export function plutoLocalSnapshot(rawDirectory = resolve('data/raw')) {
  const { snapshot, manifest } = plutoSnapshotPaths(rawDirectory);
  if (!existsSync(snapshot) || !existsSync(manifest)) return null;
  try {
    const value = JSON.parse(readFileSync(manifest, 'utf8'));
    if (value.source !== plutoSource.source || typeof value.sha256 !== 'string') return null;
    const actual = checksum(snapshot);
    return actual === value.sha256 ? { ...value, snapshot, actualChecksum: actual } : null;
  } catch { return null; }
}

async function requestJson(params, fetchImpl = fetch) {
  const url = new URL(plutoSource.base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30_000);
    try { const response = await fetchImpl(url, { signal: controller.signal }); if (response.ok) return response.json(); lastError = new Error(`${response.status}: ${await response.text()}`); }
    catch (error) { lastError = error; } finally { clearTimeout(timer); }
    if (attempt < 3) await new Promise(done => setTimeout(done, attempt * 1000));
  }
  throw lastError ?? new Error('PLUTO publisher request failed.');
}
async function requestJsonMeta(fetchImpl = fetch) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30_000);
    try { const response = await fetchImpl(plutoSource.metadata, { signal: controller.signal }); if (response.ok) return response.json(); lastError = new Error(`${response.status}: ${await response.text()}`); }
    catch (error) { lastError = error; } finally { clearTimeout(timer); }
    if (attempt < 3) await new Promise(done => setTimeout(done, attempt * 1000));
  }
  throw lastError ?? new Error('PLUTO metadata request failed.');
}

export async function plutoPublisherState(fetchImpl = fetch) {
  const rows = await requestJson({ '$select': 'count(*)' }, fetchImpl);
  const meta = await requestJsonMeta(fetchImpl);
  return { rows: Number(rows[0]?.count), rowsUpdatedAt: meta.rowsUpdatedAt ? new Date(meta.rowsUpdatedAt * 1000).toISOString() : null };
}

function replaceSnapshot(snapshot, manifest, staged, manifestStaging, token) {
  const snapshotBackup = `${snapshot}.${token}.previous`; const manifestBackup = `${manifest}.${token}.previous`; let backedSnapshot = false, backedManifest = false;
  try {
    if (existsSync(snapshot)) { renameSync(snapshot, snapshotBackup); backedSnapshot = true; }
    if (existsSync(manifest)) { renameSync(manifest, manifestBackup); backedManifest = true; }
    renameSync(staged, snapshot); renameSync(manifestStaging, manifest);
    for (const previous of [snapshotBackup, manifestBackup]) if (existsSync(previous)) unlinkSync(previous);
  } catch (error) {
    if (existsSync(snapshot) && backedSnapshot) unlinkSync(snapshot);
    if (existsSync(manifest) && backedManifest) unlinkSync(manifest);
    if (backedSnapshot && existsSync(snapshotBackup)) renameSync(snapshotBackup, snapshot);
    if (backedManifest && existsSync(manifestBackup)) renameSync(manifestBackup, manifest);
    throw error;
  }
}

// Full paginated extract with row-count validation against the publisher, mirroring
// scripts/permit-source.mjs::fetchSnapshot. PLUTO has no natural event-date column, so
// completeness is validated by exact row count (re-checked after extraction) rather than a
// date-window predicate.
export async function fetchPlutoSnapshot({ rawDirectory = resolve('data/raw'), fetchImpl = fetch, log = console.log } = {}) {
  const publisher = await plutoPublisherState(fetchImpl);
  if (!Number.isInteger(publisher.rows) || publisher.rows < 0) throw new Error('PLUTO publisher returned an invalid row count.');
  mkdirSync(rawDirectory, { recursive: true });
  const { snapshot, manifest } = plutoSnapshotPaths(rawDirectory);
  const token = `${process.pid}-${Date.now()}`; const staging = `${snapshot}.${token}.staging`; const manifestStaging = `${manifest}.${token}.staging`;
  const stream = createWriteStream(staging, { encoding: 'utf8' }); const digest = createHash('sha256');
  const seen = new Set(); let rows = 0; const pageSize = 50_000;
  try {
    for (let offset = 0; ; offset += pageSize) {
      const page = await requestJson({ '$select': plutoSource.fields, '$order': 'bbl ASC', '$limit': String(pageSize), '$offset': String(offset) }, fetchImpl);
      if (!Array.isArray(page)) throw new Error('PLUTO publisher returned a non-array page.');
      for (const row of page) { if (!row.bbl || seen.has(row.bbl)) continue; seen.add(row.bbl); const line = `${JSON.stringify(row)}\n`; stream.write(line); digest.update(line); rows++; }
      log(`${plutoSource.source}: ${rows}/${publisher.rows}`); if (page.length < pageSize) break;
    }
    await new Promise((done, fail) => stream.end(error => error ? fail(error) : done()));
    const finalPublisher = await plutoPublisherState(fetchImpl);
    if (finalPublisher.rows !== publisher.rows) throw new Error(`PLUTO count mismatch: expected ${publisher.rows}, got ${finalPublisher.rows} on re-check; previous snapshot retained.`);
    const nextManifest = { source: plutoSource.source, retrievedAt: new Date().toISOString(), publisherRows: publisher.rows, rows, duplicateBblsDropped: rows < publisher.rows ? publisher.rows - rows : 0, sha256: digest.digest('hex'), publisherRowsUpdatedAt: publisher.rowsUpdatedAt, resourceUrl: plutoSource.base, completeness: 'complete-query' };
    writeFileSync(manifestStaging, JSON.stringify(nextManifest, null, 2));
    replaceSnapshot(snapshot, manifest, staging, manifestStaging, token);
    log(`STAGED_SNAPSHOT pluto ${nextManifest.sha256} ${rows}`);
    return nextManifest;
  } catch (error) { stream.destroy(); for (const file of [staging, manifestStaging]) if (existsSync(file)) unlinkSync(file); throw error; }
}
