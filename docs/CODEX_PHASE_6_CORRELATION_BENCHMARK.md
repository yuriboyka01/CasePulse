# CASEPULSE Phase 6A — Correlation Benchmark and Failure Analysis

**Project:** CASEPULSE, SIH 2026 PS 26264  
**Owner:** Codex (backend/algorithm/testing)  
**Workspace:** `E:\\sih`

## Current verified state

- PostgreSQL-backed read and write APIs exist.
- The current policy in `src/lib/correlation-engine.ts` uses name similarity >= 0.75, a 60-day temporal window, and a score threshold of 75 for its suggested action.
- The thresholds are provisional and are not proven optimal.
- 57 unit tests pass; the PostgreSQL integration test passes against a disposable schema in the local synthetic development database.
- Both `npm run build -- --webpack` and the default `npm run build` have passed after the PostCSS/Tailwind fix.
- All demo records are synthetic.

## Objective

Replace unsupported claims about correlation quality with a small, explicit, reproducible benchmark. Before tuning any thresholds, measure the current detector on labelled synthetic examples and document its limitations.

## Step 1: Inspect the actual algorithm

Read:
- `src/lib/correlation-engine.ts`
- `src/types/index.ts`
- `tests/unit/correlation-engine.test.ts`
- `src/data/synthetic-dataset.ts`
- `docs/API_CONTRACT.md`

The current deterministic candidate generator primarily uses registry IDs and normalized institution-name matches. Geographic jurisdiction, category co-occurrence, and filing-time proximity contribute evidence and/or scores. Confirm the exact behavior from the code; do not describe it as semantic complaint-text matching unless implemented and tested. Keep the distinction between same institution, related incidents, and potential duplicate complaints.

## Step 2: Create a labelled synthetic benchmark

Add a versioned fixture under `tests/fixtures/` and tests under `tests/unit/`.

Include at least 30 manually specified case-pair scenarios across these categories:
1. Exact AISHE ID match across different bureaus.
2. Exact AICTE ID match.
3. Institution-name variation above the current 0.75 threshold.
4. Similarity exactly at the inclusive threshold and immediately below it.
5. Same institution but clearly independent complaint topics.
6. Same institution with related categories and close filing dates.
7. Same institution with unrelated categories and dates outside the temporal window.
8. Similar institution names in different states/districts or separate campus contexts.
9. Missing identifiers and weak names.
10. Same-bureau pairs, which should not be considered cross-bureau candidates.
11. Adversarial examples with generic or empty names, malformed dates, and common tokens.
12. Potential duplicate complaint scenarios. Verify that sharing an institution ID alone does not establish a duplicate complaint.

Every fixture must contain its expected label and a brief rationale. Keep the fixture synthetic; do not use real complainant or institutional personal data.

Use explicit expected classifications appropriate to the current code. If the detector cannot distinguish two classes today, record that as a measured limitation rather than weakening the label to fit the implementation.

## Step 3: Measure baseline quality

Report:
- Number of labelled pairs.
- Candidate precision and recall against the declared candidate definition.
- Precision, recall, and F1 where a clear positive/negative ground truth exists.
- False-positive and false-negative counts.
- Results broken down by scenario category.
- The specific cases the detector fails and why.
- Evidence consistency at matching boundaries.

Do not claim that a small synthetic benchmark estimates real-world accuracy. Name it a synthetic regression benchmark and state its limitations.

## Step 4: Tune only with evidence

First commit the baseline results to a report, then recommend threshold or rule changes if justified by the fixture. If implementing a change:
- Keep one configuration source of truth.
- Preserve deterministic explanations.
- Avoid adding an LLM, paid service, or embedding dependency in this phase.
- Add regression tests for each fixed failure.
- Do not automatically assign `POTENTIAL_DUPLICATE_COMPLAINT` due to institution identity.
- Do not automatically confirm any relationship.
- Re-run the complete tests and report before/after metrics.

If the benchmark exposes that two outcomes are not distinguishable with current inputs, document the missing evidence/feature instead of fabricating a classifier.

## Acceptance criteria

- At least 30 labelled synthetic pair scenarios.
- Reproducible baseline metrics plus per-category breakdown.
- Honest documentation of what the detector does and does not analyze.
- Tests cover difficult negatives, not just successful matches.
- No unsupported accuracy claims.
- No frontend changes.
- No database migration changes unless strictly necessary and explicitly justified.

## Validation

Run:
- `npm test`
- `npm run typecheck`
- `npm run lint`

PostgreSQL integration tests may use the configured local synthetic database, where the test harness creates and drops its own random schema. Do not use production data. Do not run a production build while the development server is active; final build validation is coordinated separately.

## Final report

List files changed, the benchmark definition, exact metrics, limitations, tests, and whether any behavior/threshold was changed. Stop after benchmark and focused improvements. Do not start unrelated work.
