# CODEX PHASE 3 — Transactional Case Actions and Overlap Review Writes

**Project:** `E:\\sih`  
**SIH PS:** 26264  
**Role:** Backend engineer  
**Scope:** Implement persistent write workflows only. Do not redesign frontend and do not claim live OIDC is verified.

## Current repository context

CASEPULSE uses Next.js 16 App Router, TypeScript, PostgreSQL, and Auth.js v5 OIDC configuration.

Relevant files:
- `src/auth.ts`
- `src/lib/server/actor-provider.ts`
- `src/lib/server/repository.ts`
- `src/lib/server/types.ts`
- `src/lib/server/errors.ts`
- `src/lib/server/validation.ts`
- `db/migrations/001_initial.sql`
- `db/migrations/002_officers_and_auth.sql`
- `docs/API_CONTRACT.md`
- `docs/BACKEND_SETUP.md`

The authorization layer has unit tests. The current report says 31 unit tests pass, typecheck and lint pass, and `npm run build -- --webpack` passes. PostgreSQL integration tests were skipped without `DATABASE_URL_TEST`. Live OIDC sign-in has not been verified with a real provider. Preserve those distinctions.

## First: inspect and preserve

1. Run `git status --short` and preserve all existing files and untracked work.
2. Read the current API contract, migrations, actor provider, repository, all existing API route handlers, and frontend case/overlap interactions.
3. Confirm exact action-history and relationship table schemas before writing SQL.
4. Do not reset, clean, or regenerate the project. Do not modify frontend UI components in this phase.
5. Use a new numbered migration if schema changes are needed; never edit an already-applied migration.

## Required implementation

### A. Case action write endpoint

Implement an authenticated, bureau-authorized API for the existing case-detail UI's “Add Entry” and status-change workflow.

Prefer one transactional operation for an action plus an optional status transition, for example:

`POST /api/cases/[id]/actions`

Use a request schema that supports an action note/type and an optional requested next status. Adapt names to the existing contract and UI, but document the final request/response format.

Requirements:
- Resolve the actor with the existing server-side `requireActor()` / trusted actor provider.
- Ignore or reject any request-supplied officer ID, reviewer name, role, or bureau membership. Actor identity must come from the resolved server-side actor.
- Require a normal officer's membership in the case's bureau for case actions. Apply an explicit, documented ADMIN policy if admins can act across bureaus. A read-only `CROSS_BUREAU_VIEW` permission alone must not grant write access.
- Validate action types, text length, requested status transitions, and case existence.
- Use parameterized SQL.
- Persist the action and status change in one database transaction.
- If status changes, update the case and create exactly one corresponding timeline/action-history record. Do not insert a second duplicate event due to client-side double calls.
- Roll back all changes if any part fails.
- Return the canonical updated case state and appended action record.
- Preserve stable ordering for the timeline.
- Use a consistent non-disclosing response for inaccessible cases where revealing existence is sensitive.
- Return visible errors for database failures. No in-memory or browser-storage fallback.

If the current UI makes two separate calls that would cause duplicates, document the mismatch without changing components in this phase. Implement the canonical backend transaction and report the small API integration change the frontend will need.

### B. Overlap review write endpoint

Implement:

`POST /api/overlaps/[id]/reviews`

Allowed decision values are exactly:
- `CONFIRMED`
- `REJECTED`
- `FURTHER_COORDINATION`

Requirements:
- Resolve reviewer identity on the server.
- Never trust a reviewer name or officer ID from the request body.
- Validate notes and decision values.
- Enforce authorization for BOTH involved bureaus. For MVP, permit a provisioned officer assigned to both bureaus, or an ADMIN with the explicitly documented policy. Do not treat `CROSS_BUREAU_VIEW` by itself as review-write permission.
- Return non-disclosing 404 for inaccessible relationship records if existence could leak restricted information.
- In one transaction, update the relationship's current decision/version and append one immutable review-history record.
- Use optimistic concurrency or an expected version to prevent concurrent decisions silently overwriting a newer decision. Return a conflict response for stale versions.
- Never update/delete older review-history entries.
- Do not conflate `FURTHER_COORDINATION` with initiating a joint inquiry. Joint-inquiry initiation is a separate administrative action and remains out of scope here.
- Return the updated relationship and the newly appended review event.
- Database errors must not appear as successful writes.

### C. Authorization helpers

Reuse and, if necessary, refine the existing actor/bureau authorization functions in server-only code.

Keep read and write permissions separate. Do not perform authorization only in client components.

Add a narrowly scoped helper for case-action permissions and another for overlap-review permissions, with unit tests. Avoid adding unnecessary role complexity. If an additional role or schema change is truly necessary, document why and add a new migration.

### D. Contract and setup documentation

Update `docs/API_CONTRACT.md` with final route semantics, request schemas, response shapes, status codes, transaction behavior, actor resolution, and authorization policy.

Update `docs/BACKEND_SETUP.md` only where required. State clearly that the generic OIDC integration is configurable but live provider login has not been verified unless actual credentials are configured and exercised.

Do not log or expose secrets.

## Tests and acceptance criteria

Add unit tests and PostgreSQL integration tests for:

1. Unauthenticated writes return 401.
2. Officer cannot write to an unauthorized bureau case.
3. `CROSS_BUREAU_VIEW` alone cannot write/review.
4. Authorized officer can append a case action.
5. A status transition and action-history event are atomic.
6. A status transition produces exactly one history event.
7. Invalid action, invalid transition, or oversized notes are rejected.
8. Invalid case/relationship IDs return documented responses.
9. Officer cannot review an overlap without the required two-bureau scope.
10. Valid review appends history and updates the current decision atomically.
11. Stale expected versions return a conflict and do not overwrite state.
12. Review history remains append-only.
13. Request-supplied actor identity never changes the server-resolved actor.
14. Database failure returns a visible service error and does not fabricate success.
15. Rollback occurs if the history insert or state update fails.

Run:
- `npm test`
- `npm run test:db` only with a dedicated disposable test database configured in `DATABASE_URL_TEST`
- `npm run typecheck`
- `npm run lint`
- `npm run build -- --webpack`

Do not point tests at a valuable or production database. Do not claim DB integration coverage if the test command skips. Do not run parallel builds. If the normal Turbopack build still fails at worker startup while Webpack passes, record both outcomes separately.

## Out of scope

- Frontend redesign or component edits
- Complaint intake, transfer, escalation, reassignment
- Production identity-provider credentials/setup
- Deploying to production
- Automatic AI decisions or auto-merging complaints

## Final report

Report:
- Files changed and any new migration
- Endpoints and exact payloads implemented
- Authorization policy actually enforced
- Tests run and exact pass/fail/skip results
- Whether PostgreSQL write integration was executed against a live test DB
- Remaining frontend integration changes
- Remaining production OIDC configuration and verification steps

Stop after these two write workflows and tests are complete. Do not start another phase.
