# Product and data decisions

## One investigation workflow, two source adapters

Chicago Building Permits and NYC DOB NOW: Build are ingested through separate adapters into a common permit shape. This preserves each publisher’s identity, dates, type labels, retained raw fields, and source link while allowing one market selector, aggregation path, map, and evidence experience. NYC DOB NOW is not presented as all NYC construction activity; it excludes other permit systems. The adapter boundary is therefore a consistency mechanism, not a claim of semantic equivalence.

## No cross-city ranking

The product switches between markets; it does not put Chicago and NYC cells into one leaderboard. Cities differ in their source systems, coverage, issuing practices, coordinate quality, and volume. A shared H3 resolution makes local exploration consistent, but it does not make counts comparable across city systems.

## Counts before a score

The app shows current count, prior count, absolute change, and a safe percentage where a baseline exists. It does not create an “opportunity,” demand, capital, or investment score. Map color represents current permit count; ranking can use absolute change or current count. The user can see the evidence behind either measure. Zero-to-positive comparisons are labeled as having no baseline instead of receiving an infinite percentage.

## Issuance records are not projects or starts

Chicago `issue_date` and NYC DOB NOW `issued_date` are used as recorded issuance-event dates. They do not prove construction began, completed, or represents one unique project. The interface therefore calls the series permit activity and displays source-specific warnings. Mixed residential and commercial records remain visible because no defensible commercial-only classifier was established.

## Applicant cost stays at the record level

Chicago `reported_cost` and NYC `estimated_job_costs` are applicant-reported work estimates. They are shown in evidence when supplied, but are not summed into area “investment” or used in ranking. Several permits may describe parts of the same work and a missing amount is not zero.

## SBA approval context is deliberately separate

SBA 504 `ApprovalDate` and `GrossApproval` describe loan approvals and total approval amount. They are not deployment, disbursement, completed construction, project cost, or leasing demand. The verified city field is borrower city, so SBA rows are presented as city-labelled borrower context with their later loan status available for inspection. They never obtain a coordinate, H3 cell, or influence permit-area metrics. Chicago uses exact `CHICAGO`, IL labels; NYC uses the five exact borough/city labels documented in `SBA_STATUS.md`. Ambiguous aliases are excluded.

## H3 cells are a display bucket, separate from precision

Resolution-8 H3 cells create a stable common grid for resolved permit coordinates. A cell is not a neighborhood, submarket, parcel, or assertion of location accuracy. `SOURCE_COORDINATE` states only that the source supplied the coordinate; it is not called exact. Permits with invalid or missing coordinates remain accepted and counted in city totals, source health, and unmapped counts, but have no map cell. No ZIP centroid or city-labelled financing record is projected into a cell.

## Local SQLite snapshot over a live analytical service

The seeded SQLite database holds a frozen local snapshot, normalized observations, retained source fields, ingestion reports, and evidence identities. This keeps the review reproducible and avoids network dependency during the demo. It is intentionally not a cloud deployment, multi-user service, live refresh pipeline, ORM layer, or a claim of production-scale throughput.

## Source identities remain source-specific

Chicago uses its published record `id`. NYC uses Socrata’s `:id` retained as `source_row_id`; filing, permit, and sequence numbers are evidence fields, not silently substituted project keys. The SBA extract lacks a verified loan-level ID: `LocationID` identifies a lender, not a loan. SBA ingestion therefore uses source-row ordinal plus a canonical-record fingerprint for snapshot audit and avoids deduplicating distinct approvals merely because some fields match. Exact duplicate handling and outcome accounting remain visible in source reports.
