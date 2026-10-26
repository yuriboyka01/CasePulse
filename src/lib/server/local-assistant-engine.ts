import 'server-only';
import type { AssistantContext, AssistantSource, AssistantTurn } from '@/lib/assistant-types';
import { BUREAUS, CASES, INSTITUTIONS } from '@/data/synthetic-dataset';
import { detectCrossBureauOverlaps } from '@/lib/correlation-engine';

export interface LocalAssistantResult {
  answer: string;
  sources: AssistantSource[];
  counts: {
    cases: number;
    institutions: number;
    relationships: number;
  };
}

export function runLocalRegulatoryIntelligenceEngine(
  messages: AssistantTurn[],
  context?: AssistantContext
): LocalAssistantResult {
  const latestMessage = messages[messages.length - 1];
  const question = latestMessage?.content ?? '';
  const q = question.toLowerCase().trim();

  const overlaps = detectCrossBureauOverlaps(CASES, INSTITUTIONS);
  const sources: AssistantSource[] = [];

  const addCaseSource = (caseId: string) => {
    const c = CASES.find((item) => item.id.toLowerCase() === caseId.toLowerCase());
    if (c && !sources.some((s) => s.id === c.id)) {
      sources.push({
        id: c.id,
        type: 'case',
        label: `${c.id}: ${c.title.slice(0, 75)}`,
        href: `/cases/${encodeURIComponent(c.id)}`,
      });
    }
  };

  const addInstitutionSource = (instId: string) => {
    const inst = INSTITUTIONS.find(
      (item) => item.id.toLowerCase() === instId.toLowerCase() || item.name.toLowerCase().includes(instId.toLowerCase())
    );
    if (inst && !sources.some((s) => s.id === inst.id)) {
      sources.push({
        id: inst.id,
        type: 'institution',
        label: `${inst.name} (${inst.aisheCode || inst.id})`,
        href: `/institutions/${encodeURIComponent(inst.id)}`,
      });
    }
  };

  const addOverlapSource = (overlapId: string) => {
    const ovl = overlaps.find((item) => item.id.toLowerCase() === overlapId.toLowerCase());
    if (ovl && !sources.some((s) => s.id === ovl.id)) {
      sources.push({
        id: ovl.id,
        type: 'relationship',
        label: `${ovl.id}: ${ovl.institutionName} (${ovl.sourceBureau} ↔ ${ovl.targetBureau})`,
        href: `/overlaps?search=${encodeURIComponent(ovl.id)}`,
      });
    }
  };

  // 1. Context-based handling if page context is present (Case or Institution)
  if (context?.caseId) {
    const c = CASES.find((item) => item.id.toLowerCase() === context.caseId!.toLowerCase());
    if (c) {
      addCaseSource(c.id);
      addInstitutionSource(c.institutionId);
      c.overlapIds.forEach(addOverlapSource);

      // 1a. SLA specific query on active docket
      if (q.includes('sla') || q.includes('due') || q.includes('deadline') || q.includes('overdue')) {
        const answer = [
          `### Statutory SLA Compliance: Docket [${c.id}](/cases/${c.id})`,
          `* **Statutory SLA Due Date:** **${new Date(c.slaDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}**`,
          `* **Compliance Status:** ${c.isOverdue ? '⚠️ **OVERDUE / BREACHED** — Mandated resolution timeline exceeded' : '✅ **ACTIVE COMPLIANCE WINDOW** — Within statutory timeframe'}`,
          `* **Investigation Duration:** **${c.daysOpen} days** elapsed since filing on ${new Date(c.filingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
          `* **Severity Classification:** \`${c.severity}\` | **Jurisdiction:** \`${c.bureauId}\``,
          `* **Assigned Case Officer:** **${c.assignedOfficer.name}** (${c.assignedOfficer.designation})`,
          '',
          c.isOverdue
            ? '⚠️ **Administrative Escalation Required:** This docket has exceeded statutory adjudication deadlines and requires immediate supervisory notice.'
            : 'ℹ️ **Timely Adjudication:** Preliminary evidentiary review is progressing within standard regulatory parameters.',
        ].join('\n');
        return {
          answer,
          sources,
          counts: { cases: 1, institutions: 1, relationships: c.overlapIds.length },
        };
      }

      // 1b. Officer query on active docket
      if (q.includes('officer') || q.includes('assigned') || q.includes('lead') || q.includes('who is') || q.includes('handling') || q.includes('investigator')) {
        const answer = [
          `### Assigned Case Officer: Docket [${c.id}](/cases/${c.id})`,
          `* **Lead Officer:** **${c.assignedOfficer.name}**`,
          `* **Designation:** ${c.assignedOfficer.designation}`,
          `* **Official Contact:** \`${c.assignedOfficer.email || 'officer@casepulse.gov.in'}\``,
          `* **Supervising Bureau:** \`${c.bureauId}\``,
          `* **Docket Status:** \`${c.status}\` (Severity: \`${c.severity}\`)`,
          `* **SLA Target:** Due ${new Date(c.slaDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} (${c.isOverdue ? '⚠️ OVERDUE' : 'ON TRACK'})`,
        ].join('\n');
        return {
          answer,
          sources,
          counts: { cases: 1, institutions: 1, relationships: 0 },
        };
      }

      // 1c. General or "this case" summary
      if (q === 'summarize this case' || q.includes('this case') || q.includes('summary') || q === 'details' || q === 'help') {
        const answer = [
          `### Case Docket Analysis: [${c.id}](/cases/${c.id})`,
          `**Title:** ${c.title}`,
          `**Target Institution:** ${c.institutionName} (AISHE: \`${c.aisheCode}\`)`,
          `**Originating Bureau:** ${c.bureauId} | **Severity:** \`${c.severity}\` | **Status:** \`${c.status}\``,
          `**Filing Date:** ${new Date(c.filingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
          `**Statutory SLA:** Due ${new Date(c.slaDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} (${c.isOverdue ? '⚠️ **OVERDUE** - SLA Exceeded' : 'Active Compliance Window'})`,
          `**Assigned Officer:** ${c.assignedOfficer.name} (${c.assignedOfficer.designation})`,
          '',
          `#### Allegation Summary`,
          c.description,
          '',
          c.crossBureauFlag
            ? `⚠️ **Cross-Bureau Alert:** This docket correlates across multiple administrative jurisdictions. Linked overlap dockets: ${c.overlapIds.map((id) => ('`' + id + '`')).join(', ')}.`
            : 'ℹ️ **Jurisdiction:** This case is currently tracked solely within the originating bureau.',
        ].join('\n');

        return {
          answer,
          sources,
          counts: { cases: 1, institutions: 1, relationships: c.overlapIds.length },
        };
      }
    }
  }

  // 1d. Institution context handling if viewing an institution page
  if (context?.institutionId) {
    const inst = INSTITUTIONS.find(
      (item) => item.id.toLowerCase() === context.institutionId!.toLowerCase() || item.name.toLowerCase().includes(context.institutionId!.toLowerCase())
    );
    if (inst) {
      addInstitutionSource(inst.id);
      const instCases = CASES.filter((c) => c.institutionId === inst.id);
      instCases.slice(0, 3).forEach((c) => addCaseSource(c.id));
      const instOverlaps = overlaps.filter((o) => o.institutionId === inst.id);
      instOverlaps.slice(0, 3).forEach((o) => addOverlapSource(o.id));

      if (q.includes('risk') || q.includes('rating') || q.includes('score')) {
        const answer = [
          `### Institution Risk Profile: [${inst.name}](/institutions/${inst.id})`,
          `* **Risk Rating:** \`${inst.riskRating}\``,
          `* **Active Inquiries:** **${inst.activeCasesCount}** open investigation dockets`,
          `* **Total Historical Dockets:** **${inst.totalCasesCount}** complaints on record`,
          `* **Bureaus Involved:** ${inst.bureauInvolvement.map((b) => ('`' + b + '`')).join(', ')}`,
          `* **AISHE Code:** \`${inst.aisheCode}\``,
          `* **Affiliated University:** ${inst.affiliatedUniversity}`,
          '',
          inst.riskRating === 'CRITICAL' || inst.riskRating === 'HIGH'
            ? '⚠️ **High-Risk Regulatory Alert:** This entity is flagged across multiple enforcement bureaus for correlated compliance breaches.'
            : '✅ **Standard Regulatory Standing:** Risk level is currently categorized as controlled.',
        ].join('\n');
        return {
          answer,
          sources,
          counts: { cases: instCases.length, institutions: 1, relationships: instOverlaps.length },
        };
      }

      if (q.includes('cases') || q.includes('dockets') || q.includes('inquiries') || q.includes('investigations')) {
        const caseList = instCases.length > 0
          ? instCases.map((c) => `* **[${c.id}](/cases/${c.id})** (\`${c.bureauId}\`) — ${c.title} (SLA: ${c.isOverdue ? '⚠️ OVERDUE' : 'Active'})`).join('\n')
          : 'No registered case dockets on file for this institution.';
        const answer = [
          `### Case Register: [${inst.name}](/institutions/${inst.id})`,
          `Found **${instCases.length} case docket(s)** associated with this institution:`,
          '',
          caseList,
        ].join('\n');
        return {
          answer,
          sources,
          counts: { cases: instCases.length, institutions: 1, relationships: instOverlaps.length },
        };
      }

      if (q.includes('summarize') || q.includes('profile') || q.includes('institution') || q.includes('overview') || q === 'help') {
        const answer = [
          `### Institution Dossier: [${inst.name}](/institutions/${inst.id})`,
          `* **AISHE Code:** \`${inst.aisheCode}\``,
          `* **AICTE Permanent ID:** \`${inst.aictePermanentId || 'N/A'}\``,
          `* **Category:** \`${inst.category}\``,
          `* **Risk Rating:** \`${inst.riskRating}\``,
          `* **Location:** ${inst.district}, ${inst.state} (${inst.pincode})`,
          `* **Affiliated University:** ${inst.affiliatedUniversity}`,
          `* **Sanctioned Annual Intake:** **${inst.approvedIntake}** students`,
          `* **Regulatory Inquiries:** **${inst.activeCasesCount} active** (${inst.totalCasesCount} total on record)`,
          `* **Jurisdictions Involved:** ${inst.bureauInvolvement.map((b) => ('`' + b + '`')).join(', ')}`,
          '',
          instOverlaps.length > 0
            ? `⚠️ **${instOverlaps.length} cross-bureau overlap(s)** flagged for coordinated multi-agency review: ${instOverlaps.map((o) => `[${o.id}](/overlaps?search=${o.id})`).join(', ')}.`
            : 'ℹ️ No active cross-bureau collision flags currently active for this institution.',
        ].join('\n');
        return {
          answer,
          sources,
          counts: { cases: instCases.length, institutions: 1, relationships: instOverlaps.length },
        };
      }
    }
  }

  // 2. Explicit Case ID query (e.g. "CP-2026-0104" or "case 0104")
  const caseIdMatch = question.match(/\b(?:CASE|CP)-2026-\d{4}\b/i) || question.match(/\bCP-\d{4}\b/i);
  if (caseIdMatch) {
    const matchId = caseIdMatch[0].toUpperCase();
    const c = CASES.find((item) => item.id.toUpperCase() === matchId || item.id.toUpperCase().endsWith(matchId));
    if (c) {
      addCaseSource(c.id);
      addInstitutionSource(c.institutionId);
      c.overlapIds.forEach(addOverlapSource);

      const answer = [
        `### Regulatory Dossier: Docket [${c.id}](/cases/${c.id})`,
        `* **Institution:** ${c.institutionName}`,
        `* **AISHE Code:** \`${c.aisheCode}\``,
        `* **Bureau:** \`${c.bureauId}\` · **Status:** \`${c.status}\``,
        `* **Severity Level:** \`${c.severity}\``,
        `* **Statutory SLA Status:** ${c.isOverdue ? '⚠️ **OVERDUE** (Priority escalation)' : 'On Schedule'} (Due: ${new Date(c.slaDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`,
        `* **Lead Officer:** ${c.assignedOfficer.name} (${c.assignedOfficer.designation})`,
        '',
        `#### Allegations & Investigation Notes`,
        c.description,
        '',
        c.crossBureauFlag && c.overlapIds.length > 0
          ? `**Cross-Bureau Links:** Correlated in inter-agency reviews: ${c.overlapIds.map((id) => `[${id}](/overlaps?search=${id})`).join(', ')}.`
          : '**Single-Bureau Scope:** No cross-agency collision detected.',
      ].join('\n');

      return {
        answer,
        sources,
        counts: { cases: 1, institutions: 1, relationships: c.overlapIds.length },
      };
    }
  }

  // 3. Conversational / Greetings / Help
  if (
    q === 'hi' ||
    q === 'hello' ||
    q === 'hey' ||
    q === 'greetings' ||
    q === 'help' ||
    q.startsWith('who are you') ||
    q.startsWith('what can you do') ||
    q.includes('how to use')
  ) {
    // Pick 3 high priority cases as sources
    ['CP-2026-0104', 'CP-2026-0440', 'CP-2026-0572'].forEach(addCaseSource);
    ['INST-001', 'INST-004'].forEach(addInstitutionSource);

    const answer = [
      '### Welcome to CASEPULSE AI · Regulatory Intelligence Command',
      'I am your **Read-Only Casework Intelligence Assistant**, operating across 6 regulatory bureaus with deterministic entity correlation.',
      '',
      '#### What I Can Help You With:',
      '1. **Recent Cases:** Query `"Show most recent cases"` to review latest grievance filings and evidence files.',
      '2. **Overdue SLA Dockets:** Query `"List overdue cases"` to surface all complaints that have exceeded the statutory 30-day investigation window.',
      '3. **Critical Violations:** Query `"Which institutions are Critical Risk?"` or `"Critical cases"` to inspect high-severity matters (ghost faculty, physical ragging, unapproved campuses).',
      '4. **Cross-Bureau Overlaps:** Query `"Summarize 7 cross-bureau overlaps"` to analyze multi-agency jurisdictional collisions.',
      '5. **Bureau Analysis:** Inquire about specific jurisdictions like `"UGC cases"`, `"AICTE"`, or `"DTE Maharashtra"`.',
      '6. **Institution Dossiers:** Ask about institutions like `"Apex Institute"` or search by AISHE code like `"C-19842"`.',
      '',
      '> *Note: All responses are grounded in authoritative CASEPULSE database records. Click on any supporting record below to inspect the full case docket or institution master.*',
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: 3, institutions: 2, relationships: 2 },
    };
  }

  // 4. Overdue Cases / Statutory SLA Violations
  if (
    q.includes('overdue') ||
    q.includes('sla') ||
    q.includes('delayed') ||
    q.includes('delay') ||
    q.includes('deadline') ||
    q.includes('exceeded')
  ) {
    const overdueCases = CASES.filter((c) => c.isOverdue);
    overdueCases.slice(0, 6).forEach((c) => {
      addCaseSource(c.id);
      addInstitutionSource(c.institutionId);
    });

    const rows = overdueCases
      .slice(0, 5)
      .map((c) => {
        const dueFormatted = new Date(c.slaDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return `* **[${c.id}](/cases/${c.id})** (${c.bureauId}) — **${c.institutionName}** (AISHE: \`${c.aisheCode}\`)\n  *Allegation:* ${c.title}\n  *Status:* \`${c.status}\` · *SLA Due:* **${dueFormatted}** (⚠️ **Overdue by ${c.daysOpen} days**)`;
      })
      .join('\n\n');

    const answer = [
      `### Statutory SLA Compliance Alert: ${overdueCases.length} Overdue Dockets`,
      `The statutory investigation SLA window is **30 days**. Currently, **${overdueCases.length} open complaints** have exceeded this threshold and require immediate administrative triage:`,
      '',
      rows,
      '',
      `**Recommended Action:** Initiate expedited show-cause notices or synchronized joint hearings for repeat entities like **Apex Institute** and **Kalinga Academy**.`,
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: overdueCases.length, institutions: 4, relationships: 3 },
    };
  }

  // 5. Recent Cases
  if (
    q.includes('recent') ||
    q.includes('latest') ||
    q.includes('newest') ||
    q === 'cases' ||
    q.includes('show cases')
  ) {
    const sorted = [...CASES].sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());
    const topRecent = sorted.slice(0, 5);
    topRecent.forEach((c) => {
      addCaseSource(c.id);
      addInstitutionSource(c.institutionId);
    });

    const rows = topRecent
      .map((c) => {
        const filedFormatted = new Date(c.filingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return `* **[${c.id}](/cases/${c.id})** · \`${c.bureauId}\` · **${c.institutionName}** (AISHE: \`${c.aisheCode}\`)\n  *Title:* ${c.title}\n  *Filed:* ${filedFormatted} · *Severity:* \`${c.severity}\` · *Status:* \`${c.status}\`${c.crossBureauFlag ? ' · ⚠️ *Cross-Bureau Overlap*' : ''}`;
      })
      .join('\n\n');

    const answer = [
      '### Most Recent Regulatory Case Filings',
      'Here are the latest grievance dockets registered across the Joint Desk:',
      '',
      rows,
      '',
      `Total registered cases in current scope: **${CASES.length} dockets** across **${BUREAUS.length} regulatory bureaus**.`,
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: topRecent.length, institutions: 4, relationships: 2 },
    };
  }

  // 6. Critical Risk / High Severity Queries
  if (
    q.includes('critical') ||
    q.includes('high risk') ||
    q.includes('severe') ||
    q.includes('high severity')
  ) {
    const criticalCases = CASES.filter((c) => c.severity === 'CRITICAL');
    const criticalInsts = INSTITUTIONS.filter((inst) => inst.riskRating === 'CRITICAL');

    criticalCases.forEach((c) => addCaseSource(c.id));
    criticalInsts.forEach((inst) => addInstitutionSource(inst.id));

    const caseList = criticalCases
      .map(
        (c) =>
          `* **[${c.id}](/cases/${c.id})** — **${c.institutionName}** (\`${c.aisheCode}\`)\n  *Category:* \`${c.category}\` · *Bureau:* \`${c.bureauId}\` · *Status:* \`${c.status}\`\n  *Allegation:* ${c.title}`
      )
      .join('\n\n');

    const instList = criticalInsts
      .map(
        (inst) =>
          `* **${inst.name}** (AISHE: \`${inst.aisheCode}\`)\n  *State:* ${inst.state} · *Active Cases:* ${inst.activeCasesCount} · *Bureaus Involved:* ${inst.bureauInvolvement.join(', ')}`
      )
      .join('\n');

    const answer = [
      '### Critical Regulatory Risk Assessment',
      `Identified **${criticalCases.length} Critical Severity Dockets** and **${criticalInsts.length} Critical Risk Institutions**:`,
      '',
      '#### Priority Critical Complaints',
      caseList,
      '',
      '#### Critical Risk Institutions (Concurrent Violations)',
      instList,
      '',
      '**Regulatory Protocol:** Critical risk institutions with multi-bureau involvement qualify for mandatory inter-agency joint inspections under Joint Desk Guidelines.',
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: criticalCases.length, institutions: criticalInsts.length, relationships: 4 },
    };
  }

  // 7. Overlaps / Cross-Bureau Summaries
  if (
    q.includes('overlap') ||
    q.includes('cross-bureau') ||
    q.includes('cross bureau') ||
    q.includes('inter-bureau') ||
    q.includes('collision') ||
    q.includes('correlation')
  ) {
    overlaps.forEach((ovl) => {
      addOverlapSource(ovl.id);
      addCaseSource(ovl.sourceCaseId);
      addCaseSource(ovl.targetCaseId);
      addInstitutionSource(ovl.institutionId);
    });

    const overlapDetails = [
      `1. **[OVL-0104-0188](/overlaps?search=OVL-0104-0188):** **Apex Institute of Engineering, Pune** (\`C-19842\`)\n   * AICTE (\`CP-2026-0104\` Ghost Faculty) ↔ Consumer Forum (\`CP-2026-0188\` Capitation Fee Extortion).\n   * *Confidence:* **94%** · *Status:* Hearing Scheduled.`,
      `2. **[OVL-0104-0231](/overlaps?search=OVL-0104-0231):** **Apex Institute of Engineering, Pune** (\`C-19842\`)\n   * AICTE (\`CP-2026-0104\` Ghost Faculty) ↔ DTE Maharashtra (\`CP-2026-0231\` Excess Intake Without Approval).\n   * *Confidence:* **91%** · *Status:* Under Joint Investigation.`,
      `3. **[OVL-0312-0389](/overlaps?search=OVL-0312-0389):** **St. Jude College of Pharmacy, Bengaluru** (\`C-48210\`)\n   * UGC Vigilance (\`CP-2026-0312\` Off-Campus Study Centers) ↔ DTE Karnataka (\`CP-2026-0389\` Deficient Pharmacology Labs).\n   * *Confidence:* **88%** · *Status:* Joint Coordination Requested.`,
      `4. **[OVL-0440-0491](/overlaps?search=OVL-0440-0491):** **Kalinga Academy of Higher Technology, Bhubaneswar** (\`C-62109\`)\n   * Anti-Ragging Cell (\`CP-2026-0440\` Student Fractures & Intimidation) ↔ UGC Vigilance (\`CP-2026-0491\` Non-compliance with Anti-Ragging Regulations 2009).\n   * *Confidence:* **96%** · *Status:* Joint Inquiry Active.`,
      `5. **[OVL-0518-0572](/overlaps?search=OVL-0518-0572):** **National Institute of Management, Greater Noida** (\`C-33918\`)\n   * AICTE (\`CP-2026-0518\` Fraudulent NBA Accreditation) ↔ UGC Vigilance (\`CP-2026-0572\` Unapproved Foreign Dual-Degree).\n   * *Confidence:* **89%** · *Status:* Appellate Hearing.`,
      `6. **[OVL-0701-0744](/overlaps?search=OVL-0701-0744):** **Greenfield Memorial Institute, Hyderabad** (\`C-71044\`)\n   * AICTE (\`CP-2026-0701\` Revoked Fire Safety Certificate) ↔ Consumer Forum (\`CP-2026-0744\` Illegal Hostel Fee Forfeiture).\n   * *Confidence:* **86%** · *Status:* Action Pending.`,
    ].join('\n\n');

    const answer = [
      '### Cross-Bureau Correlation Intelligence: Multi-Agency Overlaps',
      `CASEPULSE's deterministic correlation engine has identified **${overlaps.length} high-confidence cross-bureau collisions** where complaints in separate jurisdictions target the same educational entity:`,
      '',
      overlapDetails,
      '',
      '**Operational Significance:** Coordinated multi-agency proceedings prevent conflicting regulatory orders and close jurisdictional loopholes exploited by non-compliant institutions.',
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: 10, institutions: 5, relationships: overlaps.length },
    };
  }

  // 8. Specific Bureau Queries
  const matchedBureau = BUREAUS.find(
    (b) =>
      q.includes(b.id.toLowerCase()) ||
      q.includes(b.shortName.toLowerCase()) ||
      (b.id === 'AICTE_APPROVAL' && q.includes('aicte')) ||
      (b.id === 'UGC_VIGILANCE' && q.includes('ugc')) ||
      (b.id === 'STATE_DTE_MAHA' && (q.includes('maharashtra') || q.includes('dte maha'))) ||
      (b.id === 'STATE_DTE_KAR' && (q.includes('karnataka') || q.includes('dte kar'))) ||
      (b.id === 'NARC_ANTI_RAGGING' && (q.includes('ragging') || q.includes('narc'))) ||
      (b.id === 'CONSUMER_FORUM' && (q.includes('consumer') || q.includes('tribunal')))
  );

  if (matchedBureau) {
    const bureauCases = CASES.filter((c) => c.bureauId === matchedBureau.id);
    bureauCases.forEach((c) => {
      addCaseSource(c.id);
      addInstitutionSource(c.institutionId);
    });

    const caseList = bureauCases
      .map((c) => {
        const filedFormatted = new Date(c.filingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return `* **[${c.id}](/cases/${c.id})** — **${c.institutionName}** (AISHE: \`${c.aisheCode}\`)\n  *Title:* ${c.title}\n  *Status:* \`${c.status}\` · *Filed:* ${filedFormatted}${c.isOverdue ? ' · ⚠️ **OVERDUE**' : ''}`;
      })
      .join('\n\n');

    const answer = [
      `### Bureau Caseload Dossier: ${matchedBureau.name} (\`${matchedBureau.shortName}\`)`,
      `* **Department:** ${matchedBureau.department}`,
      `* **Jurisdiction:** ${matchedBureau.jurisdiction}`,
      `* **Lead Contact:** ${matchedBureau.contactOfficer} (${matchedBureau.contactEmail})`,
      `* **Active Dockets:** **${bureauCases.length} case(s)**`,
      '',
      '#### Active Grievances in this Bureau',
      caseList,
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: bureauCases.length, institutions: 3, relationships: 2 },
    };
  }

  // 9. Specific Institution Lookup (by name, keyword, or AISHE code)
  const matchedInst = INSTITUTIONS.find(
    (inst) =>
      q.includes(inst.name.toLowerCase()) ||
      q.includes(inst.normalizedName.toLowerCase()) ||
      (inst.aisheCode && q.includes(inst.aisheCode.toLowerCase())) ||
      q.includes(inst.id.toLowerCase()) ||
      (inst.name.includes('Apex') && q.includes('apex')) ||
      (inst.name.includes('St. Jude') && (q.includes('jude') || q.includes('pharmacy'))) ||
      (inst.name.includes('Kalinga') && q.includes('kalinga')) ||
      (inst.name.includes('National Institute') && q.includes('national')) ||
      (inst.name.includes('Greenfield') && q.includes('greenfield')) ||
      (inst.name.includes('Imperial') && q.includes('imperial')) ||
      (inst.name.includes('Vidyapeeth') && q.includes('vidyapeeth')) ||
      (inst.name.includes('Dharmashala') && q.includes('dharmashala'))
  );

  if (matchedInst) {
    addInstitutionSource(matchedInst.id);
    const instCases = CASES.filter((c) => c.institutionId === matchedInst.id);
    instCases.forEach((c) => {
      addCaseSource(c.id);
      c.overlapIds.forEach(addOverlapSource);
    });

    const caseList = instCases.length > 0
      ? instCases.map((c) => `* **[${c.id}](/cases/${c.id})** (\`${c.bureauId}\`): ${c.title} — \`${c.status}\`${c.isOverdue ? ' (⚠️ Overdue)' : ''}`).join('\n')
      : 'No active case records currently registered for this institution.';

    const answer = [
      `### Institutional Regulatory Profile: ${matchedInst.name}`,
      `* **AISHE Code:** \`${matchedInst.aisheCode || 'N/A'}\` | **AICTE Permanent ID:** \`${matchedInst.aictePermanentId || 'N/A'}\``,
      `* **Risk Rating:** \`${matchedInst.riskRating}\` | **Category:** \`${matchedInst.category}\``,
      `* **Location:** ${matchedInst.district}, ${matchedInst.state} (PIN: ${matchedInst.pincode})`,
      `* **Affiliated University:** ${matchedInst.affiliatedUniversity}`,
      `* **Approved Intake:** ${matchedInst.approvedIntake} students | **Established:** ${matchedInst.establishedYear}`,
      `* **Regulatory Footprint:** Inquiries active across ${matchedInst.bureauInvolvement.join(', ')}`,
      '',
      `#### Registered Complaints (${instCases.length} total)`,
      caseList,
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: instCases.length, institutions: 1, relationships: 2 },
    };
  }

  // 10. General / Fallback Search through cases and institutions
  const matchingCases = CASES.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.institutionName.toLowerCase().includes(q)
  );

  if (matchingCases.length > 0) {
    matchingCases.slice(0, 4).forEach((c) => {
      addCaseSource(c.id);
      addInstitutionSource(c.institutionId);
    });

    const caseItems = matchingCases
      .slice(0, 4)
      .map((c) => `* **[${c.id}](/cases/${c.id})** (\`${c.bureauId}\`) — **${c.institutionName}** (\`${c.aisheCode}\`)\n  ${c.title} (Status: \`${c.status}\`)`)
      .join('\n\n');

    const answer = [
      `### Records Matching Your Inquiry`,
      `Found **${matchingCases.length} relevant case docket(s)** in the regulatory database:`,
      '',
      caseItems,
      '',
      'You can select any cited case ID above to inspect full evidentiary documents, witness depositions, and chronological timeline actions.',
    ].join('\n');

    return {
      answer,
      sources,
      counts: { cases: matchingCases.length, institutions: 2, relationships: 1 },
    };
  }

  // 11. Catch-all informative fallback
  ['CP-2026-0104', 'CP-2026-0440', 'CP-2026-0701'].forEach(addCaseSource);
  ['INST-001', 'INST-004'].forEach(addInstitutionSource);

  const answer = [
    `### CASEPULSE Regulatory Assistant Search`,
    `I analyzed your query: **"${question}"** across our database of **${CASES.length} dockets**, **${INSTITUTIONS.length} institutions**, and **${overlaps.length} cross-bureau correlations**.`,
    '',
    '#### Recommended Explorations:',
    '* **Recent Dockets:** Ask `"Show most recent cases"` to see the latest filings.',
    '* **Statutory SLA:** Ask `"List overdue SLA dockets"` for compliance priorities.',
    '* **High-Risk Entities:** Ask `"Which institutions are Critical Risk?"` for cross-agency targets.',
    '* **Cross-Bureau Links:** Ask `"Summarize 7 cross-bureau overlaps"` for inter-agency collisions.',
    '',
    'Explore the priority dockets linked below to begin inspecting records.',
  ].join('\n');

  return {
    answer,
    sources,
    counts: { cases: 3, institutions: 2, relationships: 1 },
  };
}
