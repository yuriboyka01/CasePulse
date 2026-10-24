# CASEPULSE backend setup

## Requirements

- Node.js 20 or newer and npm.
- PostgreSQL 14 or newer, reachable from the Next.js server process.
- A PostgreSQL database and role with permission to create tables, indexes, functions, triggers, and use transactions in that database.

The application reads database and authentication credentials only on the server. Never prefix sensitive variables with `NEXT_PUBLIC_` or commit real secrets/connection strings.

For local development, place settings in the ignored `.env.local` file:

```dotenv
DATABASE_URL=postgresql://casepulse_app:replace-with-local-password@localhost:5432/casepulse
CASEPULSE_AUTH_MODE=demo
```

`CASEPULSE_AUTH_MODE=demo` enables one fixed synthetic officer only when `NODE_ENV=development`. It does not authenticate a real user and is strictly ignored in production (`NODE_ENV=production` fails closed and returns `401 UNAUTHENTICATED`).

## Authentication & Trusted Identity Architecture (Phase 2B)

CASEPULSE uses standard OpenID Connect (OIDC) through Auth.js / `next-auth` for production authentication. The platform enforces server-side identity resolution and strict database-backed, bureau-scoped authorization:

1. **Authentication Boundary**: The client authenticates against a trusted OpenID Connect Identity Provider (IdP). The validated session token is stored in an encrypted, HTTP-only cookie (`authjs.session-token`, or `__Secure-authjs.session-token` on HTTPS).
2. **Identity Resolution**: `resolveActor(request)` decodes and cryptographically verifies the session token using `AUTH_SECRET`. It extracts the validated OpenID Connect `issuer` (`iss`) and `subject` (`sub`) claims. It never trusts client-supplied headers (such as `x-officer-id`, `x-roles`, or `x-bureau`) or client-supplied body payloads.
3. **Provisioned Officer Mapping**: The server maps `(issuer, subject)` to a record in `officers` and `officer_identities`. If the identity is not provisioned in CASEPULSE, or if `is_active` is false, access is denied (`403 FORBIDDEN`). Access is never granted solely on display name or email matching.
4. **Bureau & Role Scoping**: Bureau memberships (`officer_bureaus`) and application roles (`officer_roles`) are loaded exclusively from PostgreSQL.

### OIDC Environment Variables

Configure these variables in `.env.local` (local) or your deployment secret manager (production):

| Variable | Description | Example / Note |
|---|---|---|
| `AUTH_SECRET` (or `NEXTAUTH_SECRET`) | 32+ character random secret for JWT encryption and CSRF protection. | Keep secret; never commit. |
| `AUTH_OIDC_ISSUER` | OpenID Connect discovery/issuer URL. | e.g. `https://auth.example.gov.in` |
| `AUTH_OIDC_CLIENT_ID` | OIDC Client Identifier registered in the IdP. | e.g. `casepulse-portal` |
| `AUTH_OIDC_CLIENT_SECRET` | OIDC Client Secret registered in the IdP. | Keep secret in secret manager. |
| `AUTH_URL` (or `NEXTAUTH_URL`) | Canonical deployment base URL. | e.g. `https://casepulse.gov.in` |

### IdP Redirect / Callback URL

Configure the redirect URI in your identity provider:
```
${AUTH_URL}/api/auth/callback/oidc
```
Built-in authentication entry points:
- Sign-in: `/api/auth/signin`
- Sign-out: `/api/auth/signout`
- Session: `/api/auth/session`

### Role and Authorization Matrix

| Role | Description | Bureau Scope | Overlap / Cross-Bureau Access |
|---|---|---|---|
| `OFFICER` | Standard regulatory officer | Limited to assigned bureau(s) in `officer_bureaus`. | Access to overlaps and review history requires membership in **both** involved bureaus. Cannot view out-of-scope cases or other bureau data. |
| `CROSS_BUREAU_VIEW` | Senior analyst / inter-bureau investigator | Can read cases across all bureaus. | Can view all cross-bureau overlaps, correlation details, and review history. |
| `ADMIN` | Administrative supervisory officer | Full platform read access across all bureaus. | Includes cross-bureau view. |

### Least-Privilege Overlap Scoping Rule

An overlap relationship connects two complaints from potentially different bureaus (e.g. `AICTE_APPROVAL` and `STATE_DTE_MAHA`). Under the least-privilege policy:
- Viewing an overlap relationship or its review history requires **either** the `CROSS_BUREAU_VIEW` / `ADMIN` role **or** explicit membership in **both** involved bureaus.
- Related-case endpoints filter out any related cases belonging to bureaus the officer is not authorized to read.
- Single-bureau officers filtering by `overlapOnly=true` will only see cases whose overlaps involve their authorized bureaus.

## Officer Provisioning Procedure

Production identities must be explicitly provisioned by an administrator. Administrators do not get created automatically, and self-registration with elevated privileges is blocked.

Use the provisioning CLI script:

```powershell
npx tsx scripts/provision-officer.ts `
  --id "OFF-MAHA-042" `
  --email "officer.deshmukh@dte.maha.gov.in" `
  --name "S. Deshmukh" `
  --designation "Deputy Director of Technical Education" `
  --issuer "https://auth.gov.in" `
  --subject "usr_sub_98471203" `
  --bureaus "STATE_DTE_MAHA" `
  --roles "OFFICER" `
  --active true
```

For cross-bureau coordination officers:
```powershell
npx tsx scripts/provision-officer.ts `
  --id "OFF-COORD-001" `
  --email "lead.vigilance@aicte.gov.in" `
  --name "Dr. R. Sharma" `
  --designation "Joint Coordination Director" `
  --issuer "https://auth.gov.in" `
  --subject "usr_sub_11029384" `
  --bureaus "AICTE_APPROVAL,UGC_VIGILANCE" `
  --roles "OFFICER,CROSS_BUREAU_VIEW" `
  --active true
```

The script runs idempotently inside a PostgreSQL transaction (`SELECT pg_advisory_xact_lock(262640003)`). It updates the officer record, updates the OIDC `(issuer, subject)` mapping, and synchronizes the bureau memberships and roles.

## Local development PostgreSQL (Windows)

This workspace includes local PostgreSQL helpers so the demo does not depend on credentials for an existing PostgreSQL service. The one-time setup creates an isolated database cluster under `%LOCALAPPDATA%\CASEPULSE\postgres-data`, binds it to `127.0.0.1:55439` only, creates a dedicated `casepulse_app` role with a generated password, applies migrations, seeds synthetic records, and appends `DATABASE_URL` to the ignored `.env.local` file. It refuses to overwrite an existing cluster or an existing `DATABASE_URL`.

```powershell
# Run once on this machine
npm run db:dev:setup

# Start the local cluster after a reboot or whenever it is stopped
npm run db:dev:start

# Run the Next.js app after setup / after restarting an already-running dev server
npm run dev

# Stop PostgreSQL when you no longer need the local demo
npm run db:dev:stop
```

The local database currently contains only the synthetic SIH demo dataset. Its counts are 6 bureaus, 8 institutions, 13 cases, 29 actions, 7 relationships, and 3 synthetic officers. The database is separate from any existing PostgreSQL installation and is bound to loopback only. The `.env.local` connection string contains a generated development credential and must remain untracked.

## Migrate and seed

```powershell
npm install
npm run db:migrate
$env:CASEPULSE_ALLOW_SYNTHETIC_SEED = 'true'
npm run db:seed
Remove-Item Env:CASEPULSE_ALLOW_SYNTHETIC_SEED
npm run dev
```

Migrations are stored in `db/migrations/`:
- `001_initial.sql`: Core schema (bureaus, institutions, complaint cases, case actions, case relationships, overlap reviews).
- `002_officers_and_auth.sql`: Officer identities, bureau memberships, roles, and OIDC issuer/subject mapping.
- `003_write_workflows.sql`: Adds the `NOTE_ADDED` case action type and per-case action idempotency constraint.

The seed command is blocked in production and requires the explicit `CASEPULSE_ALLOW_SYNTHETIC_SEED=true` opt-in. It seeds synthetic SIH benchmark records and synthetic test officers, sets `is_synthetic=true`, and uses stable IDs plus `ON CONFLICT DO NOTHING`.

If `DATABASE_URL` is missing or PostgreSQL cannot be reached, API requests return `503 DATABASE_UNAVAILABLE`. There is no in-memory or browser-storage fallback.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
```

The unit test suite covers authentication boundaries, OIDC token resolution, unprovisioned identity rejection, inactive account lockout, role matrix enforcement, and SQL query scoping.

PostgreSQL integration tests require a separate empty test database:

```powershell
$env:DATABASE_URL_TEST = 'postgresql://casepulse_test:replace-with-local-password@localhost:5432/casepulse_test'
npm run test:db
Remove-Item Env:DATABASE_URL_TEST
```

## Steps to Verify a Configured OIDC Provider

1. Register CASEPULSE with the OIDC Identity Provider and configure the redirect URI: `${AUTH_URL}/api/auth/callback/oidc`.
2. Set `AUTH_SECRET`, `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`, and `AUTH_OIDC_CLIENT_SECRET` in `.env.local` or environment secrets.
3. Provision the target test identity using `npm run db:provision` with the matching `issuer` and `subject`.
4. Navigate to `/api/auth/signin` and complete authentication at the IdP.
5. Verify the issued session cookie `authjs.session-token` allows access to authorized GET endpoints (`/api/cases`, `/api/dashboard/summary`), and returns `403 FORBIDDEN` for out-of-scope bureaus.

*Note: In local development without a configured live identity provider, the integration is verified using deterministic cryptographic mocks and unit/integration tests. Live provider sign-in remains unverified until live credentials and an authorized OIDC provider endpoint are provided.*

Case actions require membership in the case bureau; `ADMIN` can act across bureaus, while `CROSS_BUREAU_VIEW` remains read-only. Overlap review requires membership in both involved bureaus or `ADMIN`. The API stores action/review state and immutable history together in PostgreSQL transactions.
