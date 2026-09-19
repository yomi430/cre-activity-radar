# CRE lens taxonomy proposal

This is a proposal for a future multi-type **CRE triage lens**. It is not active
yet: the live selector uses either all records or one exact source value. The
sources do not supply a shared use code, parcel type, project ID, occupancy,
tenant, or construction-stage field. A cross-city category therefore cannot be
treated as a common market signal.

`All types` remains the reversible view of every accepted source record. It is
not a commercial-only default. A future lens must display its exact included and
excluded source values, keep All available, and apply the identical selection to
the queue, map, brief, and evidence table. It must never silently drop records or
convert a category into a demand, occupancy, investment, or supply outcome.

| Lens / treatment | Chicago exact permit types | NYC DOB NOW exact work types | It can support | It cannot support |
| --- | --- | --- | --- | --- |
| Development / site-work review | `PERMIT - NEW CONSTRUCTION`; `PERMIT - WRECKING/DEMOLITION` | `Foundation`; `Full Demolition`; `Earth Work`; `Support of Excavation` | A smaller queue for development- or site-work-related records. | New-supply count, project count, completion, timing, size, or commercial use. |
| Reinvestment / repositioning review | `PERMIT - RENOVATION/ALTERATION` | No clean exact equivalent. `General Construction` and `Structural` are mixed work labels. | Chicago alteration activity for property-level follow-up. | A matched Chicago/NYC category, commercial use, tenant activity, or value creation. |
| Building systems / signage review | `PERMIT - ELEVATOR EQUIPMENT`; `PERMIT - SIGNS` | `Plumbing`; `Mechanical Systems`; `Sprinklers`; `Boiler Equipment`; `Solar`; `Sign` | A distinct building-system or signage record queue. | Tenant move-in, lease activity, occupancy, capital investment, or a project total. |
| Temporary, protection, process, or status review | `PERMIT – EXPRESS PERMIT PROGRAM`; `PERMIT - EASY PERMIT PROCESS`; `PERMIT - REINSTATE REVOKED PMT` | `Construction Fence`; `Sidewalk Shed`; `Supported Scaffold`; `Suspended Scaffold`; `Protection and Mechanical Methods` | Transparent review of records that are hard to interpret without their description. | That the records are immaterial; each may relate to real work. |
| Specialized / mixed review | No grouping proposed beyond exact selection | `Standpipe`; `Curb Cut`; `Antenna`; `General Construction`; `Structural` | An explicit read-the-evidence-first queue. | Automatic inclusion in a CRE-intent score. |

The values above are the literal accepted Chicago `permit_type` and NYC
`work_type` values in the seeded public snapshot. The taxonomy is intentionally
source-specific: a label is grouped only where its literal source value supports
the treatment.

## Recommended implementation

1. Keep **All types** and state that it includes temporary, process, and status
   labels.
2. Offer the source-specific lenses as editable inclusion lists and show their
   literal values before results load.
3. Make a visible **CRE triage** selection the recommended starting view: include
   development/site work, Chicago alteration work, and building systems/signage;
   exclude only the temporary/process/status group from the ranked queue. Restore
   those values in one click. Keep NYC `General Construction` and `Structural`
   separate until description-level validation supports a rule.
4. Report the selection beside every count and preserve the exact permit-type
   driver table and record-level evidence.

No weighting is proposed. Downweighting would be a value judgment that the
available fields cannot validate. The first useful implementation is a visible,
reversible inclusion rule with record-level review.
