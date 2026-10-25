# CASEPULSE Implementation Roadmap

This roadmap carries forward the Phase 1 technical audit and tracks the AI assistant without treating unverified work as complete.

## Track A: Platform stabilization and SIH readiness

- [x] Create `fix/phase-1-stability` from the audited `main` baseline.
- [x] Remove the six unused-import lint warnings.
- [x] Change the production build script to use Webpack after the observed Turbopack CSS/child-process failure; a Webpack build compiled and generated all static pages in the initial verification attempt.
- [x] Re-run the production build after all feature changes and record its final exit code (Webpack build exit 0; 38/38 static pages generated).
- [ ] Provision a dedicated disposable PostgreSQL test database and run `npm run test:db`; never point it at development or production data.
- [ ] Configure a test OIDC provider and verify login, logout, expiry, bureau-scoped reads, and write denials.
- [ ] Complete browser smoke tests for dashboard, case actions, overlap review history, institution profiles, analytics, and explorer.
- [ ] Fix analytics charts that currently derive distributions from only the first 100 fetched rows, or label their coverage accurately.
- [ ] Evaluate correlation against governed, human-reviewed labeled pairs beyond the 36 synthetic scenarios. Keep all candidates advisory.

## Track B: AI Casework Assistant MVP

- [x] Create `feat/ai-casework-assistant` from the stabilization branch.
- [x] Add a provider-independent model interface and an OpenAI-compatible Chat Completions adapter.
- [x] Add a read-only assistant API route with server-side actor resolution, scoped repository retrieval, request limits, and sanitized provider errors.
- [x] Add a persistent chat drawer with case/institution page context and supporting-record links.
- [x] Add server-side-only AI environment variables to `.env.example` and document data-handling requirements.
- [x] Add unit tests for request validation, provider behavior, authorization denial, and prompt-injection safeguards.
- [x] Run lint, typecheck, unit tests, and a production build after the new route and UI are complete (lint exit 0, typecheck exit 0, 76 unit tests passed, build exit 0).
- [ ] Configure the user-supplied API key and model locally, then test with synthetic records only.
- [ ] Evaluate answer grounding, citations, retrieval misses, latency, and provider failure behavior against a curated question set.
- [ ] Obtain data governance approval before using real regulatory records with any hosted model.

## Branch discipline

Work on one branch per focused change. Do not have Codex and Antigravity edit the same working tree concurrently. Review diffs and run the relevant checks before opening a pull request. Keep `.env.local`, API keys, real case data, and test-database credentials out of commits.

## Latest verification snapshot (2026-10-25)

- `npm test`: exit 0, 76 passed, 0 failed, 0 skipped.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings reported.
- `npm run build`: exit 0 using Webpack; 38/38 static pages generated and `/api/assistant` appears in the route manifest.
- PostgreSQL integration checks remain blocked until `DATABASE_URL_TEST` points to a dedicated disposable database.
- Live OIDC, a real provider API call, and browser end-to-end journeys remain unverified. No AI API key was configured or read during this implementation.
