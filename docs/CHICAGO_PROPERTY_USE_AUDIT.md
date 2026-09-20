# Chicago property-use enrichment audit

**Decision:** **NO-GO for Chicago property-use filtering in the current release.**

This is a local-evidence audit completed on 2026-09-20. It does not choose a
source from web search or create a text, cost, address-proximity, or permit-type
heuristic. The next implementation may proceed only after an official
parcel/property-use source and a deterministic permit-to-parcel identity contract
pass the gates below.

## What is verified locally

The active Chicago input is the City of Chicago Building Permits Socrata resource
`ydr8-5enu`. The frozen selected-field snapshot covers
`[2024-07-01, 2026-07-01)`, has 63,482 rows, and records its source URL and
SHA-256 in `data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl.manifest.json`.

The extractor selects only these permit fields:

```
id, permit_, permit_type, permit_status, issue_date, work_type, reported_cost,
latitude, longitude, community_area, street_number, street_direction,
street_name, work_description
```

This is verified in `scripts/permit-source.mjs`; the runtime normalization in
`src/sources/chicago.ts` keeps `id`, permit number, date, type, cost, a composed
street address, community area, source coordinates, description, and raw source
fields. It has no PIN, tax parcel identifier, building identifier, official
property-use code, building-class code, unit count, or parcel geometry.

The repository has no Chicago parcel/property-use raw snapshot, fixture, source
adapter, normalizer, schema table, refresh command, or test. Its existing parcel
adapters are NYC-only: ZAP/PLUTO and ACRIS/PLUTO use BBL as a declared identity.
The Chicago/Cook County sales path mentioned in `HANDOFF.md` is intentionally
parked pending a separately audited PIN-to-Chicago/geometry association. It is a
sales path, not local evidence of a property-use source or a permit join.

The current permit address must not be promoted to a parcel identity. It is
assembled from street number, direction, and street name; it has no retained PIN,
unit, ZIP, or audited publisher crosswalk. Likewise, the supplied latitude and
longitude support H3 display only. Without an official parcel geometry source,
geometry version, coordinate semantics, and a tested boundary rule, reverse
geocoding or nearest-parcel matching would be an unsupported attribution.

The current product statements are therefore accurate: CRE lenses classify
**work intent**, while the permit queue continues to mix residential and
commercial activity. `reported_cost` is applicant-reported record evidence and
cannot classify a parcel or be used as a commercial threshold.

## Required source decision before implementation

Select one official City of Chicago, Cook County, or other authoritative public
publisher source only after preserving its metadata/data dictionary and testing a
bounded extract. The selected source must supply all of the following, either in
one dataset or through a documented official crosswalk:

| Need | Required evidence |
| --- | --- |
| Stable parcel identity | A documented canonical parcel/PIN value, including format, zero padding, null behavior, and whether one record may represent multiple parcels. |
| Property-use semantics | A documented, publisher-defined land-use, property-class, occupancy/use, or equivalent code and its official codebook. Free-text descriptions are insufficient. |
| Geography or official address crosswalk | Parcel geometry with CRS/version metadata, or an official address-to-parcel/PIN relationship. This is required to associate a permit that lacks a PIN. |
| Scope and time | Jurisdiction/Chicago-boundary coverage, update cadence, effective/as-of date, historic-versus-current semantics, and known exclusions. |
| Reproducible retrieval | Stable dataset/resource URL, selected fields, deterministic pagination/order, count reconciliation, snapshot manifest, and checksum. |

The source decision must state whether its use is **current parcel profile** or
**historical use at permit issuance**. A current assessor/parcel snapshot cannot
be represented as the historical use of a 2024 or 2025 permit unless the source
actually provides the applicable dated history.

Do not use a source merely because it contains an address, coordinate, sales
amount, permit description, or a suggested NAICS/business name. Do not infer
commercial relevance from permit type, work description, dollar amount,
neighborhood, proximity, or a model score.

## Required identity and join contract

Every retained permit must receive exactly one audited join outcome. The join may
create a classification only through one of the methods below, in priority order.

| Method | Preconditions | Confidence | Treatment |
| --- | --- | --- | --- |
| `DIRECT_PARCEL_ID` | Permit source contains a valid canonical PIN/parcel ID that exactly exists in the same authoritative property snapshot. | `HIGH` | Classify from the matched property record. |
| `OFFICIAL_CROSSWALK` | A publisher-owned, documented permit-ID or address-ID to PIN crosswalk yields one active canonical parcel. | `HIGH` | Retain crosswalk row identity and version. |
| `EXACT_OFFICIAL_ADDRESS` | An official property source supplies a documented standardized-address key and it returns exactly one parcel after a reviewed canonicalization contract. | `MEDIUM` | Retain both address forms and the source row. No fuzzy matching. |
| `STRICT_POINT_IN_PARCEL` | The official source supplies versioned polygon geometry; the source point is documented as the permit property location and lies strictly inside exactly one eligible polygon under a tested CRS/boundary rule. | `MEDIUM` | Retain geometry version, predicate, and point precision. Boundary or multi-polygon results do not match. |
| `UNMATCHED` | Any missing, invalid, stale, ambiguous, conflicting, or unsupported case. | `NONE` | Expose as `UNKNOWN`; do not choose a candidate. |

`EXACT_OFFICIAL_ADDRESS` and `STRICT_POINT_IN_PARCEL` remain unavailable until
their field-level and sampled-match audits are complete. A coordinate radius,
nearest feature, fuzzy string similarity, manual neighborhood rule, or arbitrary
tie-breaker is prohibited.

If a permit legitimately maps to several parcels, retain one association per
permit/PIN and classify the permit as `UNKNOWN` unless the authoritative source
also supplies an explicit single property-use outcome for that permit. Never pick
the first parcel. A multi-parcel permit must remain visible in its association and
quality accounting without inflating citywide permit counts.

## Classification contract

Store the publisher's raw code and the versioned mapping separately from the
display category. No category mapping is approved until the selected source's
official codebook has been checked and the mapping table has a reviewer, source
URL, source version/as-of date, and ambiguity note.

| Display category | Allowed condition |
| --- | --- |
| `LIKELY_COMMERCIAL` | The matched, official property-use code is explicitly mapped to a nonresidential commercial/institutional/industrial class under the approved codebook. The label remains “likely” because it describes a parcel profile, not the permit scope or tenant use. |
| `MULTIFAMILY` | The matched official code explicitly identifies a residential multi-unit/multifamily class. |
| `MIXED_USE` | The matched official code explicitly identifies mixed residential/nonresidential use. Do not construct this from adjacent parcels or multiple permits. |
| `RESIDENTIAL` | The matched official code explicitly identifies residential use other than the approved multifamily mapping. |
| `UNKNOWN` | No match, missing/invalid/unsupported code, one-to-many conflict, source conflict, unreviewed code, or insufficient source semantics. |

The raw code is the source of truth. `LIKELY_COMMERCIAL` is not a catch-all for
nonresidential-looking text, blank values, or unrecognized codes. The UI must show
the category, raw code/label, source, source snapshot/as-of date, join method, and
confidence on record evidence and exports.

## Minimum persisted data model

The exact table names may change, but the following information is required.

| Entity | Required fields |
| --- | --- |
| Property-use snapshot | `snapshot_id`, source name/dataset URL, retrieved timestamp, publisher updated/as-of timestamp, selected-field list, query scope, source row count, checksum, completeness, and raw manifest. |
| Canonical parcel | `snapshot_id`, canonical `parcel_id`/PIN, raw property-use code and label, source record identity, raw source record, optional geometry/version, and validity/effective dates when published. |
| Permit-to-parcel association | `permit_id`, `snapshot_id`, canonical parcel ID, join method, confidence, matching input values, crosswalk/geometry record identity, source and target snapshot IDs, and a reject/unmatched reason when no association is accepted. |
| Property-use classification | `permit_id`, `snapshot_id`, category, raw use code/label, mapping version, mapping rationale, source provenance, join method, confidence, and `classified_as_of`. |
| Quality report | Source rows read/accepted/rejected/duplicates; parcel normalization failures; permit candidates; each join outcome; matched permits by method; multi-parcel and conflicting-use permits; classifications by category; missing/unsupported use codes; and assertion totals. |

The property snapshot must be immutable and separable from the permit snapshot.
This permits a reviewer to reproduce why a given permit was classified after a
later assessor refresh changes a parcel attribute.

## Accounting and release gates

For each permit snapshot and property-use snapshot pair, report counts at the
**distinct permit ID** level. These buckets must sum to accepted Chicago permits:

```
direct-PIN matched
+ official-crosswalk matched
+ exact-official-address matched
+ strict-point-in-polygon matched
+ invalid/missing permit identity input
+ no property candidate
+ multiple property candidates
+ geometry boundary/outside/invalid
+ property record lacks a use code
+ unsupported or unreviewed use code
+ conflicting multi-parcel/use outcome
= accepted Chicago permits
```

All unmatched/uncertain buckets are `UNKNOWN`. If a pipeline supports
multiple association attempts, keep its detailed attempt accounting but publish
one mutually exclusive final outcome per permit so the reconciliation remains
auditable. Separately reconcile property-source rows as:

```
rows read = accepted + rejected + duplicate + out-of-scope
```

Do not count parcel associations, H3 placements, or multiple properties as extra
permits. The “All activity” queue must retain existing permit counts. Property-use
filters may restrict the row set, but must never change the underlying permit
identity, H3 coordinate, work-intent lens, comparison window, or reported-cost
meaning.

## Refresh and verification requirements

1. Fetch the property-use/crosswalk/geometry source into a staging snapshot with
   deterministic query order, bounded fields, source row-count reconciliation,
   manifest, and checksum.
2. Normalize parcel IDs and source codes without silent coercion. Reject invalid
   values with reason counts.
3. Join against the fixed local permit snapshot using only the approved method(s).
   Produce association and classification quality reports before activation.
4. Rebuild and verify a staged SQLite database using the exact property snapshot
   ID. Activate atomically only when all quality assertions pass; retain the
   previous active snapshot on a failure.
5. Expose property-source freshness, as-of semantics, code-mapping version, join
   coverage, unmatched count, and category counts in Data Operations and every
   relevant export. A refresh that changes parcel use may change category filters;
   it must identify the new snapshot rather than silently rewriting history.

Required tests include:

- pure canonical PIN parsing, code normalization, and exact mapping tests;
- explicit rejection tests for missing/invalid IDs, unknown codes, duplicate or
  conflicting source rows, multiple candidates, geometry-boundary points, and
  invalid coordinates;
- fixture integration tests proving every accepted permit has one final outcome
  and every property-source snapshot reconciles;
- proof that `UNKNOWN` is visible and that no heuristic method enters the
  classification path;
- API/export tests preserving category, raw source code, provenance, confidence,
  unmatched accounting, and snapshot identity;
- UI/end-to-end tests for All activity, each category, zero-result recovery,
  record evidence, H3 drill-down, saved lead, and export behavior; and
- staged-refresh failure/idempotence tests proving a bad source snapshot cannot
  replace the active dataset.

## Implementation status

No Chicago property-use filter should be implemented from the current permit
extract. The next bounded task is an official-source audit that names the selected
publisher dataset(s), records exact fields and codebook semantics, tests the
permitted join method on a frozen sample, measures all outcome buckets above, and
returns either a GO contract or this explicit Chicago limitation. If it remains
blocked, implement any verified market-specific enrichment separately and keep
Chicago's property-use control unavailable with the present mixed-activity
disclosure.
