'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Mail,
  Plus,
  RotateCw,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { CaseComplaint, CaseOverlap, CaseStatus, TimelineEvent } from '@/types';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { SeverityBadge, StatusBadge } from '@/components/ui/StatusBadge';
import { CaseTimeline } from '@/components/cases/CaseTimeline';
import { OverlapReviewPanel } from '@/components/overlaps/OverlapReviewPanel';
import { ExportDossierModal } from '@/components/common/ExportDossierModal';
import { apiClient, ApiClientError, CaseActionPayload, CaseActionType } from '@/lib/api-client';

interface CaseDetailClientProps {
  caseId: string;
}

interface EvidenceDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  sha256: string;
  verificationStatus: 'VERIFIED' | 'PENDING_FORENSIC' | 'SEALED';
  source: string;
}

export default function CaseDetailClient({ caseId }: CaseDetailClientProps) {
  const [caseData, setCaseData] = useState<CaseComplaint | null>(null);
  const [overlaps, setOverlaps] = useState<CaseOverlap[]>([]);
  const [peerCases, setPeerCases] = useState<CaseComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiClientError | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedDocPreview, setSelectedDocPreview] = useState<EvidenceDocument | null>(null);

  // Administrative action modal state
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<CaseActionType>('NOTICE_ISSUED');
  const [newStatus, setNewStatus] = useState<CaseStatus>('UNDER_INVESTIGATION');
  const [actionTitle, setActionTitle] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch authoritative case data and related overlaps from the backend
  const loadCaseData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const serverCase = await apiClient.getCase(caseId);
      setCaseData(serverCase);
      setNewStatus(serverCase.status);

      try {
        const related = await apiClient.getRelatedCases(caseId);
        setOverlaps(related.relationships.map((r) => r.overlap));
      } catch {
        setOverlaps([]);
      }

      try {
        const peers = await apiClient.getCases({
          institutionId: serverCase.institutionId,
          pageSize: 20,
        });
        setPeerCases(peers.data);
      } catch {
        setPeerCases([]);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLoadError(err);
      } else {
        setLoadError(new ApiClientError(0, 'UNKNOWN_ERROR', 'Failed to retrieve regulatory case dossier.'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    let ignore = false;
    async function initialFetch() {
      try {
        const serverCase = await apiClient.getCase(caseId);
        if (ignore) return;
        setCaseData(serverCase);
        setNewStatus(serverCase.status);

        try {
          const related = await apiClient.getRelatedCases(caseId);
          if (!ignore) {
            setOverlaps(related.relationships.map((r) => r.overlap));
          }
        } catch {
          if (!ignore) setOverlaps([]);
        }

        try {
          const peers = await apiClient.getCases({
            institutionId: serverCase.institutionId,
            pageSize: 20,
          });
          if (!ignore) setPeerCases(peers.data);
        } catch {
          if (!ignore) setPeerCases([]);
        }
      } catch (err) {
        if (!ignore) {
          if (err instanceof ApiClientError) {
            setLoadError(err);
          } else {
            setLoadError(new ApiClientError(0, 'UNKNOWN_ERROR', 'Failed to retrieve regulatory case dossier.'));
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    initialFetch();
    return () => {
      ignore = true;
    };
  }, [caseId]);

  // Open action modal and generate a single idempotency key per logical submission
  const handleOpenActionModal = () => {
    if (!caseData) return;
    setNewStatus(caseData.status);
    setActionType('NOTICE_ISSUED');
    setActionTitle('');
    setActionNotes('');
    setActionError(null);

    // One key per logical submission. Preserved across network retries of this submission.
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setIdempotencyKey(`case-action-${caseId}-${uniqueSuffix}`);
    setIsActionModalOpen(true);
  };

  // Submit action & optional status transition in one atomic transaction
  const handleRecordAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !caseData) return;
    if (!actionNotes.trim() && !actionTitle.trim()) {
      setActionError('Please provide official notes for this administrative action.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    const finalNotes = actionTitle.trim()
      ? `${actionTitle.trim()}: ${actionNotes.trim()}`
      : actionNotes.trim();

    try {
      const payload: CaseActionPayload = {
        idempotencyKey,
        type: actionType,
        notes: finalNotes,
        ...(newStatus !== caseData.status ? { nextStatus: newStatus } : {}),
      };

      const result = await apiClient.recordCaseAction(caseData.id, payload);

      // Reflect success only after receiving successful server response
      setCaseData({
        ...result.case,
        actionHistory: [
          result.action,
          ...(caseData.actionHistory ?? []).filter((a) => a.id !== result.action.id),
        ],
      });
      setIsActionModalOpen(false);
      setActionTitle('');
      setActionNotes('');
      setSuccessNotice('Administrative action and docket status successfully persisted to PostgreSQL.');
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err) {
      // Do NOT generate a new idempotency key here! Preserve it so retries use the identical key.
      if (err instanceof ApiClientError) {
        setActionError(err.userFriendlyMessage);
      } else {
        setActionError('Failed to record administrative action. Please retry.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert server-returned action history to TimelineEvent array for display
  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!caseData) return [];
    if (caseData.actionHistory && caseData.actionHistory.length > 0) {
      return caseData.actionHistory.map((act) => ({
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
    return caseData.timeline ?? [];
  }, [caseData]);

  // Generate synthetic evidentiary documents tailored to the case
  const evidenceDocuments = useMemo<EvidenceDocument[]>(() => {
    if (!caseData) return [];

    const baseDate = caseData.filingDate ? caseData.filingDate.split('T')[0] : '2026-08-01';
    const docs: EvidenceDocument[] = [
      {
        id: `DOC-${caseData.id}-01`,
        name: `Sworn_Complainant_Affidavit_Notarized.pdf`,
        type: 'application/pdf',
        size: '1.8 MB',
        uploadedAt: `${baseDate} 10:15 IST`,
        sha256: `7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069`,
        verificationStatus: 'VERIFIED',
        source: 'Aggrieved Petitioner Submission',
      },
      {
        id: `DOC-${caseData.id}-02`,
        name: `Institutional_Roll_Inspection_Verification.xlsx`,
        type: 'application/vnd.ms-excel',
        size: '420 KB',
        uploadedAt: `${baseDate} 14:30 IST`,
        sha256: `185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969`,
        verificationStatus: 'SEALED',
        source: 'Expert Committee Preliminary Memo',
      },
    ];

    if (caseData.category === 'GHOST_FACULTY') {
      docs.push({
        id: `DOC-${caseData.id}-03`,
        name: `Aadhaar_PAN_Cross_Bureau_Duplication_Matrix.csv`,
        type: 'text/csv',
        size: '640 KB',
        uploadedAt: `${baseDate} 16:00 IST`,
        sha256: `bc614e${caseData.id.replace(/\D/g, '')}aa7b2123f114c022e3ae`,
        verificationStatus: 'VERIFIED',
        source: 'Synthetic Faculty Roll Cross-Check Artifact',
      });
    } else if (caseData.category === 'WITHHOLDING_DOCUMENTS' || caseData.category === 'CAPITATION_FEE') {
      docs.push({
        id: `DOC-${caseData.id}-03`,
        name: `Cash_Challan_Deposit_Slips_Bank_Statements.pdf`,
        type: 'application/pdf',
        size: '2.4 MB',
        uploadedAt: `${baseDate} 11:20 IST`,
        sha256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
        verificationStatus: 'VERIFIED',
        source: 'Complainant Bank Corroboration',
      });
    } else if (caseData.category === 'RAGGING_HARASSMENT') {
      docs.push({
        id: `DOC-${caseData.id}-03`,
        name: `Government_Hospital_Discharge_Summary_MLC_Record.pdf`,
        type: 'application/pdf',
        size: '3.1 MB',
        uploadedAt: `${baseDate} 09:45 IST`,
        sha256: `3b879a8d9a7d45e69e8b7c4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0`,
        verificationStatus: 'SEALED',
        source: 'District Medical Officer & Police MLC',
      });
    }

    return docs;
  }, [caseData]);

  // Compute Related-Case Recommendations with Matching Explanations
  const relatedRecommendations = useMemo(() => {
    if (!caseData) return [];

    const related: Array<{
      caseItem: CaseComplaint;
      reason: string;
      confidence: number;
      relationType: 'SAME_INSTITUTION' | 'CROSS_BUREAU_OVERLAP' | 'CATEGORY_PATTERN' | 'DISTRICT_COHORT';
    }> = [];

    peerCases.forEach((other) => {
      if (other.id === caseData.id) return;

      // 1. Same Institution
      if (other.institutionId === caseData.institutionId) {
        related.push({
          caseItem: other,
          confidence: 95,
          relationType: 'SAME_INSTITUTION',
          reason: `Exact Institutional Entity Match (AISHE: ${caseData.aisheCode}). Active inquiry registered in ${other.bureauId} regarding ${other.category.replace(/_/g, ' ')}.`,
        });
        return;
      }

      // 2. Overlap Connection
      const isOverlap = overlaps.some(
        (o) =>
          (o.sourceCaseId === other.id || o.targetCaseId === other.id) &&
          (o.sourceCaseId === caseData.id || o.targetCaseId === caseData.id)
      );

      if (isOverlap) {
        related.push({
          caseItem: other,
          confidence: 90,
          relationType: 'CROSS_BUREAU_OVERLAP',
          reason: `Corroborated by CasePulse Correlation Engine: Bilateral proceeding identified across ${caseData.bureauId} and ${other.bureauId}.`,
        });
        return;
      }

      // 3. Category Synergy
      if (other.category === caseData.category) {
        related.push({
          caseItem: other,
          confidence: 75,
          relationType: 'CATEGORY_PATTERN',
          reason: `Identical regulatory violation category (${caseData.category.replace(/_/g, ' ')}) filed within the same regulatory cycle. Useful for precedent comparison.`,
        });
      }
    });

    return related.slice(0, 3);
  }, [caseData, overlaps, peerCases]);

  // Loading State
  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Loading authoritative regulatory case dossier...
        </p>
        <p className="text-xs text-slate-500 mt-1">Retrieving persistent record from PostgreSQL</p>
      </div>
    );
  }

  // Error State: 404 Not Found
  if (loadError && loadError.status === 404) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Case Docket Not Found
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          No regulatory case docket matches the reference ID &quot;{caseId}&quot; or it is outside your authorized scope.
        </p>
        <Link
          href="/cases"
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Case Register
        </Link>
      </div>
    );
  }

  // Error State: 401, 403, 503, Network failure
  if (loadError) {
    return (
      <div className="py-16 max-w-lg mx-auto text-center">
        <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            {loadError.status === 401
              ? 'Authentication Required'
              : loadError.status === 403
              ? 'Access Denied'
              : loadError.status === 503
              ? 'Database Unavailable (HTTP 503)'
              : 'Error Loading Case Dossier'}
          </h2>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
            {loadError.userFriendlyMessage}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={loadCaseData}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
            <Link
              href="/cases"
              className="px-3.5 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Return to Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) return null;

  const filingDateFormatted = new Date(caseData.filingDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const slaDueDateFormatted = new Date(caseData.slaDueDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Link
            href="/cases"
            className="p-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Return to case register"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs text-slate-500">Case Docket</span>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
            {caseData.id}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Official Dossier
          </button>
          <button
            onClick={handleOpenActionModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Action / Update Status
          </button>
        </div>
      </div>

      {/* Primary Docket Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {caseData.id}
            </span>
            <BureauBadge bureauId={caseData.bureauId} size="md" />
            <StatusBadge status={caseData.status} isOverdue={caseData.isOverdue} />
            <SeverityBadge severity={caseData.severity} />
          </div>

          <div className="text-right text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Investigation SLA</span>
            <span
              className={`font-mono font-semibold ${
                caseData.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              Due: {slaDueDateFormatted} {caseData.isOverdue && '(BREACHED)'}
            </span>
          </div>
        </div>

        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
          {caseData.title}
        </h1>

        {/* Quick Meta Row */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
              Filing Date
            </span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
              {filingDateFormatted}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
              Complainant Type
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {caseData.complainantType}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
              Days In Process
            </span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {caseData.daysOpen} days
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
              Evidence Attachments
            </span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
              {caseData.evidenceFilesCount} Verified Artifacts
            </span>
          </div>
        </div>
      </div>

      {/* Target Institution and Assigned Officer Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Target Institution */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Target Higher Education Institution
            </span>
            <Link
              href={`/institutions/${caseData.institutionId}`}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              View Institution Dossier <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {caseData.institutionName}
          </h3>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px]">AISHE CODE</span>
              <strong>{caseData.aisheCode}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">DATABASE REF</span>
              <span>{caseData.institutionId}</span>
            </div>
          </div>
        </div>

        {/* Assigned Inspection Officer */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Assigned Case Officer
          </span>
          <div className="text-xs">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {caseData.assignedOfficer.name}
            </div>
            <div className="text-slate-500 mt-0.5">
              {caseData.assignedOfficer.designation}
            </div>
            {caseData.assignedOfficer.email && (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {caseData.assignedOfficer.email}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Narrative Allegation Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          Factual Allegations & Investigation Scope
        </h2>
        <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-200 dark:border-slate-800">
          {caseData.description}
        </div>
      </div>

      {/* Supporting Documents & Evidentiary Artifacts */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-500" />
              Supporting Evidentiary Documentation ({evidenceDocuments.length} Verified Files)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Secure digital depository of notarized affidavits, biometric logs, and bank instruments.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Chain of Custody: SHA-256 Validated
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {evidenceDocuments.map((doc) => (
            <div
              key={doc.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                  {doc.type.includes('excel') || doc.type.includes('csv') ? (
                    <FileSpreadsheet className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 break-all">
                      {doc.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {doc.verificationStatus}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-slate-500 font-mono">
                    <span>Size: {doc.size}</span>
                    <span>•</span>
                    <span>Timestamp: {doc.uploadedAt}</span>
                    <span>•</span>
                    <span className="font-sans text-slate-400">{doc.source}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-slate-400 break-all">
                    SHA-256: {doc.sha256}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => setSelectedDocPreview(doc)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Eye className="w-3 h-3" /> Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Bureau Overlap Alert Panel (If flagged) */}
      {caseData.crossBureauFlag && overlaps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Cross-Bureau Correlated Proceedings ({overlaps.length})
            </h2>
            <span className="text-[11px] text-slate-500">
              Detected by CASEPULSE Multi-Bureau Engine
            </span>
          </div>

          <div className="space-y-3">
            {overlaps.map((ovl) => (
              <OverlapReviewPanel
                key={ovl.id}
                overlap={ovl}
                onReviewSuccess={(updated) => {
                  setOverlaps((prev) =>
                    prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
                  );
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Related-Case Recommendations & Correlation Explanations */}
      {relatedRecommendations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Related-Case Correlation Recommendations ({relatedRecommendations.length})
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Multi-factor cross-match analysis identifying correlated proceedings and institutional trends.
              </p>
            </div>
            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
              Deterministic Matrix Match
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {relatedRecommendations.map((rel, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {rel.caseItem.id}
                    </span>
                    <BureauBadge bureauId={rel.caseItem.bureauId} size="sm" />
                    <StatusBadge status={rel.caseItem.status} />
                    <SeverityBadge severity={rel.caseItem.severity} />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">
                    {rel.caseItem.title}
                  </h4>
                  <div className="p-2 rounded bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-slate-700 dark:text-slate-300">
                    <strong className="text-purple-900 dark:text-purple-300 block text-[10px] uppercase font-bold mb-0.5">
                      Correlation Explanation:
                    </strong>
                    {rel.reason}
                  </div>
                </div>

                <div className="shrink-0 self-end md:self-center">
                  <Link
                    href={`/cases/${rel.caseItem.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Inspect Related Docket
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chronological Action History / Case Timeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Chronological Regulatory Action Trail
            </h2>
            <p className="text-[11px] text-slate-500">
              Time-stamped log of notices, hearings, inspection visits, and inter-bureau syncs.
            </p>
          </div>

          <button
            onClick={handleOpenActionModal}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entry
          </button>
        </div>

        <CaseTimeline events={timelineEvents} />
      </div>

      {/* Document Inspection Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Evidentiary Artifact Inspection
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Document Filename
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedDocPreview.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Evidentiary Provenance
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {selectedDocPreview.source}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">SIZE / FORMAT</span>
                    <span>{selectedDocPreview.size} ({selectedDocPreview.type})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">STATUS</span>
                    <span className="text-emerald-600 font-bold">{selectedDocPreview.verificationStatus}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Cryptographic Checksum
                  </span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all block">
                    {selectedDocPreview.sha256}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded text-xs text-amber-900 dark:text-amber-200">
                <strong>Regulatory Integrity Notice:</strong> Evidentiary files are synthetic demonstration records for SIH 2026 Problem Statement 26264 benchmark testing. Real institutional records are maintained in state high-security repositories.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Action Modal */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg shadow-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              Record Administrative Action & Update Docket Status
            </h3>

            {actionError && (
              <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleRecordAction} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Investigation Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
                  disabled={isSubmitting}
                  className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                >
                  <option value={caseData.status}>Keep Current Status ({caseData.status.replace(/_/g, ' ')})</option>
                  <option value="UNDER_INVESTIGATION">Under Investigation</option>
                  <option value="HEARING_SCHEDULED">Hearing Scheduled</option>
                  <option value="ACTION_PENDING">Action Pending</option>
                  <option value="JOINT_INQUIRY">Joint Inquiry Active</option>
                  <option value="RESOLVED">Resolved / Penalty Executed</option>
                  <option value="CLOSED">Closed (Archived)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as CaseActionType)}
                  disabled={isSubmitting}
                  className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                >
                  <option value="NOTICE_ISSUED">Notice Issued / Directives</option>
                  <option value="NOTE_ADDED">Investigation Note Added</option>
                  <option value="HEARING">Hearing Scheduled / Recorded</option>
                  <option value="INTER_BUREAU_SYNC">Inter-Bureau Coordination Sync</option>
                  <option value="PENALTY_ISSUED">Penalty / Sanction Issued</option>
                  <option value="CLOSURE">Closure Record</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Action Summary
                </label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="e.g., Surprise EVC team dispatched; Show-cause issued..."
                  disabled={isSubmitting}
                  className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Authorized Actor / Officer
                </label>
                <div className="text-xs p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Server-Resolved Session Identity</span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Authenticated Actor</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Officer identity and bureau authority are resolved authoritatively from the server session.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Official Detailed Notes
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Enter details of inspection findings, correspondence or inter-agency directives..."
                  required
                  disabled={isSubmitting}
                  className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-mono text-[9px] text-slate-400 truncate max-w-[200px]" title={idempotencyKey}>
                  Key: {idempotencyKey}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsActionModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:bg-blue-400"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Persisting Action...
                      </>
                    ) : (
                      'Save Action'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Dossier Modal */}
      <ExportDossierModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        caseId={caseData.id}
      />
    </div>
  );
}
