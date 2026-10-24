'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  Network,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { BUREAUS } from '@/data/synthetic-dataset';
import { BureauCode, CaseComplaint, CaseOverlap } from '@/types';
import { MetricCard } from '@/components/ui/MetricCard';
import { WorkQueue } from '@/components/dashboard/WorkQueue';
import { AlertCard } from '@/components/ui/AlertCard';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { ComplaintTable } from '@/components/cases/ComplaintTable';
import { OverlapReviewPanel } from '@/components/overlaps/OverlapReviewPanel';
import { ExportDossierModal } from '@/components/common/ExportDossierModal';
import { apiClient, ApiClientError, DashboardSummary } from '@/lib/api-client';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface DashboardData {
  summary: DashboardSummary;
  urgentCases: CaseComplaint[];
  topOverlaps: CaseOverlap[];
}

export default function OverviewDashboardPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    try {
      const [summaryRes, casesRes, overlapsRes] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.getCases({ pageSize: 5, overdueOnly: false }),
        apiClient.getOverlaps({ pageSize: 3 }),
      ]);

      // Urgent cases: overdue or critical severity, up to 5
      const urgent = casesRes.data
        .filter((c) => c.isOverdue || c.severity === 'CRITICAL')
        .slice(0, 5);
      const urgentCases =
        urgent.length > 0 ? urgent : casesRes.data.slice(0, 5);

      setData({
        summary: summaryRes,
        urgentCases,
        topOverlaps: overlapsRes.data.slice(0, 3),
      });
      setLoadState('success');
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.userFriendlyMessage
          : 'Failed to load dashboard data. Please retry.';
      setError(msg);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [summaryRes, casesRes, overlapsRes] = await Promise.all([
          apiClient.getDashboardSummary(),
          apiClient.getCases({ pageSize: 5, overdueOnly: false }),
          apiClient.getOverlaps({ pageSize: 3 }),
        ]);
        if (ignore) return;

        const urgent = casesRes.data
          .filter((c) => c.isOverdue || c.severity === 'CRITICAL')
          .slice(0, 5);
        const urgentCases =
          urgent.length > 0 ? urgent : casesRes.data.slice(0, 5);

        setData({
          summary: summaryRes,
          urgentCases,
          topOverlaps: overlapsRes.data.slice(0, 3),
        });
        setLoadState('success');
      } catch (err) {
        if (ignore) return;
        const msg =
          err instanceof ApiClientError
            ? err.userFriendlyMessage
            : 'Failed to load dashboard data. Please retry.';
        setError(msg);
        setLoadState('error');
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const bureaus = BUREAUS;
  const summary = data?.summary;
  const urgentCases = data?.urgentCases ?? [];
  const topOverlaps = data?.topOverlaps ?? [];

  // Derived metrics from API summary
  const underProcessCount = summary ? summary.pendingCases : 0;
  const disposedCount = summary
    ? summary.totalCases - summary.pendingCases
    : 0;

  return (
    <div className="space-y-7">
      {/* Executive Command Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Inter-Bureau Operational Command
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {summary ? (summary.syntheticDemoData ? 'LOCAL POSTGRESQL · SYNTHETIC DEMO' : 'LOCAL POSTGRESQL') : 'CONNECTING...'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Statutory multi-agency oversight across AICTE, UGC, State DTEs, Anti-Ragging Cell, and Consumer Forum with explainable deterministic cross-bureau correlation.
          </p>
        </div>

        {/* Operational Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Executive Dossier</span>
          </button>
          <Link
            href="/explorer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors"
          >
            <Network className="w-3.5 h-3.5 text-blue-500" />
            <span>Topology Graph</span>
          </Link>
          <Link
            href="/overlaps"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Triage Overlaps ({summary?.unresolvedOverlapsCount ?? '…'})</span>
          </Link>
        </div>
      </div>

      {/* Loading / Error States */}
      {loadState === 'loading' && (
        <div className="py-14 text-center text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827] shadow-xs">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Synchronizing inter-bureau telemetry & registry dockets…</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 flex items-start gap-3.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-900 dark:text-rose-300">
              Regulatory Dashboard Telemetry Unavailable
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{error}</p>
          </div>
          <button
            onClick={() => void fetchDashboard()}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {loadState === 'success' && summary && (
        <>
          {/* Priority Work Queue & Correlation Radar */}
          <WorkQueue
            cases={urgentCases}
            unresolvedRelationships={summary.unresolvedOverlapsCount}
            detectedRelationships={summary.flaggedOverlapsCount}
          />

          {/* Primary Operational Metrics (5 Balanced KPI Cards Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Total Cases Received */}
            <MetricCard
              label="Total Cases Received"
              value={summary.totalCases}
              description="Total grievance dockets registered across all six coordinating administrative bureaus."
              icon={<FileText className="w-4 h-4 text-blue-500" />}
              badge={{ text: 'Multi-Bureau', variant: 'neutral' }}
              href="/cases"
            />

            {/* 2. Cases Under Process */}
            <MetricCard
              label="Under Process"
              value={underProcessCount}
              description="Active inquiries under investigation, hearing, or joint proceedings."
              icon={<Clock className="w-4 h-4 text-indigo-500" />}
              badge={{
                text: `${summary.totalCases > 0 ? Math.round((underProcessCount / summary.totalCases) * 100) : 0}% Active`,
                variant: 'info',
              }}
              href="/cases?status=UNDER_INVESTIGATION"
            />

            {/* 3. Overdue SLA Breaches */}
            <MetricCard
              label="Pending & Overdue"
              value={summary.overdueCases}
              description="Complaints exceeding statutory 30-day investigation SLA without closure."
              icon={<AlertCircle className="w-4 h-4 text-rose-500" />}
              badge={{ text: 'Action Required', variant: 'danger' }}
              isUrgent={summary.overdueCases > 0}
              href="/cases?overdueOnly=true"
            />

            {/* 4. Potential Cross-Bureau Overlaps */}
            <MetricCard
              label="Flagged Overlaps"
              value={summary.flaggedOverlapsCount}
              description="Deterministic multi-agency links detected across bureaus requiring joint triage."
              icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
              badge={{ text: `${summary.unresolvedOverlapsCount} Pending`, variant: 'warning' }}
              isUrgent={summary.unresolvedOverlapsCount > 0}
              href="/overlaps"
            />

            {/* 5. Cases Disposed */}
            <MetricCard
              label="Disposed / Closed"
              value={disposedCount}
              description="Complaints successfully concluded with formal orders, compliance or archive."
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              badge={{ text: `${disposedCount} Resolved`, variant: 'success' }}
              href="/cases?status=RESOLVED"
            />
          </div>

          {/* Bureau-Level Workload & Jurisdictional Distribution */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Bureau-Level Caseload & Jurisdictional Distribution
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Workload share and active complaint density distributed across statutory higher education bodies.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
                {summary.totalCases} Active Workload Units
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              {bureaus.map((bureau) => {
                const count = (summary.bureauCounts as Record<string, number>)[bureau.id] || 0;
                const percentage = Math.round((count / Math.max(summary.totalCases, 1)) * 100);

                return (
                  <Link
                    key={bureau.id}
                    href={`/cases?bureau=${bureau.id}`}
                    className="group p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500/50 shadow-2xs hover:shadow-xs transition-all block"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="truncate">
                        <BureauBadge bureauId={bureau.id} size="sm" />
                        <h3 className="mt-1.5 text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {bureau.shortName}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-base font-extrabold text-slate-900 dark:text-white">
                          {count}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono font-semibold">
                          {percentage}% Share
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-2.5">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[180px]">{bureau.contactOfficer.split('(')[0].trim()}</span>
                      <span className="font-mono text-slate-400">{count} dockets</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Strategic Objective Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  SIH 2026 Problem Statement 26264: Breaking Inter-Bureau Regulatory Silos
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
                  CASEPULSE correlates complaints across AICTE, UGC, State DTEs, Anti-Ragging Cell, and Consumer Forum into explainable dossiers with verified AISHE codes and temporal pattern synergy.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <Link
                href="/explorer"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                <span>Explore Topology</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Priority Action Alerts Grid */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Priority Operational Alerts (Urgent Attention)
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">Auto-prioritized by risk & SLA breach</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AlertCard
                type="OVERDUE"
                title="Apex Institute (Pune): Ghost Faculty Hearing Overdue"
                subtitle="Investigation CP-2026-0104 has been open for 45 days. 19 faculty absences remain unexplained."
                meta="AICTE · Breached 15 days ago"
                href="/cases/CP-2026-0104"
              />
              <AlertCard
                type="OVERLAP"
                title="Confirmed Overlap: Kalinga Academy Anti-Ragging"
                subtitle="Concurrent inquiries in NARC (CP-2026-0440) and UGC Vigilance (CP-2026-0491) for severe hostel assault."
                meta="NARC & UGC · 100% ID Match"
                href="/overlaps"
                actionText="Coordinate Joint Inquiry"
              />
              <AlertCard
                type="RISK"
                title="St. Jude College: Multi-Bureau Unapproved Intake"
                subtitle="Active de-recognition alert across Karnataka DTE and UGC for unapproved M.Pharm seats and degree retention."
                meta="DTE-KA & UGC · High Severity"
                href="/institutions/INST-002"
                actionText="Inspect Institution Dossier"
              />
            </div>
          </div>

          {/* Top Unresolved Overlaps Highlight Section */}
          {topOverlaps.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    High-Confidence Cross-Bureau Overlaps Requiring Triage
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Correlated case pairs verified by deterministic institutional identifiers and temporal category synergy.
                  </p>
                </div>
                <Link
                  href="/overlaps"
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1"
                >
                  <span>View All ({summary.flaggedOverlapsCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3.5">
                {topOverlaps.map((ovl) => (
                  <OverlapReviewPanel
                    key={ovl.id}
                    overlap={ovl}
                    onTriage={() => {
                      // Write operations go through /overlaps dedicated page
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Urgent Cases Table */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Active Priority Case Register (Recent Filings & Escalations)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Showing top cases flagged for severity, overdue SLA, or multi-bureau ties.
                </p>
              </div>
              <Link
                href="/cases"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1"
              >
                <span>Explore Complete Register ({summary.totalCases})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <ComplaintTable cases={urgentCases} />
          </div>
        </>
      )}

      {/* Export Dossier Modal */}
      <ExportDossierModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
