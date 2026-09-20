# Official property-transaction source audit

Audited on 2026-09-20. This is a source contract for a future transaction-evidence layer, not implementation. A transaction must remain a separately dated public-record fact: it must not alter permit ranking or imply that it caused redevelopment.

## Decision

| Market | Recommendation | Bounded product use | Hard boundary |
| --- | --- | --- | --- |
| Chicago | **GO with quality flags and lag disclosure** | Parcel-sale facts linked by zero-padded 14-digit PIN; map only after an audited PIN geography adapter. | No arms-length, execution-date, unique-document, causality, or investment claim. |
| NYC | **LIMITED GO: ACRIS four-borough recorded deeds** | Deed facts joined to BBL associations. | No NYC-wide count, Staten Island coverage, buyer/seller identity, or sale-price claim. |

## Chicago: Cook County Assessor Parcel Sales

- Official publisher and dataset: Cook County Assessor's Office Data Department, [Assessor - Parcel Sales](https://datacatalog.cookcountyil.gov/d/wvhk-k5uv), Socrata ID `wvhk-k5uv`.
- Correct host: `datacatalog.cookcountyil.gov`. The previously suggested `data.cityofchicago.org` host returns 404.
- Metadata: `https://datacatalog.cookcountyil.gov/api/views/wvhk-k5uv`. API: `https://datacatalog.cookcountyil.gov/api/v3/views/wvhk-k5uv/query.json`; use POST and deterministic bounded pages in production.
- Live metadata observed: countywide parcel data, 1999-present, bi-weekly publishing/data change; `rowsUpdatedAt` was `2026-09-15T11:52:36Z`. The publisher says sales may arrive months after their recorded date.
- Identity and evidence fields: `row_id` is the unique API row key; retain `doc_no` as Clerk document evidence (not unique per parcel row), `pin`, `sale_date`, `is_mydec_date`, `sale_price`, `deed_type`, `mydec_deed_type`, `sale_type`, `is_multisale`, `num_parcels_sale`, and all three `sale_filter_*` fields.
- Canonicalize `pin` as 14-digit text. `sale_date` is recorded, not executed; `is_mydec_date=false` may mean historic month-truncation.
- Live aggregate for `[2024-07-01, 2026-07-01)`: 147,991 rows, 147,991 unique `row_id`, and 126,672 distinct `doc_no`. A document can span multiple parcel rows.
- 143,376 rows had all filter flags false. The publisher says its 2023 revision no longer filters sales by deed type, price, or same-PIN/price recency. Preserve flags; never label the source arms-length by default.
- This is Cook County, not Chicago. Require an independently audited authoritative PIN-to-city/geometry source before H3 placement; do not substitute addresses, ZIPs, townships, or assessor neighbourhoods.
- The catalog exposes public downloads but no machine-readable licence identifier in metadata. Preserve attribution/source URLs and confirm redistribution terms before commercial deployment.

```powershell
Invoke-RestMethod 'https://datacatalog.cookcountyil.gov/api/views/wvhk-k5uv'
$body = @{ query = 'SELECT pin, sale_date, is_mydec_date, sale_price, doc_no, row_id, deed_type, mydec_deed_type, sale_type, is_multisale, num_parcels_sale, sale_filter_same_sale_within_365, sale_filter_less_than_10k, sale_filter_deed_type ORDER BY sale_date DESC'; page = @{ pageNumber = 1; pageSize = 25 }; includeSynthetic = $false } | ConvertTo-Json -Depth 4
Invoke-RestMethod 'https://datacatalog.cookcountyil.gov/api/v3/views/wvhk-k5uv/query.json' -Method Post -ContentType 'application/json' -Body $body
```

## NYC: Department of Finance ACRIS

- Official publisher: NYC Department of Finance via NYC Open Data.
- [ACRIS Real Property Master](https://data.cityofnewyork.us/d/bnx9-e6tj), ID `bnx9-e6tj`; [ACRIS Real Property Legals](https://data.cityofnewyork.us/d/8h5j-fqxa), ID `8h5j-fqxa`.
- Parties `636b-3b5g` is intentionally out of the first increment: it is not needed for parcel linkage, party semantics were not audited, and it adds personal data.
- Poll `https://data.cityofnewyork.us/api/views/{id}` for `rowsUpdatedAt`; acquire `https://data.cityofnewyork.us/resource/{id}.json` through a deterministic keyset/window, never an unordered offset scan.
- Master and Legals advertise automated monthly updates. Observed timestamps were `2026-09-08T19:32:41Z` and `2026-09-08T19:31:09Z`; `good_through_date` means latest recording or correction in the extract. Retain immutable snapshots because publisher data can be corrected/overwritten.
- Fact identity: Master `document_id`. It joins to one or more Legals `document_id` rows. BBL is borough + 5-digit block + 4-digit lot; retain rights/partial-lot flags in association identity.
- Candidate event date is Master `recorded_datetime`; retain `document_date` separately. Start with exact `doc_type = DEED` only. Account for compound/unknown values, including `DEED, TS`; do not call them sales without a documented rule.
- `document_amt` is officially **principal debt or obligation**, not consideration. Never label or expose it as sale price/amount.
- Samples confirmed Master/Legals join on `document_id`, multiple BBL associations are possible, and Master includes non-deed types such as `PAT` and `SAT`.
- Mandatory disclosure: ACRIS covers Manhattan, Bronx, Brooklyn, and Queens. NYC DOF directs Staten Island records to the Richmond County Clerk. UI/export must say: **“ACRIS recorded-deed context: four boroughs; Staten Island is not covered.”**
- NYC Open Data policy allows public data access subject to terms but warns data can be updated, corrected, overwritten, and refreshed; the City disclaims completeness/fitness. Preserve DOF attribution, URL, retrieval time, manifest hash, and caveat in every output.

```powershell
Invoke-RestMethod 'https://data.cityofnewyork.us/api/views/bnx9-e6tj'
Invoke-RestMethod 'https://data.cityofnewyork.us/api/views/8h5j-fqxa'
Invoke-RestMethod 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json?$select=document_id,doc_type,document_date,document_amt,recorded_datetime,modified_date,good_through_date&$order=recorded_datetime DESC&$limit=25'
Invoke-RestMethod 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json?$select=document_id,borough,block,lot,easement,partial_lot,air_rights,subterranean_rights,good_through_date&$where=document_id=%272026080700366001%27'
```

## Exact next implementation contract

1. Add a separate `transaction` source family with metadata polling, selected-field immutable raw snapshots, checksums/manifests, completeness checks, staged rebuild, and atomic activation. Failure retains active data.
2. Use source, event kind, event date, raw identity, geography identity/precision, freshness, and caveats. Do not blend into permit scores or rank.
3. Chicago identity is `row_id`; retain `doc_no`, 14-digit PIN, date precision, filter flags, and multi-parcel fields. Block H3 placement until a PIN-to-city/geometry audit passes.
4. NYC identity is `document_id`; association identity is normalized BBL plus rights/partial-lot components. Start exact `DEED`; show excluded-type counts. Use PLUTO only with unmatched-BBL accounting. Price is unavailable.
5. UI labels: `Recorded parcel sale` (Chicago) and `Recorded deed` (NYC ACRIS, four-borough). The allowed next action is property/ownership research; never causality or prediction.
6. Required tests: duplicate identities, multi-parcel/deed associations, unmatched geography, correction snapshots, staged-refresh idempotence, UI/export coverage disclosures, and no permit-rank change.

## Frozen NYC ACRIS window audit — 2026-09-20

The remaining pre-implementation checks were completed against official Socrata data for
Master `recorded_datetime` in `[2024-07-01, 2026-07-01)`. The reproducible audit is
`scripts/inspect-nyc-acris.mjs`; pure identity helpers and tests are in
`scripts/nyc-acris-audit-lib.mjs` and `tests/nyc-acris-audit.test.ts`. The retained aggregate
report is `data/audits/nyc-acris-2024-07-01-2026-07-01.json`, SHA-256
`106a8c233f058f08c045ebb707c29b994d1159133c9c686dd9b645959c6fb5c7`.

- Publisher versions stayed stable during extraction: Master and Legals were updated
  2026-09-08; PLUTO was updated 2026-08-24.
- Master returned 596,922 rows but 595,690 distinct document IDs. There were 1,220
  duplicate-ID groups and 1,232 rows beyond the first, with a largest group of three.
  Production ingestion must reconcile duplicate Master rows deterministically and expose
  the duplicate count; it cannot assume one row per `document_id`.
- Exact raw `DEED` produced 114,832 rows and 114,356 document IDs. The audit excludes
  482,090 rows with other raw types, including 21,490 `DEED, TS`, 3,237 `DEED, LE`, and
  97 `DEED COR`. These remain visible as excluded-type quality counts.
- All 114,356 exact-DEED document IDs had Legal rows. The 122,931 Legal rows formed
  122,383 distinct association identities; 503 identities were duplicated, with 548 rows
  beyond the first. Association identity therefore includes document ID, normalized BBL,
  easement, partial-lot, air-rights, and subterranean-rights flags and is de-duplicated.
- Multi-parcel deeds are material: 109,291 documents mapped to one distinct BBL, 4,114 to
  two, 589 to three, 150 to four, and 212 to five or more. Count documents distinctly at
  city level and once per H3; never sum H3 counts into a city total.
- PLUTO matched only 72,888 of 111,568 distinct Legal BBLs (65.33%). On association rows,
  81,765 of 122,931 matched (66.51%). Of matched BBLs, 99.87% had coordinates. This is a
  serious coverage limitation: unmatched deeds remain in city totals and quality counts,
  while only matched coordinate-bearing BBLs receive `PARCEL_CENTROID` H3 placement.
- Master and Legal rows exposed the same set of `good_through_date` values. Dates extend
  past the event window because corrected/current source rows retain publisher snapshot
  dates; `good_through_date` is freshness metadata, never the transaction event date.

Reproduce the compact recent smoke audit with `node scripts/inspect-nyc-acris.mjs`. The
full fixed-window audit uses PowerShell environment variables:

```powershell
$env:ACRIS_MODE='window'
node scripts/inspect-nyc-acris.mjs
Remove-Item Env:ACRIS_MODE
```

**Decision: implementation GO with strict coverage controls.** Ship only an NYC
four-borough, exact-`DEED`, separately sourced recorded-deed context. Use distinct document
counts, retain multi-BBL associations, never expose `document_amt` as price, never include
Parties initially, keep unmatched deeds visible, and never modify permit ranking.

## Remaining limits

- Chicago: audit an official PIN geometry/city membership source and its licensing before mapping/counting Chicago cells.
- NYC: determine the duplicate-Master winner rule from retained raw rows during ingestion
  design; reject activation if duplicates disagree on material event fields and cannot be
  resolved without an explicit source rule.
- Both: do not use parties/ownership names, sales price comparisons, or cross-city totals until separately justified.
