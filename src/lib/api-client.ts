import {
  BureauCode,
  CaseComplaint,
  CaseOverlap,
  CaseStatus,
  Institution,
  RelationshipStatus,
  ReviewDecision,
  TimelineEvent,
} from '@/types';

export type CaseActionType =
  | 'NOTE_ADDED'
  | 'HEARING'
  | 'NOTICE_ISSUED'
  | 'INTER_BUREAU_SYNC'
  | 'PENALTY_ISSUED'
  | 'CLOSURE';

export interface CaseActionPayload {
  idempotencyKey: string;
  type: CaseActionType;
  notes: string;
  nextStatus?: CaseStatus;
}

export interface CaseActionRecord {
  id: string;
  caseId: string;
  occurredAt: string;
  actor: { id: string; displayName: string };
  bureauId: BureauCode;
  type: string;
  action: string;
  notes: string;
  metadata?: Record<string, unknown>;
  isSynthetic?: boolean;
}

export interface CaseActionResponse {
  case: CaseComplaint;
  action: CaseActionRecord;
}

export interface OverlapReviewPayload {
  decision: ReviewDecision;
  notes: string;
  expectedVersion: number;
}

export interface OverlapReviewRecord {
  id: string;
  decision: ReviewDecision;
  notes: string;
  reviewedAt: string;
  reviewer: { id: string; displayName: string; bureauId: BureauCode };
  previousVersion: number;
  newVersion: number;
  isSynthetic?: boolean;
}

export interface OverlapReviewResponse {
  relationship: CaseOverlap;
  review: OverlapReviewRecord;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface DashboardSummary {
  asOf: string;
  dataSource: string;
  syntheticDemoData: boolean;
  totalCases: number;
  pendingCases: number;
  overdueCases: number;
  criticalCases: number;
  activeInstitutions: number;
  repeatOffenderInstitutions: number;
  flaggedOverlapsCount: number;
  unresolvedOverlapsCount: number;
  jointInquiriesActive: number;
  bureauCounts: Partial<Record<BureauCode, number>>;
}

// ─── Cases list ─────────────────────────────────────────────────────────────

export interface CaseFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  bureau?: string;
  status?: string;
  category?: string;
  institutionId?: string;
  overdueOnly?: boolean;
  overlapOnly?: boolean;
}

// ─── Institutions list ───────────────────────────────────────────────────────

export interface InstitutionFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  state?: string;
  riskRating?: string;
  bureau?: string;
}

export interface OverlapFilters {
  page?: number;
  pageSize?: number;
  status?: RelationshipStatus;
  matchType?: string;
  bureau?: BureauCode;
  institutionId?: string;
  search?: string;
}

export interface RelatedCaseRelationship {
  overlap: CaseOverlap;
  relatedCase: {
    id: string;
    bureauId: BureauCode;
    title: string;
    status: CaseStatus;
  };
}

export interface RelatedCasesResponse {
  caseId: string;
  relationships: RelatedCaseRelationship[];
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isUnavailable(): boolean {
    return this.status === 503;
  }

  get userFriendlyMessage(): string {
    switch (this.status) {
      case 401:
        return 'Authentication required. Please sign in with an authorized officer account to view or modify this record.';
      case 403:
        return 'Access denied. You do not have permissions for this bureau or operation.';
      case 404:
        return 'Resource unavailable. The requested record does not exist or is outside your authorized bureau scope.';
      case 409:
        return 'Review conflict (HTTP 409). Another officer updated this relationship. Please refresh to inspect current state.';
      case 503:
        return 'The backend database service is currently unavailable. Please verify PostgreSQL connection and retry.';
      default:
        return this.message || 'An unexpected error occurred while communicating with the server.';
    }
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network connection failure. Unable to reach server.'
    );
  }

  let body: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      // Body was not parseable as JSON
    }
  }

  if (!response.ok) {
    const errorObj = (body as { error?: { code?: string; message?: string; details?: Record<string, unknown>; requestId?: string } })?.error;
    const code = errorObj?.code || (response.status === 503 ? 'DATABASE_UNAVAILABLE' : `HTTP_${response.status}`);
    const message = errorObj?.message || response.statusText || `Request failed with status ${response.status}`;
    const details = errorObj?.details;
    const requestId = errorObj?.requestId;

    throw new ApiClientError(response.status, code, message, details, requestId);
  }

  return body as T;
}

function normalizeCase(c: CaseComplaint): CaseComplaint {
  if (!c.timeline) {
    c.timeline = (c.actionHistory ?? []).map((act) => ({
      id: act.id,
      caseId: act.caseId,
      timestamp: act.occurredAt,
      actor: act.actor?.displayName || act.actor?.id || 'Authorized Officer',
      bureau: act.bureauId,
      action: act.action || act.type.replace(/_/g, ' '),
      notes: act.notes,
      type: (act.type as TimelineEvent['type']) || 'NOTE_ADDED',
    }));
  }
  return c;
}

function normalizeOverlap(o: CaseOverlap): CaseOverlap {
  if (!o.flaggedDate) {
    o.flaggedDate = o.flaggedAt || new Date().toISOString();
  }
  return o;
}

export const apiClient = {
  /**
   * Retrieves current scoped dashboard summary metrics.
   * GET /api/dashboard/summary
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const res = await requestJson<{ data: DashboardSummary }>('/api/dashboard/summary');
    return res.data;
  },

  /**
   * Lists paginated cases with optional filters.
   * GET /api/cases
   */
  async getCases(
    filters?: CaseFilters
  ): Promise<{ data: CaseComplaint[]; meta: Pagination }> {
    const params = new URLSearchParams();
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters?.search && filters.search.trim()) params.set('search', filters.search.trim());
    if (filters?.bureau && filters.bureau !== 'ALL') params.set('bureau', filters.bureau);
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters?.category && filters.category !== 'ALL') params.set('category', filters.category);
    if (filters?.institutionId) params.set('institutionId', filters.institutionId);
    if (filters?.overdueOnly) params.set('overdueOnly', 'true');
    if (filters?.overlapOnly) params.set('overlapOnly', 'true');

    const qs = params.toString();
    const url = `/api/cases${qs ? `?${qs}` : ''}`;
    const res = await requestJson<{ data: CaseComplaint[]; meta: Pagination }>(url);
    return {
      data: res.data.map(normalizeCase),
      meta: res.meta,
    };
  },

  /**
   * Lists paginated institutions with optional filters.
   * GET /api/institutions
   */
  async getInstitutions(
    filters?: InstitutionFilters
  ): Promise<{ data: Institution[]; meta: Pagination }> {
    const params = new URLSearchParams();
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters?.search && filters.search.trim()) params.set('search', filters.search.trim());
    if (filters?.state && filters.state !== 'ALL') params.set('state', filters.state);
    if (filters?.riskRating && filters.riskRating !== 'ALL') params.set('riskRating', filters.riskRating);
    if (filters?.bureau && filters.bureau !== 'ALL') params.set('bureau', filters.bureau);

    const qs = params.toString();
    const url = `/api/institutions${qs ? `?${qs}` : ''}`;
    const res = await requestJson<{ data: Institution[]; meta: Pagination }>(url);
    return res;
  },

  /**
   * Retrieves a single institution by ID.
   * GET /api/institutions/{id}
   */
  async getInstitution(id: string): Promise<Institution> {
    const res = await requestJson<{ data: Institution }>(
      `/api/institutions/${encodeURIComponent(id)}`
    );
    return res.data;
  },

  /**
   * Retrieves full authoritative Case projection with action history.
   * GET /api/cases/{id}
   */
  async getCase(id: string): Promise<CaseComplaint> {
    const res = await requestJson<{ data: CaseComplaint }>(`/api/cases/${encodeURIComponent(id)}`);
    return normalizeCase(res.data);
  },

  /**
   * Retrieves related cases and overlap relationships for a case docket.
   * GET /api/cases/{id}/related
   */
  async getRelatedCases(id: string): Promise<RelatedCasesResponse> {
    const res = await requestJson<{ data: RelatedCasesResponse }>(
      `/api/cases/${encodeURIComponent(id)}/related`
    );
    res.data.relationships = res.data.relationships.map((rel) => ({
      ...rel,
      overlap: normalizeOverlap(rel.overlap),
    }));
    return res.data;
  },

  /**
   * Appends an administrative action and optional status transition in one atomic transaction.
   * POST /api/cases/{id}/actions
   */
  async recordCaseAction(id: string, payload: CaseActionPayload): Promise<CaseActionResponse> {
    const body: Record<string, unknown> = {
      idempotencyKey: payload.idempotencyKey,
      type: payload.type,
      notes: payload.notes,
    };
    if (payload.nextStatus) {
      body.nextStatus = payload.nextStatus;
    }

    const res = await requestJson<{ data: CaseActionResponse }>(
      `/api/cases/${encodeURIComponent(id)}/actions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    return {
      case: normalizeCase(res.data.case),
      action: res.data.action,
    };
  },

  /**
   * Lists cross-bureau overlap relationships with filters.
   * GET /api/overlaps
   */
  async getOverlaps(
    filters?: OverlapFilters
  ): Promise<{ data: CaseOverlap[]; meta: Pagination }> {
    const params = new URLSearchParams();
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters?.status) params.set('status', filters.status);
    if (filters?.matchType && filters.matchType !== 'ALL') params.set('matchType', filters.matchType);
    if (filters?.bureau && filters.bureau !== ('ALL' as BureauCode)) params.set('bureau', filters.bureau);
    if (filters?.institutionId) params.set('institutionId', filters.institutionId);
    if (filters?.search && filters.search.trim()) params.set('search', filters.search.trim());

    const qs = params.toString();
    const url = `/api/overlaps${qs ? `?${qs}` : ''}`;
    const res = await requestJson<{ data: CaseOverlap[]; meta: Pagination }>(url);
    return {
      data: res.data.map(normalizeOverlap),
      meta: res.meta,
    };
  },

  /**
   * Lists immutable review history for an overlap relationship (newest first).
   * GET /api/overlaps/{id}/reviews
   */
  async getOverlapReviews(
    id: string,
    page = 1,
    pageSize = 25
  ): Promise<{ data: OverlapReviewRecord[]; meta: Pagination }> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    return requestJson<{ data: OverlapReviewRecord[]; meta: Pagination }>(
      `/api/overlaps/${encodeURIComponent(id)}/reviews?${params.toString()}`
    );
  },

  /**
   * Appends an overlap review decision and updates relationship version atomically.
   * POST /api/overlaps/{id}/reviews
   */
  async recordOverlapReview(
    id: string,
    payload: OverlapReviewPayload
  ): Promise<OverlapReviewResponse> {
    const body = {
      decision: payload.decision,
      notes: payload.notes,
      expectedVersion: payload.expectedVersion,
    };

    const res = await requestJson<{ data: OverlapReviewResponse }>(
      `/api/overlaps/${encodeURIComponent(id)}/reviews`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    return {
      relationship: normalizeOverlap(res.data.relationship),
      review: res.data.review,
    };
  },
};
