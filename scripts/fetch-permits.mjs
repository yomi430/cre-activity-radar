import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const market = process.argv[2];
const config = {
  chicago: { source: 'CHICAGO_PERMIT', base: 'https://data.cityofchicago.org/resource/ydr8-5enu.json', date: 'issue_date', order: 'id ASC', fields: 'id,permit_,permit_type,permit_status,issue_date,work_type,reported_cost,latitude,longitude,community_area,street_number,street_direction,street_name,work_description', id: row => row.id },
  nyc: { source: 'NYC_DOB_NOW', base: 'https://data.cityofnewyork.us/resource/rbx6-tga4.json', date: 'issued_date', order: ':id ASC', fields: ':id as source_row_id,job_filing_number,work_permit,sequence_number,tracking_number,issued_date,permit_status,work_type,estimated_job_costs,latitude,longitude,house_no,street_name,borough,job_description,bbl', id: row => row.source_row_id }
}[market];
if (!config) throw new Error('Usage: node scripts/fetch-permits.mjs <chicago|nyc>');
const where = `${config.date} >= '2024-07-01T00:00:00' AND ${config.date} < '2026-07-01T00:00:00'`;
async function request(params) {
  const url = new URL(config.base); for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30_000);
    try { const response = await fetch(url, { signal: controller.signal }); if (response.ok) return response; if (attempt === 3) throw new Error(`${response.status}: ${await response.text()}`); await new Promise(resolve => setTimeout(resolve, Number(response.headers.get('retry-after') ?? attempt) * 1000)); }
    catch (error) { if (attempt === 3) throw error; await new Promise(resolve => setTimeout(resolve, attempt * 1000)); }
    finally { clearTimeout(timer); }
  }
  throw new Error('unreachable');
}
const countResponse = await request({ '$select': 'count(*)', '$where': where });
const expectedRows = Number((await countResponse.json())[0].count);
const rawDir = resolve('data/raw'); mkdirSync(rawDir, { recursive: true });
const filename = `${market}-permits-2024-07-01_2026-07-01.jsonl`; const output = resolve(rawDir, filename); const staging = `${output}.staging`;
if (existsSync(staging)) unlinkSync(staging);
const stream = createWriteStream(staging, { encoding: 'utf8' }); const hash = createHash('sha256'); const ids = new Set(); let rows = 0;
const pageSize = market === 'nyc' ? 5_000 : 50_000;
for (let offset = 0; ; offset += pageSize) {
  const response = await request({ '$select': config.fields, '$where': where, '$order': config.order, '$limit': String(pageSize), '$offset': String(offset) });
  const page = await response.json();
  for (const row of page) { const id = config.id(row); if (!id || ids.has(id)) throw new Error(`duplicate or missing source identity: ${id}`); ids.add(id); const line = `${JSON.stringify(row)}\n`; stream.write(line); hash.update(line); rows++; }
  console.log(`${config.source}: ${rows}/${expectedRows}`); if (page.length < pageSize) break;
}
await new Promise((resolve, reject) => stream.end(error => error ? reject(error) : resolve()));
if (rows !== expectedRows) { unlinkSync(staging); throw new Error(`count mismatch: expected ${expectedRows}, got ${rows}`); }
const finalCount = Number((await (await request({ '$select': 'count(*)', '$where': where })).json())[0].count);
if (finalCount !== expectedRows) { unlinkSync(staging); throw new Error(`source changed during extraction: began ${expectedRows}, ended ${finalCount}`); }
renameSync(staging, output);
writeFileSync(`${output}.manifest.json`, JSON.stringify({ source: config.source, retrievedAt: new Date().toISOString(), coverageStart: '2024-07-01', coverageEndExclusive: '2026-07-01', expectedRows, rows, sha256: hash.digest('hex'), resourceUrl: config.base, completeness: 'complete-query' }, null, 2));
console.log(`Frozen ${output} (${rows} rows).`);
