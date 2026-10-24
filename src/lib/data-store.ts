// CASEPULSE: Service Layer & Data Store
// Connects UI to state, deterministic correlation engine, and prepares clean contract for Python/FastAPI & PostgreSQL backend

import { BUREAUS, CASES, INSTITUTIONS } from '@/data/synthetic-dataset';
import { detectCrossBureauOverlaps } from '@/lib/correlation-engine';
import {
  Bureau,
  BureauCode,
  CaseComplaint,
  CaseOverlap,
  CaseStatus,
  Institution,
  OperationalMetrics,
  OverlapStatus,
  TimelineEvent,
} from '@/types';

class CasePulseService {
  private institutions: Institution[];
  private cases: CaseComplaint[];
  private overlaps: CaseOverlap[];
  private bureaus: Bureau[];
  private isBrowser: boolean;

  constructor() {
    this.bureaus = BUREAUS;
    this.institutions = [...INSTITUTIONS];
    this.cases = [...CASES];
    this.isBrowser = typeof window !== 'undefined';

    // Run deterministic overlap detector on dataset
    const detected = detectCrossBureauOverlaps(this.cases, this.institutions);
    this.overlaps = detected;

    // Load persisted state if in client browser
    if (this.isBrowser) {
      this.loadFromStorage();
    }
  }

  private loadFromStorage() {
    try {
      const storedOverlaps = localStorage.getItem('casepulse_overlaps');
      if (storedOverlaps) {
        const parsed = JSON.parse(storedOverlaps);
        // Merge status & reviewer notes
        this.overlaps = this.overlaps.map((ovl) => {
          const match = parsed.find((p: CaseOverlap) => p.id === ovl.id);
          return match ? { ...ovl, ...match } : ovl;
        });
      }

      const storedCases = localStorage.getItem('casepulse_cases');
      if (storedCases) {
        this.cases = JSON.parse(storedCases);
      }
    } catch {
      // Fallback silently if storage unavailable
    }
  }

  private saveToStorage() {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem('casepulse_overlaps', JSON.stringify(this.overlaps));
      localStorage.setItem('casepulse_cases', JSON.stringify(this.cases));
    } catch {
      // Storage quota or restriction fallback
    }
  }

  // --- Bureau queries ---
  public getBureaus(): Bureau[] {
    return this.bureaus;
  }

  public getBureauByCode(code: BureauCode): Bureau | undefined {
    return this.bureaus.find((b) => b.id === code);
  }

  // --- Metrics & KPI queries ---
  public getMetrics(): OperationalMetrics {
    const totalCases = this.cases.length;
    const pendingCases = this.cases.filter(
      (c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED'
    ).length;
    const overdueCases = this.cases.filter((c) => c.isOverdue).length;
    const criticalCases = this.cases.filter((c) => c.severity === 'CRITICAL').length;

    const repeatOffenders = this.institutions.filter(
      (inst) => inst.activeCasesCount > 1
    ).length;

    const unresolvedOverlaps = this.overlaps.filter(
      (o) => o.status === 'UNREVIEWED'
    ).length;

    const jointInquiries = this.cases.filter(
      (c) => c.status === 'JOINT_INQUIRY'
    ).length;

    const bureauCounts: Record<BureauCode, number> = {
      AICTE_APPROVAL: 0,
      UGC_VIGILANCE: 0,
      STATE_DTE_MAHA: 0,
      STATE_DTE_KAR: 0,
      NARC_ANTI_RAGGING: 0,
      CONSUMER_FORUM: 0,
    };

    this.cases.forEach((c) => {
      if (bureauCounts[c.bureauId] !== undefined) {
        bureauCounts[c.bureauId]++;
      }
    });

    return {
      totalCases,
      pendingCases,
      overdueCases,
      criticalCases,
      activeInstitutions: this.institutions.length,
      repeatOffenderInstitutions: repeatOffenders,
      flaggedOverlapsCount: this.overlaps.length,
      unresolvedOverlapsCount: unresolvedOverlaps,
      jointInquiriesActive: jointInquiries,
      bureauCounts,
    };
  }

  // --- Case queries & mutations ---
  public getCases(filters?: {
    search?: string;
    bureau?: string;
    status?: string;
    category?: string;
    overdueOnly?: boolean;
    overlapOnly?: boolean;
    institutionId?: string;
  }): CaseComplaint[] {
    let result = [...this.cases];

    if (!filters) return result;

    if (filters.institutionId) {
      result = result.filter((c) => c.institutionId === filters.institutionId);
    }

    if (filters.bureau && filters.bureau !== 'ALL') {
      result = result.filter((c) => c.bureauId === filters.bureau);
    }

    if (filters.status && filters.status !== 'ALL') {
      result = result.filter((c) => c.status === filters.status);
    }

    if (filters.category && filters.category !== 'ALL') {
      result = result.filter((c) => c.category === filters.category);
    }

    if (filters.overdueOnly) {
      result = result.filter((c) => c.isOverdue);
    }

    if (filters.overlapOnly) {
      result = result.filter((c) => c.crossBureauFlag);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.institutionName.toLowerCase().includes(q) ||
          c.aisheCode.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public getCaseById(id: string): CaseComplaint | undefined {
    return this.cases.find((c) => c.id === id);
  }

  public updateCaseStatus(
    caseId: string,
    newStatus: CaseStatus,
    actorName: string,
    actorBureau: BureauCode,
    notes: string
  ): boolean {
    const targetCase = this.cases.find((c) => c.id === caseId);
    if (!targetCase) return false;

    targetCase.status = newStatus;
    const newEvent: TimelineEvent = {
      id: `EVT-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: actorName,
      bureau: actorBureau,
      action: `Status altered to ${newStatus.replace(/_/g, ' ')}`,
      notes,
      type: 'STATUS_CHANGE',
    };

    targetCase.timeline.unshift(newEvent);
    this.saveToStorage();
    return true;
  }

  public addTimelineEvent(caseId: string, event: Omit<TimelineEvent, 'id' | 'caseId' | 'timestamp'>): boolean {
    const targetCase = this.cases.find((c) => c.id === caseId);
    if (!targetCase) return false;

    const fullEvent: TimelineEvent = {
      ...event,
      id: `EVT-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
    };

    targetCase.timeline.unshift(fullEvent);
    this.saveToStorage();
    return true;
  }

  // --- Institution queries ---
  public getInstitutions(filters?: {
    search?: string;
    riskRating?: string;
    state?: string;
  }): Institution[] {
    let result = [...this.institutions];

    if (!filters) return result;

    if (filters.riskRating && filters.riskRating !== 'ALL') {
      result = result.filter((i) => i.riskRating === filters.riskRating);
    }

    if (filters.state && filters.state !== 'ALL') {
      result = result.filter((i) => i.state.toLowerCase() === filters.state?.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.aisheCode.toLowerCase().includes(q) ||
          i.district.toLowerCase().includes(q) ||
          i.state.toLowerCase().includes(q) ||
          (i.aictePermanentId && i.aictePermanentId.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public getInstitutionById(id: string): Institution | undefined {
    return this.institutions.find((i) => i.id === id);
  }

  // --- Overlap queries & triage mutations ---
  public getOverlaps(filters?: {
    status?: OverlapStatus | 'ALL';
    matchType?: string;
    search?: string;
  }): CaseOverlap[] {
    let result = [...this.overlaps];

    if (!filters) return result;

    if (filters.status && filters.status !== 'ALL') {
      result = result.filter((o) => o.status === filters.status);
    }

    if (filters.matchType && filters.matchType !== 'ALL') {
      result = result.filter((o) => o.matchType === filters.matchType);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.sourceCaseId.toLowerCase().includes(q) ||
          o.targetCaseId.toLowerCase().includes(q) ||
          o.institutionName.toLowerCase().includes(q) ||
          o.reasons.some((r) => r.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public getOverlapById(id: string): CaseOverlap | undefined {
    return this.overlaps.find((o) => o.id === id);
  }

  public triageOverlap(
    overlapId: string,
    status: OverlapStatus,
    reviewerNotes: string,
    reviewerName: string = 'Authorized Bureau Officer'
  ): boolean {
    const ovl = this.overlaps.find((o) => o.id === overlapId);
    if (!ovl) return false;

    ovl.status = status;
    ovl.reviewerNotes = reviewerNotes;
    ovl.reviewedAt = new Date().toISOString();
    ovl.reviewedBy = reviewerName;

    // If joint inquiry initiated, update the involved cases
    if (status === 'JOINT_INQUIRY_INITIATED') {
      this.updateCaseStatus(
        ovl.sourceCaseId,
        'JOINT_INQUIRY',
        reviewerName,
        ovl.sourceBureau,
        `Cross-bureau Joint Inquiry initiated via CasePulse with ${ovl.targetBureau}. Reference Overlap: ${overlapId}. Notes: ${reviewerNotes}`
      );
      this.updateCaseStatus(
        ovl.targetCaseId,
        'JOINT_INQUIRY',
        reviewerName,
        ovl.targetBureau,
        `Cross-bureau Joint Inquiry initiated via CasePulse with ${ovl.sourceBureau}. Reference Overlap: ${overlapId}. Notes: ${reviewerNotes}`
      );
    }

    this.saveToStorage();
    return true;
  }

  // --- Reset demo data ---
  public resetToDefault() {
    if (this.isBrowser) {
      localStorage.removeItem('casepulse_overlaps');
      localStorage.removeItem('casepulse_cases');
    }
    this.institutions = [...INSTITUTIONS];
    this.cases = [...CASES];
    this.overlaps = detectCrossBureauOverlaps(this.cases, this.institutions);
  }

  // --- PostgreSQL DDL Export (For clean Python/FastAPI backend handoff) ---
  public getPostgresSchema(): string {
    return `-- CASEPULSE: SIH 2026 Problem Statement 26264
-- PostgreSQL Relational Schema for Inter-Bureau Complaint Correlation

CREATE TABLE IF NOT EXISTS bureaus (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100) NOT NULL,
    department VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(255) NOT NULL,
    contact_officer VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS institutions (
    id VARCHAR(50) PRIMARY KEY,
    aishe_code VARCHAR(50) UNIQUE NOT NULL,
    aicte_permanent_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    affiliated_university VARCHAR(255) NOT NULL,
    established_year INT,
    approved_intake INT,
    risk_rating VARCHAR(20) DEFAULT 'LOW'
);

CREATE TABLE IF NOT EXISTS case_complaints (
    id VARCHAR(50) PRIMARY KEY,
    bureau_id VARCHAR(50) REFERENCES bureaus(id),
    institution_id VARCHAR(50) REFERENCES institutions(id),
    aishe_code VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL,
    complainant_type VARCHAR(50) NOT NULL,
    filing_date TIMESTAMPTZ NOT NULL,
    sla_due_date TIMESTAMPTZ NOT NULL,
    is_overdue BOOLEAN DEFAULT FALSE,
    assigned_officer_name VARCHAR(255),
    assigned_officer_email VARCHAR(255),
    evidence_files_count INT DEFAULT 0,
    cross_bureau_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_timeline_events (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES case_complaints(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    actor VARCHAR(255) NOT NULL,
    bureau_id VARCHAR(50) REFERENCES bureaus(id),
    action VARCHAR(255) NOT NULL,
    notes TEXT,
    event_type VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS case_overlaps (
    id VARCHAR(50) PRIMARY KEY,
    source_case_id VARCHAR(50) REFERENCES case_complaints(id),
    target_case_id VARCHAR(50) REFERENCES case_complaints(id),
    source_bureau_id VARCHAR(50) REFERENCES bureaus(id),
    target_bureau_id VARCHAR(50) REFERENCES bureaus(id),
    institution_id VARCHAR(50) REFERENCES institutions(id),
    match_type VARCHAR(50) NOT NULL,
    confidence_score INT NOT NULL,
    flagged_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'UNREVIEWED',
    reasons JSONB NOT NULL,
    evidence_matches JSONB NOT NULL,
    recommended_action TEXT,
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255)
);

CREATE INDEX idx_case_aishe ON case_complaints(aishe_code);
CREATE INDEX idx_case_bureau ON case_complaints(bureau_id);
CREATE INDEX idx_case_status ON case_complaints(status);
CREATE INDEX idx_overlap_cases ON case_overlaps(source_case_id, target_case_id);
`;
  }
}

// Export singleton instance
export const dataStore = new CasePulseService();
