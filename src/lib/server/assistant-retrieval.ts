import 'server-only';
import type { AssistantContext, AssistantSource } from '@/lib/assistant-types';
import { ApiError } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';
import { parseId } from '@/lib/server/validation';
import type { Actor } from '@/lib/server/types';
import type { AssistantEvidence } from '@/lib/server/ai/provider';

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'among', 'and', 'are', 'been', 'before', 'between', 'both', 'case', 'cases',
  'could', 'find', 'from', 'have', 'help', 'into', 'institution', 'institutions', 'involving', 'latest', 'list',
  'more', 'most', 'other', 'please', 'related', 'relationship', 'relationships', 'show', 'summarize', 'that', 'the',
  'their', 'there', 'these', 'this', 'those', 'what', 'when', 'where', 'which', 'with', 'would', 'why', 'within',
]);

export interface RetrievedAssistantEvidence {
  evidence: AssistantEvidence;
  sources: AssistantSource[];
}

function cleanText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function caseEvidence(row: Record<string, unknown>) {
  return {
    id: row.id,
    bureau: row.bureauId,
    title: cleanText(row.title, 300),
    description: cleanText(row.description, 1_200),
    institutionId: row.institutionId,
    institutionName: cleanText(row.institutionName, 300),
    aisheCode: cleanText(row.aisheCode, 80),
    category: row.category,
    severity: row.severity,
    status: row.status,
    filingDate: row.filingDate,
    slaDueDate: row.slaDueDate,
    isOverdue: row.isOverdue,
    daysOpen: row.daysOpen,
    evidenceFilesCount: row.evidenceFilesCount,
    crossBureauFlag: row.crossBureauFlag,
    isSynthetic: row.isSynthetic,
    actions: Array.isArray(row.actionHistory)
      ? (row.actionHistory as Array<Record<string, unknown>>).slice(0, 5).map((action) => ({
          date: action.occurredAt,
          type: action.type,
          action: cleanText(action.action, 200),
          bureau: action.bureauId,
        }))
      : [],
  };
}

function institutionEvidence(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: cleanText(row.name, 300),
    aisheCode: cleanText(row.aisheCode, 80),
    aictePermanentId: cleanText(row.aictePermanentId, 80),
    category: row.category,
    state: cleanText(row.state, 100),
    district: cleanText(row.district, 100),
    riskRating: row.riskRating,
    activeCasesCount: row.activeCasesCount,
    totalCasesCount: row.totalCasesCount,
    bureauInvolvement: row.bureauInvolvement,
    isSynthetic: row.isSynthetic,
  };
}

function relationshipEvidence(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceCaseId: row.sourceCaseId,
    targetCaseId: row.targetCaseId,
    sourceBureau: row.sourceBureau,
    targetBureau: row.targetBureau,
    sourceCaseTitle: cleanText(row.sourceCaseTitle, 300),
    targetCaseTitle: cleanText(row.targetCaseTitle, 300),
    institutionId: row.institutionId,
    institutionName: cleanText(row.institutionName, 300),
    relationshipKind: row.relationshipKind,
    matchType: row.matchType,
    confidenceScore: row.confidenceScore,
    status: row.status,
    reasons: Array.isArray(row.reasons) ? row.reasons.slice(0, 8).map((item) => cleanText(item, 300)).filter(Boolean) : [],
    evidenceMatches: Array.isArray(row.evidenceMatches)
      ? (row.evidenceMatches as Array<Record<string, unknown>>).slice(0, 8).map((match) => ({
          label: cleanText(match.label, 150),
          isMatch: match.isMatch,
          significance: match.significance,
          description: cleanText(match.description, 300),
        }))
      : [],
    recommendedAction: cleanText(row.recommendedAction, 300),
    latestDecision: row.latestDecision && typeof row.latestDecision === 'object'
      ? {
          decision: (row.latestDecision as Record<string, unknown>).decision,
          reviewedAt: (row.latestDecision as Record<string, unknown>).reviewedAt,
        }
      : null,
    isSynthetic: row.isSynthetic,
  };
}

function buildSources(evidence: AssistantEvidence): AssistantSource[] {
  const sources: AssistantSource[] = [];
  for (const item of evidence.cases as Array<Record<string, unknown>>) {
    if (typeof item.id === 'string') sources.push({ id: item.id, type: 'case', label: `${item.id}: ${cleanText(item.title, 90) ?? 'Case record'}`, href: `/cases/${encodeURIComponent(item.id)}` });
  }
  for (const item of evidence.institutions as Array<Record<string, unknown>>) {
    if (typeof item.id === 'string') sources.push({ id: item.id, type: 'institution', label: cleanText(item.name, 120) ?? item.id, href: `/institutions/${encodeURIComponent(item.id)}` });
  }
  for (const item of evidence.relationships as Array<Record<string, unknown>>) {
    if (typeof item.id === 'string') sources.push({ id: item.id, type: 'relationship', label: `${item.id}: ${cleanText(item.relationshipKind, 80) ?? 'Recorded relationship'}`, href: `/overlaps?search=${encodeURIComponent(item.id)}` });
  }
  const unique = new Map(sources.map((source) => [`${source.type}:${source.id}`, source]));
  return [...unique.values()].slice(0, 20);
}

function searchTerms(question: string): string[] {
  const terms = question
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term.toLowerCase()));
  return [...new Set(terms)].slice(0, 2);
}

export async function retrieveAssistantEvidence(
  question: string,
  context: AssistantContext | undefined,
  actor: Actor
): Promise<RetrievedAssistantEvidence> {
  const cases = new Map<string, Record<string, unknown>>();
  const institutions = new Map<string, Record<string, unknown>>();
  const relationships = new Map<string, Record<string, unknown>>();

  const addCase = (row: unknown) => {
    if (row && typeof row === 'object' && typeof (row as Record<string, unknown>).id === 'string') {
      const item = row as Record<string, unknown>;
      cases.set(String(item.id), caseEvidence(item));
    }
  };
  const addInstitution = (row: unknown) => {
    if (row && typeof row === 'object' && typeof (row as Record<string, unknown>).id === 'string') {
      const item = row as Record<string, unknown>;
      institutions.set(String(item.id), institutionEvidence(item));
    }
  };
  const addRelationship = (row: unknown) => {
    if (row && typeof row === 'object') {
      const item = row as Record<string, unknown>;
      const relationship = (item.overlap && typeof item.overlap === 'object' ? item.overlap : item) as Record<string, unknown>;
      if (typeof relationship.id === 'string') relationships.set(relationship.id, relationshipEvidence(relationship));
      if (item.relatedCase && typeof item.relatedCase === 'object') {
        const related = item.relatedCase as Record<string, unknown>;
        addCase({ id: related.id, bureauId: related.bureauId, title: related.title, status: related.status });
      }
    }
  };

  if (context?.caseId) {
    const id = parseId(context.caseId);
    const row = await repository.getCase(id, actor);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'The requested case was not found in your authorized scope.');
    addCase(row as unknown);
    const [related, institution] = await Promise.all([
      repository.getRelatedCases(id, actor),
      repository.getInstitution(String((row as Record<string, unknown>).institutionId), actor),
    ]);
    (related ?? []).forEach(addRelationship);
    addInstitution(institution);
  } else if (context?.institutionId) {
    const id = parseId(context.institutionId);
    const institution = await repository.getInstitution(id, actor);
    if (!institution) throw new ApiError(404, 'NOT_FOUND', 'The requested institution was not found in your authorized scope.');
    addInstitution(institution);
    const [caseRows, relationshipRows] = await Promise.all([
      repository.listCases({ page: 1, pageSize: 8, institutionId: id }, actor),
      repository.listOverlaps({ page: 1, pageSize: 8, institutionId: id }, actor),
    ]);
    caseRows.data.forEach(addCase);
    relationshipRows.data.forEach(addRelationship);
  } else {
    const explicitCaseId = question.match(/\b(?:CASE|CP)-[A-Z0-9_-]{2,}\b/i)?.[0];
    const explicitInstitutionId = question.match(/\bINST-[A-Z0-9_-]{2,}\b/i)?.[0];
    if (explicitCaseId) {
      const row = await repository.getCase(explicitCaseId, actor);
      if (row) {
        addCase(row as unknown);
        const related = await repository.getRelatedCases(explicitCaseId, actor);
        (related ?? []).forEach(addRelationship);
      }
    }
    if (explicitInstitutionId) {
      const row = await repository.getInstitution(explicitInstitutionId, actor);
      if (row) {
        addInstitution(row);
        const [caseRows, relationshipRows] = await Promise.all([
          repository.listCases({ page: 1, pageSize: 6, institutionId: explicitInstitutionId }, actor),
          repository.listOverlaps({ page: 1, pageSize: 6, institutionId: explicitInstitutionId }, actor),
        ]);
        caseRows.data.forEach(addCase);
        relationshipRows.data.forEach(addRelationship);
      }
    }

    const normalizedQuestion = question.toLowerCase();
    if (/(recent|latest|newest|most recent)/.test(normalizedQuestion)) {
      const rows = await repository.listCases({ page: 1, pageSize: 5 }, actor);
      rows.data.forEach(addCase);
    }
    if (/(overdue|sla|deadline|late cases)/.test(normalizedQuestion)) {
      const rows = await repository.listCases({ page: 1, pageSize: 8, overdueOnly: true }, actor);
      rows.data.forEach(addCase);
    }
    if (/(overlap|cross[- ]bureau|correlation|inter-bureau|relationship)/.test(normalizedQuestion)) {
      const rows = await repository.listOverlaps({ page: 1, pageSize: 8 }, actor);
      rows.data.forEach(addRelationship);
    }
    if (/(critical|high risk|high-risk)/.test(normalizedQuestion)) {
      const [caseRows, institutionRows] = await Promise.all([
        repository.listCases({ page: 1, pageSize: 30 }, actor),
        repository.listInstitutions({ page: 1, pageSize: 30 }, actor),
      ]);
      caseRows.data.filter((row) => String((row as Record<string, unknown>).severity).toUpperCase() === 'CRITICAL').forEach(addCase);
      institutionRows.data.filter((row) => String((row as Record<string, unknown>).riskRating).toUpperCase() === 'CRITICAL').forEach(addInstitution);
    }

    const terms = searchTerms(question);
    if (terms.length > 0 && cases.size + institutions.size + relationships.size < 12) {
      const results = await Promise.all(terms.map(async (term) => {
        const [caseRows, institutionRows, relationshipRows] = await Promise.all([
          repository.listCases({ page: 1, pageSize: 5, search: term }, actor),
          repository.listInstitutions({ page: 1, pageSize: 5, search: term }, actor),
          repository.listOverlaps({ page: 1, pageSize: 5, search: term }, actor),
        ]);
        return { caseRows, institutionRows, relationshipRows };
      }));
      for (const result of results) {
        result.caseRows.data.forEach(addCase);
        result.institutionRows.data.forEach(addInstitution);
        result.relationshipRows.data.forEach(addRelationship);
      }
    }
  }

  const evidence: AssistantEvidence = {
    cases: [...cases.values()].slice(0, 12),
    institutions: [...institutions.values()].slice(0, 8),
    relationships: [...relationships.values()].slice(0, 12),
  };
  return { evidence, sources: buildSources(evidence) };
}
