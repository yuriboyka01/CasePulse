// CASEPULSE: SIH 2026 Problem Statement 26264
// TypeScript Domain Models (PostgreSQL-compatible)

export type BureauCode =
  | 'AICTE_APPROVAL'
  | 'UGC_VIGILANCE'
  | 'STATE_DTE_MAHA'
  | 'STATE_DTE_KAR'
  | 'NARC_ANTI_RAGGING'
  | 'CONSUMER_FORUM';

export interface Bureau {
  id: BureauCode;
  name: string;
  shortName: string;
  department: string;
  jurisdiction: string;
  contactOfficer: string;
  contactEmail: string;
  badgeColor: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
}

export type InstitutionCategory =
  | 'ENGINEERING'
  | 'MANAGEMENT'
  | 'UNIVERSITY'
  | 'POLYTECHNIC'
  | 'PHARMACY'
  | 'MEDICAL';

export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Institution {
  id: string; // UUID or synthetic ID (e.g. "INST-001")
  aisheCode: string; // All India Survey on Higher Education Code (e.g. "C-19842")
  aictePermanentId?: string; // AICTE Permanent Institute ID (e.g. "1-7281920")
  name: string;
  normalizedName: string; // Upper-cased, normalized punctuation & stop-words for deterministic matching
  category: InstitutionCategory;
  state: string;
  district: string;
  pincode: string;
  address: string;
  affiliatedUniversity: string;
  establishedYear: number;
  approvedIntake: number;
  riskRating: RiskRating;
  activeCasesCount: number;
  totalCasesCount: number;
  bureauInvolvement: BureauCode[];
}

export type ComplaintCategory =
  | 'CAPITATION_FEE'
  | 'WITHHOLDING_DOCUMENTS'
  | 'GHOST_FACULTY'
  | 'RAGGING_HARASSMENT'
  | 'INFRASTRUCTURE_DEFICIT'
  | 'UNAPPROVED_COURSES'
  | 'EXAM_MALPRACTICE'
  | 'FALSE_ACCREDITATION';

export type CaseStatus =
  | 'NEW'
  | 'UNDER_INVESTIGATION'
  | 'HEARING_SCHEDULED'
  | 'ACTION_PENDING'
  | 'JOINT_INQUIRY'
  | 'RESOLVED'
  | 'CLOSED';

export type CaseSeverity = 'ROUTINE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export type ComplainantType =
  | 'STUDENT'
  | 'FACULTY'
  | 'PARENT'
  | 'WHISTLEBLOWER'
  | 'ANONYMOUS';

export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: string; // ISO 8601
  actor: string;
  bureau: BureauCode;
  action: string;
  notes: string;
  type:
    | 'FILING'
    | 'STATUS_CHANGE'
    | 'HEARING'
    | 'NOTICE_ISSUED'
    | 'OVERLAP_FLAG'
    | 'INTER_BUREAU_SYNC'
    | 'PENALTY_ISSUED'
    | 'CLOSURE';
}

export interface CaseComplaint {
  id: string; // e.g. "CP-2026-0842"
  bureauId: BureauCode;
  institutionId: string;
  institutionName: string;
  aisheCode: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  severity: CaseSeverity;
  status: CaseStatus;
  complainantType: ComplainantType;
  filingDate: string; // ISO 8601
  slaDueDate: string; // ISO 8601
  isOverdue: boolean;
  daysOpen: number;
  assignedOfficer: {
    id?: string;
    name: string;
    designation: string;
    email?: string;
  };
  evidenceFilesCount: number;
  crossBureauFlag: boolean;
  overlapIds: string[];
  timeline: TimelineEvent[];
  actionHistory?: Array<{
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
  }>;
  isSynthetic?: boolean;
}

export type OverlapMatchType =
  | 'CONFIRMED_ID' // Exact AISHE Code or AICTE Permanent ID match across different bureaus
  | 'HIGH_PROBABILITY_NAME' // High normalized string similarity + same district/pincode
  | 'PATTERN_CORRELATION'; // Same category of predatory practices across different complaint types within active window

export type RelationshipKind = 'SAME_INSTITUTION' | 'RELATED_INCIDENT' | 'POTENTIAL_DUPLICATE_COMPLAINT';

export type OverlapStatus =
  | 'UNREVIEWED'
  | 'CONFIRMED'
  | 'DISMISSED_FALSE_POSITIVE'
  | 'JOINT_INQUIRY_INITIATED'
  | 'PROPOSED'
  | 'REJECTED'
  | 'FURTHER_COORDINATION';

export type RelationshipStatus =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FURTHER_COORDINATION';

export type ReviewDecision = 'CONFIRMED' | 'REJECTED' | 'FURTHER_COORDINATION';

export interface EvidenceMatchPoint {
  key: string;
  label: string;
  sourceVal?: string;
  sourceValue?: string;
  targetVal?: string;
  targetValue?: string;
  isMatch: boolean;
  significance: 'CRITICAL' | 'SUPPORTING' | 'CONTEXTUAL';
  description: string;
}

export interface CaseOverlap {
  id: string; // e.g. "OVL-901"
  sourceCaseId: string;
  targetCaseId: string;
  sourceBureau: BureauCode;
  targetBureau: BureauCode;
  sourceCaseTitle?: string;
  sourceCaseCategory?: ComplaintCategory;
  sourceCaseStatus?: CaseStatus;
  sourceFilingDate?: string;
  sourceSlaDueDate?: string;
  targetCaseTitle?: string;
  targetCaseCategory?: ComplaintCategory;
  targetCaseStatus?: CaseStatus;
  targetFilingDate?: string;
  targetSlaDueDate?: string;
  institutionId: string;
  institutionName: string;
  relationshipKind?: RelationshipKind;
  matchType: OverlapMatchType;
  confidenceScore: number; // 0 - 100
  flaggedDate: string;
  flaggedAt?: string;
  status: OverlapStatus;
  reasons: string[];
  evidenceMatches: EvidenceMatchPoint[];
  recommendedAction: string;
  reviewerNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  version?: number;
  latestDecision?: {
    decision: ReviewDecision | string;
    notes: string;
    reviewedAt: string;
    reviewer: { id: string; displayName: string; bureauId: BureauCode };
  } | null;
  isSynthetic?: boolean;
}

export interface OperationalMetrics {
  totalCases: number;
  pendingCases: number;
  overdueCases: number;
  criticalCases: number;
  activeInstitutions: number;
  repeatOffenderInstitutions: number;
  flaggedOverlapsCount: number;
  unresolvedOverlapsCount: number;
  jointInquiriesActive: number;
  bureauCounts: Record<BureauCode, number>;
}
