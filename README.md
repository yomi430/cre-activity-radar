# CRE Activity Radar

CRE Activity Radar is a local research prototype for a CRE analyst preparing a market review. It makes a deliberately narrow question easier to investigate: **where did recorded permit activity change, and which source records explain it?** The map and ranked area list help choose a place to inspect; the detail panel and source links make that choice auditable before it becomes a research conclusion.

**Start with the task-oriented [product manual](docs/MANUAL.md)** for a guided tour, question index, source caveats, troubleshooting, and API examples.

The working hypothesis is that analysts benefit from transparent, count-based triage before they spend time on proprietary property, leasing, or broker research. This is a product hypothesis, not a claim that users were interviewed or that the prototype has measured time savings, predictive accuracy, or causal insight.

## What it builds

The application supports the same investigation workflow for **Chicago** and **New York City**. Choose a market, review its H3 grid of permit counts, select an area from the map or ranked list, compare the two fixed periods, and open the underlying permit evidence. The permit-type filter applies consistently to the map, list, trend, and evidence. Source-health panels report accepted, rejected, duplicate, out-of-scope, mapped, and unmapped rows so a viewer can assess coverage before interpreting a change.

It also shows SBA 504 approvals as a separate city-labelled context panel and evidence list. Those approvals never affect permit-cell colors, rankings, or detail evidence. The application keeps the two indicators separate because an approval has a different geography, timing, and meaning from a permit record.

The comparison windows are fixed for reproducibility:

| Period | Dates |
| --- | --- |
| Prior | 2024-07-01 through 2025-06-30 (`[2024-07-01, 2025-07-01)`) |
| Current | 2025-07-01 through 2026-06-30 (`[2025-07-01, 2026-07-01)`) |

The visible label is “Jul 2025–Jun 2026 versus Jul 2024–Jun 2025.” These dates are not calculated from today or from the latest observed record.

## Data semantics and limits

Chicago uses the City of Chicago Building Permits dataset. Its `issue_date` is treated as a recorded permit-issuance event, not a construction start or a unique development project. NYC uses DOB NOW: Build approved permits. That dataset excludes some permit systems (including electrical, elevator, and limited-alteration application data), and a DOB NOW issuance record is also not a unique project. Both sources retain mixed residential and commercial activity; this prototype does not claim a reliable commercial-only classification.

`reported_cost` (Chicago) and `estimated_job_costs` (NYC) are applicant-reported estimates. They are retained in row-level evidence only. They are not summed or called construction investment, because multiple permits may overlap one project and missing values are not zero.

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

Useful data commands are `data:fetch:chicago`, `data:fetch:nyc`, `data:bundle-demo`, `data:seed`, and `data:verify`. Permit fetches query the fixed windows, freeze selected source fields, and reconcile source counts before keeping a snapshot. `data:fetch:sba` remains an explicit source-acquisition task; the verified SBA CSV may instead be supplied under `data/raw/` and is then ingested as borrower-city context. No normal app command fetches from a third-party API.

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

The seed reports balance for every source. `data:verify` passed its accounting, date bounds, mapped/unmapped evidence, and raw-file checksum checks. TypeScript, production build, and all four Vitest tests passed. API smoke passed for both markets; it reported Chicago current/prior permit totals of 31,555/31,927 and NYC totals of 168,852/166,122. These are source-record counts for the stated datasets, not findings about project starts or investment. The optimized NYC cell response was approximately 756 KB and 3.4 seconds in a warm local run; selected-area detail returns its 24 monthly values. Playwright passed two workflows: the two-city desktop investigation and a 390×844 mobile flow. Desktop Chicago/NYC and mobile layouts were visually inspected and were readable and functional, with no blocking issue observed.

## Sources and further reading

The verified source notes, field semantics, and retrieval caveats are in [docs/RESEARCH.md](docs/RESEARCH.md); the SBA field audit and exact borrower-city policy are in [docs/SBA_STATUS.md](docs/SBA_STATUS.md). [docs/DECISIONS.md](docs/DECISIONS.md) records the boundaries that keep the prototype from overstating what its data can support. [docs/DEMO.md](docs/DEMO.md) is a three-minute walkthrough.
