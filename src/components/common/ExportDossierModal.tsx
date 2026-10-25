'use client';

import React, { useEffect, useState } from 'react';
import { Copy, Download, FileCode, FileText, X } from 'lucide-react';
import { apiClient, DashboardSummary } from '@/lib/api-client';
import { CaseComplaint, CaseOverlap, Institution } from '@/types';

export const POSTGRES_SCHEMA_SQL = `-- CASEPULSE command data model export
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

interface ExportDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
}

export function ExportDossierModal({ isOpen, onClose, caseId }: ExportDossierModalProps) {
  const [tab, setTab] = useState<'DOSSIER' | 'POSTGRES_SCHEMA'>('DOSSIER');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [targetCase, setTargetCase] = useState<CaseComplaint | null>(null);
  const [relatedOverlaps, setRelatedOverlaps] = useState<CaseOverlap[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function fetchExportData() {
      setIsLoading(true);
      setLoadError(null);
      try {
        if (caseId) {
          const [caseRes, relatedRes] = await Promise.all([
            apiClient.getCase(caseId),
            apiClient.getRelatedCases(caseId).catch(() => ({ relationships: [] })),
          ]);
          if (ignore) return;
          setTargetCase(caseRes);
          setRelatedOverlaps(relatedRes.relationships.map((r) => r.overlap));
        } else {
          const [summaryRes, instRes] = await Promise.all([
            apiClient.getDashboardSummary(),
            apiClient.getInstitutions({ pageSize: 100 }),
          ]);
          if (ignore) return;
          setSummary(summaryRes);
          setInstitutions(instRes.data);
        }
      } catch (err) {
        if (ignore) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Failed to load export data from authoritative database.'
        );
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void fetchExportData();
    return () => {
      ignore = true;
    };
  }, [isOpen, caseId]);

  if (!isOpen) return null;

  const generateDossierText = () => {
    if (isLoading) {
      return 'Loading authoritative dossier records from PostgreSQL...';
    }
    if (loadError) {
      return `Unable to generate dossier: ${loadError}`;
    }

    if (caseId && targetCase) {
      return `================================================================================
CASEPULSE CASE DOSSIER
${targetCase.isSynthetic ? 'Record provenance    : Synthetic records' : ''}
Date: ${new Date().toISOString()}
================================================================================

1. PRIMARY DOCKET IDENTIFIERS
--------------------------------------------------------------------------------
Case Docket ID       : ${targetCase.id}
Originating Bureau   : ${targetCase.bureauId}
Filing Date          : ${targetCase.filingDate}
SLA Resolution Due   : ${targetCase.slaDueDate} (${targetCase.isOverdue ? 'OVERDUE' : 'ON TRACK'})
Investigation Status : ${targetCase.status}
Severity Level       : ${targetCase.severity}
Assigned Officer     : ${targetCase.assignedOfficer.name} (${targetCase.assignedOfficer.designation})
Contact Email        : ${targetCase.assignedOfficer.email || 'N/A'}

2. TARGET INSTITUTION RECORD
--------------------------------------------------------------------------------
Institution Name     : ${targetCase.institutionName}
AISHE Code           : ${targetCase.aisheCode}
Institution ID       : ${targetCase.institutionId}

3. ALLEGATION PARTICULARS
--------------------------------------------------------------------------------
Category             : ${targetCase.category}
Complainant Category : ${targetCase.complainantType}
Docket Title         : ${targetCase.title}

Executive Summary:
${targetCase.description}

4. EXPLAINABLE CROSS-BUREAU OVERLAP ANALYSIS
--------------------------------------------------------------------------------
Flagged Overlaps Count: ${relatedOverlaps.length}

${
  relatedOverlaps.length === 0
    ? 'No cross-bureau overlaps flagged for this docket.'
    : relatedOverlaps
        .map(
          (ovl, idx) => `[Overlap Ref #${idx + 1}: ${ovl.id}]
- Correlated Bureau   : ${ovl.sourceBureau === targetCase.bureauId ? ovl.targetBureau : ovl.sourceBureau}
- Correlated Docket   : ${ovl.sourceCaseId === targetCase.id ? ovl.targetCaseId : ovl.sourceCaseId}
- Deterministic Match : ${ovl.matchType} (Confidence: ${ovl.confidenceScore}%)
- Triage Status       : ${ovl.status}
- System Rationale    :
  * ${ovl.reasons.join('\n  * ')}
- Recommended Action  :
  ${ovl.recommendedAction}
`
        )
        .join('\n--------------------------------------------------------------------------------\n')
}

5. AUDIT TRAIL & RECENT TIMELINE
--------------------------------------------------------------------------------
${(targetCase.timeline || [])
  .map(
    (ev) =>
      `[${ev.timestamp.split('T')[0]}] [${ev.bureau}] ${ev.action} (Actor: ${ev.actor})\n  Notes: ${ev.notes}`
  )
  .join('\n')}

================================================================================
DOSSIER GENERATED BY CASEPULSE (POSTGRESQL RECORD VIEW)
================================================================================`;
    }

    if (summary) {
      return `================================================================================
CASEPULSE OPERATIONAL INTELLIGENCE SUMMARY
Date: ${new Date().toISOString()}
Data Source: ${summary.dataSource}${summary.syntheticRecordsPresent ? '\nRecord provenance: Synthetic records are included' : ''}
================================================================================

Total Registered Complaints  : ${summary.totalCases}
Pending Active Investigations : ${summary.pendingCases}
Overdue SLA Breaches         : ${summary.overdueCases}
Critical Severity Cases      : ${summary.criticalCases}
Cross-Bureau Overlaps Flagged: ${summary.flaggedOverlapsCount}
Unresolved Overlaps          : ${summary.unresolvedOverlapsCount}
Joint Inquiries Active       : ${summary.jointInquiriesActive}

Active Repeat-Offender Institutions:
${institutions
  .filter((i) => i.activeCasesCount > 1)
  .map(
    (i) =>
      `- ${i.name} (AISHE: ${i.aisheCode}) | Active Cases: ${i.activeCasesCount} across ${i.bureauInvolvement.join(', ')}`
  )
  .join('\n')}

================================================================================`;
    }

    return 'Generating report...';
  };

  const contentToDisplay =
    tab === 'DOSSIER' ? generateDossierText() : POSTGRES_SCHEMA_SQL;

  const handleCopy = () => {
    navigator.clipboard.writeText(contentToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename =
      tab === 'DOSSIER'
        ? `${caseId ? `casepulse-dossier-${caseId}` : 'casepulse-summary'}.txt`
        : 'casepulse-schema.sql';
    const blob = new Blob([contentToDisplay], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-ink">
              {caseId ? `Inter-Bureau Case Dossier: ${caseId}` : 'Regulatory Data & Schema Export'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-4 pt-3 flex gap-2 border-b border-line text-xs">
          <button
            onClick={() => setTab('DOSSIER')}
            className={`pb-2 px-2 font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'DOSSIER'
                ? 'border-blue-600 text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Coordination Memorandum
            </span>
          </button>
          <button
            onClick={() => setTab('POSTGRES_SCHEMA')}
            className={`pb-2 px-2 font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'POSTGRES_SCHEMA'
                ? 'border-blue-600 text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              PostgreSQL DDL Schema (FastAPI Ready)
            </span>
          </button>
        </div>

        {/* Code/Text Viewer */}
        <div className="p-4 flex-1 overflow-auto bg-background font-mono text-xs text-ink whitespace-pre">
          {contentToDisplay}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-line bg-card flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Export ready for administrative record or Python backend handoff.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-line bg-raised hover:bg-slate-50 text-ink-soft cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
