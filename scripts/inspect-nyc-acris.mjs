import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalAcrisBbl, distribution, legalAssociationIdentity, normalizedLegalAssociation, rate } from './nyc-acris-audit-lib.mjs';

const BASE = 'https://data.cityofnewyork.us';
const master = { id: 'bnx9-e6tj', fields: 'document_id,doc_type,recorded_datetime,good_through_date' };
const legals = { id: '8h5j-fqxa', fields: 'document_id,borough,block,lot,easement,partial_lot,air_rights,subterranean_rights,good_through_date' };
const pluto = { id: '64uk-42ks', fields: 'bbl,latitude,longitude' };
const start = process.env.ACRIS_START ?? '2024-07-01T00:00:00.000';
const end = process.env.ACRIS_END ?? '2026-07-01T00:00:00.000';
const mode = process.env.ACRIS_MODE ?? 'recent';
const recentLimit = Number(process.env.ACRIS_RECENT_LIMIT ?? '1000');
assert(Number.isSafeInteger(recentLimit) && recentLimit > 0 && recentLimit <= 10_000, 'ACRIS_RECENT_LIMIT must be an integer from 1 to 10,000.');
const output = resolve(process.env.ACRIS_AUDIT_OUTPUT ?? `data/audits/nyc-acris-${mode === 'recent' ? `latest-${recentLimit}` : `${start.slice(0, 10)}-${end.slice(0, 10)}`}.json`);

function sourceUrl(source) { return `${BASE}/resource/${source.id}.json`; }
function iso(value) { return typeof value === 'number' ? new Date(value * 1_000).toISOString() : null; }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function dateAfter(value, days = 1) { const next = new Date(value); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); }
function sqlBbl(value) { return String(BigInt(value)); }

async function requestJson(url, params = {}) {
  const target = new URL(url); for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(target, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function metadata(source) {
  const value = await requestJson(`${BASE}/api/views/${source.id}`);
  return { id: source.id, name: value.name, rowsUpdatedAt: value.rowsUpdatedAt ?? null, rowsUpdatedIso: iso(value.rowsUpdatedAt), publicationDate: value.publicationDate ?? null, publicationIso: iso(value.publicationDate), update: value.metadata?.custom_fields?.Update ?? null, agency: value.metadata?.custom_fields?.['Dataset Information']?.Agency ?? null, sourceUrl: sourceUrl(source) };
}
async function rows(source, params) {
  const value = await requestJson(sourceUrl(source), params);
  assert(Array.isArray(value), `${source.id} returned a non-array response`);
  return value;
}
async function masterSnapshot() {
  if (mode === 'recent') return rows(master, { '$select': master.fields, '$order': 'recorded_datetime DESC,document_id DESC', '$limit': recentLimit });
  assert(mode === 'window', 'ACRIS_MODE must be recent or window.');
  const selected = [];
  // Fortnightly closed windows make the query bounded without relying on an
  // unstable global offset. The 50k guard turns an unexpectedly busy window
  // into a reproducible failure rather than a silently partial result.
  for (let day = start.slice(0, 10); `${day}T00:00:00.000` < end; day = dateAfter(day, 14)) {
    const next = dateAfter(day, 14);
    const page = await rows(master, {
      '$select': master.fields,
      '$where': `recorded_datetime >= '${day}T00:00:00.000' AND recorded_datetime < '${next}T00:00:00.000'`,
      '$order': 'recorded_datetime ASC,document_id ASC', '$limit': 50_000,
    });
    assert(page.length < 50_000, `Master daily window ${day} reached the 50,000 cap; shrink the window before using this audit.`);
    selected.push(...page);
  }
  return selected;
}
async function scopedLegals(documentIds) {
  const selected = [];
  for (let index = 0; index < documentIds.length; index += 350) {
    const batch = documentIds.slice(index, index + 350);
    const escaped = batch.map(value => `'${value.replaceAll("'", "''")}'`).join(',');
    const page = await rows(legals, { '$select': legals.fields, '$where': `document_id IN (${escaped})`, '$limit': 50_000 });
    assert(page.length < 50_000, `Legal document batch ${index / 350 + 1} reached the 50,000 cap; shrink the batch before using this audit.`);
    selected.push(...page);
  }
  return selected;
}
async function scopedPluto(bbls) {
  const selected = [];
  for (let index = 0; index < bbls.length; index += 350) {
    const batch = bbls.slice(index, index + 350).map(sqlBbl).join(',');
    const page = await rows(pluto, { '$select': pluto.fields, '$where': `bbl IN (${batch})`, '$limit': 50_000 });
    assert(page.length < 50_000, `PLUTO BBL batch ${index / 350 + 1} reached the 50,000 cap; shrink the batch before using this audit.`);
    selected.push(...page);
  }
  return selected;
}
function countsBy(rows, key) {
  const values = new Map(); for (const row of rows) { const value = String(row[key] ?? '').trim() || '(blank)'; values.set(value, (values.get(value) ?? 0) + 1); }
  return Object.fromEntries([...values].sort(([left], [right]) => left.localeCompare(right)).map(([value, count]) => [value, count]));
}
function duplicateSummary(values) {
  const frequency = new Map(); for (const value of values) frequency.set(value, (frequency.get(value) ?? 0) + 1);
  const duplicateGroups = [...frequency.values()].filter(count => count > 1);
  return { distinct: frequency.size, duplicateGroups: duplicateGroups.length, duplicateRowsBeyondFirst: duplicateGroups.reduce((sum, count) => sum + count - 1, 0), largestGroup: duplicateGroups.length ? Math.max(...duplicateGroups) : 1 };
}
function coordinatePresent(row) {
  const valid = value => typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
  return valid(row.latitude) && valid(row.longitude);
}

const before = { master: await metadata(master), legals: await metadata(legals), pluto: await metadata(pluto) };
console.error(`Auditing ${start} to ${end}; Master publisher=${before.master.rowsUpdatedIso}`);
const masters = await masterSnapshot();
const masterIds = masters.map(row => String(row.document_id ?? '').trim());
assert(masterIds.every(Boolean), 'Master snapshot contains a blank document_id.');
const masterDuplicates = duplicateSummary(masterIds);
const exactDeedIds = [...new Set(masters.filter(row => String(row.doc_type ?? '').trim() === 'DEED').map(row => String(row.document_id).trim()))];
const legalRows = await scopedLegals(exactDeedIds);
const normalized = legalRows.map(row => ({ row, normalized: normalizedLegalAssociation(row), identity: legalAssociationIdentity(row) }));
const legalDuplicates = duplicateSummary(normalized.map(item => item.identity));
const legalByDocument = new Map();
for (const item of normalized) { const values = legalByDocument.get(item.normalized.documentId) ?? new Set(); if (item.normalized.bbl) values.add(item.normalized.bbl); legalByDocument.set(item.normalized.documentId, values); }
const bbls = [...new Set(normalized.map(item => item.normalized.bbl).filter(Boolean))].sort();
const plutoRows = await scopedPluto(bbls);
const plutoByBbl = new Map();
for (const row of plutoRows) {
  const bbl = typeof row.bbl === 'number' && Number.isSafeInteger(row.bbl) ? String(row.bbl).padStart(10, '0') : typeof row.bbl === 'string' && /^\d+(?:\.0+)?$/.test(row.bbl) ? BigInt(row.bbl.split('.')[0]).toString().padStart(10, '0') : null;
  assert(bbl, `PLUTO returned an invalid BBL: ${String(row.bbl)}`);
  assert(!plutoByBbl.has(bbl), `PLUTO returned duplicate BBL ${bbl} in the requested scope.`);
  plutoByBbl.set(bbl, row);
}
const matchedBbls = bbls.filter(bbl => plutoByBbl.has(bbl));
const bblCoordinateRows = matchedBbls.filter(bbl => coordinatePresent(plutoByBbl.get(bbl)));
const validAssociations = normalized.filter(item => item.normalized.bbl);
const matchedAssociations = validAssociations.filter(item => plutoByBbl.has(item.normalized.bbl));
const coordinateAssociations = matchedAssociations.filter(item => coordinatePresent(plutoByBbl.get(item.normalized.bbl)));
const after = { master: await metadata(master), legals: await metadata(legals), pluto: await metadata(pluto) };
assert(['master', 'legals', 'pluto'].every(name => before[name].rowsUpdatedAt === after[name].rowsUpdatedAt), 'Publisher metadata changed during audit; discard this output and rerun.');

const masterGoodThrough = countsBy(masters, 'good_through_date');
const legalGoodThrough = countsBy(legalRows, 'good_through_date');
const report = {
  auditVersion: 1, retrievedAt: new Date().toISOString(), window: mode === 'recent' ? { selection: `latest ${recentLimit} Master rows ordered by recorded_datetime DESC,document_id DESC; exact DEED then Legal document_id batches; PLUTO only requested Legal BBLs`, dateField: 'ACRIS Master recorded_datetime' } : { startInclusive: start, endExclusive: end, dateField: 'ACRIS Master recorded_datetime', selection: '14-day closed windows, ordered selected fields; exact DEED then Legal document_id batches; PLUTO only requested Legal BBLs' },
  sources: before,
  master: { rows: masters.length, documentIds: masterDuplicates, docTypeRows: countsBy(masters, 'doc_type'), exactDeed: { rows: masters.filter(row => String(row.doc_type ?? '').trim() === 'DEED').length, documentIds: exactDeedIds.length, excludedRows: masters.filter(row => String(row.doc_type ?? '').trim() !== 'DEED').length, excludedDocumentIds: new Set(masters.filter(row => String(row.doc_type ?? '').trim() !== 'DEED').map(row => String(row.document_id).trim())).size }, goodThroughDateRows: masterGoodThrough },
  legalsForExactDeed: { rows: legalRows.length, associationIdentities: legalDuplicates, invalidOrMissingBblRows: normalized.length - validAssociations.length, documentsWithLegals: legalByDocument.size, deedDocumentsWithoutLegals: exactDeedIds.length - legalByDocument.size, distinctNormalizedBbls: bbls.length, bblsPerDeedDocument: distribution(exactDeedIds.map(id => legalByDocument.get(id)?.size ?? 0)), goodThroughDateRows: legalGoodThrough },
  plutoForExactDeedBbls: { requestedNormalizedBbls: bbls.length, matchedNormalizedBbls: matchedBbls.length, unmatchedNormalizedBbls: bbls.length - matchedBbls.length, matchRatePercent: rate(matchedBbls.length, bbls.length), matchedBblsWithCoordinates: bblCoordinateRows.length, matchedBblsMissingCoordinates: matchedBbls.length - bblCoordinateRows.length, coordinateRateAmongMatchedPercent: rate(bblCoordinateRows.length, matchedBbls.length), associationRowsWithValidBbl: validAssociations.length, associationRowsMatched: matchedAssociations.length, associationRowsUnmatched: validAssociations.length - matchedAssociations.length, associationMatchRatePercent: rate(matchedAssociations.length, validAssociations.length), associationRowsWithCoordinates: coordinateAssociations.length, associationCoordinateRateAmongMatchedPercent: rate(coordinateAssociations.length, matchedAssociations.length) },
  coherence: { publisherStableDuringExtraction: true, masterGoodThroughDateRows: masterGoodThrough, legalGoodThroughDateRows: legalGoodThrough, goodThroughDateSetsEqual: JSON.stringify(Object.keys(masterGoodThrough).sort()) === JSON.stringify(Object.keys(legalGoodThrough).sort()) },
  implementationContract: { exactDocTypeAllowlist: ['DEED'], compoundAndOtherDocTypes: 'exclude and expose the snapshot counts by raw doc_type; do not normalize DEED, TS into DEED', masterIdentity: 'document_id; reject or quality-account duplicate Master document_id before event activation', legalAssociationIdentity: 'document_id + canonical 10-digit BBL + easement + partial_lot + air_rights + subterranean_rights', bblNormalization: 'borough 1–4 + zero-padded five-digit block + zero-padded four-digit lot; retain invalid/missing BBL rows in quality accounting', geography: 'PLUTO BBL match and WGS84 coordinate presence are required for PARCEL_CENTROID H3 placement; retain unmatched/null-coordinate counts', price: 'document_amt is principal debt or obligation and must not be presented as price' },
};
const text = `${JSON.stringify(report, null, 2)}\n`; mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, text);
console.log(JSON.stringify({ output, sha256: sha256(text), masterRows: report.master.rows, exactDeedDocuments: report.master.exactDeed.documentIds, legalRows: report.legalsForExactDeed.rows, requestedBbls: report.plutoForExactDeedBbls.requestedNormalizedBbls }, null, 2));
