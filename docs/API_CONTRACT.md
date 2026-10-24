# CASEPULSE API contract (review draft)

**Status:** Backend foundation contract. The implementation uses the existing Next.js 16 App Router with Route Handlers and server-only services. PostgreSQL is the persistent source of truth. A future FastAPI service can implement the same JSON contract behind a proxy without changing frontend URLs.

## Conventions

- Base path: `/api`; JSON request and response bodies use UTF-8 `application/json`.
- Timestamps: ISO 8601 UTC strings. IDs remain opaque strings so current synthetic IDs such as `CP-2026-0104`, `INST-001`, and `OVL-...` can be used while production UUIDs are introduced.
- Enums are uppercase `SCREAMING_SNAKE_CASE` strings matching current domain types where possible.
- Collection endpoints return `{ "data": [...], "meta": { "page": 1, "pageSize": 25, "totalCount": 1 } }`. Defaults: `page=1`, `pageSize=25`; maximum `pageSize=100`. Invalid pagination or enum filters return `400 VALIDATION_ERROR`.
- A successful single-resource or mutation response returns `{ "data": ... }`.
- No endpoint exposes complainant name, email, or evidence contents. The current demo model only has a complainant type and evidence count.
- All endpoints require an actor resolved on the server. In production, identity is verified via OpenID Connect (OIDC) through Auth.js session cookies, cryptographically validated with `AUTH_SECRET`, and mapped to server-side provisioned officer records in PostgreSQL (`officers` and `officer_identities`). Inactive accounts or unprovisioned OIDC identities return `403 FORBIDDEN`. Bureau memberships (`officer_bureaus`) and roles (`officer_roles`) are derived strictly from database records. Client-supplied actor ID, role, or bureau headers are strictly ignored. The development-only fixed demo actor is enabled only when `NODE_ENV=development` and `CASEPULSE_AUTH_MODE=demo`; it is strictly disallowed in production (`NODE_ENV=production` fails closed with `401 UNAUTHENTICATED`).
- Authorization is enforced at the database query level with bureau scoping. A standard officer can read only cases and institution records associated with their assigned bureau(s). Overlap relationships and review history require cross-bureau authorization (`CROSS_BUREAU_VIEW` or `ADMIN`) or explicit membership in both involved bureaus. Inaccessible resources return non-disclosing `404 NOT_FOUND` responses. Requested bureau filters outside the actor's permitted scope are rejected with `403 FORBIDDEN`.
- PostgreSQL is the source of truth. Missing configuration or a failed database connection returns `503 DATABASE_UNAVAILABLE`; handlers must never fall back to client `localStorage`, seeded in-memory data, or a fabricated successful response.
- Errors use `{ "error": { "code": "NOT_FOUND", "message": "...", "requestId": "...", "details": {} } }`. Common statuses: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 VERSION_CONFLICT`, and `500 INTERNAL_ERROR`. Do not return stack traces or secret/configuration values.

## Resource vocabulary

The institution and case projections keep existing CASEPULSE field names. `isSynthetic` marks synthetic demo rows. Relationship classification describes the case-to-case claim; it is separate from evidence that the cases involve the same institution. Sharing an institution identifier alone never means the complaints are duplicates. A review decision is an append-only record; it is not overwritten when a later review occurs.

```ts
type BureauCode =
  | 'AICTE_APPROVAL' | 'UGC_VIGILANCE' | 'STATE_DTE_MAHA'
  | 'STATE_DTE_KAR' | 'NARC_ANTI_RAGGING' | 'CONSUMER_FORUM';

type CaseStatus =
  | 'NEW' | 'UNDER_INVESTIGATION' | 'HEARING_SCHEDULED' | 'ACTION_PENDING'
  | 'JOINT_INQUIRY' | 'RESOLVED' | 'CLOSED';

type ReviewDecision = 'CONFIRMED' | 'REJECTED' | 'FURTHER_COORDINATION';
type RelationshipStatus = 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'FURTHER_COORDINATION';
type RelationshipKind = 'SAME_INSTITUTION' | 'RELATED_INCIDENT' | 'POTENTIAL_DUPLICATE_COMPLAINT';
```

`SAME_INSTITUTION` records an entity match; `RELATED_INCIDENT` records a possible incident relationship; `POTENTIAL_DUPLICATE_COMPLAINT` is a duplicate candidate and requires its own review. The matcher must not create a duplicate classification solely because two cases share an institution identifier.

### Initial matching policy

`src/lib/correlation-engine.ts` is the source of truth for the initial policy constants. A normalized institution-name Jaccard score of **0.75 or higher** is an inclusive candidate threshold; the candidate generator and `institution_name` evidence use that same boundary. A filing-time separation of **60 elapsed days or less** is the inclusive temporal window for both temporal evidence and the score bonus. A score of **75 or higher** changes only the suggested verification action, not the candidate or relationship classification. These defaults are provisional and are not claimed to be optimal without labeled evaluation data. Exact registry IDs support a `SAME_INSTITUTION` relationship. Name-only candidates also describe a possible entity match, while pattern evidence can describe a `RELATED_INCIDENT`; neither means duplicate complaints. `POTENTIAL_DUPLICATE_COMPLAINT` remains a distinct, separately reviewed classification and is not automatically assigned by shared institution identity.

### Institution

```json
{
  "id": "INST-001",
  "aisheCode": "C-19842",
  "aictePermanentId": "1-7281920",
  "name": "Apex Institute of Technology",
  "category": "ENGINEERING",
  "state": "Maharashtra",
  "district": "Pune",
  "pincode": "411001",
  "address": "Pune, Maharashtra",
  "affiliatedUniversity": "Example Technical University",
  "establishedYear": 2008,
  "approvedIntake": 720,
  "riskRating": "HIGH",
  "activeCasesCount": 2,
  "totalCasesCount": 4,
  "bureauInvolvement": ["AICTE_APPROVAL", "STATE_DTE_MAHA"],
  "isSynthetic": true
}
```

### Case and action history

```json
{
  "id": "CP-2026-0104",
  "bureauId": "AICTE_APPROVAL",
  "institutionId": "INST-001",
  "institutionName": "Apex Institute of Technology",
  "aisheCode": "C-19842",
  "title": "Faculty strength discrepancy",
  "description": "Synthetic demo allegation.",
  "category": "GHOST_FACULTY",
  "severity": "HIGH",
  "status": "UNDER_INVESTIGATION",
  "complainantType": "STUDENT",
  "filingDate": "2026-08-01T10:00:00Z",
  "slaDueDate": "2026-08-31T10:00:00Z",
  "isOverdue": true,
  "daysOpen": 83,
  "assignedOfficer": { "name": "Demo Officer", "designation": "Investigation Officer" },
  "evidenceFilesCount": 3,
  "crossBureauFlag": true,
  "overlapIds": ["OVL-2026-0104-2026-0112"],
  "actionHistory": [
    {
      "id": "ACT-1001",
      "caseId": "CP-2026-0104",
      "occurredAt": "2026-08-01T10:00:00Z",
      "actor": { "id": "OFF-01", "displayName": "Demo Officer" },
      "bureauId": "AICTE_APPROVAL",
      "type": "FILING",
      "action": "Complaint filed",
      "notes": "Synthetic demo event.",
      "metadata": {},
      "isSynthetic": true
    }
  ],
  "isSynthetic": true
}
```

`actionHistory` is ordered newest first. The current `TimelineEvent` field `timestamp` maps to `occurredAt` in the API; `actor` is projected as an identity object for durable audit attribution. `description`, names, addresses, and notes may contain restricted case data in production and require bureau-scoped access.

### Related cases and overlap

```json
{
  "id": "OVL-2026-0104-2026-0112",
  "sourceCaseId": "CP-2026-0104",
  "targetCaseId": "CP-2026-0112",
  "sourceBureau": "AICTE_APPROVAL",
  "targetBureau": "STATE_DTE_MAHA",
  "institutionId": "INST-001",
  "institutionName": "Apex Institute of Technology",
  "relationshipKind": "SAME_INSTITUTION",
  "matchType": "CONFIRMED_ID",
  "confidenceScore": 95,
  "flaggedAt": "2026-08-02T10:00:00Z",
  "status": "PROPOSED",
  "reasons": ["Exact AISHE code match across different bureaus."],
  "evidenceMatches": [
    {
      "key": "aisheCode",
      "label": "AISHE code",
      "sourceValue": "C-19842",
      "targetValue": "C-19842",
      "isMatch": true,
      "significance": "CRITICAL",
      "description": "Exact identifier match."
    }
  ],
  "recommendedAction": "Review the entity match and coordinate across bureaus.",
  "latestDecision": null,
  "version": 1,
  "isSynthetic": true
}
```

The overlap projection intentionally gives the current review state a neutral `PROPOSED` status before officer review. `CONFIRMED_ID` means registry identifiers matched deterministically; it is distinct from an officer's `CONFIRMED` decision. `DISMISSED_FALSE_POSITIVE` maps to `REJECTED`, and legacy `UNREVIEWED` maps to `PROPOSED`. The current UI's `JOINT_INQUIRY_INITIATED` option is a separate administrative action, not an overlap decision.

## Endpoints

### `GET /api/dashboard/summary`

Returns current scoped metrics and a small aggregate per bureau. Metrics use one consistent read snapshot and count records the caller can access. `dataSource` identifies PostgreSQL; `syntheticDemoData` is true only when all scoped cases are synthetic.

```json
{
  "data": {
    "asOf": "2026-10-23T09:00:00Z",
    "dataSource": "POSTGRESQL",
    "syntheticDemoData": true,
    "totalCases": 120,
    "pendingCases": 74,
    "overdueCases": 18,
    "criticalCases": 9,
    "activeInstitutions": 42,
    "repeatOffenderInstitutions": 11,
    "flaggedOverlapsCount": 26,
    "unresolvedOverlapsCount": 12,
    "jointInquiriesActive": 4,
    "bureauCounts": {
      "AICTE_APPROVAL": 35,
      "UGC_VIGILANCE": 20,
      "STATE_DTE_MAHA": 24,
      "STATE_DTE_KAR": 16,
      "NARC_ANTI_RAGGING": 13,
      "CONSUMER_FORUM": 12
    }
  }
}
```

Counts are illustrative. `pendingCases` excludes `RESOLVED` and `CLOSED`; unresolved overlaps are proposed relationships that have no final decision. Overdue is calculated from SLA due date and case status at request time, rather than trusted from a client-supplied flag.

### `GET /api/institutions`

Query parameters: `page`, `pageSize`, `search`, `state`, `riskRating`, `bureau`. `search` matches name and registry identifiers. Return paginated `Institution[]`.

### `GET /api/institutions/{id}`

Returns one `Institution`. Unknown or out-of-scope ID returns `404 NOT_FOUND`.

### `GET /api/cases`

Query parameters: `page`, `pageSize`, `search`, `bureau`, `status`, `category`, `institutionId`, `overdueOnly`, `overlapOnly`. Return paginated case summaries. For list responses, `actionHistory` may be omitted; `GET /api/cases/{id}` includes full ordered history.

### `GET /api/cases/{id}`

Returns one full `Case` projection with its action history. Unknown or out-of-scope ID returns `404 NOT_FOUND`.

### `POST /api/cases/{id}/actions`

Requires an authenticated officer. Standard officers must belong to the case bureau. `ADMIN` may act across bureaus. `CROSS_BUREAU_VIEW` grants read access only. The server derives actor ID/display name/bureau from the trusted session and provisioned officer record. Inaccessible or missing cases return the same non-disclosing `404 NOT_FOUND`.

```json
{
  "idempotencyKey": "case-entry-20261024-0001",
  "type": "NOTICE_ISSUED",
  "notes": "Inspection notice issued; officer rationale or outcome.",
  "nextStatus": "HEARING_SCHEDULED"
}
```

`idempotencyKey` (8–128 permitted characters) is required and unique per case; retries return the original action without appending another row. `type` is one of `NOTE_ADDED`, `HEARING`, `NOTICE_ISSUED`, `INTER_BUREAU_SYNC`, `PENALTY_ISSUED`, `CLOSURE`. `notes` is required and at most 4000 characters. Optional `nextStatus` must be a valid permitted transition. A successful request appends exactly one action row; when status changes that row is `STATUS_CHANGE`, with previous/next status and requested action type in metadata. Case update and action insertion are in one transaction. Response is `201 {data:{case,action}}`; invalid inputs/transitions return `400`, unauthenticated returns `401`, and database failures return visible `503`/`500` errors. No actor or role fields are accepted.

### `GET /api/cases/{id}/related`

Returns all proposed or reviewed cross-bureau relationships involving the case, including the other case summary and full overlap evidence.

```json
{
  "data": {
    "caseId": "CP-2026-0104",
    "relationships": [
      {
        "overlap": { "id": "OVL-2026-0104-2026-0112", "status": "PROPOSED", "confidenceScore": 95 },
        "relatedCase": { "id": "CP-2026-0112", "bureauId": "STATE_DTE_MAHA", "title": "Faculty roster verification", "status": "NEW" }
      }
    ]
  }
}
```

### `GET /api/overlaps`

Query parameters: `page`, `pageSize`, `status`, `matchType`, `bureau`, `institutionId`, `search`. `bureau` matches either side of the relationship. Returns paginated overlap projections with the latest decision. Review history is available as an audit trail on the review resource/response and is not required in every list row.

### `GET /api/overlaps/{id}/reviews`

Returns the immutable review history for one relationship, newest first, using the standard pagination envelope. Each row contains the decision, notes, reviewer identity/bureau, timestamp, and relationship version transition. Access is restricted to authorized officers with scope over the relationship.

```json
{
  "data": [
    {
      "id": "REV-9001",
      "decision": "FURTHER_COORDINATION",
      "notes": "Please verify the campus address with the state bureau before confirming the relationship.",
      "reviewedAt": "2026-10-23T09:15:00Z",
      "reviewer": { "id": "OFF-01", "displayName": "Demo Officer", "bureauId": "AICTE_APPROVAL" },
      "previousVersion": 1,
      "newVersion": 2
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalCount": 1 }
}
```

### `POST /api/overlaps/{id}/reviews`

Requires an authenticated, authorized officer. An officer must be provisioned in both involved bureaus; `ADMIN` may review across bureaus. `CROSS_BUREAU_VIEW` alone never grants write permission. Missing and inaccessible relationships return the same `404 NOT_FOUND`. `expectedVersion` is required to prevent stale overwrites. Actor identity and bureau come from the verified server session.

```json
{
  "decision": "FURTHER_COORDINATION",
  "notes": "Please verify the campus address with the state bureau before confirming the relationship.",
  "expectedVersion": 1
}
```

On success, atomically append one immutable review record and update the relationship's current status/version. `FURTHER_COORDINATION` does not initiate a joint inquiry. Response is `201 {data:{relationship,review}}`. A stale version returns `409 VERSION_CONFLICT`; a failed database operation returns an error and rolls back both writes. Notes may be empty and are limited to 4000 characters. No reviewer name, officer ID, role, or bureau field is accepted.

```json
{
  "data": {
    "relationship": { "id": "OVL-2026-0104-2026-0112", "status": "FURTHER_COORDINATION", "version": 2 },
    "review": {
      "id": "REV-9001",
      "decision": "FURTHER_COORDINATION",
      "notes": "Please verify the campus address with the state bureau before confirming the relationship.",
      "reviewedAt": "2026-10-23T09:15:00Z",
      "reviewer": { "id": "OFF-01", "displayName": "Demo Officer", "bureauId": "AICTE_APPROVAL" }
    }
  }
}
```

Return `401` without a valid session, `404` for absent or out-of-scope records, and `400` for invalid decisions, notes, or IDs.

## Relational model recommendation

Use PostgreSQL (consistent with the existing DDL handoff) with normalized foreign keys and append-only actions/reviews:

| Table | Important fields and constraints |
|---|---|
| `bureaus` | `code` primary key, name, jurisdiction metadata. |
| `institutions` | `id` primary key, nullable unique AISHE/AICTE identifiers, registry/profile fields, risk rating. |
| `complaint_cases` | `id` primary key, `institution_id` and `bureau_code` foreign keys, category/severity/status, filing and SLA timestamps, assigned officer reference. |
| `case_actions` | `id` primary key, `case_id` foreign key, occurred-at, actor ID, bureau, action type, action text, notes; append-only. Index `(case_id, occurred_at DESC)`. |
| `case_relationships` | `id` primary key, two distinct case foreign keys, match type/score/rule version/evidence JSON, status, version, created timestamp. Enforce canonical unique case pair and different bureau constraint in service/domain validation. |
| `overlap_reviews` | `id` primary key, relationship foreign key, decision, notes, reviewer ID/bureau, timestamp, prior/new version; append-only. Index `(relationship_id, reviewed_at DESC)`. |

Persist the detector's algorithm/rule version with each proposed relationship so scores can be explained and reproduced after rules change. Review insertion and current-state update must be one database transaction. Do not store review audit history only in local storage or overwrite prior reviews.

## Routing and stack notes

The UI already uses Next.js App Router paths for pages, and the requested `/api/...` names fit its `src/app/api/**/route.ts` Route Handler convention. Next.js 16 handler dynamic `params` are promises; handlers for IDs await them. The API is implemented as same-origin Route Handlers backed by a server-only repository interface. If the team proceeds with the README's planned FastAPI microservice, it should preserve these paths and JSON shapes through a reverse proxy/BFF. This foundation phase implements the listed GET routes; write routes remain specified for the following integration phase.
