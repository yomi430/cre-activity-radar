# SBA 504 source audit — 2026-09-19

Audited local publisher files only:

- `data/raw/sba_504_fy2010_present_asof_260630.csv` — 117,983 data rows, `AsOfDate` is `2026-06-30` on sampled rows.
- `data/raw/sba_504_data_dictionary.xlsx` — publisher data dictionary, sheet **504 Data Dictionary**.

## Verified raw contract

The CSV is exclusively 504: `Program` is `504` for all 117,983 rows. Use `ApprovalDate` (ISO `YYYY-MM-DD`) for the fixed comparison windows and `GrossApproval` as the amount. The dictionary defines `ApprovalDate` as “Date the loan was approved” and `GrossApproval` as “Total loan amount.” It is therefore the gross/total approved loan amount, not a disbursement, project cost, or SBA-guaranteed amount. `ThirdPartyDollars` is separately defined as the third-party loan amount.

Geography is borrower geography: `BorrStreet`, `BorrCity`, `BorrState`, and `BorrZip` are respectively borrower address fields. There is **no project city or project ZIP**. `ProjectCounty` and `ProjectState` are the only verified project-place fields. Do not label `BorrCity` as a project city, or geocode it into cells.

`LocationID` is **not a loan identifier**: the dictionary calls it “SBA's unique lender ID code”; all 117,983 values are populated but only 194 distinct values occur (largest group 5,842). No stable loan-level ID is present in this extract. Persist source row ordinal plus a canonical-record fingerprint for audit/re-ingestion; do not deduplicate on `LocationID`. A fingerprint may identify exact repeated content but cannot prove distinct approvals when raw fields coincide.

## Status semantics and aggregation policy

`LoanStatus` is a current/later status, so an approval in either window can now be cancelled, paid, charged off, etc. The dictionary defines: `CANCLD` = cancelled; `CHGOFF` = charged off; `EXEMPT` = disbursed and not cancelled/PIF/charged-off, withheld under FOIA Exemption 4; `PIF` = paid in full; `NOT FUNDED` = undisbursed; and legacy `CLOSED` = closed for another reason. Full-file observed counts: EXEMPT 57,449; PIF 36,624; CANCLD 14,469; NOT FUNDED 8,516; CHGOFF 923; CLOSED 2.

Recommended adapter: retain every approval-row as an auditable source record, expose `loanStatus`, and calculate headline approval counts/sums from all approval rows **with a separate cancelled count/amount and a clear “later status as of 2026-06-30” caveat**. Do not call the gross total funded, disbursed, completed, or active investment. If product asks for non-cancelled approvals, explicitly filter `CANCLD` only and label the series accordingly; do not silently substitute it for approvals.

## Fixed windows and city labels

These counts filter `ApprovalDate` using half-open intervals and classify only normalized `BorrCity` (trimmed, uppercase). They are borrower-city context, not project location.

| Window | All 504 approvals | Chicago (`CHICAGO`, IL) | Chicago gross approval | NYC five-borough exact labels, NY state | NYC gross approval |
| --- | ---: | ---: | ---: | ---: | ---: |
| prior: 2024-07-01 to 2025-07-01 | 6,574 | 49 (6 cancelled) | $37,058,000 | 44 | $78,472,000 |
| current: 2025-07-01 to 2026-07-01 | 6,398 | 48 (1 cancelled) | $43,825,000 | 30 | $57,570,000 |

**NYC policy:** classify borrower-city context only where normalized `BorrCity` is exactly one of `NEW YORK`, `BROOKLYN`, `BRONX`, `QUEENS`, or `STATEN ISLAND` **and** normalized `BorrState` is `NY`. This is the most reproducible broad-city rule from fields supplied, while avoiding similarly named places. It yields prior: New York 10 / $12.481m, Brooklyn 24 / $48.498m, Bronx 5 / $10.827m, Queens 0, Staten Island 5 / $6.666m; current: New York 11 / $23.803m, Brooklyn 13 / $21.324m, Bronx 3 / $5.476m, Queens 0, Staten Island 3 / $6.967m. One prior literal `Brooklyn` record is excluded because its state is CT (1 / $131k).

Do not add neighborhood/ambiguous aliases without an explicit maintained crosswalk. Observed NY-state candidates outside the five exact labels are `Flushing` (2 prior, 1 current), `Jamaica` (1 prior), and `Far Rockaway aka Queens` (1 prior); these are excluded from the headline city series because the source does not give a verified borough field. `Queensbury` is also NY-state but is outside NYC (3 prior, 1 current). `WEST NEW YORK` (1 current) is excluded because it is NJ. `New York City` and `NYC` contribute zero in both windows. Chicago has no relevant observed variant in these windows beyond `Chicago` under case/trim normalization.

The current window nominally ends 2026-07-01, but the extract is as of 2026-06-30, so it contains no July 2026 records. Keep the source as-of date in metadata and present the window as source-complete only through 2026-06-30.
