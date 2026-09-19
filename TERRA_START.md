# Implementation handoff

Paste this prompt into the implementation session:

> Implement the CRE Activity Radar in this workspace. Read IMPLEMENTATION_PLAN.md
> and docs/RESEARCH.md first. The plan is the agreed default build specification;
> follow tasks T01–T08 sequentially and execute the work rather than producing a
> second plan. Build complete Chicago AND NYC investigation workflows through the
> same domain, aggregation, API and UI. Both city adapters and market switching are
> required, not optional. Use the NYC rules in section 12 during T02–T07. Keep SBA
> city context separate from H3 permit cells. Time-box public SBA acquisition to
> 30 minutes and use the documented unavailable-source fallback if blocked. Use NYC
> native coordinates first; PLUTO is an enrichment fallback, not a universal prerequisite.
>
> Use the specified one-package TypeScript/React/Vite/Express/SQLite stack. This is
> Windows PowerShell: use npm.cmd and npx.cmd. Node 24.18.0 and node:sqlite were
> verified here. The workspace initially contained only these planning documents.
> Initialize git if absent, preserve these documents, and commit meaningful working
> milestones. Keep actual prompts, decisions, and verification results in docs/AI_LOG.md
> and docs/PROGRESS.md. Do not invent successful checks or field mappings.
>
> Make routine implementation decisions autonomously within scope. If a verified
> source contradicts the plan, make the smallest correct adjustment and document
> the evidence. Follow applicable approval requirements for tool actions. Do not
> send email, publish anything, or change system execution policy. Do not introduce
> new frameworks or architectural layers. Do not spawn agents.
>
> At every task gate run its checks, fix failures, and update progress before
> continuing. A task is done only when its acceptance gate is true. When context
> is compacted, resume from docs/PROGRESS.md and existing files; do not restart.
> Finish with a runnable local app, honest data labels, passing relevant tests,
> reviewed desktop/mobile UI, a short README, and a three-minute demo script.
> Report actual completed scope, exact startup commands, tests run and remaining
> limitations. Begin with T01 now.

Suggested progress log format (create during implementation):

```text
Current task: Txx
Dataset mode / source availability:
Completed tasks and commits:
Commands actually run and outcomes:
Open failures or limitations:
Scope cuts / supporting evidence:
Next exact action:
```

The implementation plan uses checkboxes so completion remains visible across
sessions. This handoff itself does not implement or validate the application.
