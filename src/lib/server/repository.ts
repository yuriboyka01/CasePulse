import 'server-only';
import type { QueryResultRow } from 'pg';
import { query, withTransaction } from './db';
import type { PoolClient } from 'pg';
import type {
  Actor,
  CaseFilters,
  CollectionResult,
  DashboardOverview,
  DashboardSummary,
  InstitutionFilters,
  OverlapFilters,
} from './types';
import { canReadBureau, canReadCrossBureau, canWriteCaseAction, canWriteOverlapReview } from './actor-provider';
import { ApiError } from './errors';

type Row = QueryResultRow & Record<string, unknown>;
type Sql = (text: string, values?: unknown[]) => Promise<{ rows: Row[]; rowCount: number | null }>;
type Transaction = <T>(operation: (client: PoolClient) => Promise<T>) => Promise<T>;

const ALL_BUREAUS = [
  'AICTE_APPROVAL', 'UGC_VIGILANCE', 'STATE_DTE_MAHA',
  'STATE_DTE_KAR', 'NARC_ANTI_RAGGING', 'CONSUMER_FORUM',
];

function scopedBureaus(actor: Actor): string[] {
  return canReadCrossBureau(actor) ? ALL_BUREAUS : actor.bureauCodes;
}

function pageResult<T>(rows: T[], page: number, pageSize: number, totalCount: number): CollectionResult<T> {
  return { data: rows, meta: { page, pageSize, totalCount } };
}

function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, '!$&');
}

function institutionProjection(row: Row) {
  return {
    id: row.id,
    aisheCode: row.aisheCode,
    aictePermanentId: row.aictePermanentId,
    name: row.name,
    category: row.category,
    state: row.state,
    district: row.district,
    pincode: row.pincode,
    address: row.address,
    affiliatedUniversity: row.affiliatedUniversity,
    establishedYear: row.establishedYear,
    approvedIntake: row.approvedIntake,
    riskRating: row.riskRating,
    activeCasesCount: Number(row.activeCasesCount ?? 0),
    totalCasesCount: Number(row.totalCasesCount ?? 0),
    bureauInvolvement: row.bureauInvolvement ?? [],
    isSynthetic: row.isSynthetic,
  };
}

function caseProjection(row: Row, actionHistory?: Row[]) {
  const due = new Date(String(row.slaDueDate)).getTime();
  const filed = new Date(String(row.filingDate)).getTime();
  const closed = row.status === 'RESOLVED' || row.status === 'CLOSED';
  const now = Date.now();
  return {
    id: row.id,
    bureauId: row.bureauId,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    aisheCode: row.aisheCode,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    status: row.status,
    complainantType: row.complainantType,
    filingDate: row.filingDate,
    slaDueDate: row.slaDueDate,
    isOverdue: !closed && due < now,
    daysOpen: Math.max(0, Math.floor((now - filed) / 86_400_000)),
    assignedOfficer: {
      id: row.assignedOfficerId,
      name: row.assignedOfficerName,
      designation: row.assignedOfficerDesignation,
    },
    evidenceFilesCount: Number(row.evidenceFilesCount),
    crossBureauFlag: Boolean(row.crossBureauFlag),
    overlapIds: row.overlapIds ?? [],
    ...(actionHistory ? { actionHistory: actionHistory.map(actionProjection) } : {}),
    isSynthetic: row.isSynthetic,
  };
}

function actionProjection(row: Row) {
  return {
    id: row.id,
    caseId: row.caseId,
    occurredAt: row.occurredAt,
    actor: { id: row.actorId, displayName: row.actorDisplayName },
    bureauId: row.bureauId,
    type: row.actionType,
    action: row.action,
    notes: row.notes,
    metadata: row.metadata ?? {},
    isSynthetic: row.isSynthetic,
  };
}

function relationshipProjection(row: Row) {
  return {
    id: row.id,
    sourceCaseId: row.sourceCaseId,
    targetCaseId: row.targetCaseId,
    sourceBureau: row.sourceBureau,
    targetBureau: row.targetBureau,
    sourceCaseTitle: row.sourceCaseTitle,
    sourceCaseCategory: row.sourceCaseCategory,
    sourceCaseStatus: row.sourceCaseStatus,
    sourceFilingDate: row.sourceFilingDate,
    sourceSlaDueDate: row.sourceSlaDueDate,
    targetCaseTitle: row.targetCaseTitle,
    targetCaseCategory: row.targetCaseCategory,
    targetCaseStatus: row.targetCaseStatus,
    targetFilingDate: row.targetFilingDate,
    targetSlaDueDate: row.targetSlaDueDate,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    relationshipKind: row.relationshipKind,
    matchType: row.matchType,
    confidenceScore: Number(row.confidenceScore),
    flaggedAt: row.flaggedAt,
    status: row.status,
    reasons: row.reasons ?? [],
    evidenceMatches: row.evidenceMatches ?? [],
    recommendedAction: row.recommendedAction,
    latestDecision: row.latestDecision ?? null,
    version: Number(row.version),
    isSynthetic: row.isSynthetic,
  };
}

function caseSelect(scopeParameter: number) {
  const scoped = `$${scopeParameter}::text[]`;
  return `
  SELECT c.id, c.bureau_code AS "bureauId", c.institution_id AS "institutionId",
    i.name AS "institutionName", i.aishe_code AS "aisheCode", c.title, c.description,
    c.category, c.severity, c.status, c.complainant_type AS "complainantType",
    c.filing_date AS "filingDate", c.sla_due_date AS "slaDueDate",
    c.assigned_officer_id AS "assignedOfficerId", c.assigned_officer_name AS "assignedOfficerName",
    c.assigned_officer_designation AS "assignedOfficerDesignation",
    c.evidence_files_count AS "evidenceFilesCount", c.is_synthetic AS "isSynthetic",
    EXISTS (
      SELECT 1 FROM case_relationships r
      JOIN complaint_cases a ON a.id = r.source_case_id
      JOIN complaint_cases b ON b.id = r.target_case_id
      WHERE (r.source_case_id = c.id OR r.target_case_id = c.id) AND r.status <> 'REJECTED'
        AND a.bureau_code = ANY(${scoped}) AND b.bureau_code = ANY(${scoped})
    ) AS "crossBureauFlag",
    COALESCE((SELECT jsonb_agg(r.id ORDER BY r.flagged_at DESC, r.id)
      FROM case_relationships r
      JOIN complaint_cases a ON a.id = r.source_case_id
      JOIN complaint_cases b ON b.id = r.target_case_id
      WHERE (r.source_case_id = c.id OR r.target_case_id = c.id)
        AND a.bureau_code = ANY(${scoped}) AND b.bureau_code = ANY(${scoped})), '[]'::jsonb) AS "overlapIds"
  FROM complaint_cases c JOIN institutions i ON i.id = c.institution_id`;
}

const RELATIONSHIP_SELECT = `
  SELECT r.id, r.source_case_id AS "sourceCaseId", r.target_case_id AS "targetCaseId",
    source.bureau_code AS "sourceBureau", target.bureau_code AS "targetBureau",
    source.title AS "sourceCaseTitle", source.category AS "sourceCaseCategory", source.status AS "sourceCaseStatus",
    source.filing_date AS "sourceFilingDate", source.sla_due_date AS "sourceSlaDueDate",
    target.title AS "targetCaseTitle", target.category AS "targetCaseCategory", target.status AS "targetCaseStatus",
    target.filing_date AS "targetFilingDate", target.sla_due_date AS "targetSlaDueDate",
    i.id AS "institutionId", i.name AS "institutionName", r.relationship_kind AS "relationshipKind",
    r.match_type AS "matchType", r.confidence_score AS "confidenceScore", r.flagged_at AS "flaggedAt",
    r.status, r.reasons, r.evidence_matches AS "evidenceMatches", r.recommended_action AS "recommendedAction",
    (SELECT jsonb_build_object('decision', rev.decision, 'notes', rev.notes,
      'reviewedAt', rev.reviewed_at, 'reviewer', jsonb_build_object('id', rev.reviewer_id,
      'displayName', rev.reviewer_display_name, 'bureauId', rev.reviewer_bureau_code))
      FROM overlap_reviews rev WHERE rev.relationship_id = r.id ORDER BY rev.reviewed_at DESC, rev.id DESC LIMIT 1) AS "latestDecision",
    r.version, r.is_synthetic AS "isSynthetic"
  FROM case_relationships r
    JOIN complaint_cases source ON source.id = r.source_case_id
    JOIN complaint_cases target ON target.id = r.target_case_id
    JOIN institutions i ON i.id = (SELECT institution_id FROM complaint_cases WHERE id = r.source_case_id)`;

export class CasePulseRepository {
  constructor(private readonly sql: Sql = query as unknown as Sql, private readonly transaction: Transaction = withTransaction) {}

  async appendCaseAction(id: string, actor: Actor, input: { idempotencyKey: string; type: string; notes: string; nextStatus?: string }) {
    return this.transaction(async (client) => {
      const found = await client.query(`SELECT id, bureau_code AS "bureauId", status FROM complaint_cases WHERE id = $1 FOR UPDATE`, [id]);
      const current = found.rows[0] as Row | undefined;
      if (!current || !canWriteCaseAction(actor, String(current.bureauId))) return null;
      const prior = await client.query(`SELECT id, case_id AS "caseId", occurred_at AS "occurredAt", actor_id AS "actorId", actor_display_name AS "actorDisplayName", bureau_code AS "bureauId", action_type AS "actionType", action, notes, metadata, is_synthetic AS "isSynthetic"
        FROM case_actions WHERE case_id = $1 AND metadata->>'idempotencyKey' = $2`, [id, input.idempotencyKey]);
      if (prior.rows[0]) {
        const caseResult = await client.query(`${caseSelect(2)} WHERE c.id = $1 AND c.bureau_code = ANY($2::text[]) LIMIT 1`, [id, scopedBureaus(actor)]);
        return { case: caseProjection(caseResult.rows[0] as Row), action: actionProjection(prior.rows[0] as Row) };
      }
      const nextStatus = input.nextStatus;
      const transitions: Record<string, string[]> = {
        NEW: ['UNDER_INVESTIGATION', 'CLOSED'],
        UNDER_INVESTIGATION: ['HEARING_SCHEDULED', 'ACTION_PENDING', 'JOINT_INQUIRY', 'RESOLVED', 'CLOSED'],
        HEARING_SCHEDULED: ['ACTION_PENDING', 'JOINT_INQUIRY', 'RESOLVED', 'CLOSED'],
        ACTION_PENDING: ['UNDER_INVESTIGATION', 'JOINT_INQUIRY', 'RESOLVED', 'CLOSED'],
        JOINT_INQUIRY: ['UNDER_INVESTIGATION', 'ACTION_PENDING', 'RESOLVED', 'CLOSED'],
        RESOLVED: ['CLOSED'], CLOSED: [],
      };
      if (nextStatus && nextStatus !== current.status && !transitions[String(current.status)]?.includes(nextStatus)) {
        throw new ApiError(400, 'INVALID_STATUS_TRANSITION', 'The requested case status transition is not permitted.');
      }
      const changed = Boolean(nextStatus && nextStatus !== current.status);
      const occurredAt = new Date().toISOString();
      let actionId = crypto.randomUUID();
      if (changed) {
        await client.query(`UPDATE complaint_cases SET status = $2, version = version + 1, updated_at = now() WHERE id = $1`, [id, nextStatus]);
      }
      const inserted = await client.query(`INSERT INTO case_actions (id, case_id, occurred_at, actor_id, actor_display_name, bureau_code, action_type, action, notes, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        ON CONFLICT (case_id, (metadata->>'idempotencyKey')) WHERE (metadata ? 'idempotencyKey') DO NOTHING
        RETURNING id`, [actionId, id, occurredAt, actor.id, actor.displayName, current.bureauId, changed ? 'STATUS_CHANGE' : input.type, changed ? `Status changed from ${current.status} to ${nextStatus}` : input.notes, input.notes, JSON.stringify({ idempotencyKey: input.idempotencyKey, ...(changed ? { previousStatus: current.status, nextStatus, requestedActionType: input.type } : {}) })]);
      if (!inserted.rowCount) {
        const existing = await client.query(`SELECT id FROM case_actions WHERE case_id = $1 AND metadata->>'idempotencyKey' = $2`, [id, input.idempotencyKey]);
        actionId = String(existing.rows[0].id);
      }
      const caseResult = await client.query(`${caseSelect(2)} WHERE c.id = $1 AND c.bureau_code = ANY($2::text[]) LIMIT 1`, [id, scopedBureaus(actor)]);
      const eventResult = await client.query(`SELECT id, case_id AS "caseId", occurred_at AS "occurredAt", actor_id AS "actorId", actor_display_name AS "actorDisplayName", bureau_code AS "bureauId", action_type AS "actionType", action, notes, metadata, is_synthetic AS "isSynthetic" FROM case_actions WHERE id = $1`, [actionId]);
      return { case: caseProjection(caseResult.rows[0] as Row), action: actionProjection(eventResult.rows[0] as Row) };
    });
  }

  async appendOverlapReview(id: string, actor: Actor, input: { decision: string; notes: string; expectedVersion: number }) {
    return this.transaction(async (client) => {
      const result = await client.query(`SELECT r.id, r.status, r.version, a.bureau_code AS "sourceBureau", b.bureau_code AS "targetBureau"
        FROM case_relationships r JOIN complaint_cases a ON a.id = r.source_case_id JOIN complaint_cases b ON b.id = r.target_case_id
        WHERE r.id = $1 FOR UPDATE OF r`, [id]);
      const row = result.rows[0] as Row | undefined;
      if (!row || !canWriteOverlapReview(actor, String(row.sourceBureau), String(row.targetBureau))) return null;
      if (Number(row.version) !== input.expectedVersion) throw new ApiError(409, 'VERSION_CONFLICT', 'The overlap review is stale. Reload and submit the current version.');
      const nextVersion = Number(row.version) + 1;
      const updated = await client.query(`UPDATE case_relationships SET status = $2, version = $3 WHERE id = $1 AND version = $4 RETURNING id`, [id, input.decision, nextVersion, input.expectedVersion]);
      if (!updated.rowCount) throw new ApiError(409, 'VERSION_CONFLICT', 'The overlap review is stale. Reload and submit the current version.');
      const reviewId = crypto.randomUUID();
      const review = await client.query(`INSERT INTO overlap_reviews (id, relationship_id, decision, notes, reviewer_id, reviewer_display_name, reviewer_bureau_code, previous_version, new_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, decision, notes, reviewed_at AS "reviewedAt", jsonb_build_object('id', reviewer_id, 'displayName', reviewer_display_name, 'bureauId', reviewer_bureau_code) AS reviewer, previous_version AS "previousVersion", new_version AS "newVersion", is_synthetic AS "isSynthetic"`,
      [reviewId, id, input.decision, input.notes, actor.id, actor.displayName, actor.bureauCodes.includes(String(row.sourceBureau) as Actor['bureauCodes'][number]) ? row.sourceBureau : row.targetBureau, input.expectedVersion, nextVersion]);
      const relationship = await client.query(`${RELATIONSHIP_SELECT} WHERE r.id = $1`, [id]);
      return { relationship: relationshipProjection(relationship.rows[0] as Row), review: review.rows[0] };
    });
  }

  async dashboardSummary(actor: Actor): Promise<DashboardSummary> {
    const bureaus = scopedBureaus(actor);
    const result = await this.sql(`
      WITH scoped_cases AS (
        SELECT * FROM complaint_cases WHERE bureau_code = ANY($1::text[])
      ), scoped_relationships AS (
        SELECT r.* FROM case_relationships r
        JOIN complaint_cases a ON a.id = r.source_case_id
        JOIN complaint_cases b ON b.id = r.target_case_id
        WHERE a.bureau_code = ANY($1::text[]) AND b.bureau_code = ANY($1::text[])
      ), bureau_counts AS (
        SELECT bureau_code, count(*)::int AS count FROM scoped_cases GROUP BY bureau_code
      )
      SELECT now() AS "asOf",
        (SELECT count(*)::int FROM scoped_cases) AS "totalCases",
        (SELECT count(*)::int FROM scoped_cases WHERE status NOT IN ('RESOLVED', 'CLOSED')) AS "pendingCases",
        (SELECT count(*)::int FROM scoped_cases WHERE sla_due_date < now() AND status NOT IN ('RESOLVED', 'CLOSED')) AS "overdueCases",
        (SELECT count(*)::int FROM scoped_cases WHERE severity = 'CRITICAL') AS "criticalCases",
        (SELECT count(*)::int FROM (SELECT institution_id FROM scoped_cases WHERE status NOT IN ('RESOLVED', 'CLOSED') GROUP BY institution_id HAVING count(*) > 1) repeaters) AS "repeatOffenderInstitutions",
        (SELECT count(*)::int FROM scoped_relationships) AS "flaggedOverlapsCount",
        (SELECT count(*)::int FROM scoped_relationships WHERE status IN ('PROPOSED', 'FURTHER_COORDINATION')) AS "unresolvedOverlapsCount",
        (SELECT count(*)::int FROM scoped_cases WHERE status = 'JOINT_INQUIRY') AS "jointInquiriesActive",
        (SELECT count(DISTINCT ib.institution_id)::int FROM institution_bureaus ib WHERE ib.bureau_code = ANY($1::text[])) AS "activeInstitutions",
        (SELECT COALESCE(bool_and(is_synthetic), false) FROM scoped_cases) AS "allSynthetic",
        (SELECT COALESCE(bool_or(is_synthetic), false) FROM scoped_cases) AS "hasSyntheticRecords",
        COALESCE((SELECT jsonb_object_agg(code, COALESCE(bc.count, 0)) FROM bureaus b LEFT JOIN bureau_counts bc ON bc.bureau_code = b.code WHERE b.code = ANY($1::text[])), '{}'::jsonb) AS "bureauCounts"
    `, [bureaus]);
    const row = result.rows[0];
    const { allSynthetic, hasSyntheticRecords, ...metrics } = row;
    return {
      ...metrics,
      dataSource: 'POSTGRESQL',
      syntheticDemoData: Boolean(allSynthetic),
      syntheticRecordsPresent: Boolean(hasSyntheticRecords),
    } as unknown as DashboardSummary;
  }

  async dashboardOverview(actor: Actor): Promise<DashboardOverview> {
    const bureaus = scopedBureaus(actor);
    const [summary, priorityRows, pendingRows, recentCases] = await Promise.all([
      this.dashboardSummary(actor),
      this.sql(`
        ${caseSelect(1)}
        WHERE c.bureau_code = ANY($1::text[])
          AND c.status NOT IN ('RESOLVED', 'CLOSED')
          AND (c.sla_due_date < now() OR c.severity = 'CRITICAL')
        ORDER BY
          CASE WHEN c.sla_due_date < now() THEN 0 ELSE 1 END ASC,
          CASE WHEN c.sla_due_date < now() THEN c.sla_due_date END ASC,
          CASE WHEN c.sla_due_date >= now() AND c.severity = 'CRITICAL' THEN c.sla_due_date END ASC,
          c.id ASC
        LIMIT 5
      `, [bureaus]),
      this.sql(`
        ${RELATIONSHIP_SELECT}
        WHERE source.bureau_code = ANY($1::text[])
          AND target.bureau_code = ANY($1::text[])
          AND r.status IN ('PROPOSED', 'FURTHER_COORDINATION')
        ORDER BY CASE r.status WHEN 'PROPOSED' THEN 0 ELSE 1 END ASC, r.flagged_at ASC, r.id ASC
        LIMIT 3
      `, [bureaus]),
      this.listCases({ page: 1, pageSize: 5 }, actor),
    ]);

    return {
      summary,
      priorityCases: priorityRows.rows.map((row) => caseProjection(row)),
      pendingOverlaps: pendingRows.rows.map((row) => relationshipProjection(row)),
      recentCases: recentCases.data,
    };
  }

  async listInstitutions(filters: InstitutionFilters, actor: Actor) {
    if (filters.bureau && !canReadBureau(actor, filters.bureau)) {
      throw new ApiError(403, 'FORBIDDEN', 'You are not permitted to view this bureau.');
    }
    const values: unknown[] = [scopedBureaus(actor)];
    const where = ['EXISTS (SELECT 1 FROM institution_bureaus ib WHERE ib.institution_id = i.id AND ib.bureau_code = ANY($1::text[]))'];
    const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)); };
    if (filters.search) {
      const p = `%${escapeLike(filters.search)}%`;
      values.push(p, p, p, p, p);
      const start = values.length - 4;
      where.push(`(i.name ILIKE $${start} ESCAPE '!' OR i.aishe_code ILIKE $${start + 1} ESCAPE '!' OR i.aicte_permanent_id ILIKE $${start + 2} ESCAPE '!' OR i.state ILIKE $${start + 3} ESCAPE '!' OR i.district ILIKE $${start + 4} ESCAPE '!')`);
    }
    if (filters.state) add('i.state ILIKE ?', filters.state);
    if (filters.riskRating) add('i.risk_rating = ?', filters.riskRating);
    if (filters.bureau) add('EXISTS (SELECT 1 FROM institution_bureaus ib2 WHERE ib2.institution_id = i.id AND ib2.bureau_code = ?)', filters.bureau);
    const clause = where.join(' AND ');
    const count = await this.sql(`SELECT count(*)::int AS total FROM institutions i WHERE ${clause}`, values);
    const pageValues = [...values, filters.pageSize, (filters.page - 1) * filters.pageSize];
    const rows = await this.sql(`
      SELECT i.id, i.aishe_code AS "aisheCode", i.aicte_permanent_id AS "aictePermanentId", i.name,
        i.category, i.state, i.district, i.pincode, i.address, i.affiliated_university AS "affiliatedUniversity",
        i.established_year AS "establishedYear", i.approved_intake AS "approvedIntake", i.risk_rating AS "riskRating",
        i.is_synthetic AS "isSynthetic",
        (SELECT count(*)::int FROM complaint_cases c WHERE c.institution_id = i.id AND c.bureau_code = ANY($1::text[]) AND c.status NOT IN ('RESOLVED', 'CLOSED')) AS "activeCasesCount",
        (SELECT count(*)::int FROM complaint_cases c WHERE c.institution_id = i.id AND c.bureau_code = ANY($1::text[])) AS "totalCasesCount",
        COALESCE((SELECT jsonb_agg(ib.bureau_code ORDER BY ib.bureau_code) FROM institution_bureaus ib WHERE ib.institution_id = i.id AND ib.bureau_code = ANY($1::text[])), '[]'::jsonb) AS "bureauInvolvement"
      FROM institutions i WHERE ${clause}
      ORDER BY lower(i.name), i.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, pageValues);
    return pageResult(rows.rows.map(institutionProjection), filters.page, filters.pageSize, Number(count.rows[0].total));
  }

  async getInstitution(id: string, actor: Actor) {
    const result = await this.sql(`
      SELECT i.id, i.aishe_code AS "aisheCode", i.aicte_permanent_id AS "aictePermanentId", i.name,
        i.category, i.state, i.district, i.pincode, i.address, i.affiliated_university AS "affiliatedUniversity",
        i.established_year AS "establishedYear", i.approved_intake AS "approvedIntake", i.risk_rating AS "riskRating",
        i.is_synthetic AS "isSynthetic",
        (SELECT count(*)::int FROM complaint_cases c WHERE c.institution_id = i.id AND c.bureau_code = ANY($2::text[]) AND c.status NOT IN ('RESOLVED', 'CLOSED')) AS "activeCasesCount",
        (SELECT count(*)::int FROM complaint_cases c WHERE c.institution_id = i.id AND c.bureau_code = ANY($2::text[])) AS "totalCasesCount",
        COALESCE((SELECT jsonb_agg(ib.bureau_code ORDER BY ib.bureau_code) FROM institution_bureaus ib WHERE ib.institution_id = i.id AND ib.bureau_code = ANY($2::text[])), '[]'::jsonb) AS "bureauInvolvement"
      FROM institutions i WHERE i.id = $1 AND EXISTS (
        SELECT 1 FROM institution_bureaus ib WHERE ib.institution_id = i.id AND ib.bureau_code = ANY($2::text[])
      ) LIMIT 1
    `, [id, scopedBureaus(actor)]);
    return result.rows[0] ? institutionProjection(result.rows[0]) : null;
  }

  async listCases(filters: CaseFilters, actor: Actor) {
    const values: unknown[] = [scopedBureaus(actor)];
    const where = ['c.bureau_code = ANY($1::text[])'];
    const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)); };
    if (filters.search) {
      values.push(`%${escapeLike(filters.search)}%`);
      const p = `$${values.length}`;
      where.push(`(c.id ILIKE ${p} ESCAPE '!' OR c.title ILIKE ${p} ESCAPE '!' OR c.description ILIKE ${p} ESCAPE '!' OR i.name ILIKE ${p} ESCAPE '!' OR i.aishe_code ILIKE ${p} ESCAPE '!')`);
    }
    if (filters.bureau) {
      if (!canReadBureau(actor, filters.bureau)) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not permitted to view this bureau.');
      }
      add('c.bureau_code = ?', filters.bureau);
    }
    if (filters.status) add('c.status = ?', filters.status);
    if (filters.category) add('c.category = ?', filters.category);
    if (filters.institutionId) add('c.institution_id = ?', filters.institutionId);
    if (filters.overdueOnly) where.push(`c.sla_due_date < now() AND c.status NOT IN ('RESOLVED', 'CLOSED')`);
    if (filters.overlapOnly) {
      where.push(`EXISTS (
        SELECT 1 FROM case_relationships r
        JOIN complaint_cases a ON a.id = r.source_case_id
        JOIN complaint_cases b ON b.id = r.target_case_id
        WHERE (r.source_case_id = c.id OR r.target_case_id = c.id) AND r.status <> 'REJECTED'
          AND a.bureau_code = ANY($1::text[]) AND b.bureau_code = ANY($1::text[])
      )`);
    }
    const clause = where.join(' AND ');
    const from = 'FROM complaint_cases c JOIN institutions i ON i.id = c.institution_id';
    const count = await this.sql(`SELECT count(*)::int AS total ${from} WHERE ${clause}`, values);
    const rows = await this.sql(`${caseSelect(1)} WHERE ${clause} ORDER BY c.filing_date DESC, c.id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.pageSize, (filters.page - 1) * filters.pageSize]);
    return pageResult(rows.rows.map((row) => caseProjection(row)), filters.page, filters.pageSize, Number(count.rows[0].total));
  }

  async getCase(id: string, actor: Actor) {
    const result = await this.sql(`${caseSelect(2)} WHERE c.id = $1 AND c.bureau_code = ANY($2::text[]) LIMIT 1`, [id, scopedBureaus(actor)]);
    if (!result.rows[0]) return null;
    const actions = await this.sql(`
      SELECT id, case_id AS "caseId", occurred_at AS "occurredAt", actor_id AS "actorId",
        actor_display_name AS "actorDisplayName", bureau_code AS "bureauId", action_type AS "actionType",
        action, notes, metadata, is_synthetic AS "isSynthetic"
      FROM case_actions WHERE case_id = $1 ORDER BY occurred_at DESC, id DESC
    `, [id]);
    return caseProjection(result.rows[0], actions.rows);
  }

  async getRelatedCases(id: string, actor: Actor) {
    const caseRow = await this.sql(`SELECT id FROM complaint_cases WHERE id = $1 AND bureau_code = ANY($2::text[])`, [id, scopedBureaus(actor)]);
    if (!caseRow.rows[0]) return null;
    const rows = await this.sql(`
      SELECT r.id, r.source_case_id AS "sourceCaseId", r.target_case_id AS "targetCaseId",
        source.bureau_code AS "sourceBureau", target.bureau_code AS "targetBureau",
        i.id AS "institutionId", i.name AS "institutionName", r.relationship_kind AS "relationshipKind",
        r.match_type AS "matchType", r.confidence_score AS "confidenceScore", r.flagged_at AS "flaggedAt",
        r.status, r.reasons, r.evidence_matches AS "evidenceMatches", r.recommended_action AS "recommendedAction",
        (SELECT jsonb_build_object('decision', rev.decision, 'notes', rev.notes,
          'reviewedAt', rev.reviewed_at, 'reviewer', jsonb_build_object('id', rev.reviewer_id,
          'displayName', rev.reviewer_display_name, 'bureauId', rev.reviewer_bureau_code))
          FROM overlap_reviews rev WHERE rev.relationship_id = r.id ORDER BY rev.reviewed_at DESC, rev.id DESC LIMIT 1) AS "latestDecision",
        r.version, r.is_synthetic AS "isSynthetic",
        other.id AS "otherCaseId", other.bureau_code AS "otherBureauId", other.title AS "otherTitle", other.status AS "otherStatus"
      FROM case_relationships r
      JOIN complaint_cases source ON source.id = r.source_case_id
      JOIN complaint_cases target ON target.id = r.target_case_id
      JOIN institutions i ON i.id = (SELECT institution_id FROM complaint_cases WHERE id = r.source_case_id)
      JOIN complaint_cases other ON other.id = CASE WHEN r.source_case_id = $1 THEN r.target_case_id ELSE r.source_case_id END
      WHERE (r.source_case_id = $1 OR r.target_case_id = $1)
        AND source.bureau_code = ANY($2::text[]) AND target.bureau_code = ANY($2::text[])
      ORDER BY r.flagged_at DESC, r.id ASC
    `, [id, scopedBureaus(actor)]);
    return rows.rows.map((row) => ({
      overlap: relationshipProjection(row),
      relatedCase: { id: row.otherCaseId, bureauId: row.otherBureauId, title: row.otherTitle, status: row.otherStatus },
    }));
  }

  async listOverlaps(filters: OverlapFilters, actor: Actor) {
    const values: unknown[] = [scopedBureaus(actor)];
    const where = ['source.bureau_code = ANY($1::text[])', 'target.bureau_code = ANY($1::text[])'];
    const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)); };
    if (filters.status) add('r.status = ?', filters.status);
    if (filters.matchType) add('r.match_type = ?', filters.matchType);
    if (filters.bureau) {
      values.push(filters.bureau, filters.bureau);
      where.push(`(source.bureau_code = $${values.length - 1} OR target.bureau_code = $${values.length})`);
    }
    if (filters.institutionId) add('i.id = ?', filters.institutionId);
    if (filters.search) {
      values.push(`%${escapeLike(filters.search)}%`);
      const p = `$${values.length}`;
      where.push(`(r.id ILIKE ${p} ESCAPE '!' OR source.id ILIKE ${p} ESCAPE '!' OR target.id ILIKE ${p} ESCAPE '!' OR i.name ILIKE ${p} ESCAPE '!' OR r.reasons::text ILIKE ${p} ESCAPE '!')`);
    }
    const clause = where.join(' AND ');
    const from = `FROM case_relationships r JOIN complaint_cases source ON source.id = r.source_case_id JOIN complaint_cases target ON target.id = r.target_case_id JOIN institutions i ON i.id = (SELECT institution_id FROM complaint_cases WHERE id = r.source_case_id)`;
    const count = await this.sql(`SELECT count(*)::int AS total ${from} WHERE ${clause}`, values);
    const rows = await this.sql(`${RELATIONSHIP_SELECT} WHERE ${clause} ORDER BY r.confidence_score DESC, r.flagged_at DESC, r.id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.pageSize, (filters.page - 1) * filters.pageSize]);
    return pageResult(rows.rows.map(relationshipProjection), filters.page, filters.pageSize, Number(count.rows[0].total));
  }

  async listOverlapReviews(id: string, actor: Actor, page = 1, pageSize = 25) {
    const scope = await this.sql(`
      SELECT r.id FROM case_relationships r
      JOIN complaint_cases a ON a.id = r.source_case_id JOIN complaint_cases b ON b.id = r.target_case_id
      WHERE r.id = $1 AND a.bureau_code = ANY($2::text[]) AND b.bureau_code = ANY($2::text[])
    `, [id, scopedBureaus(actor)]);
    if (!scope.rows[0]) return null;
    const count = await this.sql('SELECT count(*)::int AS total FROM overlap_reviews WHERE relationship_id = $1', [id]);
    const rows = await this.sql(`
      SELECT id, decision, notes, reviewed_at AS "reviewedAt",
        jsonb_build_object('id', reviewer_id, 'displayName', reviewer_display_name, 'bureauId', reviewer_bureau_code) AS reviewer,
        previous_version AS "previousVersion", new_version AS "newVersion", is_synthetic AS "isSynthetic"
      FROM overlap_reviews WHERE relationship_id = $1 ORDER BY reviewed_at DESC, id DESC LIMIT $2 OFFSET $3
    `, [id, pageSize, (page - 1) * pageSize]);
    return pageResult(rows.rows, page, pageSize, Number(count.rows[0]?.total ?? 0));
  }
}

export const repository = new CasePulseRepository();
