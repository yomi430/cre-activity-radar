# Progress

## 2026-09-19 final value workflow

The planned release is complete except for the separately deferred NYC ZAP entitlement
layer. Auditable permit lenses now filter the Chicago and NYC queue, map, brief, and
evidence with explicit confidence, ambiguity, raw mappings, and `UNCLASSIFIED`
coverage. The investigation loop now includes dispositions, notes, a browser-local
watchlist, restored selections, and JSON/HTML evidence export. The map has a sequential
current-count gradient and numeric legend. SBA is collapsed and labelled experimental.

Operations now supports an idempotent staged refresh: inspect, publisher check, fetch
only when changed, validate, isolated rebuild, verify, and atomic swap. Job state and
bounded output survive a server restart. Final checks passed: 19/19 Vitest tests,
3/3 Playwright flows, typecheck, `data:verify`, and production build. Commits:
`0ee197a`, `3210570`, `c9594b3`, and `332340f`.

NYC ZAP remains the next product increment. The exact official dataset IDs, join rules,
status semantics, and cautions are preserved in `PERPLEXITY_LENS_ZAP_AUDIT.md`.

## 2026-09-19 value release

The value upgrade is complete and verified. It adds the queue-first analyst workflow,
deterministic Investigation Briefs, street/satellite basemaps, and a Data Operations
view backed by safe allowlisted local jobs. Chicago and NYC are both supported.

Final checks: typecheck passed; 10/10 unit/integration tests passed; public dataset
verification passed; production build passed; and 3/3 Playwright flows passed across
Chicago, NYC, mobile, and Data Operations. Generated desktop and Operations screenshots
were reviewed. Old local CRE processes were terminated after testing.

The content below records earlier implementation history and may describe checks that
were still pending at that earlier checkpoint.

Current task: T07 — complete public-data backend, API, and integration verification.

The local runtime database is a full public snapshot named `public-full-5f0dea082481-91aa29bb1cde`. Chicago is frozen and reconciled at 63,482 rows; NYC DOB NOW Build is frozen and reconciled at 334,974 rows. Both are complete-query selected-field extracts for `[2024-07-01, 2026-07-01)`. The transactional SQLite import accepts 398,456 permits: Chicago 62,750 mapped / 732 unresolved, NYC 333,591 mapped / 1,383 unresolved.

The backend now streams source input into a SQLite schema, retains invalid geography as accepted unresolved permits, assigns H3 resolution 8 only to valid source coordinates, records explicit source accounting, serves 24-month zero-filled cells, safe change semantics, typed pagination, evidence, raw provenance, source reports and SBA context. NYC uses `source_row_id` snapshot identity and explicitly counts DOB NOW Build issuance records rather than projects. SBA uses snapshot row ordinal plus canonical fingerprint because `LocationID` is a lender identifier, not a loan identifier.

SBA 504 data was audited locally against its dictionary: 117,983 national source rows as of 2026-06-30, `ApprovalDate` and `GrossApproval` are used, and city is borrower geography. Context has 97 Chicago-labelled rows and 74 rows matching only five explicit NYC borough labels across both periods. It never changes cell counts or map placement.

Checks actually completed: `npm.cmd run typecheck`, `npm.cmd run build:server`, `npm.cmd run data:seed`, and `npm.cmd run data:verify` passed. `node scripts/smoke-api.mjs` passed against the built local server: Chicago current/prior 31,555/31,927 across 807 mapped cells; NYC 168,852/166,122 across 1,078 mapped cells. Initial `npm.cmd test` inside the ordinary sandbox was blocked by Vite/esbuild Windows directory resolution; the elevated rerun found one mistaken normalization assertion, fixed in this worktree, and needs a final rerun.

Known limits: the runtime SQLite file is ignored (~487 MB). `npm.cmd run data:bundle-demo` creates deterministic compact public retained samples for checkouts without raw data; its manifest is explicitly `partial`, so comparison percentages and ranking must remain disabled. No commercial-only classifier, project-level count, or precise SBA geography is claimed. The final API performance pass is in progress: `/api/cells` originally used an N+1 query shape and is being replaced with bulk aggregation.
