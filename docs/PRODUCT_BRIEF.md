# Product brief: an auditable weekly investigation queue

## The decision

The primary persona is a CRE market research analyst supporting brokers' weekly market review. Their job is to turn a broad market question into a small, defensible research queue before broker and proprietary-data time is spent.

The trigger is a recurring weekly review or a broker asking where local activity may warrant a closer look. The analyst starts with fragmented public permit records, not a validated signal of property value, tenant demand, or investment performance. The output is a ranked set of local areas and an **Investigation Brief** for each selected area: the observed change, the records behind it, the limits on interpretation, and concrete next checks.

This is deliberately a triage tool. It does not recommend an investment, value a property, forecast demand, or determine that an area is commercially attractive.

## Job to be done

> When I am preparing a weekly market review, help me decide which local permit patterns deserve the next thirty minutes of research, while letting me explain exactly why an area surfaced and what the public records do and do not establish.

## Workflow

| Stage | Analyst action | Product responsibility |
| --- | --- | --- |
| Frame | Choose Chicago or New York City and a source permit type. | Hold the comparison window fixed and preserve each publisher's semantics. |
| Prioritize | Review the highest-change eligible areas. | Surface record-count changes with volume and source-quality context; do not invent an opportunity score. |
| Explain | Select an area. | Produce an Investigation Brief that connects the area count to trend, type mix, repeated addresses, and source evidence. |
| Validate | Open retained records and official source links. | Make every displayed claim traceable to the frozen local snapshot and disclose relevant warnings. |
| Continue | Research the viable leads in property, zoning, ownership, leasing, or broker systems. | State suggested next checks and the limits of public permit evidence. |

## What makes a useful brief

An Investigation Brief should answer four questions without making claims the data cannot support:

1. **Why did this area surface?** Current and prior permit-record counts, absolute change, and safe baseline treatment.
2. **What appears to drive the difference?** Source permit-type mix, time distribution, repeated supplied addresses, and a small set of large reported-estimate records where present.
3. **How much should I trust this as a lead?** Source completeness, mapped/unmapped coverage, missing estimates, low-volume context, and source-specific caveats.
4. **What should I do next?** Verify the highest-impact records, de-duplicate likely project-related permits, check property and ownership context, then decide if broker research is warranted.

The brief is a decision aid, not a conclusion. A change may reflect permitting practice, a single project recorded through many permits, missing coverage, or normal variation. The analyst remains responsible for validation.

## Success criteria for this prototype

- A weekly-review analyst can move from a market-level question to an evidence-backed area brief in minutes.
- Each brief resolves to the underlying records and official publisher link.
- A reviewer can see the source conditions that would make a comparison unreliable.
- The same workflow works within Chicago and NYC without implying their permit systems are comparable.
- SBA 504 information remains separate city-level borrower context and cannot distort a permit-area conclusion.

These are product-design success criteria. No user interviews, adoption metrics, time-saved measurement, predictive validation, or outcomes study has been completed. The intended value is a hypothesis to test with analysts.

## Why this is staff-level work

The meaningful problem was not rendering a map. It was deciding where public data can responsibly help a CRE workflow, then making the system's reasoning inspectable. The work treats source differences, spatial precision, snapshot reproducibility, quality accounting, and the boundary between a lead and a conclusion as product requirements. The shared workflow is intentionally narrow: it converts ambiguity into a reviewable next action without pretending public records answer the downstream commercial question.

## Interview FAQ

### Isn't this just a government-data explorer?

It starts with government data, but it is organized around a different job. A city portal publishes one authoritative source and supports source-specific search. This prototype helps a CRE analyst prepare a weekly review: it holds periods fixed, prioritizes a small local queue, explains each surfaced pattern, carries the analyst through to source evidence, and states the next check. The map is a view in that workflow, not the product's claim of value.

### Why could a city portal not build this?

Technically, it could. The distinction is product focus, not exclusive capability. City portals appropriately optimize authoritative publication, broad access, and the semantics of their own source. A CRE workflow needs a controlled comparison and evidence experience across heterogeneous systems while preserving the fact that the systems mean different things. There is no claim that this is a durable technical moat.

### What is the differentiator, and is there a moat?

The differentiator is the evidence-continuous workflow: cross-market normalization, fixed comparable windows, transparent prioritization, diagnostic explanation, quality/provenance context, and concrete next checks. The prototype uses no exclusive data and has no demonstrated durable moat. A potential future advantage would have to come from validated analyst workflow integration, trusted enriched data, accumulated feedback, and reliable operations—not from H3 or a public-data map alone.

### Why H3?

H3 resolution 8 is a repeatable bucket for grouping records with usable publisher coordinates. It lets one interaction model work within both cities while avoiding a fabricated neighborhood taxonomy. It is not a parcel, submarket, boundary, or precision claim; the brief labels the source coordinate limitation and records without usable coordinates remain visible in source accounting.

### Why two cities?

The purpose is to test whether the workflow survives materially different public permit systems, not to produce a national leaderboard. Chicago and NYC have separate adapters and retain their source-specific caveats. They are never ranked against each other. This is evidence that the product boundary is deliberate: common workflow, distinct source semantics.

### Does this predict CRE outcomes?

No. It identifies changes in recorded permit activity that may be worth verifying. It does not establish supply, tenant demand, rent growth, property value, construction completion, investment performance, or causality. Those are downstream questions for property, ownership, leasing, zoning, and broker research.

### Who uses it and who pays?

The primary user is a CRE market research analyst supporting brokerage teams' weekly reviews. A plausible buyer would be a brokerage research organization or a platform team serving that function. That is a target persona and commercial hypothesis, not evidence of willingness to pay.

### How would you validate value?

Observe several analysts preparing real weekly reviews. Compare their current research queue with a queue generated by the prototype, ask which evidence changed their next action, and trace whether the brief reduced time to a defensible lead without increasing false leads. Measure repeat use, record-opening behavior, lead disposition, freshness needs, and whether analysts need property/use enrichment more than another visualization. Do not claim time savings or accuracy until those studies are run.

## Boundaries

- Permit issuance records are not unique projects, construction starts, completions, or proof of demand.
- Applicant-reported costs are evidence fields, not area investment measures.
- H3 cells are fixed display buckets, not neighborhoods, parcels, or submarkets.
- Chicago and NYC may be explored through the same interaction pattern, but are not placed in one cross-city ranking.
- SBA 504 approvals use borrower-city geography and approval amounts; they are not localized financing signals, disbursements, or project costs.

The detailed source definitions and decisions are in [RESEARCH.md](RESEARCH.md), [SBA_STATUS.md](SBA_STATUS.md), and [DECISIONS.md](DECISIONS.md).

## Commercialization hypothesis

Position the product as a **public-signal research queue for CRE teams**. The recurring user is the market research analyst; the practical buyer hypothesis is a research lead or broker-team leader who needs a more consistent weekly research workflow. The value hypothesis is not that a permit count is valuable by itself. It is that a transparent queue and evidence brief can make the scarce analyst-to-broker handoff more focused, reviewable, and repeatable.

That hypothesis needs discovery before a pricing, efficiency, or revenue claim. Interviews should establish which weekly-review decisions are actually painful, whether users trust the evidence packet, what a viable lead looks like, and whether the likely buyer values research consistency, freshness, collaboration, enrichment, or workflow integration.

## Prioritized product path

| Priority | Capability | Intended outcome and differentiation | Delivery effort | Evidence required before advancing |
| --- | --- | --- | --- | --- |
| Now | Investigation queue and explainable brief | Turns public records into a reviewable next research action. | Shipped prototype | Observe analysts using it in a real weekly review. |
| Next | Watchlist, analyst disposition, threshold alerts, evidence export or CRM handoff | Completes the recurring loop from surfaced signal to analyst/broker follow-through. | Moderate | Validate which threshold, destination, and disposition states analysts actually use. |
| Strategic | Parcel and property-use enrichment; selected proprietary CRE datasets | Makes the lead easier to connect to the asset, ownership, leasing, and market context needed for a decision. | High, data-dependent | Confirm that enrichment changes lead disposition and justify data/licensing cost. |
| Strategic | Historical anomaly and peer baselines | Helps distinguish ordinary seasonal patterns from unusual local activity while keeping the reasoning inspectable. | High | Backtest against analyst-reviewed cases and confirm the baseline reduces false leads. |
| Later | Citation-grounded natural-language research | Speeds retrieval and synthesis after the evidence packet exists. | High | Test that citations are sufficient, reliable, and preferred over direct filters and evidence views. |

An opportunity, demand, or investment score is intentionally absent. It should not be introduced until a documented outcome definition, labeled historical examples, calibration method, monitoring plan, and analyst validation establish that it improves a real decision without hiding uncertainty.

## Operations is part of the product

Analysts can only use a public-signal queue if they can tell whether its snapshot is fresh, complete, and internally reconciled. Source accounting and a controlled refresh flow are product capabilities: they expose accepted, rejected, duplicate, out-of-scope, mapped, and unresolved records rather than silently replacing a result with an unknown one.

The local prototype runs on localhost with no authentication. A production implementation would require authenticated administrator roles, an allowlisted refresh job queue rather than arbitrary command execution, protected source credentials, retry and failure handling, an audit log, durable snapshot history, and blue/green publication so a partially loaded snapshot is never shown to analysts. This is an operational design direction, not a claim that those production controls are present in the prototype.

For an interview: staff-level ownership includes making failures and freshness visible to users, designing a safe operating path, and preserving a reproducible evidence chain. It is not limited to a data architecture or a polished UI.
