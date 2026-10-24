# CASEPULSE Product & UX Implementation Plan

**Status:** Working plan for the current synthetic benchmark prototype  
**North star:** Reduce the time and uncertainty involved in reviewing cross-bureau relationships while preserving evidence, jurisdiction boundaries, and accountable human decisions.

## Product principles

1. **Work before widgets.** Lead with cases and coordination actions that require attention; place aggregate metrics second.
2. **Evidence before scores.** Every proposed relationship should explain the identifiers, dates, categories, and source records that caused it to be suggested.
3. **A shared institution is not a duplicate complaint.** Keep entity identity, incident relationship, and duplicate-candidate classifications separate.
4. **Human review is explicit.** A model or deterministic matcher proposes; an authorized officer records the decision and rationale.
5. **Trust the source of truth.** Do not silently fall back from PostgreSQL/API errors to localStorage or fabricated values.
6. **Respect jurisdiction.** Surface information only within server-enforced permissions; client-side hiding is not authorization.
7. **Design for sustained work.** Readable density, predictable navigation, keyboard access, and restrained color beat decorative dashboards.
8. **Label synthetic data honestly.** Demo records and simulated operational states must not imply live agency connectivity.

## Experience model

### Overview
- Start with a priority work queue: overdue cases, critical cases, and coordination actions waiting for the current officer.
- Explain why each item needs attention and link to its actual record.
- Keep bureau workload and aggregate metrics as supporting context.
- Separate case deadline breaches from overdue coordination tasks where the domain model supports that distinction.

### Cross-Bureau Review Workbench
- Compare the two case records side by side.
- Show evidence as source value, target value, match result, and a plain-language interpretation.
- Explain the rule/algorithm version and relevant thresholds.
- Preserve the difference between deterministic identifier matching and an officer-confirmed relationship.
- Support confirm, reject, and further-coordination decisions only through authorized API routes, with append-only review history and concurrency checks.

### Institution profile
- Identity and registry identifiers
- Bureau involvement and jurisdiction
- Case history and administrative actions
- Related records with evidence
- Risk classification with transparent contributing factors and caveats

### Relationship Explorer
- Distinct visual types for institutions, cases, bureaus, and relationships.
- Selectable nodes and edges linked to source records.
- Filters and focus modes to avoid overwhelming graphs.
- Accessible textual alternatives to graph-only interpretation.

## Visual direction: Evidence-led institutional intelligence

- Warm neutral page canvas, white working surfaces, charcoal ink, muted teal brand accent.
- Reserve red for genuinely urgent conditions and amber for review-needed states.
- Avoid glow effects, ornamental gradients, repetitive oversized cards, and color-only statuses.
- Use spacing and typographic hierarchy to establish importance.
- Use monospaced typography selectively for registry and case identifiers.
- Keep focus rings visible, meet WCAG contrast expectations, support reduced motion, and maintain keyboard operation.

## Data and trust boundaries to verify

- Confirm each route's real implementation and error behavior.
- Confirm dashboard metrics are scoped consistently to the authenticated officer.
- Confirm demo mode is visibly labeled and disabled in production.
- Confirm case actions and overlap reviews are persisted transactionally in PostgreSQL.
- Confirm review history is append-only and version conflicts are handled.
- Confirm no component relies on localStorage as a production fallback.
- Confirm correlation outputs preserve relationship kind and rule version.
- Confirm no shared identifier alone creates a duplicate-complaint conclusion.

## Delivery sequence

### Phase 1: Baseline and safety
- Preserve existing work; inspect repository status and project-specific instructions.
- Map routes, API handlers, service layer, auth boundaries, and current tests.
- Run typecheck, lint, unit tests, and build to establish baseline.

### Phase 2: Design foundation
- Apply the CASEPULSE visual tokens and navigation shell.
- Standardize surface, border, type, focus, alert, and status patterns.
- Check desktop, tablet, and mobile navigation.

### Phase 3: Action-first overview
- Add an operational work queue using existing authoritative data.
- Remove misleading or redundant labels and correct metric definitions.
- Make empty, loading, and API error states explicit.

### Phase 4: Core investigation workflows
- Improve overlap comparison and evidence provenance.
- Improve institution profiles and related-case navigation.
- Improve relationship explorer selection, filtering, and explanation.

### Phase 5: Validation
- Test representative workflows end to end.
- Test authorization boundaries and error states.
- Check keyboard navigation, reduced motion, contrast, and responsive layouts.
- Measure time to find a priority case and explain a proposed relationship before claiming UX improvement.

## Acceptance criteria

- Every priority item explains why it is prioritized.
- Every proposed relationship exposes evidence and its limitations.
- Proposed and officer-confirmed states are visibly distinct and text-labeled.
- Failed API/database requests never appear as successful empty results.
- Mutations require authorization and preserve an auditable history.
- Existing route behavior and regression tests remain intact.
- Layout remains usable at narrow widths and with keyboard-only interaction.
