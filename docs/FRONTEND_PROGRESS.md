# Frontend progress

Completed: `src/web/App.tsx` provides the shared Chicago/NYC investigation flow: market and exact permit-type controls, filtered Leaflet/H3 polygons, sortable area list, selected-area detail, monthly chart, paginated permit evidence, retained source-field dialog, separate SBA context, and source-quality reporting. Leaflet uses local GeoJSON only, so the workflow does not depend on remote map tiles.

Correctness and accessibility: market/filter reloads clear selection, detail, record dialog, and stale data; the low-volume control filters the map and list from the same visible cells and clears a now-hidden selection. Evidence resets to the current fixed period and first page on market/cell/filter changes. Detail and record requests use `AbortController`; record requests supersede prior opens. Incomplete sources disable growth ranking and label comparisons unavailable. The source report shows ingestion accounting, completeness, mapping quality, and retrieval date. The source-record dialog focuses its Close button, restores focus on dismissal, and supports Escape. The desktop grid becomes one column at narrow widths and source-report columns collapse before mobile.

API contract: the typed client uses `/api/summary`, `/api/cells`, `/api/cells/:h3`, `/api/cells/:h3/evidence`, `/api/approvals`, `/api/records/:id`, and `/api/sources`, all with the shared DTO envelopes. Summary and cell requests include `permitType`; market-scoped endpoints include `market`.

Checks run:

- `npm.cmd run typecheck` — passed.
- `npm.cmd run build:web` — passed after the approved outside-sandbox rerun required by Vite/esbuild; output is in `dist/web`.
- `git diff --check -- src/web/App.tsx src/web/styles.css` — passed (only line-ending warnings).
- `npm.cmd run build` — passed after the approved outside-sandbox Vite/esbuild rerun.
- `npx.cmd playwright test --list` — passed; the focused Chicago-to-NYC investigation test is discovered.
- Direct integrated API flow against `http://127.0.0.1:3001` — both markets returned summary, cells, current evidence, record detail, and two source reports. Chicago: 8 types, 807 cells, 1,038 current records in the selected first cell; NYC: 21 types, 1,078 cells, 3,266 current records in the selected first cell.

Browser limitation: `npm.cmd run test:e2e` cannot launch because Playwright Chromium is not installed (`chromium_headless_shell-1243/.../chrome-headless-shell.exe` is missing). No browser surface is registered for the computer-use tool, and its local in-app browser is unavailable, so desktop/mobile screenshots and manual visual checks could not be made in this environment. `npx.cmd playwright install chromium` would be required before rerunning the test and screenshot review.
