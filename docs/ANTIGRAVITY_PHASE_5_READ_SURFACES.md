# Antigravity Phase 5 — Finish Read-Only API Integration Across CASEPULSE

**Workspace:** `E:\\sih`  
**Problem statement:** SIH 2026 PS 26264  
**Owner:** Antigravity, frontend only

## Current status verified by Desktop Commander

- Case Detail and Cross-Bureau Overlap Review now use the typed `src/lib/api-client.ts` and PostgreSQL-backed Route Handlers.
- Case-action and overlap-review write endpoints are implemented and have passed PostgreSQL integration assertions, including idempotency, version conflicts, and rollback behavior.
- A persistent, isolated local development PostgreSQL cluster has been configured at `127.0.0.1:55439`.
- `.env.local` now has a generated local `DATABASE_URL` and the development-only synthetic actor mode. Do not print or disclose any values from `.env.local`.
- The synthetic database currently contains 6 bureaus, 8 institutions, 13 cases, 29 actions, 7 relationships, and 3 synthetic officers.
- Current unit tests have passed (49/49); typecheck and lint have passed. PostgreSQL integration tests also passed against an isolated local PostgreSQL cluster. A clean HTTP/browser end-to-end run is still pending.
- Existing API contracts and routes are documented in `docs/API_CONTRACT.md`. Use them rather than guessing response formats.

## Goal

Convert the remaining read-only screens from the client-side `dataStore`/synthetic dataset to the existing PostgreSQL-backed APIs, while preserving the current CASEPULSE UI and navigation.

The previous phase intentionally only converted Case Detail and Overlap Review. This phase should cover:
1. Overview Dashboard — `src/app/page.tsx`
2. Complaint Register — `src/app/cases/page.tsx`
3. Institution Directory — `src/app/institutions/page.tsx`
4. Institution Profile — `src/app/institutions/[id]/InstitutionDetailClient.tsx`
5. Intelligence & Reports — `src/app/analytics/**`
6. Relationship Explorer — `src/app/explorer/ExplorerClient.tsx`
7. Any shared components that still require local mock records for these screens.

## Read-only API contract

Extend the existing typed client in `src/lib/api-client.ts` to add typed functions for:
- `GET /api/dashboard/summary`
- `GET /api/cases?page=1&pageSize=...`
- `GET /api/institutions?page=1&pageSize=...`
- `GET /api/institutions/{id}`
- `GET /api/overlaps?page=1&pageSize=...` (reuse the current client function if present)

Use the exact response envelope, query parameters, enums, and field mapping in `docs/API_CONTRACT.md`. All collection APIs have a maximum `pageSize` of 100; paginate until `meta.totalCount` if a complete dataset is needed. Do not assume one page equals the entire dataset.

## Screen requirements

### Dashboard
- Load KPI values from `GET /api/dashboard/summary`.
- Keep counts scoped to the server-authorized actor.
- Use only values actually returned by the API.
- Do not leave stale hard-coded counts in the production-data view.
- If a recent activity feed cannot be populated from the current contract, present a truthful empty/limited state rather than fabricated “live” activity. Do not add a new backend endpoint in this task.

### Complaint Register
- Use `GET /api/cases` with server-side filters and pagination.
- Preserve search, bureau, category, status, overdue, and overlap filters where supported.
- Show visible loading, empty, retry, authentication-required, access-denied, and service-unavailable states.
- Avoid reapplying browser-side filters that contradict authoritative server pagination.

### Institution Directory and Profile
- Use `GET /api/institutions` and `GET /api/institutions/{id}`.
- For linked cases and overlaps on an institution profile, fetch the documented case/overlap collections filtered by `institutionId`.
- Ensure linked case details, counts, and relationships reflect the authorized API results only.
- A missing or out-of-scope institution should show a non-disclosing unavailable state.

### Analytics
- Use dashboard summary and paginated cases/institutions data to compute only metrics that can be supported by the returned API fields.
- Never substitute mock data on API failure.
- Clearly distinguish calculated demo-data analytics from unsupported metrics. Keep charts honest if data is unavailable.

### Relationship Explorer
- Fetch cases, institutions, and overlaps from the existing APIs.
- Build graph nodes and edges from returned relationships and associated records.
- Preserve the existing custom SVG topology and evidence inspector.
- Clearly distinguish a same-institution relationship from a related-incident/duplicate complaint claim.
- Do not show out-of-scope nodes/cases or infer relationships from records the server did not return.

### Shared navigation and reset behavior
- Review `Navbar.tsx`. Its current Reset Demo State action calls the old client-side store and does not reset PostgreSQL.
- Remove or clearly disable the obsolete local-store reset action; do not imply it resets persisted server state.
- Keep the synthetic dataset banner truthful. If it is driven by API responses, use the server's `isSynthetic` / `syntheticDemoData` information rather than a hard-coded assumption.

## Engineering requirements

- Preserve existing visual design and accessibility.
- Reuse the typed `api-client.ts`; add types and tests rather than using `any`.
- Same-origin requests must preserve the existing session/cookie behavior.
- No localStorage or in-memory fallback for server-backed records.
- Never send officer identity, role, or bureau claims from the browser as authority.
- Do not touch database migrations, server repository code, authentication policy, or write endpoints.
- Do not add a second backend or require new paid API providers.
- Preserve all existing work and inspect `git status --short` first.

## Verification

The persistent local DB is stored outside the repository under `%LOCALAPPDATA%\\CASEPULSE\\postgres-data` and is bound to loopback port 55439. Use the documented command `npm run db:dev:start` if it is stopped. Do not print database credentials.

The running Next.js development server may need a restart to load the new `DATABASE_URL` from `.env.local`. Coordinate a deliberate restart; do not kill an unknown server process.

Run when no conflicting build/server process is using `.next`:
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build -- --webpack`

If a dev preview is active, do not run a competing production build. State the limitation instead.

## Acceptance criteria

- All seven screens above display API-derived data or a truthful loading/empty/error state.
- No screen silently falls back to the local dataset or `localStorage`.
- Filtering, case navigation, institution drill-down, and relationship graph interactions still work.
- Unauthorized/API/database errors do not create fake metrics, nodes, review states, or success messages.
- Existing write workflows remain functional and unchanged.
- Tests cover the new API client methods and important response/error mapping.
- Final report lists changed files, exact commands/results, remaining limitations, and whether a real browser HTTP session was exercised.
