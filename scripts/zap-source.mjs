import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Official NYC Open Data resources.  Only fields used by the local join are retained. */
export const zapSources = {
  projects: { id: 'hgx4-8ukb', source: 'NYC_ZAP_PROJECT_DATA', fields: 'project_id,project_status,public_status,app_filed_date', order: 'project_id ASC' },
  bbls: { id: '2iga-a6mk', source: 'NYC_ZAP_BBL', fields: 'project_id,bbl,validated,validated_borough,validated_block,validated_lot', order: 'project_id ASC,bbl ASC' },
  pluto: { id: '64uk-42ks', source: 'NYC_PLUTO', fields: 'bbl,latitude,longitude', order: 'bbl ASC' },
};
for (const value of Object.values(zapSources)) value.base = `https://data.cityofnewyork.us/resource/${value.id}.json`;

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fileHash = path => sha256(readFileSync(path));
const safePart = value => String(value ?? 'unknown').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'unknown';
const canonicalBbl = value => {
  const source = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)(?:\.0+)?$/.exec(source); if (!match) return null;
  try { const integer = BigInt(match[1]); return integer > 0n && integer <= 9_999_999_999n ? integer.toString().padStart(10, '0') : null; } catch { return null; }
};
export { canonicalBbl };

export function zapSnapshotPaths(rawDirectory = resolve('data/raw')) {
  const root = resolve(rawDirectory, 'zap');
  return { root, snapshots: resolve(root, 'snapshots'), latest: resolve(root, 'latest.json') };
}
export function zapSnapshotAt(directory) {
  try {
    const manifestPath = resolve(directory, 'manifest.json'); if (!existsSync(manifestPath)) return null;
    const manifest = json(manifestPath);
    if (!manifest.snapshotId || !manifest.complete || !manifest.files) return null;
    for (const name of ['projects', 'bbls', 'pluto']) {
      const item = manifest.files[name], path = resolve(directory, item?.file ?? '');
      if (!item || !existsSync(path) || fileHash(path) !== item.sha256) return null;
    }
    return { ...manifest, directory };
  } catch { return null; }
}
export function zapLocalSnapshot(rawDirectory) {
  const paths = zapSnapshotPaths(rawDirectory);
  if (!existsSync(paths.latest)) return null;
  try { const pointer = json(paths.latest); const snapshot = zapSnapshotAt(resolve(paths.snapshots, String(pointer.snapshotId))); return snapshot?.snapshotId === pointer.snapshotId ? snapshot : null; } catch { return null; }
}
export function zapStoredSnapshots(rawDirectory = resolve('data/raw')) {
  const paths = zapSnapshotPaths(rawDirectory); if (!existsSync(paths.snapshots)) return [];
  return readdirSync(paths.snapshots, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => zapSnapshotAt(resolve(paths.snapshots, entry.name))).filter(Boolean).sort((left, right) => `${left.retrievedAt}\u0000${left.snapshotId}`.localeCompare(`${right.retrievedAt}\u0000${right.snapshotId}`));
}
/** Returns retained history only through an explicitly selected snapshot. This prevents
 * an immutable extraction that failed database validation from becoming active later. */
export function zapStoredSnapshotsThrough(rawDirectory, target) {
  const stored = zapStoredSnapshots(rawDirectory); const index = stored.findIndex(snapshot => snapshot.snapshotId === target?.snapshotId);
  if (index >= 0) return stored.slice(0, index + 1);
  if (!target) return [];
  return [...stored.filter(snapshot => `${snapshot.retrievedAt}\u0000${snapshot.snapshotId}` <= `${target.retrievedAt}\u0000${target.snapshotId}`), target].sort((left, right) => `${left.retrievedAt}\u0000${left.snapshotId}`.localeCompare(`${right.retrievedAt}\u0000${right.snapshotId}`));
}

export async function requestJson(base, params = {}, fetchImpl = fetch) {
  const url = new URL(base); for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30_000);
    try { const response = await fetchImpl(url, { signal: controller.signal }); if (response.ok) return await response.json(); lastError = new Error(`${response.status}: ${await response.text()}`); } catch (error) { lastError = error; } finally { clearTimeout(timer); }
    if (attempt < 3) await new Promise(done => setTimeout(done, attempt * 500));
  }
  throw lastError ?? new Error('NYC Open Data request failed.');
}
async function metadata(source, fetchImpl) {
  const response = await requestJson(`https://data.cityofnewyork.us/api/views/${source.id}`, {}, fetchImpl);
  const rows = Number(response.rowsUpdatedAt === undefined ? NaN : response?.metadata?.custom_fields?.DataLens?.rows); // Metadata row count is not stable across Socrata views.
  return { id: source.id, source: source.source, rowsUpdatedAt: typeof response.rowsUpdatedAt === 'number' ? response.rowsUpdatedAt : null, metadataRows: Number.isSafeInteger(rows) ? rows : null, apiUpdatedAt: response.rowsUpdatedAt ? new Date(response.rowsUpdatedAt * 1000).toISOString() : null };
}
export async function zapPublisherState(fetchImpl = fetch) {
  const [projects, bbls, pluto] = await Promise.all(Object.values(zapSources).map(source => metadata(source, fetchImpl)));
  return { projects, bbls, pluto };
}
export function zapPublisherMatchesSnapshot(publisher, snapshot) {
  return Boolean(snapshot && publisher && ['projects', 'bbls', 'pluto'].every(name => publisher[name]?.rowsUpdatedAt !== null && publisher[name]?.rowsUpdatedAt === snapshot.publisher?.[name]?.rowsUpdatedAt));
}
async function countFor(source, where, fetchImpl) {
  const rows = await requestJson(source.base, { '$select': 'count(*) AS count', ...(where ? { '$where': where } : {}) }, fetchImpl);
  const count = Number(rows?.[0]?.count); if (!Number.isSafeInteger(count) || count < 0) throw new Error(`${source.source} returned invalid count.`); return count;
}
async function pagedRows(source, { where, fetchImpl, pageSize = 5_000, log }) {
  const expectedRows = await countFor(source, where, fetchImpl); const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await requestJson(source.base, { '$select': source.fields, ...(where ? { '$where': where } : {}), '$order': source.order, '$limit': pageSize, '$offset': offset }, fetchImpl);
    if (!Array.isArray(page)) throw new Error(`${source.source} returned a non-array page.`);
    rows.push(...page); log?.(`${source.source}: ${rows.length}/${expectedRows}`);
    if (page.length < pageSize) break;
  }
  if (rows.length !== expectedRows) throw new Error(`${source.source} completeness mismatch: expected ${expectedRows}, got ${rows.length}.`);
  return { rows, expectedRows };
}
function sqlBbl(value) { return String(BigInt(value)); }
async function plutoRows(bbls, fetchImpl, log) {
  const unique = [...new Set(bbls.map(canonicalBbl).filter(Boolean))]; const rows = []; let expectedRows = 0;
  // Keep URLs and Socrata IN clauses bounded. PLUTO is queried only for BBLs named
  // by ZAP, rather than downloading the entire citywide parcel table.
  for (let index = 0; index < unique.length; index += 350) {
    const batch = unique.slice(index, index + 350); const where = `bbl IN (${batch.map(sqlBbl).join(',')})`;
    const result = await pagedRows(zapSources.pluto, { where, fetchImpl, pageSize: 2_000, log });
    rows.push(...result.rows); expectedRows += result.expectedRows;
  }
  const identities = new Set(); for (const row of rows) { const bbl = canonicalBbl(row.bbl); if (!bbl || identities.has(bbl)) throw new Error(`NYC_PLUTO duplicate or invalid BBL identity: ${row.bbl}`); identities.add(bbl); }
  return { rows, expectedRows, requestedBbls: unique.length };
}
function writeJsonl(path, rows) { const content = rows.map(row => `${JSON.stringify(row)}\n`).join(''); writeFileSync(path, content); return { file: path.split(/[\\/]/).pop(), rows: rows.length, sha256: sha256(content) }; }
function replacePointer(paths, pointer) { const staged = `${paths.latest}.${process.pid}-${Date.now()}.staging`; writeFileSync(staged, JSON.stringify(pointer, null, 2)); renameSync(staged, paths.latest); }

/** Fetches a complete, immutable snapshot. Failure only removes its private staging dir. */
export function activateZapSnapshot(snapshot, rawDirectory = resolve('data/raw')) {
  const paths = zapSnapshotPaths(rawDirectory); const directory = resolve(paths.snapshots, snapshot.snapshotId);
  if (!existsSync(resolve(directory, 'manifest.json'))) throw new Error(`Cannot activate missing immutable ZAP snapshot ${snapshot.snapshotId}.`);
  replacePointer(paths, { snapshotId: snapshot.snapshotId, updatedAt: new Date().toISOString() });
}
export function restoreZapPointer(pointerText, rawDirectory = resolve('data/raw')) {
  const paths = zapSnapshotPaths(rawDirectory);
  if (pointerText === null) { if (existsSync(paths.latest)) rmSync(paths.latest, { force: true }); return; }
  const staged = `${paths.latest}.${process.pid}-${Date.now()}.restore`; writeFileSync(staged, pointerText); renameSync(staged, paths.latest);
}

export async function fetchZapSnapshot({ rawDirectory = resolve('data/raw'), fetchImpl = fetch, log = console.log, activate = true } = {}) {
  const before = await zapPublisherState(fetchImpl); log('STAGE FETCHING_ZAP_PROJECTS');
  const projects = await pagedRows(zapSources.projects, { fetchImpl, log });
  const projectIds = new Set(); for (const row of projects.rows) { const id = typeof row.project_id === 'string' ? row.project_id.trim() : ''; if (!id || projectIds.has(id)) throw new Error(`NYC_ZAP_PROJECT_DATA duplicate or missing project_id: ${id || 'missing'}`); projectIds.add(id); }
  log('STAGE FETCHING_ZAP_BBLS'); const bbls = await pagedRows(zapSources.bbls, { fetchImpl, log });
  for (const row of bbls.rows) if (!(typeof row.project_id === 'string' && projectIds.has(row.project_id.trim()))) throw new Error(`NYC_ZAP_BBL references unknown project_id: ${String(row.project_id)}`);
  log('STAGE FETCHING_ZAP_PLUTO'); const pluto = await plutoRows(bbls.rows.map(row => row.bbl), fetchImpl, log);
  const after = await zapPublisherState(fetchImpl);
  if (!['projects', 'bbls', 'pluto'].every(name => before[name].rowsUpdatedAt !== null && before[name].rowsUpdatedAt === after[name].rowsUpdatedAt)) throw new Error('NYC ZAP publisher changed during extraction; no snapshot was activated.');
  const digest = sha256(JSON.stringify({ projects: projects.rows, bbls: bbls.rows, pluto: pluto.rows }));
  const snapshotId = `zap-${safePart(before.projects.rowsUpdatedAt)}-${safePart(before.bbls.rowsUpdatedAt)}-${safePart(before.pluto.rowsUpdatedAt)}-${digest.slice(0, 12)}`;
  const paths = zapSnapshotPaths(rawDirectory); mkdirSync(paths.snapshots, { recursive: true }); const finalDir = resolve(paths.snapshots, snapshotId);
  if (existsSync(finalDir)) {
    const manifest = json(resolve(finalDir, 'manifest.json'));
    if (manifest.snapshotId !== snapshotId) throw new Error(`Refusing to overwrite immutable ZAP snapshot ${snapshotId}.`);
    const existing = { ...manifest, directory: finalDir }; if (activate) activateZapSnapshot(existing, rawDirectory); return existing;
  }
  const staging = resolve(paths.snapshots, `.${snapshotId}.${process.pid}-${Date.now()}.staging`); mkdirSync(staging);
  try {
    const files = { projects: writeJsonl(resolve(staging, 'projects.jsonl'), projects.rows), bbls: writeJsonl(resolve(staging, 'bbls.jsonl'), bbls.rows), pluto: writeJsonl(resolve(staging, 'pluto.jsonl'), pluto.rows) };
    const manifest = { snapshotId, complete: true, retrievedAt: new Date().toISOString(), publisher: before, sourceUrls: Object.fromEntries(Object.entries(zapSources).map(([name, source]) => [name, source.base])), files, counts: { projects: { expected: projects.expectedRows, fetched: projects.rows.length }, bbls: { expected: bbls.expectedRows, fetched: bbls.rows.length }, pluto: { expected: pluto.expectedRows, fetched: pluto.rows.length, requestedBbls: pluto.requestedBbls } }, extraction: { selectedFieldsOnly: true, plutoScope: 'BBLs referenced by current ZAP BBL snapshot' } };
    writeFileSync(resolve(staging, 'manifest.json'), JSON.stringify(manifest, null, 2)); renameSync(staging, finalDir); const result = { ...manifest, directory: finalDir }; if (activate) activateZapSnapshot(result, rawDirectory); log(`STAGED_ZAP_SNAPSHOT ${snapshotId} ${digest}`);
    return result;
  } catch (error) { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); throw error; }
}
