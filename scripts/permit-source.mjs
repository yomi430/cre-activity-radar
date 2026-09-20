import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const coverage = { start: '2024-07-01', endExclusive: '2026-07-01' };
export const permitSources = {
  chicago: { source: 'CHICAGO_PERMIT', base: 'https://data.cityofchicago.org/resource/ydr8-5enu.json', date: 'issue_date', order: 'id ASC', fields: 'id,permit_,permit_type,permit_status,issue_date,work_type,reported_cost,latitude,longitude,community_area,street_number,street_direction,street_name,work_description', id: row => row.id },
  nyc: { source: 'NYC_DOB_NOW', base: 'https://data.cityofnewyork.us/resource/rbx6-tga4.json', date: 'issued_date', order: ':id ASC', fields: ':id as source_row_id,job_filing_number,work_permit,sequence_number,tracking_number,issued_date,permit_status,work_type,estimated_job_costs,latitude,longitude,house_no,street_name,borough,job_description,bbl', id: row => row.source_row_id },
};

export function snapshotPaths(market, rawDirectory = resolve('data/raw')) {
  if (!permitSources[market]) throw new Error('Usage: node scripts/fetch-permits.mjs <chicago|nyc>');
  const snapshot = resolve(rawDirectory, `${market}-permits-${coverage.start}_${coverage.endExclusive}.jsonl`);
  return { snapshot, manifest: `${snapshot}.manifest.json` };
}
export function checksum(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
export function localSnapshot(market, rawDirectory) {
  const { snapshot, manifest } = snapshotPaths(market, rawDirectory);
  if (!existsSync(snapshot) || !existsSync(manifest)) return null;
  try {
    const value = JSON.parse(readFileSync(manifest, 'utf8'));
    if (value.coverageStart !== coverage.start || value.coverageEndExclusive !== coverage.endExclusive || typeof value.sha256 !== 'string') return null;
    const actual = checksum(snapshot);
    return actual === value.sha256 ? { ...value, actualChecksum: actual } : null;
  } catch { return null; }
}
export function publisherMatchesSnapshot(publisher, snapshot) {
  return Boolean(snapshot && publisher && publisher.rows === snapshot.rows && publisher.latestEventDate === (snapshot.publisherLatestEventDate ?? null));
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
function whereFor(config) { return `${config.date} >= '${coverage.start}T00:00:00' AND ${config.date} < '${coverage.endExclusive}T00:00:00'`; }
export async function requestJson(config, params, fetchImpl = fetch) {
  const url = new URL(config.base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30_000);
    try { const response = await fetchImpl(url, { signal: controller.signal }); if (response.ok) return response.json(); lastError = new Error(`${response.status}: ${await response.text()}`); } catch (error) { lastError = error; } finally { clearTimeout(timer); }
    if (attempt < 3) await new Promise(done => setTimeout(done, attempt * 1000));
  }
  throw lastError ?? new Error('Publisher request failed.');
}
export async function publisherState(market, fetchImpl = fetch) {
  const config = permitSources[market]; if (!config) throw new Error('Unknown market.'); const where = whereFor(config);
  const rows = await requestJson(config, { '$select': 'count(*)', '$where': where }, fetchImpl);
  const dates = await requestJson(config, { '$select': `max(${config.date}) as latest_event_date`, '$where': where }, fetchImpl);
  const published = await requestJson(config, { '$select': `max(${config.date}) as latest_published_date` }, fetchImpl);
  return { rows: Number(rows[0]?.count), latestEventDate: dates[0]?.latest_event_date?.slice(0, 10) ?? null, latestPublishedDate: published[0]?.latest_published_date?.slice(0, 10) ?? null };
}
export async function fetchSnapshot(market, { rawDirectory = resolve('data/raw'), fetchImpl = fetch, log = console.log } = {}) {
  const config = permitSources[market]; if (!config) throw new Error('Unknown market.'); const publisher = await publisherState(market, fetchImpl);
  if (!Number.isInteger(publisher.rows) || publisher.rows < 0) throw new Error('Publisher returned an invalid row count.');
  mkdirSync(rawDirectory, { recursive: true }); const { snapshot, manifest } = snapshotPaths(market, rawDirectory); const token = `${process.pid}-${Date.now()}`; const staging = `${snapshot}.${token}.staging`; const manifestStaging = `${manifest}.${token}.staging`;
  const stream = createWriteStream(staging, { encoding: 'utf8' }); const digest = createHash('sha256'); const ids = new Set(); let rows = 0;
  try {
    const where = whereFor(config); const pageSize = market === 'nyc' ? 5_000 : 50_000;
    for (let offset = 0; ; offset += pageSize) {
      const page = await requestJson(config, { '$select': config.fields, '$where': where, '$order': config.order, '$limit': String(pageSize), '$offset': String(offset) }, fetchImpl);
      if (!Array.isArray(page)) throw new Error('Publisher returned a non-array page.');
      for (const row of page) { const id = config.id(row); if (!id || ids.has(id)) throw new Error(`duplicate or missing source identity: ${id}`); ids.add(id); const line = `${JSON.stringify(row)}\n`; stream.write(line); digest.update(line); rows++; }
      log(`${config.source}: ${rows}/${publisher.rows}`); if (page.length < pageSize) break;
    }
    await new Promise((done, fail) => stream.end(error => error ? fail(error) : done()));
    if (rows !== publisher.rows) throw new Error(`count mismatch: expected ${publisher.rows}, got ${rows}`);
    const finalPublisher = await publisherState(market, fetchImpl);
    if (finalPublisher.rows !== publisher.rows || finalPublisher.latestEventDate !== publisher.latestEventDate) throw new Error('source changed during extraction; previous snapshot was retained');
    const nextManifest = { source: config.source, retrievedAt: new Date().toISOString(), coverageStart: coverage.start, coverageEndExclusive: coverage.endExclusive, expectedRows: rows, rows, sha256: digest.digest('hex'), publisherLatestEventDate: publisher.latestEventDate, publisherLatestPublishedDate: publisher.latestPublishedDate, resourceUrl: config.base, completeness: 'complete-query' };
    writeFileSync(manifestStaging, JSON.stringify(nextManifest, null, 2)); replaceSnapshot(snapshot, manifest, staging, manifestStaging, token); log(`STAGED_SNAPSHOT ${market} ${nextManifest.sha256} ${rows}`); return nextManifest;
  } catch (error) { stream.destroy(); for (const file of [staging, manifestStaging]) if (existsSync(file)) unlinkSync(file); throw error; }
}
