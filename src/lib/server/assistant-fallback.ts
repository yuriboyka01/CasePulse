import type { RetrievedAssistantEvidence } from '@/lib/server/assistant-retrieval';

type EvidenceRow = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function buildLocalEvidenceAnswer(question: string, retrieved: RetrievedAssistantEvidence) {
  const cases = retrieved.evidence.cases as EvidenceRow[];
  const institutions = retrieved.evidence.institutions as EvidenceRow[];
  const relationships = retrieved.evidence.relationships as EvidenceRow[];
  const q = question.toLowerCase();
  const lines: string[] = [
    '### CASEPULSE Evidence-Based Response',
    'The external AI model is unavailable, so this answer uses records retrieved from your authorized database scope.',
    '',
  ];

  if (cases.length + institutions.length + relationships.length === 0) {
    lines.push(
      'I could not find matching records in your authorized scope for this question.',
      '',
      'Try a case ID (for example, CP-2026-0104), an institution name or AISHE code, or ask for recent cases, overdue cases, or cross-bureau overlaps.',
    );
    return { answer: lines.join('\n'), sources: retrieved.sources, counts: { cases: 0, institutions: 0, relationships: 0 } };
  }

  if (q.includes('overlap') || q.includes('cross-bureau') || q.includes('cross bureau') || q.includes('correlation') || q.includes('relationship')) {
    lines.push(`Found **${relationships.length} recorded relationship(s)** in the retrieved evidence. These are candidates for human review, not definitive findings.`, '');
    for (const row of relationships.slice(0, 8)) {
      lines.push(
        `- **${text(row.id)}**: ${text(row.institutionName) || 'Institution not recorded'} | ${text(row.sourceBureau)} ↔ ${text(row.targetBureau)} | Status: ${text(row.status)} | Confidence: ${row.confidenceScore ?? 'not recorded'}`,
        `  Evidence: ${Array.isArray(row.reasons) ? row.reasons.map(text).filter(Boolean).slice(0, 3).join('; ') || 'No rationale recorded' : 'No rationale recorded'}`,
      );
    }
  } else if (q.includes('overdue') || q.includes('sla') || q.includes('deadline') || q.includes('late')) {
    const overdue = cases.filter((row) => row.isOverdue === true);
    lines.push(`Found **${overdue.length} overdue case(s)** among the retrieved authorized records.`, '');
    for (const row of overdue.slice(0, 8)) {
      lines.push(`- **${text(row.id)}**: ${text(row.title)} | ${text(row.institutionName)} | Status: ${text(row.status)} | Due: ${text(row.slaDueDate)}`);
    }
    if (overdue.length === 0) lines.push('No overdue case was identified in the retrieved records. This is not proof that no overdue cases exist outside this result set.');
  } else {
    if (cases.length) {
      lines.push(`#### Cases (${cases.length})`);
      for (const row of cases.slice(0, 8)) {
        lines.push(`- **${text(row.id)}**: ${text(row.title)} | ${text(row.institutionName)} | Bureau: ${text(row.bureau)} | Status: ${text(row.status)} | Severity: ${text(row.severity)}`);
      }
    }
    if (institutions.length) {
      lines.push('', `#### Institutions (${institutions.length})`);
      for (const row of institutions.slice(0, 6)) {
        lines.push(`- **${text(row.name)}** (${text(row.id)}; AISHE: ${text(row.aisheCode) || 'not recorded'}) | Risk: ${text(row.riskRating) || 'not recorded'} | Active cases: ${row.activeCasesCount ?? 'not recorded'}`);
      }
    }
    if (relationships.length) {
      lines.push('', `#### Recorded relationships (${relationships.length})`);
      for (const row of relationships.slice(0, 6)) {
        lines.push(`- **${text(row.id)}**: ${text(row.institutionName)} | ${text(row.sourceBureau)} ↔ ${text(row.targetBureau)} | Status: ${text(row.status)}`);
      }
    }
  }

  lines.push('', 'Verify the linked source records before drawing conclusions or taking action.');
  return {
    answer: lines.join('\n'),
    sources: retrieved.sources,
    counts: { cases: cases.length, institutions: institutions.length, relationships: relationships.length },
  };
}
