# CRE Activity Radar

CRE Activity Radar is a local prototype for a **CRE market research analyst supporting brokers' weekly market review**. It converts public permit changes into an auditable investigation queue: **which local areas deserve the next research step, why did they surface, and which source records must be checked before a broker treats the pattern as meaningful?**

Its output is an Investigation Brief for a selected area. The brief connects a fixed-window count change to its permit-type mix, current-period cadence, repeated supplied addresses, selected high reported-cost evidence, source-quality context, retained records, and recommended verification steps. It is a research triage aid, not a prediction, property valuation, investment recommendation, or demand signal.

**Start with the task-oriented [product manual](docs/MANUAL.md)** for a guided tour, question index, source caveats, troubleshooting, and API examples. For the review conversation, use the concise [interview preparation guide](docs/INTERVIEW_PREP.md) and [three-minute demo](docs/DEMO.md).

The working hypothesis is that analysts benefit from transparent, count-based triage before they spend time on proprietary property, leasing, or broker research. This is a product hypothesis, not a claim that users were interviewed or that the prototype has measured time savings, predictive accuracy, or causal insight.

## What it builds

The application supports the same local investigation workflow for **Chicago** and **New York City**. City discovery contains the permit queue and heatmap; selecting an area opens Research workspace. Research combines the active H3 with the latest five navigation visits and the separate, deliberate Signal Inventory. **Back to whole city** clears the H3 while preserving global filters. NYC entitlements, NYC recorded deeds, Data & methods, and Data Operations have focused pages instead of competing for space on discovery. Analysts can record a disposition and note, recall/filter/remove a lead, and export either one evidence packet or the parked-lead portfolio as JSON/HTML. Queue candidates are never saved automatically. Source-health panels report accepted, rejected, duplicate, out-of-scope, mapped, and unmapped rows so a viewer can assess coverage before interpreting a change.

This is a product hypothesis, formed from desk research and the constraints of public data. No analyst interviews, adoption study, predictive validation, or measured time savings are claimed. The intended workflow and its explicit limits are in [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md).

It also shows SBA 504 approvals as a collapsed, experimental city-labelled context panel and evidence list. Those approvals never affect permit-cell colors, rankings, or detail evidence. The application keeps the two indicators separate because an approval has a different geography, timing, and meaning from a permit record.

For NYC, the application also shows a separate ZAP entitlement context. A clean checkout
uses deterministic retained fixtures; **Refresh NYC ZAP** or `npm.cmd run data:fetch:zap`
acquires the official current Socrata snapshots. It uses validated ZAP BBL associations and PLUTO parcel
centroids, counts distinct projects citywide, and never changes the permit queue. Its
all-record view is primary; the filed-date view discloses incomplete filing-date coverage.
The bundled ZAP fixture demonstrates the integration and must not be described as a live
or complete current ZAP snapshot. Live acquisition writes immutable checksummed snapshots,
validates row completeness, rebuilds an isolated database, and advances the active pointer
only after success. An unchanged publisher version returns `UP_TO_DATE` without rebuilding.

NYC also has a separate ACRIS recorded-deed evidence page. It includes only exact raw
`DEED` records, counts distinct document IDs, preserves multi-BBL associations, and places
only coordinate-bearing PLUTO matches at parcel-centroid precision. It explicitly excludes
Staten Island, never presents `document_amt` as a sale price, and never changes the permit
queue. The bundled fixture proves the integration; **Refresh NYC recorded deeds** or
`npm.cmd run data:fetch:acris` performs the guarded official-source refresh.

The comparison windows are fixed for reproducibility:

| Period | Dates |
| --- | --- |
| Prior | 2024-07-01 through 2025-06-30 (`[2024-07-01, 2025-07-01)`) |
| Current | 2025-07-01 through 2026-06-30 (`[2025-07-01, 2026-07-01)`) |

The visible label is “Jul 2025–Jun 2026 versus Jul 2024–Jun 2025.” These dates are not calculated from today or from the latest observed record.

## Data semantics and limits

Chicago uses the City of Chicago Building Permits dataset. Its `issue_date` is treated as a recorded permit-issuance event, not a construction start or a unique development project. NYC uses DOB NOW: Build approved permits. That dataset excludes some permit systems (including electrical, elevator, and limited-alteration application data), and a DOB NOW issuance record is also not a unique project. Both sources retain mixed residential and commercial activity. NYC offers a bounded **property context** filter by exact DOB BBL to the bundled PLUTO snapshot and direct `landuse` categories. It is parcel context, not proof of tenancy or permit purpose. Chicago has no audited parcel-use join, so the UI explicitly leaves this filter unavailable instead of guessing from descriptions, cost, or coordinates.

`reported_cost` (Chicago) and `estimated_job_costs` (NYC) are applicant-reported estimates. The UI can filter by a minimum individual value and rank H3 areas by their largest current individual record. Values remain row-level evidence: they are never summed or called construction investment, because multiple permits may overlap one project and missing values are not zero.

SBA records use 504 `ApprovalDate` and `GrossApproval`, which the published dictionary defines as the total loan amount. They are approval records, not proof of disbursement, completed work, or tenant/space demand. Their `BorrCity` fields are borrower geography, not project geography. Chicago context includes exact normalized `CHICAGO`, Illinois borrower-city labels; NYC context includes exact `NEW YORK`, `BROOKLYN`, `BRONX`, `QUEENS`, and `STATEN ISLAND`, New York labels. Other plausible local labels such as Flushing and Jamaica are excluded without a maintained crosswalk. A later loan status remains visible but is not used to rewrite historical approval activity.

The SBA source snapshot is as of 2026-06-30, so the nominal current window ends on that date. It must not be described as a July 2026-complete source.

## Architecture and spatial choices

The project is one TypeScript package: React/Vite renders the browser UI, Express exposes typed local APIs, and Node’s built-in SQLite stores a seeded snapshot. Source adapters normalize Chicago, NYC, and SBA rows into a common domain model. Pure date, change, and spatial functions support the server queries. Each API response carries the dataset identity and source-health metadata; record-detail endpoints preserve retained source fields and link back to the official publisher.

Resolved permit coordinates are binned with H3 at resolution 8. This is a fixed visualization grain for the prototype, not a neighborhood, submarket, parcel, or statistical finding. An H3 cell provides a stable shared spatial bucket across both market adapters. The app distinguishes that grid assignment from coordinate precision: a `SOURCE_COORDINATE` means the publisher supplied coordinates, not that their location is survey-grade or exact. Records without usable coordinates remain in city totals and source accounting, while being excluded from the map. SBA rows intentionally have no point or H3 cell: mapping borrower-city or ZIP-level financing to a local permit cell would manufacture geographic precision.

Snapshots live in SQLite so the demo is repeatable and evidence can be reviewed without a database service. It is an intentionally local, bounded choice; it is not a production concurrency or analytics architecture.

## Run it

Node **24.18.x** is the tested runtime (the package declares `>=24.18.0 <25`). On Windows PowerShell in this workspace, use `npm.cmd` because the `npm.ps1` shim may be blocked by execution policy. On macOS/Linux, replace `npm.cmd` with `npm`.

```powershell
npm.cmd ci
npm.cmd run data:seed
npm.cmd run dev
```

Open the Vite URL printed by the command (normally `http://127.0.0.1:5173`). The submitted local snapshot is `public-full-5f0dea082481-91aa29bb1cde`: 63,482 Chicago records (62,750 mapped; 732 unmapped; 8,316 without a usable cost) and 334,974 NYC records (333,591 mapped; 1,383 unmapped). Both are `complete-query` extracts over the fixed windows, retrieved on 2026-09-19. The seed script uses those complete local raw snapshots when present; otherwise it seeds bundled deterministic public retained samples. The source-health panel tells you whether a source is `complete-query` or `partial`. For partial samples, growth ranking and percentages are disabled; sample counts must not be treated as market totals.

For a built local demo:

```powershell
npm.cmd run demo
```

Useful data commands are `data:fetch:chicago`, `data:fetch:nyc`, `data:fetch:zap`, `data:fetch:acris`, `data:bundle-demo`, `data:seed`, and `data:verify`. Permit fetches query the fixed windows, freeze selected source fields, and reconcile source counts before keeping a snapshot. The ZAP fetch polls official NYC metadata, pages Project Data and BBL associations, fetches only referenced PLUTO parcels, and preserves retained snapshots for cautious change detection. `data:fetch:sba` remains an explicit source-acquisition task; the verified SBA CSV may instead be supplied under `data/raw/` and is then ingested as borrower-city context.

## Validation status

All submission checks passed against the corrected full-public dataset:

```powershell
npm.cmd run data:seed
npm.cmd run data:verify
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

The seed reports balance for every source. `data:verify` passed its accounting, date bounds, mapped/unmapped evidence, and raw-file checksum checks. TypeScript and the production build passed. Vitest passed all 63 tests across 16 files, including the unfiltered-window cache boundary, property-use classification/API/state contracts, ACRIS and ZAP safeguards, qualified-signal boundaries, refresh idempotence, investigation briefs, and normalization. The full serial Playwright suite passed all 13 workflows from a fresh built server in 49.1 seconds; the focused property-context screenshot was visually inspected. The initial NYC summary/cells/sources request batch measured 0.78 seconds after the final rebuild.

## Sources and further reading

The verified source notes, field semantics, and retrieval caveats are in [docs/RESEARCH.md](docs/RESEARCH.md); the SBA field audit and exact borrower-city policy are in [docs/SBA_STATUS.md](docs/SBA_STATUS.md). [docs/DECISIONS.md](docs/DECISIONS.md) records the boundaries that keep the prototype from overstating what its data can support. [docs/DEMO.md](docs/DEMO.md) is a three-minute walkthrough.

## Product positioning

This is not a claim that public permit counts predict CRE outcomes. Government portals can and should remain the authoritative publisher and source-specific explorer. CRE Activity Radar is a product hypothesis about a different job: help a market research analyst form and validate a small weekly investigation queue across heterogeneous public systems.

Its differentiation is the evidence-continuous workflow: fixed comparison windows, transparent prioritization, source-specific semantics, quality and provenance context, explainable diagnostics, and next checks. It uses no exclusive data and has no demonstrated durable moat, user adoption, willingness to pay, time savings, or predictive accuracy. [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) gives interview-ready answers on differentiation, H3, two-city scope, buyers, limits, and how value should be validated.
