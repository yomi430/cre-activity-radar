# NYC ZAP live API audit

Verified against the official NYC Open Data APIs on 2026-09-20 with
`node scripts/inspect-zap.mjs`. This closes the live-query gaps in the supplied
Perplexity follow-up. It is an implementation contract for the deferred ZAP increment,
not a claim that ZAP is part of the current release.

## Project Data (`hgx4-8ukb`)

The live schema contains `project_id`, `project_status`, `public_status`,
`current_milestone`, `current_milestone_date`, `app_filed_date`, `noticed_date`,
`certified_referred`, `approval_date`, and `completed_date`. All names shown here are
the actual lowercase Socrata field names.

The live table contained 32,964 rows, 32,964 non-null project IDs, and 32,964 distinct
project IDs. This supports `project_id` as the snapshot identity as of the audit. The
refresh must still detect future duplicates rather than assuming the constraint forever.

Only 1,439 of 32,964 rows (4.37%) had `app_filed_date`; observed values ranged from
2017-08-01 through 2026-07-02. A defensible trailing-24-month **filed application** view
is therefore possible only for the filed-date subset. It must disclose missing-date
coverage and must not treat the remaining historical records as outside the window.
The inclusive all-record view remains necessary. Do not substitute mutable
`current_milestone_date` for an original filing date.

Observed `project_status` values and live row counts were:

| Raw value | Rows | Safe normalized value |
| --- | ---: | --- |
| `Complete` | 28,361 | `COMPLETED_OTHER` |
| `Withdrawn-Other` | 2,518 | `WITHDRAWN` |
| `Terminated` | 1,678 | `TERMINATED` |
| `Active` | 267 | `ACTIVE` |
| `On-Hold` | 76 | `ON_HOLD` |
| `Terminated-Applicant Unresponsive` | 60 | `TERMINATED` |
| `Record Closed` | 4 | `COMPLETED_OTHER` |

`Complete` does not establish approval. No `APPROVED` or `DISAPPROVED` outcome should
be inferred from `project_status`; any outcome model must separately audit
`public_status`, dates, actions, and source semantics. Unknown future values must map to
`UNKNOWN` and remain visible.

## PLUTO (`64uk-42ks`) and BBL placement

The live Socrata names are `bbl`, `latitude`, `longitude`, `xcoord`, `ycoord`,
`borough`, `block`, and `lot`. All numeric values arrive through JSON as strings; sample
BBLs included a decimal suffix such as `4087860042.00000000`. Canonicalization must
parse the integer value without floating-point loss and emit a zero-padded 10-digit
string before joining to ZAP BBL.

The live PLUTO table contained 858,284 rows. 937 rows lacked latitude or longitude,
approximately 0.109%. Keep these records in source accounting and exclude them from H3
placement. Coordinates are parcel-centroid context, so precision must be labelled
`PARCEL_CENTROID`.

The ZAP BBL schema (`2iga-a6mk`) exposes `project_id`, numeric `bbl`, validated borough,
block, lot and date fields, plus unverified components. Use validated BBL rows for map
placement and report rejected/unvalidated/unmatched counts.

## Counting and refresh rules

- Citywide totals use distinct project IDs.
- A project counts once in a cell even if several of its lots fall in that cell.
- A multi-cell project may appear once in each touched cell; never sum cell counts to
  produce a unique-project city total.
- Upsert mutable project snapshots by `project_id`. Flag missing IDs for review rather
  than hard-deleting on the first absence.
- Poll dataset metadata `rowsUpdatedAt`, then fetch a complete defensively paginated
  snapshot when changed. Snapshot history locally because no separate public milestone
  history dataset was identified in the research.
- Keep ZAP counts and filters separate from permit ranking.

Official endpoints: [Project Data](https://data.cityofnewyork.us/resource/hgx4-8ukb.json),
[ZAP BBL](https://data.cityofnewyork.us/resource/2iga-a6mk.json), and
[PLUTO](https://data.cityofnewyork.us/resource/64uk-42ks.json).
