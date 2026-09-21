# CRE Activity Radar handbook

Use this page as the product documentation index. It answers the common review questions
and links to deeper material only when needed.

## Choose your path

| I want to… | Start here |
| --- | --- |
| Understand the product in two minutes | [What is this?](#what-is-this) |
| Run it locally | [Run the application](#run-the-application) |
| Use every analyst feature | [Analyst workflow](#analyst-workflow) |
| Understand Chicago versus NYC | [Market differences](#market-differences) |
| Inspect data sources and limitations | [Source inventory](#source-inventory) |
| Operate or refresh the data | [Data operations](#data-operations) |
| Review architecture and tradeoffs | [Engineering decisions](#engineering-decisions) |
| Understand tests and release status | [Verification](#verification) |
| Understand positioning and hard questions | [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) |
| Follow the concise product walkthrough | [DEMO.md](DEMO.md) |

## What is this?

CRE Activity Radar is an auditable public-data investigation workflow for a CRE market
research analyst supporting a recurring broker review. It answers three bounded questions:

1. Which local areas deserve the next research step?
2. Why did an area surface?
3. Which source evidence and caveats must be checked before treating it as a lead?

The product automates the repetitive first pass: retrieve and normalize municipal records,
hold comparison windows constant, group mapped records into H3 cells, rank a short queue,
explain each candidate, preserve an analyst disposition, and export its evidence. It does
not predict demand, value property, identify tenants, recommend an investment, or prove that
a permit represents a unique project or construction start.

## Run the application

### Quick reviewer demo

```powershell
npm.cmd install
npm.cmd run demo
```

Open `http://127.0.0.1:3001`. The terminal remains occupied while the server runs; press
`Ctrl+C` to stop it. A clean checkout uses retained permit samples and deterministic
integration fixtures.

### Complete Chicago and NYC permit extracts

```powershell
npm.cmd run data:setup:full
npm.cmd run demo
```

The setup command fetches both fixed-window official permit sources, stages and reconciles
them, seeds SQLite, and verifies the result. It downloads more than 200 MB. ZAP and ACRIS
have separate optional refresh commands. SBA requires a separately verified local CSV.

## Analyst workflow

### 1. Discover at city scale

Open **City discovery**, select a market, exact permit type or CRE work-intent lens, and
review the ranked queue with the H3 heatmap. The numeric gradient shows current permit-record
count. Ranking can use recorded change, current records, or the largest current individual
reported estimate. Low-volume visibility is an explicit triage choice.

In NYC, **Property context** can narrow the queue using an exact DOB BBL to PLUTO-snapshot
land-use join. A minimum reported estimate filters individual records. Neither control turns
cost into investment or parcel context into proof of permit purpose.

### 2. Investigate one H3

Select a queue card or map hexagon. The Research workspace keeps the H3 anchored while local
filters change. The brief shows:

- current and prior record counts with safe zero-baseline handling;
- automatic full-H3 composition and the active local scope;
- permit-type drivers and monthly persistence;
- repeated supplied addresses that may require project de-duplication;
- largest individual reported estimates and missing-cost coverage;
- qualification rule evidence, caveats, and recommended next checks;
- paginated source records and official publisher links.

Use **Back to whole city** to clear the selected H3 while preserving global discovery
filters.

### 3. Remember versus deliberately save

**Recently viewed areas** stores the latest five navigation visits for quick return.
**Signal inventory** contains only leads an analyst deliberately saves. A saved lead carries
its market, H3, filters, dataset identity, signal explanation, disposition, note, next
checks, and timestamp. Analysts can recall, filter, remove, and export one evidence packet
or an HTML portfolio report.

### 4. Inspect separate NYC context

**NYC entitlements** shows ZAP applications as a separate evidence family. **Recorded deeds**
shows bounded ACRIS exact-DEED evidence. Neither changes the permit queue. This separation
prevents different events, identities, dates, and geography from becoming an opaque score.

### 5. Check methods and operations

**Data & methods** explains every work-intent lens, source mapping, ambiguity, and source
limit. **Data operations** reports the active dataset, source accounting, freshness, job
history, and guarded refresh actions.

## Feature inventory

| Area | Delivered behavior | Deliberate boundary |
| --- | --- | --- |
| Permit discovery | Two cities, fixed windows, work-intent lenses, H3 queue and heatmap | No cross-city leaderboard or opportunity score |
| Map | Street/satellite options, gradient legend, persistent selection | H3 is not a parcel, neighborhood, or submarket |
| Investigation brief | Drivers, cadence, address repetition, cost coverage, qualification, evidence | A lead, not a prediction or causal conclusion |
| NYC property context | Exact canonical BBL join and direct PLUTO `landuse` categories | Current parcel context, not tenancy or permit use |
| Reported estimates | Individual minimum and largest-record ordering | Never summed into project or area investment |
| Research memory | Latest five visits plus separate saved Signal Inventory | Browser-local prototype storage, not shared CRM |
| Exports | Lead JSON/HTML and portfolio report | Evidence snapshot, not an investment report |
| NYC ZAP | Distinct-project entitlement context and guarded refresh | Separate from permit ranking; fixture is not live coverage |
| NYC ACRIS | Exact DEED, distinct documents, multi-BBL preservation | Four boroughs; `document_amt` is not sale price |
| SBA 504 | Borrower-city approval context when verified data is supplied | No H3 placement and no permit-ranking effect |
| Operations | Staged jobs, idempotence, validation, atomic activation, accounting | Local admin prototype without production authentication |

## Market differences

| Capability | Chicago | New York City | Why |
| --- | --- | --- | --- |
| Primary permit source | Chicago Building Permits | DOB NOW: Build Approved Permits | Different publishers and event semantics |
| Work-intent lenses | Yes | Yes | Explicit mappings per source taxonomy |
| Property context | Unavailable | PLUTO snapshot categories | NYC DOB provides a defensible BBL; retained Chicago permits do not provide an audited parcel key |
| Cost field | `reported_cost` | `estimated_job_costs` | Both are incomplete applicant estimates |
| Entitlement context | Not implemented | ZAP | Audited NYC project/BBL/PLUTO contract |
| Recorded deeds | Blocked pending PIN geography | Bounded ACRIS page | NYC association was audited; Chicago placement is not yet defensible |

The shared workflow is consistent, but feature parity is not forced when source identity or
meaning differs. A missing capability is visible rather than filled with fuzzy address,
keyword, cost, or nearest-parcel inference.

## Source inventory

| Source | What the product uses | What it cannot establish |
| --- | --- | --- |
| Chicago permits | Issuance date, official categories, applicant estimate, supplied location | Unique project, start/completion, property use, investment or demand |
| NYC DOB NOW | Approved/issued record, work type, estimate, supplied location and BBL | All DOB systems, unique project, outcome or tenancy |
| NYC PLUTO | Current tax-lot land-use context and parcel centroids where contracted | Historic use, current tenant, permit purpose or exact survey location |
| NYC ZAP | Public entitlement applications and validated BBL associations | Guaranteed approval, development completion or causal link to permits |
| NYC ACRIS | Exact DEED documents and legal BBL associations | Staten Island coverage, sale price from `document_amt`, redevelopment cause |
| SBA 504 | Borrower-city loan approval context | Project location, disbursement, construction or space demand |

See [RESEARCH.md](RESEARCH.md) for the current source index and the focused appendices for
[NYC property use](NYC_PROPERTY_USE_AUDIT.md),
[Chicago property use](CHICAGO_PROPERTY_USE_AUDIT.md),
[ACRIS](TRANSACTION_SOURCE_AUDIT.md), and [SBA](SBA_STATUS.md).

## Corner cases

- A prior count of zero and positive current count displays **New activity**, never infinity.
- Partial demo samples disable comparison percentages and growth ranking.
- Unmapped records remain in city/source accounting but never receive an invented H3.
- Missing reported cost is not zero and is excluded by a positive minimum-cost filter.
- Duplicate source identities are rejected or explicitly accounted for; refresh does not
  append the same file repeatedly.
- An H3 that has no records under local refinement stays selected and offers recovery.
- Global filters do not overwrite a customized H3 drill-down.
- Recent history is navigation; only an explicit save creates a Signal Inventory item.
- NYC property rows with missing, invalid, unmatched, or unsupported BBL/land-use evidence
  remain `UNKNOWN`.
- ACRIS multi-BBL deeds remain one distinct document citywide and once per relevant H3.
- Failed staged refreshes preserve the last active verified dataset.

## Data operations

Permit acquisition freezes selected fields for fixed dates, verifies publisher row counts,
checks identity uniqueness, computes checksums, and only then replaces the prior raw file.
Seeding is transactional and idempotent. ZAP and ACRIS refreshes use immutable snapshots,
rebuild and verify before activation, report `UP_TO_DATE` for unchanged publishers, and
preserve the active pointer on failure.

The local Operations page exposes allowlisted jobs only. A production version would add
authentication, roles, durable orchestration, secret management, retention policy, audit
logs, monitoring, and source service-level objectives.

## Engineering decisions

### Why start with Chicago and NYC before extracting a global pattern?

A universal adapter designed from one source would encode accidental assumptions. Chicago
and NYC exposed real differences in identity, categories, coverage, coordinates, and parcel
association. Implementing two concrete adapters first revealed the stable shared contract:
normalized permit evidence, fixed windows, mapping/accounting, H3 display, lenses, and the
investigation brief. ZAP, ACRIS, and SBA remain separate contracts because they are different
events rather than awkward permit variants. A third permit market would test and refine the
extension interface before claiming national generality.

### Why one TypeScript repository?

The take-home is a bounded vertical product. One package keeps React UI, Express API, shared
contracts, pure domain logic, source adapters, scripts, tests, and docs versioned together.
Reviewers can trace a source field to an API response, UI disclosure, export, and test without
distributed deployment overhead. Production scale may split acquisition workers and serving
infrastructure when operational needs justify it.

### Why SQLite?

It provides a repeatable, portable local snapshot with transactional rebuilds and no hosted
dependency. It is appropriate for a single-user demonstration. It is not presented as the
final concurrent analytics platform.

### Why deterministic rules instead of an AI score?

There is no labeled outcome, calibrated model, or validated causal target. Transparent
counts, explicit mappings, qualification rules, and evidence preserve analyst judgment and
make errors reviewable.

## Verification

The release passed:

- data seed and source/accounting verification;
- TypeScript checking and production build;
- 63 Vitest unit/integration tests across 16 files;
- 13 serial Playwright browser workflows from a fresh built server;
- desktop/mobile screenshots and the property-context workflow review.

Tests focus on semantic risks: identity, normalization, date boundaries, source accounting,
zero baselines, property classification, cost handling, refresh idempotence, ZAP/ACRIS
safeguards, URL restoration, H3 refinement, and saved-lead behavior.

## Completed and pending

**Completed:** two-market permit discovery, explainable H3 research, NYC property context,
individual-estimate controls, saved leads and exports, separate ZAP/ACRIS context, guarded
operations, full-data permit bootstrap, automated tests, interview materials, and a
repeatable narrated-video build.

**Pending after submission:** observe working CRE analysts and measure whether the workflow
changes a defensible next action; add production authentication/orchestration; implement a
production-scale PLUTO enrichment refresh; audit a Chicago parcel/PIN association before
sales or property-use placement; and evaluate licenses, certificates of occupancy, and
violations only through separate verified source contracts.

## More detail

- [Three-minute demo](DEMO.md)
- [Narrated case-study storyboard](NARRATED_DEMO.md)
- [Product positioning and hard questions](PRODUCT_BRIEF.md)
- [Product brief and FAQ](PRODUCT_BRIEF.md)
- [Task-oriented manual](MANUAL.md)
- [Architecture and product decisions](DECISIONS.md)
