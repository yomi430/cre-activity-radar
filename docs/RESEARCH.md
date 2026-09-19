# Source verification and limitations

Checked 2026-09-19 during planning. Distinguish publisher claims, directly inspected
metadata, design choices and unanswered questions. No full datasets were downloaded
and no market trends were validated in this planning pass.

## Chicago permits — primary source

[Official dataset](https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu)
and [machine-readable metadata](https://data.cityofchicago.org/api/views/ydr8-5enu.json).
Metadata was fetched successfully and inspected directly.

| Field | Verified type / meaning |
| --- | --- |
| `id` | Text; unique database record identifier |
| `permit_` | Text; tracking number assigned at application start |
| `permit_type` | Text; permit type |
| `permit_status` | Current status, not available for all types |
| `issue_date` | Calendar date; usually ready-to-issue date subject to fee payment; Express Permit Program uses issuance after full fee payment |
| `work_type` | Activity classification, not available for all types |
| `reported_cost` | Numeric; applicant's estimated work cost, missing for some permits |
| `community_area` | Numeric; community area of primary property address |
| `latitude`, `longitude` | Numeric; coordinates of primary property address |

The [government catalog](https://catalog.data.gov/dataset/building-permits-4ddae)
describes coverage from 2006 onward and exclusion of permits subsequently voided or
revoked. This is therefore a current extract of recorded permit activity, not an
immutable issuance-event ledger or confirmation of construction starts.

Before building: verify remaining address/description columns, actual date strings,
row counts, duplicate IDs, missing-coordinate rate, permit type values and the
retained two-year data volume. No commercial-only classification was established.

## SBA 504 — useful but limited context

[Official FOIA catalog](https://data.sba.gov/dataset/7a-504-foia) lists quarterly
updates and a current 504 file through June 30, 2026. Its publication lag motivates
fixed comparison windows rather than a clock-relative current period.

The following exact links were extracted from the current catalog HTML:

- [504 FY2010–present CSV, as of 2026-06-30](https://data.sba.gov/sites/default/files/uploaded_resources/FOIA_504_FY2010_Present_asof_260630.csv)
- [FOIA data dictionary](https://data.sba.gov/sites/default/files/uploaded_resources/7a_504_foia_data_dictionary.xlsx)

Access findings: the catalog works; a direct CSV request returned HTTP 403. The
historical `/api/3/action/package_show?id=7a-504-foia` route returned 404. Do not
build ingestion assuming that old catalog API exists. A normal manual download or
another publisher-provided resource may work, but was not verified here.

[SBA's program description](https://www.sba.gov/loans/504-loans/) describes financing
for major fixed assets and excludes speculation/investment in rental real estate.
The product implication is a limited owner-user/business-investment context, not a
measure of general institutional CRE investment. Financing can concern uses other
than new buildings; do not claim it directly measures new leased-space demand.

[SBA's dataset overview](https://data.sba.gov/oca-datasets) describes the FOIA series
as loan-level approval records. An approval is not proof of disbursement, completed
investment or a new development project.

UNVERIFIED and mandatory before public SBA ingestion: exact current header names;
meaning of amount field; city/address field basis; stable loan ID; status codes;
date format; duplicate behavior; program discrimination if using a combined file.
Names from memory such as `GrossApproval` are candidate search terms, not a verified
contract. The plan deliberately avoids giving guessed raw-field mappings to Terra.

Design choice: represent this source as city-level context. No ZIP lookup, no point
geocoding, no aggregation of ZIP-centroid amounts into H3 cells. If only ZIP-level
geography were used, mapping all loans to one centroid cell would introduce false
localized concentration. Labeling precision alone would not correct that bias.

## NYC — required second market per user clarification

[DOB NOW: Build approved permits](https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4/data)
excludes electrical, elevator and limited alteration application datasets. It is
not equivalent to all NYC construction activity. The
[DOB permit resource page](https://www.nyc.gov/site/buildings/dob/building-applications-permits.page)
lists both DOB NOW and DOB Permit Issuance; do not conflate those systems.

Directly inspected [DOB NOW metadata](https://data.cityofnewyork.us/api/views/rbx6-tga4.json)
exposes `job_filing_number`, `work_permit`, `sequence_number`, `issued_date`,
`latitude`, `longitude`, and `bbl`. Therefore the proposal's mandatory PLUTO join
is unnecessary as a starting assumption. Coordinate availability/completeness on
actual rows was not measured. Record identity and renewal semantics need verification.

[PLUTO](https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks/about_data)
is a possible enrichment fallback. Its published documentation describes coordinates
as approximate tax-lot locations. A parcel join should preserve its source/version
and failed matches, and must not be labeled exact. Historical tax-lot changes can
prevent contemporary PLUTO from resolving older permits correctly.

## Spatial and runtime decisions

[H3 resolution statistics](https://h3geo.org/docs/core-library/restable/) document
resolution-dependent cell sizes. Choosing resolution 8 is a fixed prototype
visualization decision; sensitivity to other resolutions and zoning/submarket
boundaries remains untested. A grid cell is not a real estate submarket.

[Node SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
supports local embedded storage. The planning session actually executed an
in-memory `DatabaseSync` query successfully on Node 24.18.0, returning SQLite 3.53.1.
The synchronous API is an acceptable bounded local-demo tradeoff; large or concurrent
production analytical workloads would need a different execution strategy.

The workspace had no existing application, git repository or ancestor AGENTS.md
instructions found in the checked path. npm 11.16.0 works via `npm.cmd`; PowerShell's
`npm.ps1` shim fails under the current execution policy. These are observed local
facts, not prerequisites that require changing system security settings.

## What remains to validate with users

No analyst interviews were conducted here. The following are hypotheses:

- Analysts need help prioritizing which areas deserve a closer look.
- Transparent changes plus inspectable evidence are useful before proprietary research.
- Absolute changes with visible counts are more useful than an opaque score for this job.

Validate by observing an analyst using the prototype on a real investigation.
Record what they inspect, what they dismiss, and which missing context prevents a
decision. Do not claim predictive performance, economic causality or proven ROI.
