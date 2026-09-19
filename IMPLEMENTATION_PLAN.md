# CRE Activity Radar — executable implementation plan

Prepared 2026-09-19; revised to require BOTH Chicago and NYC per user clarification.
This is a build specification, not a claim that the app exists.
Read `docs/RESEARCH.md` for verified sources and remaining data questions. Use
`TERRA_START.md` as the implementation handoff. Tasks below are initially unstarted.

## 1. Decision and evaluation

Build this idea, with a smaller and more defensible first release. The original
proposal has good boundaries: deterministic processing, source adapters, evidence
drill-down, SQLite, and no investment prediction. Its weaknesses are scope and data
semantics, not a lack of architectural sophistication.

Make these corrections before implementation:

| Original proposal | Decision for today's release | Reason |
| --- | --- | --- |
| Chicago + NYC + PLUTO + SBA + ZIP enrichment | Chicago AND NYC permits through the same workflow; SBA broader context; PLUTO fallback | Demonstrate working source extensibility without false geographic precision |
| ZIP-centroid SBA loans aggregated into H3 resolution 8 | Never assign city/ZIP-only loans to permit cells | A precision badge does not fix artificial spatial concentration |
| Capital deployment / space demand | Permit activity / SBA 504 approval activity | Approvals are not disbursements, completed projects, or measured demand |
| `EXACT_POINT` | `SOURCE_COORDINATE` | Published address coordinates are not a guarantee of exact location |
| Required point on every normalized record | Nullable point with explicit unresolved status | Retain otherwise valid records and quantify map exclusions |
| Loan amount interpreted as project investment | Dictionary-defined approval amount only | Financing amount and total project cost are different quantities |
| Six tables plus multiple workspace packages | One npm package, three tables, pure domain modules | The boundaries matter more than package infrastructure |
| Live last-12-months | Frozen, explicit two-year comparison | Reproducibility and source reporting lag |
| NYC always requires PLUTO | Native coordinates first; PLUTO only if needed later | Current DOB NOW schema already exposes coordinates |
| Sum permit values as construction investment | Per-record applicant estimate in evidence only | Separate permits can refer to overlapping project costs |

Primary user: a CRE research analyst supporting a broker's weekly market
review. Job: choose an area to investigate, inspect the permits driving the change,
and carry source evidence into further research. This is a product hypothesis;
do not claim interviews or proven time savings.

Product sentence: **See where recorded permit activity changed, then inspect the
underlying records before deciding what deserves further research.**

The screen should answer a useful question within 60 seconds. This is the demo
target, not a measured productivity claim. Mixed residential/commercial permits
remain visible and labeled; do not invent a reliable commercial-only classifier.

## 2. Scope contract

Required finished workflow:

1. Open the app with bundled data and no credentials or source API calls.
2. Select Chicago or NYC and see its H3 permit map, readable area list, fixed comparison dates, source
   snapshot information, and source quality summary.
3. Sort areas by absolute permit-count increase or current permit count.
4. Filter by an exact source permit type, with `All types` as the default.
5. Select a map cell or list row; both select the same detail panel.
6. See current/prior counts, absolute change, safe percentage change, and 24 monthly counts.
7. Inspect paginated records for either period, then view retained source fields
   and the official source link.
8. Inspect accepted, rejected, duplicate, out-of-scope, and unmapped row counts.

SBA companion feature: a separate market panel and evidence list for city-labelled
504 approvals. It never changes cell ranking, cell color, or cell evidence. For Chicago show
`Chicago-labelled project city, Illinois; not a municipal-boundary match` when
verified project-city fields support that filter. If only borrower geography is
available, label it borrower-city context explicitly; do not silently substitute it.
For NYC verify and document city/borough aliases in the actual SBA data. Do not claim
five-borough completeness from a filter matching only `NEW YORK`. If coverage cannot
be established, disclose the exact included labels or leave context unavailable.

Explicitly excluded: auth, LLM calls, prediction, composite opportunity score,
property valuations, alerts, queues, live refresh, arbitrary date picker, geocoding
service, ZIP polygons, ORM, Docker, cloud deployment, and generated neighborhood
names. The Chicago/NYC selector and both working adapters are REQUIRED. Section 12
specifies the NYC adapter; it is part of T02–T07, not a post-submission extension.

Fallback order, decided now:

- A: public Chicago and NYC snapshots + verified public SBA context.
- B: public Chicago and NYC snapshots + SBA panel explaining source unavailable; synthetic
  SBA rows exist only in tests / an explicitly selected synthetic demo dataset.
- C: an entirely synthetic, prominently labeled two-city demo if public data cannot be
  obtained. This satisfies the assignment's data allowance but is a weaker research
  demonstration. Document the retrieval failure; never present its trends as findings.

Do not mix synthetic rows into a public aggregate. A cut feature must be reflected
in the README and progress log. Never disguise an incomplete/truncated download as
complete city coverage.

## 3. Stack and repository layout

Use TypeScript, React, Vite, Express, native `node:sqlite`, `h3-js` v4, Leaflet,
Zod, `csv-parse`, Vitest, and Playwright. Use Leaflet directly through one React
wrapper; avoid another map integration library. Plain CSS is sufficient. No state
management library. Use `fetch` and `AbortController`.

Environment verified: Node 24.18.0, npm 11.16.0, built-in SQLite 3.53.1. In this
PowerShell session use `npm.cmd` / `npx.cmd`; `npm.ps1` is blocked by execution policy.
Do not change system execution policy. Pin Node to the tested 24.x line (document
24.18.0); install compatible package releases once and commit the lockfile. Do not
copy APIs from Node 26 documentation that do not exist in the tested runtime.

One package at the repository root:

```text
src/
  shared/contracts.ts              # API DTOs and validation schemas
  domain/{types,dates,money,change,aggregate,spatial}.ts
  sources/{chicago,nyc,sba504}.ts   # raw row -> normalization result
  server/{app,index,db,repository,queries}.ts
  web/{main,App,api,styles}.tsx     # styles is .css, api is .ts
  web/components/{ActivityMap,AreaList,AreaDetail,EvidenceTable,SourceHealth,SbaContext}.tsx
scripts/{fetch-chicago,fetch-nyc,fetch-sba,make-fixture,seed,verify-data}.ts
data/demo/{manifest.json,chicago.jsonl,nyc.jsonl,sba504.jsonl}
data/fixtures/                     # deterministic synthetic records
data/raw/                          # ignored downloads
data/runtime/                      # ignored SQLite files
docs/{RESEARCH,DECISIONS,PROGRESS,DEMO,AI_LOG}.md
tests/{normalization,aggregation,repository,api}.test.ts
tests/e2e/investigation.spec.ts
index.html
vite.config.ts
playwright.config.ts
package.json
package-lock.json
README.md
```

Use Vite root `.` and `index.html` importing `/src/web/main.tsx`. Output frontend
to `dist/web`. Compile server/domain/shared code to `dist/server` using a separate
NodeNext tsconfig; use ESM-compatible `.js` relative imports for server code. Keep
web tsconfig on bundler resolution. Backend entry becomes
`dist/server/server/index.js` with `rootDir: src`.

Development: Vite on 5173 proxies `/api` to Express on 3001. Production/demo:
Express serves `/api` and `dist/web` on 3001, bound to `127.0.0.1` by default. A
non-API HTML fallback must never intercept unknown API paths. No CORS needed.

Package scripts to implement:

| Command | Contract |
| --- | --- |
| `npm.cmd run data:fixture` | Create deterministic synthetic fixture files and manifest |
| `npm.cmd run data:fetch:chicago` | Explicit network task; download frozen date window |
| `npm.cmd run data:fetch:nyc` | Explicit network task; download named DOB NOW dataset/window |
| `npm.cmd run data:fetch:sba` | Explicit network task; dictionary-verified mapping only |
| `npm.cmd run data:seed` | Rebuild local DB transactionally from bundled demo files |
| `npm.cmd run data:verify` | Check manifest, checksums, accounting, aggregates, evidence |
| `npm.cmd run dev` | Run API + Vite with concurrently; no external data fetch |
| `npm.cmd run typecheck` | Check both TS projects |
| `npm.cmd test` | Run Vitest once, without watch |
| `npm.cmd run test:e2e` | Run Playwright against local app |
| `npm.cmd run build` | Compile server and frontend |
| `npm.cmd start` | Start the built app |
| `npm.cmd run demo` | Seed bundled data, build, and start; no data-network dependency |

Server dependencies may remain installed for the demo; no need for a single-file
executable. Dependency installation still requires network on a fresh machine.
Use Node scripts for filesystem operations rather than POSIX shell syntax.

## 4. Frozen data contract

Dates use calendar `YYYY-MM-DD` strings, never local timezone conversion:

```text
prior:   [2024-07-01, 2025-07-01)
current: [2025-07-01, 2026-07-01)
```

UI: `Jul 2025–Jun 2026 versus Jul 2024–Jun 2025`. These dates align with the
currently listed SBA snapshot, but are still a deliberate product choice. Never
compute windows using today's date or the maximum observed event date. A recent
max date does not prove complete coverage.

Chicago metadata and exact field semantics are recorded in RESEARCH.md. Fetch all
permit types in both windows, including rows without coordinates. Keep only these
source fields in the bundled extract: `id`, `permit_`, `permit_type`,
`permit_status`, `issue_date`, `work_type`, `reported_cost`, `latitude`, `longitude`,
`community_area`, `street_number`, `street_direction`, `street_name`,
`work_description`. Do not download contractor contact columns for this workflow.
Call this a retained source-field extract, not the entire original source row.

Fetch from `https://data.cityofchicago.org/resource/ydr8-5enu.json` with URLSearchParams:

```text
$where=issue_date >= '2024-07-01T00:00:00' AND issue_date < '2026-07-01T00:00:00'
$order=id ASC
$limit=5000
$offset=0,5000,...
```

Also supply `$select` for retained fields and run a `count(*)` query for the same
window before and after extraction. Use a 30-second timeout per request and at
most three attempts, honoring Retry-After when provided. Do not hardcode the API's
default page limit as a total dataset limit. Detect duplicate IDs and mismatched
counts. Record extraction start/end and acknowledge that the mutable upstream
cannot provide an atomic historical snapshot. Freeze and hash the downloaded
extract. A failed fetch leaves the last working demo untouched; use staging files.

Manifest fields:

```ts
interface DatasetManifest {
  id: string; // deterministic content/version identifier
  mode: 'public' | 'synthetic';
  sources: Array<{
    source: 'CHICAGO_PERMIT' | 'NYC_DOB_NOW' | 'SBA_504';
    status: 'available' | 'unavailable';
    datasetUrl: string;
    resourceUrl: string | null;
    retrievedAt: string | null;
    publisherAsOf: string | null;
    coverageStart: string;
    coverageEndExclusive: string;
    completeness: 'complete-query' | 'partial' | 'synthetic' | 'unavailable';
    file: string | null;
    sha256: string | null;
    expectedRows: number | null;
    mappingVersion: string;
    notes: string[];
  }>;
}
```

Do not claim equal real-world completeness just because query counts reconcile.
If either comparison window has a partial extraction, show counts as sample counts
and disable growth ranking / YoY percentages for that source.

SBA: the current CSV link returned HTTP 403 during planning. Allow **30 minutes
maximum** for acquiring and inspecting it and its data dictionary. See RESEARCH.md
for exact URLs. Inspect actual headers, amount definitions, city fields, stable ID,
date formats and status codes. Record exact mappings before implementing the public
adapter; do not invent them. Stream the national CSV and retain only the verified city labels
and two-year window. No ZIP-centroid database is needed.

For the first release, count approvals by approval date in the downloaded snapshot
and preserve the loan's reported status in evidence. Do not filter to currently
active loans: that would remove historical loans based on later outcomes. Explain
that approval activity can include subsequently cancelled/changed loans and does
not represent disbursed capital. If no stable public ID exists, use resource
checksum + row number as snapshot identity, flag exact duplicate payloads, and
document that cross-snapshot loan matching is unsupported. Do not deduplicate
different loans merely because name, date and amount match.

## 5. Types and normalization rules

Implement these boundaries before UI work. Shared runtime validation uses Zod;
source schemas permit extra columns so harmless upstream additions do not break.

```ts
type Market = 'CHICAGO' | 'NYC';
type Point = {
  lat: number;
  lng: number;
  precision: 'SOURCE_COORDINATE' | 'JOINED_PARCEL';
  provider: string;
};

type Permit = {
  id: string;                 // source namespace + verified source identity
  market: Market;
  sourceRecordId: string;
  source: 'CHICAGO_PERMIT' | 'NYC_DOB_NOW';
  date: string;
  permitNumber: string | null;
  permitType: string;
  reportedCostCents: number | null;
  address: string | null;
  description: string | null;
  communityArea: string | null;
  point: Point | null;
  geoStatus: 'RESOLVED' | 'UNRESOLVED';
  h3Cell: string | null;      // assigned after source normalization
  warnings: string[];
};

type Approval = {
  id: string;
  market: Market;
  sourceRecordId: string;
  source: 'SBA_504';
  date: string;
  approvalAmountCents: number;
  borrowerName: string | null;
  status: string | null;
  city: string;
  state: string;
  zip: string | null;
  geographyBasis: 'PROJECT_CITY' | 'BORROWER_CITY';
  // Deliberately no point or h3Cell.
};

type NormalizeResult<T> =
  | { status: 'ACCEPTED'; value: T }
  | { status: 'REJECTED'; reasons: string[] }
  | { status: 'OUT_OF_SCOPE'; reason: string };
```

Rules:

- Validate calendar dates, including impossible dates. Chicago's calendar timestamp
  is sliced to its calendar date after format validation; do not shift it to UTC.
- Trim strings; blank optional values become null. Keep ZIP strings and leading zeroes.
- Missing source ID/date -> rejected. Outside fixed date window -> out of scope.
- Missing/invalid coordinates -> accepted permit with unresolved geography. Validate
  finite numbers, world bounds and broad Chicago sanity bounds (lat 41.60–42.10,
  lng -88.00–-87.40); NYC sanity bounds are lat 40.45–40.95, lng -74.30–-73.65.
  These bounds catch obvious errors; they are not city boundaries.
- A point requires both coordinates. Never turn blanks into numeric zero.
- Parse money from decimal text into integer cents; null/invalid/negative permit
  estimates become null plus a warning, not a rejected permit. Zero is valid.
- Approval amount must be a valid nonnegative safe-integer cent value. If an official
  source documents a valid negative adjustment, stop that row with an explicit reason
  until supported; do not convert it to a positive approval.
- H3 functions accept lat/lng; GeoJSON coordinates are lng/lat. Use resolution 8 for
  resolved permits only. Domain spatial code accepts Point and knows no source schema.
- Retain raw selected fields and warnings. Missing cost is not zero cost. Never use
  work-description keyword guesses to assert commercial use.

Ingestion accounting (per source, mutually exclusive first-level outcomes):

```text
rowsRead = duplicateRows + rejectedRows + outOfScopeRows + acceptedRows
acceptedPermitRows = resolvedRows + unresolvedRows
acceptedApprovalRows = geographyNotApplicableRows
```

Duplicate handling: identical payload with the same source key is one observation
plus one duplicate count. Conflicting payloads for the same key fail publication of
that snapshot; do not arbitrarily choose a winner. Count duplicates before later
normalization categories. Store reason counts and examples for rejected/unresolved
rows. Re-ingesting the same manifest must not double counts.

## 6. Persistence and aggregation

Three tables are enough:

1. `datasets`: manifest ID, manifest JSON, ingestion report JSON, imported timestamp.
2. `source_records`: internal row key, dataset ID, source, source key if known,
   selected raw JSON, outcome, reasons JSON. Include rejected/unresolved/duplicate
   rows for diagnostics; their internal row key includes file row number.
3. `observations`: normalized ID (primary key), source_record_id (FK), market, kind,
   event_date, permit_type nullable, h3_cell nullable, amount_cents nullable,
   normalized JSON. Explicit scalar columns support parameterized queries.

Indexes: `(market, kind, event_date)`, `(market, h3_cell, event_date, permit_type)`.
Enable foreign keys. `data:seed` runs in a transaction, replaces the active local
dataset, and rolls back on error. Validate all input files before clearing the
previous dataset. Do not build multiple active dataset versions today. Derived
signals are computed from this frozen dataset, so there is no stale signal table.

Use pure `aggregatePermits(permits, windows, market, permitType)` and
`aggregateApprovals(approvals, windows, market)` functions. For a bounded offline snapshot,
reading normalized rows once and caching results by manifest ID + market + permit type is
acceptable. Return DTOs, never the live SQLite handle, to the web layer. Batch jobs
finish before the read-only server starts; no in-request ingestion.

Each cell result contains:

```ts
type Change = {
  current: number;
  previous: number;
  absolute: number;
  percent: number | null;
  basis: 'COMPARABLE' | 'NO_BASELINE' | 'NO_ACTIVITY' | 'INCOMPLETE';
};
type CellSignal = {
  market: Market;
  h3Cell: string;
  label: string; // e.g. 'Near 1200 W Example St'; not a claimed neighborhood
  permitCount: Change;
  monthly: Array<{ month: string; count: number }>; // all 24 months, zero-filled
  lowVolume: boolean;
};
```

Percentage rules: previous > 0 -> `(current - previous) / previous * 100`;
previous = 0/current > 0 -> null + `NO_BASELINE`; both zero -> null + `NO_ACTIVITY`.
Never show infinity or describe 0 -> 1 as 100% growth. Prior > 0/current = 0 is -100%.
Only round for display. Missing source -> unavailable, not zero.

Compute the union of cells in both periods so declining/disappearing activity remains
visible. Default investigation list includes cells with current + previous >= 5,
sorts by absolute increase descending, then current count descending, then H3 ID
ascending. A `Show low-volume areas` toggle reveals others. Make this arbitrary
prototype threshold visible; do not describe it as statistical significance.
Count sort uses current count descending then H3 ID. Include negative changes.

Map color = current permit count with a visible legend; map and list use the same
permit-type and volume filters. Growth ranking and map color intentionally use
different named metrics. Do not color by a fabricated joint capital/demand score.
When a filter hides a selected cell, clear the selection and show an explanatory
empty detail state. The city summary separately reports all accepted permits and
how many can be mapped; sums of cell counts reconcile to resolved permits only.

Use the most frequent nonempty street address as a cell label with lexical tie-break,
prefixed `Near`; fallback to short H3 ID. Do not equate a cell with a neighborhood.

## 7. HTTP contract

All responses have `{ datasetId, data }`; market-specific responses also include
`market`. Require and validate `market=CHICAGO|NYC` on summary, cells, cell detail,
cell evidence and approvals endpoints below. Missing/invalid market -> 400.
Source reports include market coverage. List pages additionally include
`pagination: { offset, limit, total }`. Errors are
`{ error: { code, message } }` with a suitable status. Dates and availability come
from the manifest. The frontend does not reconstruct metric definitions.

| Endpoint | Returns |
| --- | --- |
| `GET /api/health` | status and dataset ID; 503 if no usable seeded dataset |
| `GET /api/summary?permitType=ALL` | fixed windows, source availability, accepted/unmapped permit totals, separate SBA context, available raw permit types |
| `GET /api/cells?permitType=ALL` | CellSignal[] and GeoJSON FeatureCollection for union of both periods |
| `GET /api/cells/:h3?permitType=ALL` | one CellSignal; 404 if valid cell has no selected data |
| `GET /api/cells/:h3/evidence?period=current&permitType=ALL&offset=0&limit=25` | selected-period resolved permits in that cell |
| `GET /api/approvals?period=current&offset=0&limit=25` | city-level SBA evidence or explicit unavailable state |
| `GET /api/records/:id` | selected raw source fields, normalized record, provenance URL, warnings |
| `GET /api/sources` | manifest and ingestion reports, reason counts, completeness |

`ALL` is a reserved filter token; exact raw permit types are URL-encoded. Reject
unsupported filter values. Validate H3 syntax and resolution; invalid -> 400.
Pagination: integer offset >= 0, limit 1–100; invalid -> 400. Evidence sorts by
date descending then normalized ID ascending. Unknown record -> 404. Use SQL
parameters for all values; no user-supplied SQL identifiers or ordering clauses.
Cells/summary/evidence must share one filtering function or query builder.

Source URLs: Chicago dataset link plus encoded source ID query when usable. SBA
links to its resource and displays snapshot row identity; don't invent a loan page.
Record details must be available offline even if source links are unreachable.

## 8. UI acceptance contract

One page, no router required. Title: `CRE Activity Radar`. A required market selector
switches Chicago/NYC through the same components and API. Clear selected cell and
reset permit type to ALL when switching; fit the map to the selected city's bounds.
Subtitle explains
permit investigation in plain language. Display exact dates and `Public snapshot`
or `Synthetic demo` prominently. Use a calm, legible desktop layout with a small
number of consistent colors; no marketing landing page.

- Top: count summary, date window, source status, permit-type filter.
- Left/main: Leaflet map; right: sortable area list. Bottom/side: selected area.
- Detail: counts, change, small accessible SVG monthly chart (with text/table data),
  geographic precision, evidence table, raw-field disclosure.
- SBA context: visually separate section labeled city-level context. Selection of
  an H3 cell never makes it look like the loans belong to that cell.
- Source health: compact disclosure, including unmatched coordinates and missing costs.

Use Leaflet GeoJSON polygons built with H3 boundary utilities and verified city
outlines if easily obtainable; otherwise a self-contained vector view with coordinate
grid and area/address labels is sufficient. Optional remote basemap tiles may improve
context, but the polygons and investigation workflow must work with tile requests
blocked. Show attribution for any tiles used and do not bulk-download a tile service.
Set an explicit map height and import Leaflet CSS. Fit bounds once after data loads;
do not reset the user's pan on every React render. Clean up the map on unmount.

All map interactions have keyboard-accessible list alternatives. Show loading,
error with retry, no-results, no-selection, missing-source and empty-evidence states.
Abort or ignore superseded detail fetches so rapid clicks cannot display stale cell
records. Escape source text with normal React rendering; never inject raw HTML.
Check at 1440x900 and 390x844; stack panels on narrow screens. UI polish must include
readable typography, number formatting, legend and coherent empty states.

## 9. Sequential task cards (10–12 focused hours target for both cities, not a guarantee)

Follow dependencies. At each checkpoint update docs/PROGRESS.md with changed files,
commands run, result, limitations and next task. Save meaningful prompts and decisions
in docs/AI_LOG.md. If a task overruns, use the cut rules, not a new architecture.

### T01 — Scaffold and synthetic vertical slice foundation (~45 min)

- [ ] Initialize git if absent and create .gitignore before adding files.
- [ ] Create one npm package, lockfile, both TS configurations, Vite and Express.
- [ ] Implement scripts above; `dev` and built `start` return a basic page and health.
- [ ] Create deterministic source-shaped fixtures for BOTH cities, both periods and 3–5 cells per city.
- [ ] Record fixture seed and mode; include no fabricated public-record provenance.
- Gate: typecheck + build pass; local page renders. Commit: `chore: scaffold local demo`.

### T02 — Source verification and acquisition (~75 min; SBA max 30 min)

- [ ] Fetch full-window Chicago extract and metadata with pagination/count checks.
- [ ] Fetch named NYC DOB NOW extract; verify IDs, renewal semantics, dates, coordinates
      and completeness using section 12. Record the exact event-counting unit.
- [ ] Save manifest + hashes; if failed, explicitly choose synthetic dataset mode.
- [ ] Attempt SBA CSV/dictionary once through available normal download mechanisms;
      verify fields before public normalization. On time-box expiry choose fallback B.
- [ ] Write exact field mappings, date/status semantics, source URLs and availability
      to docs/RESEARCH.md. Record package version decisions too.
- Gate: one valid dataset manifest; available source files verified; no hanging fetch
      dependency. Commit: `data: freeze reproducible source inputs`.

### T03 — Contracts, normalization and storage (~105 min)

- [ ] Implement section 5, source adapters, H3 assignment, schema, transactional seed.
- [ ] Implement BOTH Chicago and NYC adapters; keep source rules outside shared spatial code.
- [ ] Store raw selected fields, accepted/unresolved/rejected rows and counts.
- [ ] Add meaningful malformed-row, date, money, coordinate, duplicate and rollback tests.
- [ ] Seed twice; verify identical normalized IDs/counts and no accumulation.
- Gate: data:seed + normalization/repository tests pass. Commit: `feat: normalize auditable observations`.

### T04 — Aggregation and reconciliation (~60 min)

- [ ] Implement windows, 24 months, union of cells, metrics, deterministic ranking.
- [ ] Keep SBA context wholly separate and preserve unavailable versus zero.
- [ ] Partition all aggregates/caches by market and verify no cross-city leakage.
- [ ] Implement data:verify with report totals and evidence reconciliation.
- [ ] Add the concrete arithmetic tests in section 10.
- Gate: aggregate tests + data:verify pass. Commit: `feat: calculate traceable permit changes`.

### T05 — API (~45 min)

- [ ] Implement section 7 using app factory independent of listen().
- [ ] Integration-test filters, pagination, provenance, invalid queries, and unavailable SBA.
- [ ] Require market on relevant endpoints and test Chicago/NYC isolation.
- [ ] Serve a built frontend from the same Express process; use exact compatible route syntax.
- Gate: all API tests + typecheck pass. Commit: `feat: expose investigation API`.

### T06 — Usable investigation page (~120 min)

- [ ] Build area list and detail/evidence first, so the workflow works before the map.
- [ ] Wire Chicago/NYC selector through the SAME investigation components.
- [ ] Add map, shared selection, legend, count summary, filters and monthly chart.
- [ ] Add source health and separate SBA context/unavailable state.
- [ ] Add loading/error/empty states, responsive CSS and accessible list controls.
- Gate: manually complete choose-area -> records -> source-fields flow; test offline
      tile behavior for BOTH cities. Commit: `feat: build two-city investigation workflow`.

### T07 — End-to-end checks and correctness fixes (~60 min)

- [ ] Run section 10 tests and fresh-install verification with npm ci.
- [ ] Inspect actual rendered screenshots at desktop/mobile sizes using available tools.
- [ ] Complete market -> cell -> evidence -> raw-record flow for both cities, and test
      rapid market switches do not display stale data or wrong map bounds.
- [ ] Fix blocking behavior, stale selection, count mismatches and unreadable layouts.
- [ ] Save one real public-data finding only if supported by available complete data;
      otherwise use a plainly labeled synthetic example.
- Gate: typecheck + tests + build + e2e + data:verify pass. Commit: `test: verify reproducible investigation flow`.

### T08 — Submission readiness (~45 min)

- [ ] Write short README, decision notes and 3-minute demo script (section 11).
- [ ] Verify a clean checkout can run from bundled data without source accounts.
- [ ] Record completed/deferred tasks, dataset size, runtime version and known limits.
- [ ] Ensure no credentials, runtime DB, node_modules, or national raw downloads in git.
- Gate: all definition-of-done items below are true. Commit: `docs: explain scope evidence and tradeoffs`.

Budget about 75 additional minutes for setup/network/debugging. These durations are
planning targets; do not declare completion based on elapsed time.

Both cities are mandatory and may not be silently cut to meet a time estimate.
Cut rules: no working investigation flow by hour 5 -> stop SBA work and all optional
UI controls; keep ALL-types flow correct. At hour 7 -> freeze features and reserve
remaining time for verification/README. Never cut provenance, honest data labels,
working startup, or arithmetic correctness. Update documented scope if type filters
are cut; remove nonworking controls and their advertised endpoints.

## 10. Meaningful verification

Use a hand-computable synthetic fixture; expected results must not be generated by
the same aggregation function being tested.

- Cell A: prior 2/current 5 -> +3/+150%; cell B: prior 0/current 1 -> no baseline;
  cell C: prior 3/current 0 -> -3/-100%. Only A meets the default volume threshold;
  B/C require the low-volume toggle. All three remain in the underlying union.
  Unknown empty cell has 404 detail.
- Include distinct records on 2024-07-01, 2025-07-01 and 2026-07-01. First is prior,
  second current, last excluded. A 2025-02-30 row is rejected. Months are zero-filled.
- Include one accepted current-period permit with missing coordinates: city accepted
  count increases; sum of mapped cell counts does not; unresolved count increases.
- Include duplicate ID/payload, a conflicting duplicate variant, missing ID, blank
  coordinate, swapped coordinate, null cost, zero cost and malformed amount.
- Test exact decimal parsing (e.g. 123.45 -> 12345), not binary-float equality.
- Seed same data twice -> same counts; failed seed -> previously working DB preserved.
- Filtered cell counts equal total filtered evidence rows across all pages. Prior
  evidence cannot contain current-period rows. Pagination has no overlaps/gaps.
- Public/synthetic source status flows through summary, detail and UI. Missing SBA
  produces unavailable, not $0; no loan ever appears in a permit cell response.
- An intentionally incomplete manifest disables percentage comparison and change ranking.
- GeoJSON cells containing known Chicago/NYC test points appear in their own cities; check
  coordinate order and closed polygon ring. Avoid snapshotting incidental CSS.

Playwright: one primary test loads the seeded deterministic dataset, selects a list
row, verifies detail counts, switches evidence period, opens source fields, changes
filter, selects a polygon and confirms list selection. Another tests missing SBA,
empty results and tile requests blocked. Fixture selectors derive from stable IDs
or accessible names. Use a separate test DB via a cross-platform launcher/env config;
never overwrite the public demo DB to run e2e tests.

Final fresh-checkout run:

```powershell
npm.cmd ci
npm.cmd run data:seed
npm.cmd run data:verify
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd start
```

Browser installation is for tests, not a runtime requirement. If tooling blocks
browser verification, state exactly what was not verified and do the best available
manual check; never report an unrun check as passing.

Definition of done: startup instructions work; bundled data is sufficient; complete
investigation flow works; totals reconcile; dates and precision are honest; no broken
controls; core tests pass; screenshots reviewed; README matches delivered behavior;
prompt/commit history retained. BOTH city workflows and adapters must pass this gate.
Public SBA availability is not allowed to block it. Synthetic mode still requires
both real adapter implementations exercised by source-shaped fixtures.

## 11. README and interview story

README target: roughly 600–900 words, plus links to deeper notes. Lead with user,
problem and what runs, then quickstart, screenshot, source scope, decisions,
validation, limitations and next steps. Include exact verified commands.

Three-minute demo:

1. Name the analyst's investigation decision and show fixed dates/data status.
2. Explain list ordering and choose an area with meaningful absolute change.
3. Open evidence; show which specific permits explain the aggregate.
4. Show geography and source quality; explain why unmapped permits remain counted.
5. Switch to NYC and repeat the evidence drill-down through the same UI; explain
   source differences and why city totals are not directly comparable.
6. Show broader SBA context if available, explaining why it does not belong in a cell.
7. End with one validated limitation and the next user-research question.

Decision notes should cover: two adapters sharing one domain and UI, why H3 despite boundary/scale effects,
fixed resolution as a visualization choice (not a discovered submarket), separate
geographic scales, approval versus deployment semantics, SQLite/runtime tradeoff,
offline snapshot, source-coordinate uncertainty, no magic score, and the source
quality limits of mixed permit types. Current upstream snapshots can contain revisions
and cannot recreate exactly what was knowable at the historical approval/issue date.

Next research question: would an analyst actually use the ranked list to choose an
investigation, and what evidence makes it worth their time? Next engineering step
depends on that answer; candidates include property/use classification, geographic
context and better freshness, rather than adding cities solely to demonstrate adapters.

Save real prompts and resulting decisions as work occurs. Do not reconstruct a fake
prompt history or claim all 38 earlier ideas were independently researched here.

## 12. Required NYC adapter (integrated into T02–T07)

Implement a working second market, not just an adapter test. Choose one named NYC
dataset: DOB NOW approved permits
`rbx6-tga4`; it is not all NYC permit activity. Verify source identity and renewal/
sequence semantics before counting. Native latitude/longitude first. PLUTO
`64uk-42ks` is a fallback for missing coordinates; retain lookup release/provenance.

If implementing the join: normalize a BBL to borough digit + zero-padded 5-digit
block + zero-padded 4-digit lot. Preserve it as a string, reject invalid parts, and
test a known match, no match, and ambiguous lookup. Unmatched remains an accepted
unresolved record. Parcel splits/merges and historical mismatches remain limitations.

Use separate source fixtures and adapter contract tests returning the shared Permit
domain shape. Both markets must work through the common aggregation/API/UI. Describe
NYC coverage as DOB NOW Build, not all municipal permits. Do not rank cities against
one another: permit coverage and counting units differ. Source-specific type labels
remain separate; do not invent equivalence with Chicago categories.

NYC fetch uses `https://data.cityofnewyork.us/resource/rbx6-tga4.json`, filtering the
same two-year window on `issued_date`. Verify a stable unique/composite key using
`job_filing_number`, `work_permit`, `sequence_number` and any documented unique ID.
Use a stable complete ordering and count reconciliation, as for Chicago. If the
dataset mixes initial permits and renewals, explicitly count issuance records and
label the unit; never claim unique construction projects. Do not sum repeated
job-level estimated costs across permits. Missing coordinates remain in quality
reports; PLUTO enrichment is needed only where feasible and useful. The architecture
must allow enrichment without forcing it on every NYC row.
