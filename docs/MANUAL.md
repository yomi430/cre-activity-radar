# CRE Activity Radar manual

## Navigating the workspace

Use **City discovery** to choose market-wide filters, compare ranked H3 areas, and use the map. Selecting a card or hexagon opens **Research workspace**, where the selected H3 has its own drill-down, evidence, qualification, and lead-saving controls. **Back to whole city** clears the H3 while keeping the market and global discovery filters.

Research contains two browser-local memory tools. **Recently viewed areas** keeps the latest five H3 visits for navigation and shows each H3 ID. **Signal inventory** contains only leads deliberately saved with a disposition or note. Opening either restores its market and H3 context; clearing recent history does not delete saved signals.

For NYC, **NYC entitlements** contains ZAP as a separate earlier-stage layer. **Recorded deeds** contains four-borough ACRIS deed evidence as a separate ownership-research context. **Data & methods** explains every CRE lens and exact source mapping, source quality, and SBA context. **Data operations** contains controlled refresh and verification jobs.

This manual helps a CRE analyst use the prototype to decide which recorded permit activity deserves a closer look. It does not provide an AI chatbot, an answer engine, a forecast, a property valuation, or a recommendation. It makes the evidence behind a narrow, repeatable first pass easy to inspect.

The comparison is always **Jul 2025–Jun 2026** (`[2025-07-01, 2026-07-01)`) versus **Jul 2024–Jun 2025** (`[2024-07-01, 2025-07-01)`).

## Quick question index

| If your question is… | Go to |
| --- | --- |
| “What can I investigate in five minutes?” | [Guided tour](#five-minute-guided-tour) |
| “Where is permit activity highest or rising?” | [Map, list, and ranking](#map-list-and-ranking) |
| “Why does a change show ‘New activity’?” | [Change math](#change-math-and-no-baseline) |
| “Which records created this area count?” | [Evidence and provenance](#evidence-and-provenance) |
| “Can I trust this source or map coverage?” | [Source quality](#source-quality-and-accounting) |
| “Does SBA financing support this cell?” | [SBA context](#sba-504-context-is-separate) |
| “What recorded-deed evidence is available in NYC?” | [NYC recorded deeds](#nyc-recorded-deeds) |
| “What exactly does a permit or dollar amount mean?” | [Data semantics](#exact-data-semantics) |
| “Why is the app empty or the map not visible?” | [Troubleshooting](#troubleshooting) |
| “Can I inspect the data programmatically?” | [API examples](#api-examples) |

## Choose your path

- **I am preparing a Chicago review:** select **Chicago**, then follow [map, list, and ranking](#map-list-and-ranking).
- **I am preparing a New York City review:** select **New York City** and use the same flow, then read the NYC caveat in [data semantics](#exact-data-semantics).
- **I have an area already:** use the map or area list, then go directly to [evidence and provenance](#evidence-and-provenance).
- **I am checking data reliability:** begin with [source quality](#source-quality-and-accounting), then inspect an evidence record.
- **I am exploring small-business financing:** go to [SBA context](#sba-504-context-is-separate); do not use it to select a permit cell.

<details>
<summary>What the first screen tells you</summary>

The top summary shows the market, fixed windows, accepted permit count, mapped and unmapped count, and permit-type selector. “Public snapshot” identifies the submitted source mode. The source-quality section at the bottom identifies publisher source, completeness, ingestion outcomes, coordinate coverage, retrieval date, and a source link.
</details>

## Five-minute guided tour

1. Start the local app with `npm.cmd run data:seed` then `npm.cmd run dev` on Windows PowerShell, or replace `npm.cmd` with `npm` elsewhere. Open the Vite address displayed in the terminal.
2. Choose a **CRE lens**, such as Ground-up & site work. Expand **What this lens includes** to inspect exact source mappings, confidence, and ambiguity. Keep **All types** unless you also need one exact publisher category.
3. In **Areas to investigate**, keep **Largest increase** to prioritize absolute count gain, or choose **Current count** to prioritize volume. The initial list hides areas with fewer than five permits across both periods; enable **Show low-volume areas** when those matter to the question.
4. Click an area-list row or an H3 polygon. Both select the same area and open its detail below.
5. Read current, prior, absolute change, safe percentage treatment, and the 24-month chart. Hover chart bars for individual monthly counts; open **Monthly values** for text values.
6. In **Permit evidence**, switch between Current and Prior, paginate with Next/Previous, and click a permit type to open its retained source fields and official source link.
7. Set a disposition, add a note, save the investigation, and export JSON or HTML for handoff.
8. Review **Source quality** before treating the pattern as useful. If the source is partial, the app disables growth comparison and ranks by current count. SBA is optional experimental city-level context only.

## Chicago and NYC flows

### Chicago

Select **Chicago**. Chicago area counts come from City of Chicago Building Permits records in the fixed dates. Select a cell, compare its periods, and inspect evidence. The source record dialog links to the official Chicago resource query for that record.

### New York City

Select **New York City**. Changing market resets the type filter to All types and clears the selected area, so stale Chicago evidence cannot be carried into NYC. Repeat the same selection and evidence flow. The record dialog links to NYC DOB NOW: Build. Its coverage differs from Chicago’s source, so use the app to investigate within NYC and do not create a cross-city cell ranking.

### NYC recorded deeds

Open **Recorded deeds** after selecting New York City. The page counts distinct ACRIS
document IDs whose raw type is exactly `DEED`, shows multi-BBL and PLUTO-match quality,
lists parcel-centroid H3 placements, and can look up a retained document ID. Use it to decide
what property or ownership research to do next. Do not sum H3 rows into a city total: one
multi-BBL deed can appear in more than one cell. ACRIS covers Manhattan, Bronx, Brooklyn,
and Queens; Staten Island is outside this source. `document_amt` is debt or obligation and
is never shown as sale price. JSON and HTML exports preserve these limitations.

<details>
<summary>Can I compare a Chicago cell directly with an NYC cell?</summary>

No. H3 provides a common display grid, but publisher systems, coverage, issuing practice, coordinate completeness, and overall volumes differ. The market selector supports two consistent local workflows, not a combined leaderboard.
</details>

## Map, list, and ranking

The map colors H3 resolution-8 polygons by **current permit count**. A darker cell means more current-window records for the active market and permit-type filter; it does not mean more growth, value, demand, development, or investment. Hover a polygon for its current count and click it to select it.

The area list and map share the same market, permit-type filter, and low-volume setting. The list can rank by:

- **Largest increase:** current count minus prior count, descending; then current count.
- **Current count:** current-window count, descending.
- **Largest individual reported estimate:** the highest current record-level applicant estimate in the H3, with current count as the tie-breaker. It is not an area total.

In NYC, **Property context** applies an exact BBL join to a PLUTO snapshot. By default that
snapshot is a bundled 8-parcel fixture — enough to prove the join works, not for coverage. Run
`npm run data:fetch:pluto` to pull the complete, current NYC PLUTO dataset (858,284 real
parcels) and `npm run data:seed` will use it automatically instead of the fixture; expect this
to change property-context coverage substantially (from a handful of qualifying H3 cells to
roughly 240 in the current comparison window, in one measured run against the bundled permit
sample). The categories describe the tax lot in whichever snapshot is active; they do not prove
current tenancy or the permit work's use. `Unknown` keeps missing, invalid, unmatched, and
unsupported source cases visible. Chicago shows this control as unavailable because no
equivalent audited join exists. The minimum-estimate control compares individual records and
excludes missing values; zero means no cost filter.

The default list excludes an area whose combined current and prior count is below five. This is a visible prototype triage threshold, not statistical significance. Use **Show low-volume areas** to include them. If a control causes the selected area to disappear, the app clears the selection rather than showing mismatched detail.

<details>
<summary>What is H3, and how precise is it?</summary>

H3 is the geographic grid used to group permits with usable publisher coordinates. Resolution 8 is a fixed visualization choice. A grid cell is not a neighborhood, parcel, market boundary, or real-estate submarket. “Source coordinate” means the publisher supplied the coordinate; it does not certify survey-grade or exact location.
</details>

## Lenses, filters, change math, and no baseline

**CRE lens** groups exact publisher categories into research intents. These are product mappings, not official classifications or proof of an asset class. Expand the mapping panel to see raw values, confidence, ambiguity, and source. Unknown future values remain visible under `UNCLASSIFIED`. Lens and exact permit-type filters intersect; `ALL` removes that level of filtering.

**Permit type** uses the exact source type labels available in the selected market. It filters the summary, map, ranked list, detail, and evidence together. It does not classify records as commercial, residential, or a particular asset class; NYC property context is a separate PLUTO-snapshot dimension.

For a selected cell, absolute change is `current − prior`. When the prior count is greater than zero, the app calculates `(current − prior) / prior × 100` and rounds only for display. A prior count of zero and a positive current count displays **New activity**, without an invented infinite percentage. Both periods at zero display **No baseline**. A partial source displays **Comparison unavailable** because a sample cannot support a full-period growth ranking.

## Investigation Brief

Select an eligible area from the ranked queue to open its Investigation Brief. The brief is an explanation for an analyst's next research step, not a score or recommendation. It contains:

- **Why it surfaced:** current and prior record counts, the absolute change, and baseline-aware comparison wording.
- **What drove it:** the leading exact source permit types and their current/prior counts.
- **Timing:** active current-window months, the longest consecutive active run, and the peak recorded month.
- **Repeated supplied addresses:** areas with more current-period records, alongside links back to current evidence. These are leads to de-duplicate, not proof that records represent distinct projects or one project.
- **Largest reported-cost records:** individual current records with a nonmissing applicant-reported estimate. They are not summed or interpreted as area investment.
- **Data quality and limits:** source-coordinate scope for the cell, missing-cost coverage, and source-specific issuance semantics.
- **What the evidence can and cannot suggest:** fixed language that separates an observed record pattern from a commercial conclusion.
- **Recommended next checks:** source-record review, likely address/project de-duplication, and targeted property or market research outside the prototype.

Use the brief to decide whether the selected area deserves the next research step. It cannot establish a construction start, completion, unique project, tenant choice, supply, demand, rent, valuation, or investment result.

## Evidence and provenance

The area detail gives 24 zero-filled monthly permit counts and separates Current from Prior evidence. Evidence is paginated in groups of 25 records. It includes date, source permit type, address when supplied, and applicant estimate when reported. Click the permit type to open the **Record provenance** dialog:

- retained raw source fields are displayed as JSON;
- **Open official source** goes to the publisher resource/query;
- warnings disclose missing coordinates or NYC issuance-record caveats.

This is evidence for a recorded permit event in the grid area, not proof of a construction start, completion, unique project, tenant decision, or investment thesis.

## Analyst decision, Signal Inventory, and export

For a selected area, choose **Investigate**, **Monitor**, **Dismiss**, or **Escalate**, write a note, and park it in the Signal Inventory. The inventory records the dataset, market, H3 cell, permit type, lens, qualified pattern, captured counts, next checks, and timestamp; selecting it restores that view. Filter parked leads by market, status, or pattern, or remove them. **Export JSON** and **Export HTML** on the brief create a single-lead evidence packet. The inventory exports either structured JSON or a readable portfolio report with status totals and potential areas to explore. Saves live in the current browser only and older-dataset entries are labelled for recomputation.

## Data Operations

Open **Data Operations** to inspect the active dataset and recent job state. Verify checks the current database. Refresh inspects the manifest, checks the publisher, returns `UP_TO_DATE` when unchanged, or fetches, validates, rebuilds an isolated database, verifies it, and swaps it atomically. `FAILED` preserves the active database and exposes bounded diagnostic output. Refresh maintains the fixed analysis window; the publisher's newest observed date is disclosed separately.

## Source quality and accounting

Read the source-quality panel before interpreting an area. It reports:

| Field | Meaning |
| --- | --- |
| Accepted | Valid in-scope observations retained for the market. |
| Rejected | Rows missing required usable fields or otherwise invalid. |
| Duplicate | Repeated source identity detected during ingestion. |
| Mapped | Accepted permits with valid market-bounded coordinates and an H3 cell. |
| Unmatched | Accepted permits without usable map geography; they remain in city totals. |
| Missing costs | Accepted permit records without a usable nonnegative applicant estimate. |
| Completeness | `complete-query`, `partial`, synthetic, or unavailable as represented by the seeded source. |

For one full-extract snapshot retrieved 2026-09-19, Chicago contained 63,482 accepted permits (62,750 mapped, 732 unmapped) and NYC contained 334,974 accepted permits (333,591 mapped, 1,383 unmapped); a re-fetch on 2026-09-21 returned 335,027 NYC permits — the coverage window is open-ended, so the source is a live, growing dataset and exact counts are tied to their retrieval date, not a fixed constant. Full query extraction, accounting balance, dates, coordinate bounds, H3 validity, and local checks are recorded by the seed and verification commands. Source records remain mutable upstream; each local snapshot is frozen for reproducible review as of its own retrieval date.

## SBA 504 context is separate

The SBA panel shows city-level 504 approval context and a few current-period evidence entries. Click an entry to inspect retained fields and the official SBA catalog link. It never changes map color, list rank, permit totals, or H3 evidence.

Chicago accepts exact normalized borrower city `CHICAGO`, Illinois. NYC accepts exact normalized borrower cities `NEW YORK`, `BROOKLYN`, `BRONX`, `QUEENS`, and `STATEN ISLAND`, New York. Labels such as Flushing and Jamaica are excluded because the source does not supply a verified borough crosswalk.

<details>
<summary>Why is an SBA approval not placed in a permit cell?</summary>

The verified available geography is borrower city, not a project coordinate or parcel. Assigning city-labelled or ZIP-level financing to one small grid cell would create a false localized signal. SBA 504 `GrossApproval` is total loan approval amount, not a disbursement, construction cost, completed project, or demand measure. A later loan status is shown for evidence but does not rewrite historical approval activity.
</details>

## NYC ZAP entitlement context

When New York City is selected, the ZAP panel shows a separate entitlement-stage source.
It does not color, filter, or rank the permit queue. Use **All tracked applications** for
the inclusive snapshot or the filed-date subset only with its displayed coverage caveat.
Projects are joined through validated ZAP BBL associations to PLUTO parcel centroids;
multi-lot projects count once within a cell and may appear in more than one cell, so cell
counts must not be summed into a citywide unique-project total.

The submitted panel is seeded from deterministic retained fixtures for demonstration.
Read its snapshot retrieval, publisher date, unvalidated/orphan/unmatched/coordinate-null
counts, and change-history disclosure before interpreting it. Missing associations are
soft-flagged for review rather than treated as confirmed deletions. Exported ZAP packets
carry the same limitations.

Use **Data Operations → Refresh NYC ZAP** to check the official Project Data, ZAP BBL,
and PLUTO sources. If their publisher metadata matches the active snapshot, the job reports
`UP_TO_DATE`. Otherwise it downloads selected fields with defensive pagination, verifies
counts and checksums, rebuilds against the staged snapshot, and activates it only after the
database swap succeeds. Retained complete snapshots are replayed in order so change-history
and `POSSIBLY_REMOVED` accounting survive a rebuild. The first live run can take several
minutes because it must acquire all current projects and BBL associations.

## Exact data semantics

| Field or source | What the app treats it as | What it does not establish |
| --- | --- | --- |
| Chicago `issue_date` | Recorded permit issuance event date | Construction start, completion, or unique project |
| NYC DOB NOW `issued_date` | DOB NOW Build issuance-event date | All NYC construction activity or unique project |
| Chicago `reported_cost` | Applicant-reported work estimate in record evidence | Area investment or a total project budget |
| NYC `estimated_job_costs` | Applicant-reported estimate in record evidence | Area investment or a total project budget |
| SBA `ApprovalDate` | 504 loan approval date | Disbursement or completed investment |
| SBA `GrossApproval` | Total approved loan amount | Project cost, capital deployed, or space demand |
| Source coordinate | Publisher-supplied map point | Exact property location |

Chicago’s source excludes permits subsequently voided or revoked according to its published catalog. NYC DOB NOW Build excludes electrical, elevator, and limited alteration application datasets. The default view leaves mixed-use and residential records visible and never applies keyword-based commercial labels. NYC can scope displayed records by exact-BBL PLUTO property context; that remains parcel context, not proof of permit purpose or tenancy.

## Common analytic questions

| Question | What the app can show | What you still need to investigate |
| --- | --- | --- |
| Which local areas had more recorded permits? | Fixed-window counts by H3 area and source type, plus the records. | Whether work started, finished, matters commercially, or reflects one project. |
| Which source records drove an increase? | Current/prior row evidence, date, type, address, retained fields, source link. | Parcel history, ownership, scope, tenancy, and project relationships. |
| Is an apparent rise meaningful? | Absolute count, baseline-aware percentage, monthly cadence, source quality. | Seasonality, policy changes, source changes, statistical significance, and causal explanation. |
| Is applicant cost rising? | Individual reported estimates where present. | Area/project investment; cost values are not aggregated for that purpose. |
| Is SBA activity concentrated near this cell? | Nothing at cell level by design. | Project geography and use from a separately verified source. |
| Which market is “better”? | Separate local investigation flows. | A comparable cross-market methodology and decision criteria. |

## Troubleshooting

<details>
<summary>The app will not start</summary>

Use Node 24.18.x and install from the lockfile: `npm.cmd ci` on Windows PowerShell, then `npm.cmd run data:seed` and `npm.cmd run dev`. Use `npm.cmd`, not the PowerShell `npm.ps1` shim, when execution policy blocks that shim. For the built server, use `npm.cmd run demo` after seeding.
</details>

<details>
<summary>I see “Run data:seed first” or an empty app</summary>

Run `npm.cmd run data:seed`, then refresh/restart the server. The API requires a local SQLite snapshot. If seed reports permit sources missing, create the supplied public retained demo with `npm.cmd run data:bundle-demo` or acquire the fixed-window raw permit extracts with `data:fetch:chicago` and `data:fetch:nyc`, then seed again. Use `npm.cmd run data:verify` to check the local snapshot.

The repository intentionally carries the compact `data/demo/` and `data/fixtures/` inputs,
while `.gitignore` excludes `data/raw/` and `data/runtime/`. The full downloaded snapshots
are kept in the author's local workspace and can be reproduced with the fetch scripts; they
are not ordinary GitHub files because the NYC extract alone is about 183 MB. A clean checkout
therefore runs immediately in retained-demo mode, while a full-data checkout uses the same
seed and application code after acquisition. Property-use, ZAP, and ACRIS bundled files are
integration fixtures unless a verified live snapshot has been explicitly fetched.

To acquire, seed, and verify the complete fixed-window Chicago and NYC permit sources in one
step, run `npm.cmd run data:setup:full`. It requires network access, downloads more than
200 MB, and may take several minutes. The downloader stages every file, reconciles the
publisher count, computes a checksum, and retains the previous valid snapshot on failure.
Use `data:fetch:zap` and `data:fetch:acris` separately when those NYC-only evidence families
are needed. SBA is intentionally excluded from the full bootstrap: supply the separately
verified CSV under `data/raw/`, or use the retained demo sample.
</details>

<details>
<summary>No areas appear after filtering</summary>

The selected exact permit type may have no mapped records, or the default low-volume threshold may hide all matching areas. Choose All types or enable Show low-volume areas. Unmapped permits still count in the top summary but intentionally cannot appear as a grid area.
</details>

<details>
<summary>The map is blank or visually limited</summary>

The map draws local H3 GeoJSON polygons and does not require remote base-map tiles. Check that an area-list row exists and select it; if no rows exist, follow the filter guidance above. The workflow remains usable from the area list and evidence even when map presentation is unavailable.
</details>

<details>
<summary>A browser test or screenshot does not run</summary>

The Playwright workflow requires a local Chromium installation. Run `npx.cmd playwright install chromium` where browser downloads are permitted, then rerun `npm.cmd run test:e2e`. The final end-to-end result for this submission is recorded in the README validation section.
</details>

## API examples

Start the API with `npm.cmd run data:seed` and `npm.cmd start` after a build, or run the development server. Endpoints return a dataset ID and typed response envelope. Replace the H3 value below with one returned by `/api/cells`.

```powershell
Invoke-RestMethod 'http://127.0.0.1:3001/api/health'
Invoke-RestMethod 'http://127.0.0.1:3001/api/summary?market=CHICAGO&permitType=ALL'
Invoke-RestMethod 'http://127.0.0.1:3001/api/cells?market=NYC&permitType=ALL'
Invoke-RestMethod 'http://127.0.0.1:3001/api/cells/882664c1adfffff?market=CHICAGO&permitType=ALL'
Invoke-RestMethod 'http://127.0.0.1:3001/api/cells/882664c1adfffff/evidence?market=CHICAGO&permitType=ALL&period=current&limit=25&offset=0'
Invoke-RestMethod 'http://127.0.0.1:3001/api/approvals?market=NYC&period=current&limit=25&offset=0'
Invoke-RestMethod 'http://127.0.0.1:3001/api/sources?market=CHICAGO'
```

`/api/records/:id` returns retained raw evidence for a permit or SBA approval ID obtained from an evidence endpoint. Invalid market, missing permit type where required, invalid pagination, and unknown cells return validation errors instead of silent fallback data.

## Glossary

| Term | Meaning here |
| --- | --- |
| Accepted permit | In-window source record with valid required fields, whether or not it maps. |
| Current / prior | The two fixed twelve-month windows at the top of this manual. |
| H3 area | Resolution-8 display grid cell receiving a permit with usable source coordinates. |
| Mapped / unmatched | Accepted permit with / without a usable map point. |
| Permit type | Exact publisher type label, not an asset-class classifier. |
| CRE lens | Auditable product grouping of exact source values for research triage. |
| Disposition | Browser-local analyst decision attached to a saved investigation. |
| Public snapshot | Frozen local extract of public source data used by the demo. |
| Source provenance | Retained source fields, warnings, and official record/resource link. |

## What comes next

For proposed extensions and their boundaries, see [DECISIONS.md](DECISIONS.md). Useful future work includes analyst observation, source-version monitoring, an audited Chicago parcel association, production-scale NYC PLUTO refresh, and a deliberately designed cross-market methodology. Each requires a new validation step before it becomes a product claim.

## Product questions for reviewers

### Is this just a government-data explorer?

No. The published records are the input, but the product is organized around a CRE analyst's weekly-review decision: choose a short queue, understand why an area surfaced, inspect evidence, and decide what deserves deeper property or broker research. A city portal is the authoritative publisher for its source; this prototype is an auditable workflow across two different sources.

### Could a city portal build it? What is the moat?

It could. The distinction is workflow focus, not an exclusive technical capability. The prototype's differentiator is a controlled fixed-window comparison, transparent prioritization, explanation and quality diagnostics, retained evidence, and next checks across heterogeneous systems. It does not claim a durable moat, exclusive data, user adoption, or willingness to pay. Any future advantage would need to be earned through validated workflow integration, trusted enrichment, feedback, and operational reliability.

### Does it predict a CRE outcome?

No. It identifies a change in recorded permit activity to validate. It does not prove construction began or completed, a project is unique, a pattern is commercial, or that supply, demand, rent, valuation, or investment performance changed.

### Why H3 and why two cities?

H3 resolution 8 is a consistent display bucket for records with usable source coordinates. It is not a parcel, neighborhood, or submarket. Chicago and NYC test the same workflow against different permit systems while retaining their separate source semantics. The app does not compare or rank one city's cells against the other.

### How should value be validated?

Observe analysts using the queue in real weekly reviews, compare it with their existing research path, and examine whether the briefs changed a next action without creating misleading leads. Measure repeat use, evidence inspection, lead disposition, freshness needs, whether NYC property context changes disposition, and whether Chicago parity is worth the source work. No such interviews or outcome measurements have been completed for this prototype.
