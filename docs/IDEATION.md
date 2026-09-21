# Ideation and scope selection

This project began with a broad question: which recurring CRE decision could public or
synthetic data support credibly within a short take-home? The exploration used 38 numbered
idea slots. Some were deliberately rescored or revisited, so this is a decision trail rather
than a claim that all 38 were unique concepts.

## Ideas considered

1. Portfolio Data Trust Gate
2. Lease Obligation Radar
3. AI Workforce-to-Space Scenario Planner
4. Comp Evidence and Exception Review
5. Site Selection Constraint Engine
6. Data Center Power Readiness Screener
7. Climate Disclosure Evidence Ledger
8. CRE Decision Navigator
9. Broker Signal-to-Action
10. Lease Decision Navigator
11. Data Center Power-to-Closing Screener
12. Climate Capex and Compliance Prioritizer
13. Office Footprint Scenario Engine
14. Comparable Evidence Review Workbench
15. Portfolio Data Trust Gate, rescored
16. Lease Obligation Radar, rescored
17. AI Workforce-to-Space Scenario Planner, rescored
18. Comp Evidence and Exception Review, rescored
19. Site Selection Constraint Engine, rescored
20. Data Center Power Readiness Screener, rescored
21. Climate Disclosure Evidence Ledger, rescored
22. Broker Signal-to-Action Queue
23. Deal Room Readiness
24. Retail Tenant Health and Rent Risk Monitor
25. Industrial Lease Abstract and Obligation Tracker
26. Multifamily Rent Optimization and Concession Analyzer
27. Development Feasibility and Residual Land Value Calculator
28. Property Tax Appeal Evidence Builder
29. Insurance and Risk Exposure Mapper
30. 1031 Exchange Identification and Replacement Finder
31. Lease Administration Data Reconciliation Engine
32. Workplace Occupancy and Lease Alignment Tracker
33. ESG Data Lineage and Assurance Dashboard
34. Lease Renewal Readiness Navigator
35. Deal Room Readiness, revisited
36. Federal Tenant Exposure and Backfill Opportunity Radar
37. Tenant Risk Early Warning Radar using federal lease and layoff notices
38. Capital Deployment and Space-Demand Signal Radar, refined into **CRE Activity Radar**

## Why idea 38 won

Many alternatives depended on private leases, occupancy, comps, reliable tenant identities,
or causal claims that could not be established with public data in the assignment window.
Idea 37 was rejected because a layoff notice can be unrelated to a specific CRE decision and
would invite unsupported inference. Idea 38 had accessible official records, meaningful
cross-market data differences, a clear weekly research persona, and a useful outcome that
could remain modest: a traceable queue for the next research step.

The first concept combined SBA 504 approvals and permit activity as possible capital and
space-demand signals. Research changed that framing. Permit issuance became the primary
area-discovery input. SBA remained separate city-level financing context because borrower
city does not justify an H3 location. NYC entitlement, parcel-use, and recorded-deed facts
were later added as separate context layers; none rewrites permit ranking.

## How the scope was chosen

The build started Friday night after normal work commitments, leaving a compressed execution
window. That constraint strengthened the choice to ship a narrow, runnable local workflow
with retained demo data, explicit limitations, and automated tests. Chicago and New York
were implemented as two real source adapters before extracting their shared permit contract.
This exposed actual differences in schema, coordinates, property identity, and public-data
coverage instead of assuming a universal city workflow prematurely.

The final product claim is intentionally smaller than the original name suggested: CRE
Activity Radar helps an analyst turn fragmented public records into an evidence-backed next
question. It does not measure capital deployment, predict space demand, or identify an
investment opportunity.
