// CASEPULSE: Deterministic Cross-Bureau Overlap Detection Engine
// SIH 2026 Problem Statement 26264
// Modular, explainable correlation without black-box hallucination

import {
  CaseComplaint,
  CaseOverlap,
  EvidenceMatchPoint,
  Institution,
  OverlapMatchType,
} from '@/types';

/** Initial deterministic policy; thresholds are operational defaults, not validated optima. */
export const CORRELATION_POLICY = Object.freeze({
  institutionNameSimilarityThreshold: 0.75,
  temporalWindowDays: 60,
  verificationRecommendationScoreThreshold: 75,
});

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type ValidatedFilingDate = {
  value: string;
  timestamp: number;
  isoString: string;
};

function validateFilingDate(value: string | undefined): ValidatedFilingDate | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$/i.exec(value);
  if (!isoDate) return undefined;

  const [, year, month, day] = isoDate;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    calendarDate.getUTCFullYear() !== Number(year) ||
    calendarDate.getUTCMonth() !== Number(month) - 1 ||
    calendarDate.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;

  const date = new Date(timestamp);
  return { value, timestamp, isoString: date.toISOString() };
}

function getFlaggedDate(
  dateA?: ValidatedFilingDate,
  dateB?: ValidatedFilingDate
): string {
  if (dateA && dateB) {
    return dateA.timestamp >= dateB.timestamp ? dateA.isoString : dateB.isoString;
  }
  return dateA?.isoString ?? dateB?.isoString ?? '';
}

/**
 * Normalizes an institution name for deterministic fuzzy token matching
 */
export function normalizeInstitutionName(rawName: string): string {
  if (!rawName) return '';

  const stopWords = new Set([
    'THE',
    'OF',
    'AND',
    '&',
    'FOR',
    'IN',
    'INSTITUTE',
    'COLLEGE',
    'ACADEMY',
    'UNIVERSITY',
    'CAMPUS',
    'EDUCATION',
    'EDUCATIONAL',
    'TRUST',
    'SOCIETY',
    'FOUNDATION',
    'TECHNOLOGY',
    'ENGINEERING',
    'MANAGEMENT',
    'STUDIES',
    'SCIENCES',
    'RESEARCH',
  ]);

  return rawName
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .sort()
    .join(' ');
}

/**
 * Simple token Jaccard similarity for normalized strings
 */
function tokenSimilarity(strA: string, strB: string): number {
  const setA = new Set(strA.split(' ').filter(Boolean));
  const setB = new Set(strB.split(' ').filter(Boolean));

  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Category co-occurrence risk mapping (predatory practices often coincide across bureaus)
 */
const RELATED_CATEGORIES: Record<string, string[]> = {
  CAPITATION_FEE: ['WITHHOLDING_DOCUMENTS', 'UNAPPROVED_COURSES', 'EXAM_MALPRACTICE'],
  WITHHOLDING_DOCUMENTS: ['CAPITATION_FEE', 'RAGGING_HARASSMENT'],
  GHOST_FACULTY: ['INFRASTRUCTURE_DEFICIT', 'FALSE_ACCREDITATION', 'UNAPPROVED_COURSES'],
  UNAPPROVED_COURSES: ['FALSE_ACCREDITATION', 'CAPITATION_FEE', 'GHOST_FACULTY'],
  RAGGING_HARASSMENT: ['WITHHOLDING_DOCUMENTS', 'INFRASTRUCTURE_DEFICIT'],
  FALSE_ACCREDITATION: ['GHOST_FACULTY', 'UNAPPROVED_COURSES'],
  INFRASTRUCTURE_DEFICIT: ['GHOST_FACULTY', 'UNAPPROVED_COURSES'],
};

/**
 * Generates explainable evidence points for two cases
 */
function buildEvidenceMatches(
  caseA: CaseComplaint,
  caseB: CaseComplaint,
  instA?: Institution,
  instB?: Institution,
  filingDateA?: ValidatedFilingDate,
  filingDateB?: ValidatedFilingDate
): EvidenceMatchPoint[] {
  const points: EvidenceMatchPoint[] = [];

  // 1. AISHE Identifier Check
  const aisheMatch =
    caseA.aisheCode &&
    caseB.aisheCode &&
    caseA.aisheCode.trim().toUpperCase() === caseB.aisheCode.trim().toUpperCase();

  points.push({
    key: 'aishe_code',
    label: 'All-India AISHE Code',
    sourceVal: caseA.aisheCode || 'N/A',
    targetVal: caseB.aisheCode || 'N/A',
    isMatch: Boolean(aisheMatch),
    significance: 'CRITICAL',
    description: aisheMatch
      ? `Exact AISHE match (${caseA.aisheCode}): Confirms the complaints target the identical registered higher educational institution.`
      : 'Different or missing AISHE registration codes.',
  });

  // 2. AICTE Permanent ID (if present in institution master)
  const aicteA = instA?.aictePermanentId;
  const aicteB = instB?.aictePermanentId;
  if (aicteA || aicteB) {
    const aicteMatch = aicteA && aicteB && aicteA === aicteB;
    points.push({
      key: 'aicte_permanent_id',
      label: 'AICTE Permanent Portal ID',
      sourceVal: aicteA || 'Not linked',
      targetVal: aicteB || 'Not linked',
      isMatch: Boolean(aicteMatch),
      significance: 'CRITICAL',
      description: aicteMatch
        ? `Identical AICTE Institute ID (${aicteA}): Corroborates unified institutional entity.`
        : 'Different or unlinked AICTE portal IDs.',
    });
  }

  // 3. Institution Name Comparison
  const nameA = typeof caseA.institutionName === 'string' ? caseA.institutionName : '';
  const nameB = typeof caseB.institutionName === 'string' ? caseB.institutionName : '';
  const normA = normalizeInstitutionName(nameA);
  const normB = normalizeInstitutionName(nameB);
  const sim = tokenSimilarity(normA, normB);
  const nameExact =
    nameA.trim().length > 0 &&
    nameB.trim().length > 0 &&
    nameA.trim().toLowerCase() === nameB.trim().toLowerCase();

  points.push({
    key: 'institution_name',
    label: 'Institutional Name Analysis',
    sourceVal: nameA,
    targetVal: nameB,
    isMatch:
      nameExact ||
      (normA.length > 0 &&
        normB.length > 0 &&
        sim >= CORRELATION_POLICY.institutionNameSimilarityThreshold),
    significance: 'SUPPORTING',
    description: nameExact
      ? 'Exact nominal match across both bureau registers.'
      : sim >= CORRELATION_POLICY.institutionNameSimilarityThreshold
      ? `High token similarity (${Math.round(sim * 100)}%) after removing legal suffixes.`
      : 'Institutional names differ significantly.',
  });

  // 4. District and Geographic Jurisdiction
  if (instA && instB) {
    const geoMatch =
      instA.state.toLowerCase() === instB.state.toLowerCase() &&
      instA.district.toLowerCase() === instB.district.toLowerCase();

    points.push({
      key: 'geography',
      label: 'State & District Jurisdiction',
      sourceVal: `${instA.district}, ${instA.state}`,
      targetVal: `${instB.district}, ${instB.state}`,
      isMatch: geoMatch,
      significance: 'SUPPORTING',
      description: geoMatch
        ? `Both filings situated in same district (${instA.district}, ${instA.state}), ruling out cross-state homonyms.`
        : 'Filings belong to different geographical jurisdictions.',
    });
  }

  // 5. Category Synergy
  const isSameCat = caseA.category === caseB.category;
  const isRelatedCat = (RELATED_CATEGORIES[caseA.category] || []).includes(caseB.category);

  points.push({
    key: 'category_correlation',
    label: 'Grievance Category Pattern',
    sourceVal: caseA.category.replace(/_/g, ' '),
    targetVal: caseB.category.replace(/_/g, ' '),
    isMatch: isSameCat || isRelatedCat,
    significance: 'CONTEXTUAL',
    description: isSameCat
      ? `Concurrent identical violation category: ${caseA.category.replace(/_/g, ' ')}.`
      : isRelatedCat
      ? `Recognized predatory correlation: ${caseA.category.replace(/_/g, ' ')} frequently co-occurs with ${caseB.category.replace(/_/g, ' ')}.`
      : 'Disparate complaint categories without known operational correlation.',
  });

  // 6. Temporal Proximity (days between filing)
  const differenceMs =
    filingDateA && filingDateB
      ? Math.abs(filingDateA.timestamp - filingDateB.timestamp)
      : undefined;
  const diffDays =
    differenceMs === undefined ? undefined : Math.floor(differenceMs / DAY_IN_MILLISECONDS);
  const withinTemporalWindow =
    differenceMs !== undefined &&
    differenceMs <= CORRELATION_POLICY.temporalWindowDays * DAY_IN_MILLISECONDS;

  points.push({
    key: 'temporal_proximity',
    label: 'Filing Timeline Proximity',
    sourceVal: filingDateA?.isoString.split('T')[0] ?? (caseA.filingDate || 'Invalid or missing date'),
    targetVal: filingDateB?.isoString.split('T')[0] ?? (caseB.filingDate || 'Invalid or missing date'),
    isMatch: withinTemporalWindow,
    significance: 'CONTEXTUAL',
    description:
      differenceMs === undefined
        ? 'Filing date is invalid or missing; temporal comparison is unavailable.'
        : withinTemporalWindow
          ? `Filed within ${diffDays} days of each other (active concurrent window).`
          : `Filed ${diffDays} days apart (historical sequence).`,
  });

  return points;
}

/**
 * Deterministic cross-bureau overlap detection
 */
export function detectCrossBureauOverlaps(
  cases: CaseComplaint[],
  institutions: Institution[]
): CaseOverlap[] {
  const overlaps: CaseOverlap[] = [];
  const instMap = new Map<string, Institution>();
  institutions.forEach((inst) => instMap.set(inst.id, inst));

  // Compare every distinct pair of cases originating from different bureaus
  for (let i = 0; i < cases.length; i++) {
    for (let j = i + 1; j < cases.length; j++) {
      const caseA = cases[i];
      const caseB = cases[j];

      // Validate once before candidate scoring/evidence and never perform date arithmetic on invalid values.
      const filingDateA = validateFilingDate(caseA.filingDate);
      const filingDateB = validateFilingDate(caseB.filingDate);

      // Cross-bureau only: complaints within the same bureau are routine internal caseload
      if (caseA.bureauId === caseB.bureauId) {
        continue;
      }

      const instA = instMap.get(caseA.institutionId);
      const instB = instMap.get(caseB.institutionId);

      const exactAisheMatch =
        caseA.aisheCode &&
        caseB.aisheCode &&
        caseA.aisheCode.trim().toUpperCase() === caseB.aisheCode.trim().toUpperCase();

      const exactAicteMatch =
        instA?.aictePermanentId &&
        instB?.aictePermanentId &&
        instA.aictePermanentId === instB.aictePermanentId;

      const nameA = typeof caseA.institutionName === 'string' ? caseA.institutionName : '';
      const nameB = typeof caseB.institutionName === 'string' ? caseB.institutionName : '';
      const normA = normalizeInstitutionName(nameA);
      const normB = normalizeInstitutionName(nameB);
      const nameSim = tokenSimilarity(normA, normB);
      const sameName =
        nameA.trim().length > 0 &&
        nameB.trim().length > 0 &&
        nameA.trim().toLowerCase() === nameB.trim().toLowerCase();

      const isSameInst = exactAisheMatch || exactAicteMatch || sameName;
      const isHighFuzzyMatch =
        !isSameInst &&
        normA.length > 0 &&
        normB.length > 0 &&
        nameSim >= CORRELATION_POLICY.institutionNameSimilarityThreshold;

      // Check if candidate qualifies as an overlap
      if (!isSameInst && !isHighFuzzyMatch) {
        continue;
      }

      // Compute confidence score deterministically
      let confidenceScore = 0;
      let matchType: OverlapMatchType = 'HIGH_PROBABILITY_NAME';
      const reasons: string[] = [];

      if (exactAisheMatch) {
        confidenceScore += 70;
        matchType = 'CONFIRMED_ID';
        reasons.push(`Exact AISHE Code Match (${caseA.aisheCode}) verified across both administrative bureaus.`);
      } else if (exactAicteMatch) {
        confidenceScore += 65;
        matchType = 'CONFIRMED_ID';
        reasons.push(`Exact AICTE Permanent Portal ID match (${instA?.aictePermanentId}).`);
      } else if (sameName) {
        confidenceScore += 50;
        reasons.push('Exact legal institution name match across bureau registers.');
      } else if (isHighFuzzyMatch) {
        confidenceScore += 40;
        matchType = 'HIGH_PROBABILITY_NAME';
        reasons.push(`High token similarity (${Math.round(nameSim * 100)}%) on normalized institutional titles.`);
      }

      // Same District / State bonus
      if (instA && instB && instA.district === instB.district && instA.state === instB.state) {
        confidenceScore += 15;
        reasons.push(`Identical geographic jurisdiction: ${instA.district}, ${instA.state}.`);
      }

      // Category pattern correlation bonus
      const isSameCategory = caseA.category === caseB.category;
      const isRelatedCategory = (RELATED_CATEGORIES[caseA.category] || []).includes(caseB.category);

      if (isSameCategory) {
        confidenceScore += 10;
        reasons.push(`Same violation category: ${caseA.category.replace(/_/g, ' ')}.`);
      } else if (isRelatedCategory) {
        confidenceScore += 8;
        matchType = matchType === 'CONFIRMED_ID' ? 'CONFIRMED_ID' : 'PATTERN_CORRELATION';
        reasons.push(`Co-occurring predatory risk pattern (${caseA.category.replace(/_/g, ' ')} + ${caseB.category.replace(/_/g, ' ')}).`);
      }

      // Temporal proximity bonus
      const differenceMs =
        filingDateA && filingDateB
          ? Math.abs(filingDateA.timestamp - filingDateB.timestamp)
          : undefined;
      const diffDays =
        differenceMs === undefined ? undefined : Math.floor(differenceMs / DAY_IN_MILLISECONDS);
      if (
        differenceMs !== undefined &&
        differenceMs <= CORRELATION_POLICY.temporalWindowDays * DAY_IN_MILLISECONDS
      ) {
        confidenceScore += 5;
        reasons.push(`Filings occurred within ${diffDays} days of each other (concurrent inquiry period).`);
      }
      if (differenceMs === undefined) {
        reasons.push('Temporal evidence unavailable because one or both filing dates are invalid or missing.');
      }

      // Cap at 100
      confidenceScore = Math.min(100, confidenceScore);

      // Determine recommended action
      let recommendedAction = '';
      if (matchType === 'CONFIRMED_ID') {
        recommendedAction =
          'Initiate joint coordination hearing; pause unilateral approval/clearance until cross-bureau review is complete.';
      } else if (confidenceScore >= CORRELATION_POLICY.verificationRecommendationScoreThreshold) {
        recommendedAction =
          'Request AISHE/PAN verification from submitting bureau to confirm entity identity before formal summons.';
      } else {
        recommendedAction =
          'Review institution branch location; verify whether complaints refer to the main campus or an affiliate extension center.';
      }

      const evidenceMatches = buildEvidenceMatches(
        caseA,
        caseB,
        instA,
        instB,
        filingDateA,
        filingDateB
      );

      // Generate a reproducible overlap ID
      const overlapId = `OVL-${caseA.id.replace('CP-', '')}-${caseB.id.replace('CP-', '')}`;

      overlaps.push({
        id: overlapId,
        sourceCaseId: caseA.id,
        targetCaseId: caseB.id,
        sourceBureau: caseA.bureauId,
        targetBureau: caseB.bureauId,
        institutionId: caseA.institutionId,
        institutionName: caseA.institutionName,
        matchType,
        confidenceScore,
        flaggedDate: getFlaggedDate(filingDateA, filingDateB),
        status: 'UNREVIEWED',
        reasons,
        evidenceMatches,
        recommendedAction,
      });
    }
  }

  // Sort by confidence score descending
  return overlaps.sort((a, b) => b.confidenceScore - a.confidenceScore);
}
