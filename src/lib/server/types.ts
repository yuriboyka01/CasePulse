export const BUREAU_CODES = [
  'AICTE_APPROVAL',
  'UGC_VIGILANCE',
  'STATE_DTE_MAHA',
  'STATE_DTE_KAR',
  'NARC_ANTI_RAGGING',
  'CONSUMER_FORUM',
] as const;

import type { CaseComplaint, CaseOverlap } from '@/types';

export type BureauCode = (typeof BUREAU_CODES)[number];
export type CaseStatus =
  | 'NEW'
  | 'UNDER_INVESTIGATION'
  | 'HEARING_SCHEDULED'
  | 'ACTION_PENDING'
  | 'JOINT_INQUIRY'
  | 'RESOLVED'
  | 'CLOSED';
export type RelationshipKind =
  | 'SAME_INSTITUTION'
  | 'RELATED_INCIDENT'
  | 'POTENTIAL_DUPLICATE_COMPLAINT';
export type RelationshipStatus =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FURTHER_COORDINATION';
export type ReviewDecision = 'CONFIRMED' | 'REJECTED' | 'FURTHER_COORDINATION';

export interface Actor {
  id: string;
  displayName: string;
  bureauCodes: BureauCode[];
  roles: string[];
  isDemo: boolean;
}

export interface DashboardSummary {
  asOf: string;
  totalCases: number;
  pendingCases: number;
  overdueCases: number;
  criticalCases: number;
  repeatOffenderInstitutions: number;
  flaggedOverlapsCount: number;
  unresolvedOverlapsCount: number;
  jointInquiriesActive: number;
  activeInstitutions: number;
  bureauCounts: Record<string, number>;
  dataSource: string;
  syntheticDemoData: boolean;
  syntheticRecordsPresent: boolean;
}

export interface DashboardOverview {
  summary: DashboardSummary;
  priorityCases: Omit<CaseComplaint, 'timeline'>[];
  pendingOverlaps: Omit<CaseOverlap, 'flaggedDate'>[];
  recentCases: Omit<CaseComplaint, 'timeline'>[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CaseFilters {
  page: number;
  pageSize: number;
  search?: string;
  bureau?: BureauCode;
  status?: CaseStatus;
  category?: string;
  institutionId?: string;
  overdueOnly?: boolean;
  overlapOnly?: boolean;
}

export interface InstitutionFilters {
  page: number;
  pageSize: number;
  search?: string;
  state?: string;
  riskRating?: string;
  bureau?: BureauCode;
}

export interface OverlapFilters {
  page: number;
  pageSize: number;
  status?: RelationshipStatus;
  matchType?: string;
  bureau?: BureauCode;
  institutionId?: string;
  search?: string;
}

export interface CollectionResult<T> {
  data: T[];
  meta: Pagination;
}
