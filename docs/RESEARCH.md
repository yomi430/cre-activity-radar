# Verified sources and product boundaries

This note is the current source index for the submitted prototype. Detailed audits are
linked where the implementation depends on a non-obvious identity, geography, or field
interpretation.

## Permit discovery

- [Chicago Building Permits](https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu)
  provides recorded permit issuance events. `reported_cost` is an applicant estimate and
  coordinates refer to the primary property address. Records do not prove construction
  starts, completions, unique projects, demand, or commercial property use.
- [NYC DOB NOW: Build Approved Permits](https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4/data)
  provides approved/issued DOB NOW records and excludes some other DOB systems. Its BBL is
  retained for the exact property-context join. An issuance record is not a unique project.

Both official sources are acquired over the fixed interval `[2024-07-01, 2026-07-01)` by
the committed fetch scripts, staged, count-reconciled, checksummed, and then seeded. Their
different publisher semantics are preserved; Chicago and NYC are never combined into a
cross-city ranking.

## NYC property context

[NYC PLUTO](https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks/about_data)
provides current tax-lot context. NYC permits join only through canonical BBL and classify
only direct `landuse` values in this release. PLUTO does not establish historic use, current
tenancy, or the purpose of permit work. See [NYC_PROPERTY_USE_AUDIT.md](NYC_PROPERTY_USE_AUDIT.md).

Chicago remains deliberately unavailable for property-use filtering because the retained
permit source has no audited parcel identifier. See
[CHICAGO_PROPERTY_USE_AUDIT.md](CHICAGO_PROPERTY_USE_AUDIT.md).

## Separate context sources

- NYC ZAP Project Data, ZAP BBL associations, and PLUTO parcel centroids support the
  separate NYC entitlement page. Counts use distinct projects, and the filed-date view
  discloses its limited filing-date coverage. ZAP never changes permit ranking.
- NYC ACRIS Master and Legal records support a separate exact-`DEED`, four-borough recorded
  deed view. `document_amt` is not presented as sale price. See
  [TRANSACTION_SOURCE_AUDIT.md](TRANSACTION_SOURCE_AUDIT.md).
- [SBA 504 FOIA data](https://data.sba.gov/dataset/7a-504-foia) supplies borrower-city
  approval context. It is not project geography, disbursement, construction investment, or
  demand and never changes H3 results. See [SBA_STATUS.md](SBA_STATUS.md).

The clean checkout uses retained permit samples and small deterministic integration
fixtures. Complete permit extracts can be acquired with `npm.cmd run data:setup:full`.
Bundled property-use, ZAP, and ACRIS fixtures demonstrate implementation behavior and must
not be described as complete live coverage. The SBA demo input is empty unless a separately
verified CSV is supplied locally.

## Technical choices and validation still required

H3 resolution 8 is a repeatable visualization bucket, not a parcel, neighborhood, or CRE
submarket. SQLite provides a reproducible local snapshot for the take-home; a concurrent
production service would use managed storage and job orchestration.

No analyst interviews, adoption study, willingness-to-pay study, predictive evaluation, or
measured time saving has been completed. The next product step is to observe analysts using
the workflow and measure whether the evidence brief changes a defensible next action.
