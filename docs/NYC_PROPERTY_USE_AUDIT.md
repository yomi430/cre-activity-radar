# NYC permit property-use enrichment audit

Audited and implemented 2026-09-20. This is the source and implementation contract for the NYC-only property-context filter. It does not make DOB NOW: Build commercial-only data.

## Decision

**GO for a bounded NYC-only filter.** The frozen DOB NOW: Build extract already retains the source BBL, so it can join directly to the Department of City Planning (DCP) PLUTO tax-lot record using a canonical 10-character BBL. Do not use addresses, coordinates, BIN, descriptions, work types, nearest parcels, or inferred parcel substitutions.

Official sources: [DOB NOW: Build – Approved Permits (`rbx6-tga4`)](https://data.cityofnewyork.us/d/rbx6-tga4), published by DOB; [PLUTO (`64uk-42ks`)](https://data.cityofnewyork.us/d/64uk-42ks), published by DCP; and the [PLUTO data dictionary](https://data.cityofnewyork.us/api/views/64uk-42ks/files/0a20c848-4af5-417a-b0b9-c136e15b807f?download=true&filename=pluto_datadictionary.pdf).

PLUTO `LandUse` is a DCP tax-lot category and `BldgClass` describes the major use of structures on that lot. Neither proves a current tenant, lease opportunity, the permit work's actual use, or property use at the historical issuance date. Product language must say “PLUTO-snapshot property use,” never “commercial-only.”

## Verified local permit evidence

The complete-query NYC permit snapshot covers `[2024-07-01, 2026-07-01)`, was retrieved 2026-09-19, and contains 334,974 rows. `scripts/permit-source.mjs` explicitly selects `bbl`, and each selected raw row is retained in `permits.raw_json`.

| BBL result | Rows | Treatment |
| --- | ---: | --- |
| Valid canonical BBL | 325,364 | 97.13%; eligible for exact PLUTO join. |
| Missing/blank BBL | 9,560 | Retain the permit as `UNKNOWN`; never derive a BBL. |
| Nonblank unusable BBL | 50 | Zero/out of range after normalization; retain as `UNKNOWN` with `INVALID_OR_ZERO_BBL`. |
| Distinct valid BBLs | 65,539 | Exact BBLs to request from PLUTO for this permit snapshot. |

Canonicalize BBL as an integer string: accept digits with an optional all-zero decimal suffix; parse with `BigInt`; require `1..9,999,999,999`; left-pad to 10 characters. Never use JavaScript `Number`. Thus DOB `4087860042` and PLUTO `4087860042.00000000` join as `4087860042`. The 50 zero/out-of-range values are source-quality accounting, not rejected permits: they stay in city totals, H3 activity, row evidence, exports, and `UNKNOWN`.

## Exact source contract

Use existing `source_row_id` as permit identity and canonical `raw_json.bbl` as the only parcel key. `work_permit`, filing number, address, and permit coordinates are evidence only. Request PLUTO in bounded BBL batches with these selected fields:

```text
bbl, landuse, bldgclass, unitsres, unitstotal, borough, block, lot, latitude, longitude
```

`bbl`, `landuse`, and `bldgclass` are required for identity/classification. Keep `unitsres` and `unitstotal` as explanatory evidence only; do not infer a category from unit counts. Borough/block/lot are diagnostics and PLUTO coordinates must not replace the permit-source H3 location.

If PLUTO returns no exact BBL, mark the permit `PLUTO_UNMATCHED` and `UNKNOWN`. If it returns duplicate canonical BBLs, fail activation. Condominium/billing-lot treatment can cause legitimate unmatched BBLs; that is not permission to guess a replacement.

External check completed 2026-09-20: the current official PLUTO endpoint accepts and returns `bbl`, `landuse`, `bldgclass`, `unitsres`, `unitstotal`, borough/block/lot, and latitude/longitude. The current catalog describes PLUTO as a quarterly DCP tax-lot dataset. A full match rate is intentionally not asserted until the 65,539-BBL retained extraction is run and checksummed.

## Classification

Direct `landuse` takes precedence whenever it is a valid DCP code. Values 7–11 remain `UNKNOWN`: transportation/utility, public/institutional, open space, parking, and vacant land cannot be silently called commercial or residential.

| Filter value | Direct `landuse` | Provenance / confidence |
| --- | --- | --- |
| `RESIDENTIAL` | `1` | `PLUTO_LANDUSE_DIRECT` / `HIGH`; one- and two-family. |
| `MULTIFAMILY` | `2`, `3` | `PLUTO_LANDUSE_DIRECT` / `HIGH`; walk-up or elevator multifamily. |
| `MIXED_USE` | `4` | `PLUTO_LANDUSE_DIRECT` / `HIGH`; mixed residential/commercial. |
| `LIKELY_COMMERCIAL` | `5`, `6` | `PLUTO_LANDUSE_DIRECT` / `HIGH`; commercial/office or industrial/manufacturing. “Likely” remains necessary because this is parcel context, not tenancy or work use. |
| `UNKNOWN` | Missing, invalid, unmatched, `7`–`11`, or future value | Include reason; do not guess. |

`BldgClass` is retained for evidence. The initial implementation does not classify from it:
missing or unsupported `landuse` remains `UNKNOWN`. A later fallback would require an
explicit versioned transcription of Appendix D, separate tests, provenance, and coverage
accounting; it must not be inferred ad hoc.

| Fallback target | Appendix D class groups |
| --- | --- |
| `RESIDENTIAL` | `A*`, `B*`, `Z0` |
| `MULTIFAMILY` | `C0,C1,C2,C3,C4,C5,C6,C8,C9,CM,R1,R2,R3,R6,D0,D1,D2,D3,D4,D5,D8,D9,H6,H7,R4,RD` |
| `MIXED_USE` | `C7,D6,D7,K4,O8,R8,R9,RM,RR,RX,RZ,S*` |
| `LIKELY_COMMERCIAL` | Commercial/office `G8,GU,GW,H1,H2,H3,H4,H5,H9,HB,HH,HR,HS,J*,K1,K2,K3,K5,K6,K7,K8,K9,O1,O2,O3,O4,O5,O6,O7,O9,P1,R5,R7,RB,RC,RH,RI,RK,RS`; industrial/manufacturing `E*,F*,L*,RW` |

`R0`, `Y5`, `Z7`, `Z9`, unmapped/missing classes, invalid land-use values, and source conflicts are `UNKNOWN`. A valid direct land-use value wins. Count a disagreement with independently mapped `bldgclass` as `LANDUSE_BLDGCLASS_CONFLICT`; do not overwrite it.

## Snapshot and refresh implementation

Leave permit ingestion, permit identity, and source-coordinate H3 placement unchanged. Add separate immutable enrichment tables:

```text
property_use_snapshots(snapshot_id, permit_snapshot_sha256, pluto_rows_updated_at, retrieved_at, manifest_json, complete)
pluto_property_use_parcels(snapshot_id, bbl, landuse_raw, bldgclass_raw, unitsres_raw, unitstotal_raw, borough_raw, block_raw, lot_raw, latitude_raw, longitude_raw, raw_json)
permit_property_use(permit_id, snapshot_id, canonical_bbl, category, provenance, confidence, reason)
```

Each active permit has exactly one `permit_property_use` row. Use `(snapshot_id,bbl)` as parcel identity and index category queries by active snapshot/category/permit. Include the snapshot ID in APIs and exports.

The immutable manifest must include permit raw SHA-256 and count, PLUTO `rowsUpdatedAt`, retrieval time, selected fields, requested/returned BBL counts, raw file hashes, classification-map version, and coverage counters. Stage and validate files, rebuild/validate the database, then atomically activate. A source change during fetch, count mismatch, duplicate canonical PLUTO BBL, or invalid staged mapping retains the former active snapshot.

Refresh when permit snapshot checksum or PLUTO `rowsUpdatedAt` changes. Display both dates: this is a current PLUTO view joined to historic permits, not historic parcel-use evidence.

## Required accounting and tests

Every summary, filter disclosure, export, and Operations view must reconcile non-overlapping row counts for total permits; valid/missing/invalid BBL; requested/returned/matched/unmatched PLUTO BBL; classification-field-null rows; categories; and `UNKNOWN` reasons: `NO_BBL`, `INVALID_OR_ZERO_BBL`, `PLUTO_UNMATCHED`, `MISSING_LANDUSE_AND_BLDGCLASS`, `UNMAPPED_LANDUSE`, `UNMAPPED_BLDGCLASS`, and `LANDUSE_BLDGCLASS_CONFLICT`.

Test canonicalization including decimal suffixes and invalid zero; the frozen 334,974/325,364/9,560/50/65,539 reconciliation; exact BBL representation matching with no address/coordinate fallback; all direct and Appendix D category mappings; direct-value precedence/conflict handling; unmatched and unknown accounting; duplicate/failing staged refresh rollback; and filters/provenance/coverage in discovery, H3 evidence, saved leads, URLs, and JSON/HTML exports.

Property use remains separate from work-intent lenses and individual-record reported-cost controls. Filtering may limit the displayed queue but must not turn PLUTO attributes into a ranking input, change all-activity ranking, or sum permit costs into investment.

## Limit

This contract supports NYC because both official sources expose an auditable BBL key and documented taxonomy. It does not establish a comparable Chicago use classification. Ship the NYC control with that market limitation until Chicago passes an equivalent official identity/use audit.
