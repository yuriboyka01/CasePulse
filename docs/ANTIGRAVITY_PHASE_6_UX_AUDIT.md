# CASEPULSE Phase 6B — Judge-Ready UX and End-to-End Workflow Audit

**Project:** CASEPULSE, SIH 2026 PS 26264  
**Owner:** Antigravity (frontend only)  
**Workspace:** `E:\\sih`

## Current verified state

- The frontend screens have been connected to the typed API client for PostgreSQL-backed reads.
- Case action and overlap review controls call the persistent write APIs.
- The current local development database is isolated under `%LOCALAPPDATA%\\CASEPULSE\\postgres-data` and listens on loopback port 55439.
- `.env.local` contains a local-only generated database URL. Never reveal or log its values.
- Tailwind styling has been repaired using `postcss.config.mjs` with `@tailwindcss/postcss`; the custom Turbopack CSS-loader rule was removed from `next.config.ts`. Preserve this configuration.
- Both dynamic detail pages now resolve `params` inside child components wrapped by Suspense. Preserve this fix.
- Production OIDC is not configured; the application should remain clear that local demo mode is not real production authentication.

## Objective

Perform a narrow visual, accessibility, and workflow audit to make the existing application reliable for a live SIH demonstration. Do not redesign it or add decorative features.

## Step 1: Preserve and inspect

1. Run `git status --short` and inspect recent changes.
2. Read `docs/API_CONTRACT.md` and the existing auth UI.
3. Preserve all backend, database, CSS, and route fixes.
4. Do not edit `src/lib/server/**`, API routes, migrations, or database services.

## Step 2: Audit the user journey

Test the actual running application on `http://localhost:3000` using its existing session/demo mode:

1. Overview → Complaint Register.
2. Open a case and confirm its timeline is loaded from the API.
3. Add a case action; confirm success appears only after the server returns successfully.
4. Refresh and confirm the action remains.
5. Open the Overlap Review queue.
6. Review a relationship using `CONFIRMED`, `REJECTED`, or `FURTHER_COORDINATION`.
7. Refresh and verify the chosen decision and append-only history remain.
8. Open an institution profile and confirm it loads without a route error.
9. Open Relationship Explorer and verify all graph nodes/edges come only from the API results.
10. Trigger or simulate a 401/403/404/409/503 response where practical and check that the UI does not show fake data or a fake success state.

Use only synthetic demo data. Do not make live institutional-service claims.

## Step 3: Visual and responsive QA

Inspect these pages at desktop width and a narrow mobile viewport:
- Dashboard
- Complaint Register
- Case Detail
- Institution Directory and Profile
- Overlap Review
- Analytics
- Relationship Explorer

Verify:
- Tailwind utilities are loaded and spacing, typography, colors, grid/flex layout, and controls are visibly styled.
- Navigation and actions work by keyboard as well as pointer.
- Focus indicators and form labels are present.
- Loading, empty, unavailable, and retry states are legible.
- Tables and graph inspector panels do not overflow mobile viewports.
- No console/runtime errors appear during the target journey.

## Step 4: Make only justified frontend corrections

- Preserve the design system and existing component structure.
- Never restore mock/localStorage data as a fallback for API failures.
- Remove any unused demo-reset action or make its disabled state and reason explicit; it must not pretend to reset PostgreSQL.
- Ensure the data-source badge is honest: the application is backed by PostgreSQL locally, while the records remain synthetic and non-production. Avoid a status that implies real AICTE records.
- If any screen makes an unsupported metric or capability claim, relabel it truthfully.
- Do not introduce new dependencies unless strictly necessary.

## Validation

Run `npm test`, `npm run typecheck`, and `npm run lint` if no other agent is running checks concurrently. Do not run a production build while the development server is active. If a build is required, coordinate a deliberate stop/build/restart with the project owner.

## Acceptance criteria

- All routes and key buttons work in the demo journey.
- Case actions and overlap review decisions survive refresh.
- Errors do not masquerade as successful writes.
- Styling is intact at desktop and mobile sizes.
- The synthetic-data and demo-auth status is unambiguous.
- No backend/database files are changed.
- Report pages checked, viewport sizes, actions actually tested, changed files, checks, and limitations. Do not claim a visual browser test unless one was actually performed.
