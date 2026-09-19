# Frontend progress

Completed: `src/web/App.tsx` provides the shared Chicago/NYC investigation flow: market and exact permit-type controls, filtered Leaflet/H3 polygons, sortable area list, selected-area detail, monthly chart, paginated permit evidence, retained source-field dialog, separate SBA context, and source-quality reporting. Leaflet uses local GeoJSON only, so the workflow does not depend on remote map tiles.

Correctness and accessibility: market/filter reloads clear selection, detail, record dialog, and stale data; the low-volume control filters the map and list from the same visible cells and clears a now-hidden selection. Evidence resets to the current fixed period and first page on market/cell/filter changes. Detail and record requests use `AbortController`; record requests supersede prior opens. Incomplete sources disable growth ranking and label comparisons unavailable. The source report shows ingestion accounting, completeness, mapping quality, and retrieval date. The source-record dialog focuses its Close button, restores focus on dismissal, and supports Escape. The desktop grid becomes one column at narrow widths and source-report columns collapse before mobile.

API contract: the typed client uses `/api/summary`, `/api/cells`, `/api/cells/:h3`, `/api/cells/:h3/evidence`, `/api/approvals`, `/api/records/:id`, and `/api/sources`, all with the shared DTO envelopes. Summary and cell requests include `permitType`; market-scoped endpoints include `market`.

Checks run:

- `npm.cmd run typecheck` — passed.
- `npm.cmd run build:web` — passed after the approved outside-sandbox rerun required by Vite/esbuild; output is in `dist/web`.
- `git diff --check -- src/web/App.tsx src/web/styles.css` — passed (only line-ending warnings).

Remaining integration: backend routes are being finalized. Once they are available, start the integrated app and manually verify Chicago and NYC: market switch, low-volume map/list parity, cell selection, evidence period/page changes, record dialog, and 1440×900 / 390×844 layouts. No focused frontend test was added because no existing frontend test harness is present and a route-backed E2E test belongs with the integrated backend fixture.
