# ZAP refresh reconciliation

## Status: required after the publisher changes the dataset

The 2026-09-20 live audit verified the current schema, identity, status vocabulary,
filing-date coverage, and PLUTO coordinate coverage. One question cannot be resolved
from a single snapshot: how NYC DCP represents projects or BBL associations that are
removed or revised between publications.

The next account implementing NYC ZAP must use this file as the reconciliation record.
Do not block the current permit release while waiting for a publisher update.

## Procedure

1. Run `node scripts/inspect-zap.mjs` and preserve the retrieval time and
   `rowsUpdatedAt` values.
2. Fetch complete, paginated snapshots of Project Data `hgx4-8ukb` and ZAP BBL
   `2iga-a6mk`; retain immutable raw files and checksums.
3. After `rowsUpdatedAt` changes, fetch the next complete snapshots.
4. Compare projects by `project_id` and BBL associations by canonical
   `(project_id, bbl)`.
5. Record counts and representative evidence for inserted, revised, missing, and
   restored rows. Distinguish a project deletion from a visibility change or failed
   partial fetch.
6. Keep first-absence records as `POSSIBLY_REMOVED`. Hard deletion requires a confirmed
   publisher rule or repeated complete-snapshot absence.
7. Re-run identity, mapping, unmatched, and citywide-distinct-project accounting before
   enabling an atomic database swap.

## Reconciliation result

Complete this section after two distinct publisher versions are available:

| Item | Result |
| --- | --- |
| First snapshot retrieval / `rowsUpdatedAt` | Pending |
| Second snapshot retrieval / `rowsUpdatedAt` | Pending |
| Added project IDs | Pending |
| Revised project IDs | Pending |
| Missing project IDs | Pending |
| Added `(project_id, bbl)` associations | Pending |
| Missing `(project_id, bbl)` associations | Pending |
| Confirmed deletion semantics | Pending |
| Implemented refresh rule and tests | Pending |

The implementation may initially use complete-snapshot upserts plus soft removal flags;
it must never infer deletion from an interrupted or incomplete fetch.

## Required UI disclosure

When the NYC ZAP section is built, show this disclosure beside its source quality or
coverage details, with an accessible explanation available without opening developer
tools:

> NYC DCP publishes the current project-to-tax-lot association snapshot. This prototype
> has not yet observed enough publisher versions to determine whether a missing
> association was removed, replaced, or temporarily omitted. Previously observed
> associations are therefore flagged for review rather than immediately deleted.

The UI must also display the ZAP snapshot retrieval time, publisher update time,
unvalidated BBL count, PLUTO-unmatched count, coordinate-null count, and count of
`POSSIBLY_REMOVED` associations. If no prior snapshot exists, display **Change history
not yet available** rather than showing zero removals. This limitation belongs in the
ZAP panel and exported evidence packet; it must not be hidden only in documentation.
