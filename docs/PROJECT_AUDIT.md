# CASEPULSE repository audit

**Scope:** Snapshot of the existing repository for SIH 2026 Problem Statement 26264, taken 23 October 2026. This is an audit of the current prototype, not a claim that production backend capabilities exist.

## Repository and technology

- Next.js 16.4.2 App Router, React 19.3.0, TypeScript 5, Tailwind CSS 4, and `lucide-react`.
- Source is under `src/`; route segments use the App Router convention. The UI pages are client components backed by `src/lib/data-store.ts`.
- Data is synthetic and defined in `src/data/synthetic-dataset.ts`. `src/lib/correlation-engine.ts` deterministically derives cross-bureau candidate overlaps. The store keeps mutable in-memory arrays and persists case and overlap changes in browser `localStorage`.
- No server API routes, database driver/ORM, migration system, backend service, authentication/authorization package, or `.env.example`/`.env*` file was found at the repository root. No database connection is configured. The service layer contains PostgreSQL DDL export text for a future backend handoff.
- Dependencies are limited to the framework, UI icon package, and lint/type tooling in `package.json`. There are no test, type-check, or check scripts; TypeScript can be checked with `npx tsc --noEmit`.
- Root files include `README.md`, `AGENTS.md`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, and `package-lock.json`. The source tree contains `src/app`, `src/components`, `src/data`, `src/lib`, and `src/types`.

## Existing pages and behavior

| Path | Existing capability |
|---|---|
| `/` | Dashboard cards, selected alerts, urgent cases, overlap triage panels, and a dossier export modal. |
| `/cases` | Search and client-side filters for bureau, status, category, overdue, and overlap. |
| `/cases/[id]` | Case detail view with timeline/action display and client-side case actions. |
| `/institutions` | Searchable/filterable institution directory. |
| `/institutions/[id]` | Institution detail and linked case/overlap information. |
| `/overlaps` | Search/filter workbench with deterministic rationale/evidence and client-side review actions. |
| `/analytics` | Correlation and caseload summaries, plus PostgreSQL schema export. |

These are implemented UI behaviors over the local synthetic store. Cross-user persistence, server-side validation, access control, and durable audit history are not present. Dashboard alert cards include hard-coded demonstration content, so they are not all computed from current store values.

## Git and environment state

At audit start, `git status --short --branch` showed branch `master`, modified tracked files `README.md`, `package-lock.json`, `package.json`, `src/app/globals.css`, `src/app/layout.tsx`, and `src/app/page.tsx`, plus untracked UI/app/data/type files under `src/`. These changes were present before this audit and have been preserved. This audit adds only the two documents in `docs/`.

No root environment files or environment examples were present in the listing. No secret values were read or included in this report.

## Verification results

Commands run against the current working tree on 23 October 2026:

| Check | Result |
|---|---|
| `npm run lint` | Passed (ESLint exited 0). |
| `npx tsc --noEmit` | Passed (TypeScript exited 0). |
| `npm run build` | Failed twice in Next.js/Turbopack before reporting an application diagnostic. Both runs failed while processing `src/app/globals.css` and starting a child process (`node process exited before we could connect to it with exit code: 0`), ending in `TurbopackInternalError: Failed to write app endpoint /page`. This appears to be a runner/process-launch limitation; the available log does not prove whether the production build succeeds in a normal local environment. |
| `npm run dev -- --port 3137` | Next.js printed `Ready in 2.1s`. An HTTP smoke request could not connect because the sandbox denied the socket (`An attempt was made to access a socket in a way forbidden by its access permissions`). The dev process was stopped after the check. |
| Tests | No test script or test files/framework were found; no test command is configured. |

## Gaps and development blockers

1. All application data and writes are local/demo state; there is no API or shared source of truth.
2. Review decisions are mutable state on a candidate overlap, not append-only decision records. The UI supplies a default reviewer identity, which is not suitable as an authenticated actor identity.
3. No server-side authentication, authorization, validation, or audit controls exist. Review writes must stay disabled until a trusted identity and officer authorization policy are connected.
4. The type model has institutions, cases, timeline events, overlap candidates, and metrics, but does not model explicit durable case relationships or a separate review-decision history.
5. Overlap detection is pairwise (`O(n²)`) and currently runs against the in-memory collection. A production implementation needs a bounded/queued recompute strategy as volume grows, plus persistence and deterministic rule-version metadata.
6. Existing fields duplicate institution name/AISHE code on cases and institution details on overlaps. The database should normalize institution and bureau references while API projections may keep convenient summary fields.
7. The README's methodology says normalized-name similarity `>= 0.70`; the current detector checks `>= 0.75`. The API contract treats the existing detector's score/rationale as opaque output pending agreement on the threshold.
8. The build and HTTP checks could not complete in this sandbox due to process/socket restrictions. Re-run them in a local environment able to spawn build workers and open a local port before relying on release readiness.

## Recommended next steps after contract review

1. Approve `docs/API_CONTRACT.md`, including the overlap decision vocabulary and review route.
2. Agree on the initial persistence/auth deployment boundary. The contract is framework-neutral and matches the existing `/api/...` examples; the current Next.js App Router supports same-origin Route Handlers. The README mentions a possible FastAPI/PostgreSQL handoff, but no such backend exists yet.
3. Add a repository/service boundary and schema migrations for institutions, cases, actions, case relationships, and review decisions; keep demo data as a seed fixture.
4. Implement read endpoints and adapt the UI to consume them, then implement the authenticated review write as a transaction with append-only audit history.
5. Add validation, authorization, integration tests, and CI checks when backend implementation begins. Resolve the similarity-threshold/documentation mismatch as part of formalizing detector version 1.
