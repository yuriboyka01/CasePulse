'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock,
  FileText,
  Layers,
  MapPin,
  Network,
  RefreshCw,
} from 'lucide-react';
import type { BureauCode, CaseComplaint, CaseOverlap, Institution } from '@/types';
import { RiskBadge } from '@/components/ui/StatusBadge';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { ComplaintTable } from '@/components/cases/ComplaintTable';
import { OverlapReviewPanel } from '@/components/overlaps/OverlapReviewPanel';
import { WorkspaceHeader } from '@/components/common/WorkspaceHeader';
import { apiClient, ApiClientError } from '@/lib/api-client';

interface InstitutionDetailClientProps {
  instId: string;
}

type LoadState = 'idle' | 'loading' | 'success' | 'not_found' | 'error';

export default function InstitutionDetailClient({ instId }: InstitutionDetailClientProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [cases, setCases] = useState<CaseComplaint[]>([]);
  const [overlaps, setOverlaps] = useState<CaseOverlap[]>([]);

  const fetchData = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    try {
      const [inst, casesRes, overlapsRes] = await Promise.all([
        apiClient.getInstitution(instId),
        apiClient.getCases({ institutionId: instId, pageSize: 100 }),
        apiClient.getOverlaps({ institutionId: instId, pageSize: 100 }),
      ]);
      setInstitution(inst);
      setCases(casesRes.data);
      setOverlaps(overlapsRes.data);
      setLoadState('success');
    } catch (err) {
      if (err instanceof ApiClientError && err.isNotFound) {
        setLoadState('not_found');
      } else {
        const msg =
          err instanceof ApiClientError
            ? err.userFriendlyMessage
            : 'Failed to load institution profile. Please retry.';
        setError(msg);
        setLoadState('error');
      }
    }
  }, [instId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [inst, casesRes, overlapsRes] = await Promise.all([
          apiClient.getInstitution(instId),
          apiClient.getCases({ institutionId: instId, pageSize: 100 }),
          apiClient.getOverlaps({ institutionId: instId, pageSize: 100 }),
        ]);
        if (ignore) return;
        setInstitution(inst);
        setCases(casesRes.data);
        setOverlaps(overlapsRes.data);
        setLoadState('success');
      } catch (err) {
        if (ignore) return;
        if (err instanceof ApiClientError && err.isNotFound) {
          setLoadState('not_found');
        } else {
          const msg =
            err instanceof ApiClientError
              ? err.userFriendlyMessage
              : 'Failed to load institution profile. Please retry.';
          setError(msg);
          setLoadState('error');
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [instId]);

  // Pending actions derived from cases
  const pendingActions = cases
    .filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED')
    .map((c) => {
      let nextAction = 'Administrative Status Review';
      if (c.status === 'NEW') nextAction = 'Initial Dossier Audit & Show-Cause Issuance';
      else if (c.status === 'UNDER_INVESTIGATION')
        nextAction = c.isOverdue
          ? 'Emergency EVC Spot Verification (Overdue Breached)'
          : 'Witness Depositions & Biometric Verification';
      else if (c.status === 'HEARING_SCHEDULED')
        nextAction = 'Formal Standing Appellate Committee Hearing';
      else if (c.status === 'ACTION_PENDING')
        nextAction = 'Execution of Regulatory Penalty / Zero-Intake Order';
      else if (c.status === 'JOINT_INQUIRY')
        nextAction = 'Synchronized Inter-Bureau Bilateral Bench Session';
      return {
        caseId: c.id,
        bureau: c.bureauId,
        title: c.title,
        nextAction,
        officer: c.assignedOfficer.name,
        slaDue: new Date(c.slaDueDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        isOverdue: c.isOverdue,
        status: c.status,
      };
    });

  // Bureau breakdown of complaints
  const bureauHistory: Record<string, { total: number; active: number; overdue: number }> = {};
  cases.forEach((c) => {
    if (!bureauHistory[c.bureauId]) {
      bureauHistory[c.bureauId] = { total: 0, active: 0, overdue: 0 };
    }
    bureauHistory[c.bureauId].total++;
    if (c.status !== 'RESOLVED' && c.status !== 'CLOSED') {
      bureauHistory[c.bureauId].active++;
    }
    if (c.isOverdue) {
      bureauHistory[c.bureauId].overdue++;
    }
  });

  // Not found
  if (loadState === 'not_found') {
    return (
      <div className="py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-ink">
          Institution Unavailable
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          The requested institution record does not exist or is outside your authorized bureau scope.
        </p>
        <Link
          href="/institutions"
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Directory
        </Link>
      </div>
    );
  }

  // Loading
  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading institution profile…</p>
      </div>
    );
  }

  // Error
  if (loadState === 'error') {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-ink">
          Unable to load institution profile
        </h2>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => void fetchData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-line bg-raised text-ink-soft hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
          <Link
            href="/institutions"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  if (!institution) return null;

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/institutions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Institution Directory</span>
        </Link>
        <div className="flex items-center gap-2 font-mono text-xs text-stone-400">
          <span>AISHE</span>
          <span>/</span>
          <span className="font-bold text-ink">{institution.aisheCode}</span>
        </div>
      </div>

      {/* Primary Institution Command Header */}
      <WorkspaceHeader
        eyebrows={
          <>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-ink tabular-nums">
              AISHE: {institution.aisheCode}
            </span>
            {institution.aictePermanentId && (
              <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 tabular-nums">
                AICTE: {institution.aictePermanentId}
              </span>
            )}
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700">
              {institution.category}
            </span>
            {institution.isSynthetic && (
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" role="note">
                SYNTHETIC RECORD
              </span>
            )}
          </>
        }
        title={institution.name}
        subtitle={`${institution.address}, ${institution.district}, ${institution.state} - ${institution.pincode} · Affiliated with ${institution.affiliatedUniversity}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <RiskBadge rating={institution.riskRating} />
            <Link
              href={`/explorer?search=${institution.aisheCode}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-card hover:bg-[#FAF9F5] text-ink transition-colors shadow-2xs"
            >
              <Network className="w-3.5 h-3.5 text-[#4A5535]" />
              Topology Explorer
            </Link>
          </div>
        }
      />

      {/* Operational Parameters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-card border border-[#E2DEC9] dark:border-line shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
            Sanctioned Intake
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-ink mt-1 block">
            {institution.approvedIntake}{' '}
            <span className="text-xs font-sans text-stone-400 font-normal">Students / Yr</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-card border border-[#E2DEC9] dark:border-line shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
            Active Investigations
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-rose-600 mt-1 block">
            {institution.activeCasesCount}{' '}
            <span className="text-xs font-sans text-stone-400 font-normal">Active Inquiries</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-card border border-[#E2DEC9] dark:border-line shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
            Total Historical Cases
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-ink mt-1 block">
            {institution.totalCasesCount}{' '}
            <span className="text-xs font-sans text-stone-400 font-normal">Dockets on Record</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-card border border-[#E2DEC9] dark:border-line shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
            Bureaus Involved ({institution.bureauInvolvement.length})
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {institution.bureauInvolvement.map((b) => (
              <BureauBadge key={b} bureauId={b} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* Complaint History Across Bureaus Summary */}
      {Object.keys(bureauHistory).length > 0 && (
        <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
          <div className="flex items-center justify-between mb-3 border-b border-stone-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#4A5535]" />
                Multi-Agency Complaint History Across Coordinating Bureaus
              </h2>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Distribution of regulatory grievances registered against this institution broken down by statutory agency.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(bureauHistory).map(([bCode, stats]) => (
              <div
                key={bCode}
                className="p-3.5 rounded-lg border border-[#E2DEC9] dark:border-line bg-[#FAF9F5] dark:bg-slate-900/40 text-xs space-y-2 hover:border-[#C5BFA8] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <BureauBadge bureauId={bCode as BureauCode} size="sm" />
                  <span className="font-mono text-sm font-bold text-ink">
                    {stats.total} Docket{stats.total > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1.5 border-t border-[#E2DEC9]/60 dark:border-slate-800">
                  <span className="text-rose-600 font-semibold">{stats.active} Active Inquiries</span>
                  {stats.overdue > 0 && (
                    <span className="text-rose-600 font-bold flex items-center gap-0.5 font-mono">
                      <AlertCircle className="w-3 h-3" /> {stats.overdue} SLA Breached
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Pending Regulatory Actions */}
      <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Current Pending Actions & Compliance Deadlines ({pendingActions.length})
            </h2>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Upcoming statutory hearings, show-cause deadlines, and expert inspections awaiting resolution.
            </p>
          </div>
        </div>

        {pendingActions.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-500 border border-dashed border-stone-200 dark:border-stone-800 rounded-lg">
            No active compliance deadlines or pending hearings currently registered for this entity.
          </div>
        ) : (
          <div className="divide-y divide-[#E2DEC9]/60 dark:divide-line text-xs">
            {pendingActions.map((item, idx) => (
              <div
                key={idx}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] dark:hover:bg-slate-800/30 px-3 rounded-lg transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BureauBadge bureauId={item.bureau} size="sm" />
                    <span className="font-mono font-bold text-[#4A5535] dark:text-[#8FA367]">
                      {item.caseId}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 uppercase">
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="font-semibold text-ink">{item.title}</h4>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                    <strong className="text-stone-500 font-normal">Next Action:</strong>{' '}
                    {item.nextAction}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Assigned Officer: {item.officer}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block font-mono">SLA DEADLINE</span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        item.isOverdue ? 'text-rose-600' : 'text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {item.slaDue} {item.isOverdue && '(BREACHED)'}
                    </span>
                  </div>
                  <Link
                    href={`/cases/${item.caseId}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-card hover:bg-[#FAF9F5] text-ink transition-colors shadow-2xs"
                  >
                    Open Docket <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flagged Cross-Bureau Overlaps for This Institution */}
      {overlaps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Inter-Bureau Correlated Inquiries ({overlaps.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Independent complaints filed against this institution across separate bureaus flagged for coordinated action.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {overlaps.map((ovl) => (
              <OverlapReviewPanel
                key={ovl.id}
                overlap={ovl}
                onTriage={() => {
                  // Write operations go through /overlaps page
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Associated Cases on Record */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              All Regulatory Dockets on Record ({cases.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Chronological log of complaints across all administrative bureaus for this entity.
            </p>
          </div>
        </div>

        <ComplaintTable cases={cases} />
      </div>
    </div>
  );
}
