# Progress

Current task: T02 — official permit acquisition; NYC download in progress

Dataset mode / source availability: Chicago official selected-field extract is frozen and complete-query reconciled (63,482 rows). NYC official DOB NOW selected-field extraction is in progress after a 334,974-row count query. The runnable app still uses the clearly labeled synthetic two-market bootstrap dataset; public rows have not yet been normalized or seeded.

Completed tasks and commits: T01 bootstrap implementation complete; repository initialized, no commit yet (Git index write is blocked under sandbox ownership and escalated Git requires command-scoped `safe.directory`). T02 Chicago fetch complete; NYC fetch started as a hidden local process writing `data/raw/nyc-fetch.log` and an adjacent staging file.

Commands actually run and outcomes: `git init` succeeded. `npm.cmd install` succeeded after approved network escalation and wrote `package-lock.json`; npm reported 3 moderate dependency audit findings and blocked esbuild's install script pending review. `npm.cmd run typecheck` passed. `npm.cmd run data:fixture`, `data:seed`, and `data:verify` passed. `npm.cmd run build` passed when rerun outside the sandbox because esbuild needs Windows paths the sandbox denies. Built `start` smoke check returned `200` from `/api/health` with both manifest markets and `200` HTML containing the app title.

Open failures or limitations: this is only a bootstrap shell. It has a health endpoint and seedable SQLite database, but no normalization, aggregation, investigation APIs, map, or evidence UI. Public files are deliberately ignored and are not yet a published dataset manifest.

Scope cuts / supporting evidence: external source retrieval is deferred to T02 by the implementation plan.

Next exact action: T02 acquisition in progress. Chicago extraction reconciled at 63,482 rows and was frozen at `data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl` (SHA-256 in adjacent manifest). NYC count query returned 334,974; its paginated extract is pending. Commands: `node scripts/count-sources.mjs`, `node scripts/inspect-sources.mjs`, `node scripts/fetch-permits.mjs chicago`.
