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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Link
            href="/institutions"
            className="p-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs text-slate-500">Institution Directory</span>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-xs font-bold text-ink">
            {institution.aisheCode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/explorer?search=${institution.aisheCode}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-line bg-raised hover:bg-slate-50 text-ink-soft transition-colors"
          >
            <Network className="w-3.5 h-3.5 text-blue-500" />
            View in Topology Explorer
          </Link>
        </div>
      </div>

      {/* Primary Institution Profile Header Card */}
      <div className="bg-card border border-line rounded-lg p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-ink-soft">
              AISHE: {institution.aisheCode}
            </span>
            {institution.aictePermanentId && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-slate-500">
                AICTE ID: {institution.aictePermanentId}
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-brand-strong border border-blue-200 dark:border-blue-900">
              {institution.category}
            </span>
            {institution.isSynthetic && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Synthetic records</span>}
          </div>

          <RiskBadge rating={institution.riskRating} />
        </div>

        <h1 className="text-xl font-bold text-ink">
          {institution.name}
        </h1>

        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            {institution.address}, {institution.district}, {institution.state} -{' '}
            {institution.pincode}
          </span>
        </div>

        {/* Multi-Bureau Involvement & Operational Parameters */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Affiliated University
            </span>
            <span className="font-medium text-ink truncate block">
              {institution.affiliatedUniversity}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Sanctioned Intake
            </span>
            <span className="font-mono font-semibold text-ink">
              {institution.approvedIntake} Students / Yr
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Active Investigations
            </span>
            <span className="font-mono font-bold text-rose-600 text-sm">
              {institution.activeCasesCount} Active ({institution.totalCasesCount} Historical)
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Bureaus Involved
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {institution.bureauInvolvement.map((b) => (
                <BureauBadge key={b} bureauId={b} size="sm" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Complaint History Across Bureaus Summary */}
      {Object.keys(bureauHistory).length > 0 && (
        <div className="bg-card border border-line rounded-lg p-5">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                Multi-Agency Complaint History Across Coordinating Bureaus
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Distribution of regulatory grievances registered against this institution broken down by statutory agency.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(bureauHistory).map(([bCode, stats]) => (
              <div
                key={bCode}
                className="p-3.5 rounded-lg border border-line bg-slate-50/50 dark:bg-slate-950/20 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <BureauBadge bureauId={bCode as BureauCode} size="sm" />
                  <span className="font-mono text-sm font-bold text-ink">
                    {stats.total} Docket{stats.total > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-rose-600 font-semibold">{stats.active} Active Inquiries</span>
                  {stats.overdue > 0 && (
                    <span className="text-rose-600 font-bold flex items-center gap-0.5">
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
      <div className="bg-card border border-line rounded-lg p-5">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              Current Pending Actions & Compliance Deadlines ({pendingActions.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Upcoming statutory hearings, show-cause deadlines, and expert inspections awaiting resolution.
            </p>
          </div>
        </div>

        {pendingActions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed rounded-lg">
            No active compliance deadlines or pending hearings currently registered for this entity.
          </div>
        ) : (
          <div className="divide-y divide-line text-xs">
            {pendingActions.map((item, idx) => (
              <div
                key={idx}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BureauBadge bureauId={item.bureau} size="sm" />
                    <span className="font-mono font-bold text-brand">
                      {item.caseId}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 rounded bg-muted text-ink-muted uppercase">
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="font-semibold text-ink">{item.title}</h4>
                  <div className="text-[11px] text-warning-ink font-medium flex items-center gap-1">
                    <strong className="text-slate-500 font-normal">Next Action:</strong>{' '}
                    {item.nextAction}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Assigned Officer: {item.officer}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">SLA DEADLINE</span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        item.isOverdue ? 'text-rose-600' : 'text-ink-soft'
                      }`}
                    >
                      {item.slaDue} {item.isOverdue && '(BREACHED)'}
                    </span>
                  </div>
                  <Link
                    href={`/cases/${item.caseId}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-line bg-raised hover:bg-slate-100 dark:hover:bg-slate-700 text-ink-soft"
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
