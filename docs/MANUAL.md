# CRE Activity Radar manual

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

<details>
<summary>Can I compare a Chicago cell directly with an NYC cell?</summary>

No. H3 provides a common display grid, but publisher systems, coverage, issuing practice, coordinate completeness, and overall volumes differ. The market selector supports two consistent local workflows, not a combined leaderboard.
</details>

## Map, list, and ranking

The map colors H3 resolution-8 polygons by **current permit count**. A darker cell means more current-window records for the active market and permit-type filter; it does not mean more growth, value, demand, development, or investment. Hover a polygon for its current count and click it to select it.

The area list and map share the same market, permit-type filter, and low-volume setting. The list can rank by:

- **Largest increase:** current count minus prior count, descending; then current count.
- **Current count:** current-window count, descending.

The default list excludes an area whose combined current and prior count is below five. This is a visible prototype triage threshold, not statistical significance. Use **Show low-volume areas** to include them. If a control causes the selected area to disappear, the app clears the selection rather than showing mismatched detail.

<details>
<summary>What is H3, and how precise is it?</summary>

H3 is the geographic grid used to group permits with usable publisher coordinates. Resolution 8 is a fixed visualization choice. A grid cell is not a neighborhood, parcel, market boundary, or real-estate submarket. “Source coordinate” means the publisher supplied the coordinate; it does not certify survey-grade or exact location.
</details>

## Lenses, filters, change math, and no baseline

**CRE lens** groups exact publisher categories into research intents. These are product mappings, not official classifications or proof of an asset class. Expand the mapping panel to see raw values, confidence, ambiguity, and source. Unknown future values remain visible under `UNCLASSIFIED`. Lens and exact permit-type filters intersect; `ALL` removes that level of filtering.

**Permit type** uses the exact source type labels available in the selected market. It filters the summary, map, ranked list, detail, and evidence together. It does not classify records as commercial, residential, or a particular asset class.

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

## Analyst decision, watchlist, and export

For a selected area, choose **Investigate**, **Monitor**, **Dismiss**, or **Escalate**, write a note, and save it. The saved investigation records the dataset, market, H3 cell, permit type, lens, and timestamp; selecting it restores that view. Saves live in the current browser only. **Export JSON** creates a structured evidence packet and **Export HTML** creates a readable handoff with the brief, decision, evidence, source links, and caveats.

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

For the submitted full snapshot, Chicago contains 63,482 accepted permits (62,750 mapped, 732 unmapped) and NYC contains 334,974 accepted permits (333,591 mapped, 1,383 unmapped). Full query extraction, accounting balance, dates, coordinate bounds, H3 validity, and local checks are recorded by the seed and verification commands. Source records remain mutable upstream; the local snapshot is frozen for reproducible review.

## SBA 504 context is separate

The SBA panel shows city-level 504 approval context and a few current-period evidence entries. Click an entry to inspect retained fields and the official SBA catalog link. It never changes map color, list rank, permit totals, or H3 evidence.

Chicago accepts exact normalized borrower city `CHICAGO`, Illinois. NYC accepts exact normalized borrower cities `NEW YORK`, `BROOKLYN`, `BRONX`, `QUEENS`, and `STATEN ISLAND`, New York. Labels such as Flushing and Jamaica are excluded because the source does not supply a verified borough crosswalk.

<details>
<summary>Why is an SBA approval not placed in a permit cell?</summary>

The verified available geography is borrower city, not a project coordinate or parcel. Assigning city-labelled or ZIP-level financing to one small grid cell would create a false localized signal. SBA 504 `GrossApproval` is total loan approval amount, not a disbursement, construction cost, completed project, or demand measure. A later loan status is shown for evidence but does not rewrite historical approval activity.
</details>

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

Chicago’s source excludes permits subsequently voided or revoked according to its published catalog. NYC DOB NOW Build excludes electrical, elevator, and limited alteration application datasets. The prototype leaves mixed-use and residential records visible and does not apply keyword-based commercial labels.

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

For proposed extensions and their boundaries, see [DECISIONS.md](DECISIONS.md). Useful future work includes analyst observation, source-version monitoring, documented parcel enrichment where appropriate, and a deliberately designed cross-market methodology. Each requires a new validation step before it becomes a product claim.

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

Observe analysts using the queue in real weekly reviews, compare it with their existing research path, and examine whether the briefs changed a next action without creating misleading leads. Measure repeat use, evidence inspection, lead disposition, freshness needs, and whether analysts need better property/use enrichment before adding more visualization. No such interviews or outcome measurements have been completed for this prototype.
