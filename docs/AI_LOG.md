# AI log

## 2026-09-19 — T01 bootstrap

Decision: use explicitly labeled deterministic synthetic fixtures for Chicago and NYC in the initial runnable vertical slice. The fixture seed is `cre-radar-t01`; the rows are source-shaped only and carry no public-record provenance. External Chicago, NYC, and SBA retrieval/mapping are deferred to later tasks.

Decision: implement only a health endpoint and static frontend shell at this gate. Endpoint, aggregation, normalization, evidence, and map contracts remain unimplemented rather than being advertised as complete.

Environment observation: `tsx` could not run in the controlled session because Node failed resolving the local user temporary directory (`uv_os_get_passwd` ENOMEM). Bootstrap fixture, seed, and verification commands therefore use small plain Node ESM scripts; the TypeScript application remains compiled by `tsc`.

## 2026-09-19 — T02 source acquisition

Official count checks succeeded through Socrata with the frozen date predicate. Chicago returned 63,482 rows and its selected-field extract reconciled exactly. NYC DOB NOW returned 334,974 rows. The first NYC identity candidate (`job_filing_number`, `work_permit`, `sequence_number`) was not unique, so extraction aborted rather than deduplicating. The next verified candidate is the published `tracking_number`, retained in the extract and used for a retry; its uniqueness will be enforced during acquisition.
