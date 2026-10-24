# Antigravity Task: CASEPULSE Phase 2B — Trusted Identity and Bureau-Scoped Authorization

**Project:** `E:\\sih`  
**Problem statement:** SIH 2026 PS 26264  
**Owner:** Antigravity  
**Scope:** Authentication boundary, identity-to-actor mapping, authorization for existing read APIs, and tests. Do not implement case-action or overlap-review write endpoints in this phase.

## Current verified context

The existing project is Next.js 16 App Router + TypeScript with PostgreSQL-backed server modules.

Relevant files:
- `src/lib/server/actor-provider.ts`
- `src/lib/server/types.ts`
- `src/lib/server/repository.ts`
- `src/lib/server/validation.ts`
- `src/app/api/**`
- `db/migrations/001_initial.sql`
- `docs/API_CONTRACT.md`
- `docs/BACKEND_SETUP.md`

The current actor provider grants a fixed synthetic actor only when `NODE_ENV=development` and `CASEPULSE_AUTH_MODE=demo`. In other cases it returns no actor. It currently defines bureau access helpers, but you must verify that authorization and row-level data scoping are consistently enforced in every route and repository query. The project currently has no authentication dependency in `package.json`.

The existing backend foundation has reported passing unit tests, PostgreSQL integration tests, typechecking, and linting. The standard Turbopack build has a worker-startup issue; `npm run build -- --webpack` passed previously. Re-run checks only when it will not collide with other running work.

## Goals

1. Add a trusted, configurable production identity integration based on standard OpenID Connect (OIDC) using a maintained authentication library compatible with this project. Prefer the simplest viable integration. Do not write custom token-signature or OIDC protocol validation.
2. Resolve authenticated identities server-side and map them to CASEPULSE officer records.
3. Store or resolve bureau memberships and application roles from trusted server-side data, not from request bodies or arbitrary headers.
4. Enforce bureau-scoped authorization for every existing GET API.
5. Add tests for authentication and authorization boundaries.
6. Document configuration, setup, local demo mode, identity provisioning, and production limitations.

## Safety and implementation requirements

- First inspect `git status --short`; preserve all existing frontend and backend work. Do not discard, reset, overwrite, or regenerate the application.
- Do not commit changes unless explicitly requested.
- Do not expose, print, or commit credentials, cookies, access tokens, client secrets, or database connection strings.
- Never trust a client-supplied officer ID, reviewer name, role, or bureau claim as proof of identity.
- Never grant access solely because an email address or display name matches. Map the validated OIDC issuer + subject to an active provisioned CASEPULSE account.
- Obtain roles and bureau memberships from trusted server-side records. A valid OIDC login without a provisioned/active CASEPULSE account must be denied by default.
- Keep the current fixed synthetic demo actor strictly development-only. It must never be enabled in production, and production must fail closed when OIDC is unconfigured.
- Do not invent provider credentials or claim the live sign-in flow was verified without a configured identity provider.
- Do not implement POST/PATCH/DELETE case-action or overlap-review endpoints yet. Those are a later phase.
- Preserve server-only boundaries and avoid putting secrets or privileged claims into browser-visible bundles.
- Avoid logging sensitive complaint content or tokens.

## Implementation plan

### A. Choose and configure the OIDC integration

Inspect current Next.js 16 compatibility and use a maintained library (for example, Auth.js if compatible with the current project). Use a generic OIDC provider configuration where possible so the deployment can select its approved identity provider without a vendor lock-in.

Define and document the exact environment variables required by the chosen library, including the issuer/discovery URL, client ID, client secret, and session/auth secret as applicable. Keep secrets in ignored local environment files or the deployment secret manager. Do not add placeholder secrets that could accidentally be treated as real.

Provide a clear sign-in entry point and sign-out behavior if required by the integration. Use secure HTTP-only session cookies, secure cookies in production, appropriate same-site policy, and the library's built-in CSRF protections.

If actual provider configuration is unavailable, implement the configurable integration and test it using mocks, but report that live IdP login remains unverified. Do not claim this task is fully production-connected until the authorized provider is configured and a real login has been exercised.

### B. Provisioned actor model

Use a new versioned migration (do not edit the already-applied `001_initial.sql`) if the schema requires tables for provisioned users, OIDC issuer/subject mapping, active status, bureau memberships, or roles.

Requirements:
- A user maps to a validated identity using issuer + subject.
- Inactive or unprovisioned users are denied.
- Bureau membership is explicit.
- Roles are typed and validated rather than arbitrary strings where practical.
- Do not seed a production administrator or grant elevated permissions to the first person who logs in.
- Document a safe administrative provisioning procedure. If a command/script is added, require explicit target identity and role arguments, be idempotent where appropriate, and refuse to operate against an unclear environment.

A possible role baseline is:
- `OFFICER`: access limited to assigned bureau(s).
- `CROSS_BUREAU_VIEW`: authorized cross-bureau read access.
- `ADMIN`: administrative access, subject to explicit policy.
- Add an overlap-review permission only if it has a current use; write endpoints remain out of scope.

Do not infer an employee's authorization from an email domain.

### C. Bureau-scoped read authorization

Audit every existing API handler and all repository methods it calls. Apply policy at the server/service/repository boundary, not only in the UI.

Minimum policy to implement and document:
- A normal officer can read cases belonging to a bureau they are assigned to.
- Cross-bureau access requires an explicit provisioned permission.
- Overlap records and review history must not leak an inaccessible case, bureau, relationship, or hidden case count. Specify whether access requires cross-bureau permission or membership in both involved bureaus; choose one consistent, least-privilege rule and test it.
- Related-case results must filter inaccessible related cases.
- Dashboard totals and analytics must be scoped to the actor's authorized data, not global totals.
- Institution responses must not expose restricted case details, overlap counts, or derived information from unauthorized bureaus.
- For inaccessible resource IDs, prefer a consistent non-disclosing response (such as 404) where revealing existence would itself leak information.
- Validate requested bureau filters against the actor's allowed scope; never let a query parameter expand privileges.
- All unconfigured, invalid, missing, or expired sessions must fail closed.

Use SQL/query-level scoping where practical rather than retrieving all records and filtering after data is loaded.

### D. Tests

Add tests for:
1. Missing session returns 401.
2. Invalid or expired session is rejected.
3. Valid OIDC identity with no provisioned CASEPULSE account is denied.
4. Inactive actor is denied.
5. Client-supplied actor ID, roles, or bureau codes cannot elevate access.
6. Officer can access permitted bureau cases.
7. Officer cannot retrieve another bureau's case by list filters or direct ID.
8. Related-case endpoints do not leak out-of-scope case data.
9. Cross-bureau overlaps and review history obey the chosen scope policy.
10. Dashboard counts are scoped correctly.
11. Admin/cross-bureau access follows explicit role policy.
12. Demo mode is denied when `NODE_ENV=production`.
13. Missing OIDC configuration fails closed in production.
14. Database errors do not turn into fabricated successful responses.

Use deterministic mocks for identity/session tests and PostgreSQL integration tests where feasible. Be clear about which tests are mocked and which exercise a live database or actual OIDC provider.

### E. Documentation and validation

Update `docs/BACKEND_SETUP.md` and relevant sections of `docs/API_CONTRACT.md` with:
- Authentication/session architecture.
- Environment variable names and callback URL setup.
- How an officer is provisioned and assigned bureau memberships.
- Role/authorization matrix.
- Development demo identity limitations.
- Production fail-closed behavior.
- Steps to verify a configured OIDC sign-in.

Run:
- `npm test`
- `npm run test:db` if a safe test database is available
- `npm run typecheck`
- `npm run lint`
- `npm run build -- --webpack`

Do not point integration tests at production or a database containing valuable data. Do not run competing builds concurrently. Record actual command results and any environmental limitations.

## Acceptance criteria

- Existing pages and backend are preserved.
- Production actor resolution is based on validated OIDC/session identity and a provisioned server-side actor.
- Every existing GET API and related query has documented and tested bureau-scoped authorization.
- No request-supplied identity or role can grant permissions.
- Demo auth cannot be enabled in production.
- Tests cover denied access, cross-bureau boundaries, and non-disclosure.
- Docs explain exactly what is configured versus what still requires deployment credentials.
- Final report lists changed files, migrations, tests run, exact outcomes, and any remaining live-provider verification.

Stop after authentication and read-authorization are implemented and verified. Do not start write endpoints in this task.
