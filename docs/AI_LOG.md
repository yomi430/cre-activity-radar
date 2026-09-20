# AI log

## 2026-09-19 — final value release

Perplexity research was used to audit competitive positioning, define the source-specific
permit-lens taxonomy, and verify the future NYC ZAP contract. Terra subagents implemented
the lens backend and began the heatmap and Operations work. The primary agent reviewed,
completed, integrated, and committed every preserved change after interrupting the two
slow tasks. No agent work remains in flight.

Decision: position the product as an auditable public-data screening and investigation
handoff workflow, complementary to licensed CRE systems. Do not claim novel permit
aggregation, prediction, commercial validation, or a moat. PropertyLabs is a close
comparable. SBA remains experimental city-level borrower context. NYC ZAP is deferred
as a separate earlier-stage entitlement signal.

Verification: 19/19 Vitest tests, 3/3 Playwright flows, typecheck, public-data
verification, production build, and visual review passed.

## 2026-09-19 — T01 bootstrap

Decision: use explicitly labeled deterministic synthetic fixtures for Chicago and NYC in the initial runnable vertical slice. The fixture seed is `cre-radar-t01`; the rows are source-shaped only and carry no public-record provenance. External Chicago, NYC, and SBA retrieval/mapping are deferred to later tasks.

Decision: implement only a health endpoint and static frontend shell at this gate. Endpoint, aggregation, normalization, evidence, and map contracts remain unimplemented rather than being advertised as complete.

Environment observation: `tsx` could not run in the controlled session because Node failed resolving the local user temporary directory (`uv_os_get_passwd` ENOMEM). Bootstrap fixture, seed, and verification commands therefore use small plain Node ESM scripts; the TypeScript application remains compiled by `tsc`.

## 2026-09-19 — T02 source acquisition

Official count checks succeeded through Socrata with the frozen date predicate. Chicago returned 63,482 rows and its selected-field extract reconciled exactly. NYC DOB NOW returned 334,974 rows. The first NYC identity candidate (`job_filing_number`, `work_permit`, `sequence_number`) was not unique, so extraction aborted rather than deduplicating. The next verified candidate is the published `tracking_number`, retained in the extract and used for a retry; its uniqueness will be enforced during acquisition.
