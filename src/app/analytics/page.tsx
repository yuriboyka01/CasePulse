'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  Code2,
  Download,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { ExportDossierModal } from '@/components/common/ExportDossierModal';
import { WorkspaceHeader } from '@/components/common/WorkspaceHeader';
import { apiClient, ApiClientError, DashboardSummary } from '@/lib/api-client';
import { CaseComplaint, CaseOverlap, Institution } from '@/types';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface AnalyticsData {
  summary: DashboardSummary;
  cases: CaseComplaint[];
  institutions: Institution[];
  overlaps: CaseOverlap[];
}

function getCategoryColor(category: string): string {
  const cat = category.toUpperCase();
  if (cat.includes('CAPITATION') || cat.includes('RAGGING') || cat.includes('SAFETY') || cat.includes('FRAUD')) {
    return 'bg-[#DC2626]';
  }
  if (cat.includes('UNAPPROVED') || cat.includes('GHOST') || cat.includes('FACULTY') || cat.includes('ADMISSION')) {
    return 'bg-[#D97706]';
  }
  return 'bg-[#4A5535]';
}

export default function AnalyticsPage() {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  const fetchData = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    try {
      const [summary, casesRes, instRes, overlapsRes] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.getCases({ pageSize: 100 }),
        apiClient.getInstitutions({ pageSize: 100 }),
        apiClient.getOverlaps({ pageSize: 100 }),
      ]);
      setAnalyticsData({
        summary,
        cases: casesRes.data,
        institutions: instRes.data,
        overlaps: overlapsRes.data,
      });
      setLoadState('success');
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.userFriendlyMessage
          : 'Failed to load analytics data. Please retry.';
      setError(msg);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [summary, casesRes, instRes, overlapsRes] = await Promise.all([
          apiClient.getDashboardSummary(),
          apiClient.getCases({ pageSize: 100 }),
          apiClient.getInstitutions({ pageSize: 100 }),
          apiClient.getOverlaps({ pageSize: 100 }),
        ]);
        if (ignore) return;
        setAnalyticsData({
          summary,
          cases: casesRes.data,
          institutions: instRes.data,
          overlaps: overlapsRes.data,
        });
        setLoadState('success');
      } catch (err) {
        if (ignore) return;
        const msg =
          err instanceof ApiClientError
            ? err.userFriendlyMessage
            : 'Failed to load analytics data. Please retry.';
        setError(msg);
        setLoadState('error');
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const d = analyticsData;
  const summary = d?.summary;
  const cases = d?.cases ?? [];
  const institutions = d?.institutions ?? [];
  const overlaps = d?.overlaps ?? [];

  // Category counts (derived from API cases)
  const categoryCounts: Record<string, number> = {};
  cases.forEach((c) => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  });

  // SLA compliance rate
  const slaComplianceRate =
    summary && summary.totalCases > 0
      ? Math.round(((summary.totalCases - summary.overdueCases) / summary.totalCases) * 100)
      : 0;

  // Cross-bureau pair matrix from API overlaps
  const matrix: Record<string, number> = {};
  overlaps.forEach((o) => {
    const pairKey = [o.sourceBureau, o.targetBureau].sort().join(' <-> ');
    matrix[pairKey] = (matrix[pairKey] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      {/* Workspace Command Header */}
      <WorkspaceHeader
        eyebrows={
          <>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5535] dark:text-[#8FA367]">
              Cross-Bureau Intelligence
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700 tabular-nums">
              {summary ? summary.dataSource.toUpperCase() : 'CONNECTING...'}
            </span>
            {summary?.syntheticRecordsPresent && (
              <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                SYNTHETIC INCLUDED
              </span>
            )}
          </>
        }
        title="Regulatory Intelligence & Cross-Bureau Analytics"
        subtitle="Systemic violation trends, inter-agency correlation density, and statutory SLA compliance monitoring."
        actions={
          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-card hover:bg-[#F9F8F3] dark:hover:bg-slate-800 text-ink shadow-[0_1px_2px_rgba(20,20,18,0.04)] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#4A5535]" />
            Executive Summary Export
          </button>
        }
      />

      {/* Loading */}
      {loadState === 'loading' && (
        <div className="py-16 text-center text-ink-muted rounded-xl border border-[#E2DEC9] dark:border-line bg-white dark:bg-card shadow-xs">
          <div className="w-8 h-8 border-2 border-[#4A5535] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Loading cross-bureau analytics data…</p>
        </div>
      )}

      {/* Error */}
      {loadState === 'error' && (
        <div className="p-5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 flex items-start gap-3.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-900 dark:text-rose-300">
              Analytics data unavailable
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{error}</p>
          </div>
          <button
            onClick={() => void fetchData()}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 bg-card text-danger-ink hover:bg-rose-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {loadState === 'success' && summary && (
        <>
          {/* High-Level Regulatory Intelligence KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Statutory SLA Compliance with Critical Alert Styling */}
            <div
              className={`p-4 rounded-xl transition-all shadow-[0_1px_2px_rgba(20,20,18,0.04)] ${
                slaComplianceRate < 70
                  ? 'bg-[#FEF2F2] dark:bg-rose-950/30 border-2 border-[#FECACA] dark:border-rose-900 shadow-sm relative overflow-hidden'
                  : 'bg-white dark:bg-card border border-[#E2DEC9] dark:border-line'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-wider truncate ${
                    slaComplianceRate < 70 ? 'text-[#991B1B] dark:text-rose-300' : 'text-stone-500'
                  }`}
                >
                  Statutory SLA Compliance
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold tabular-nums whitespace-nowrap shrink-0 shadow-2xs ${
                    slaComplianceRate < 70
                      ? 'bg-[#DC2626] text-white'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  }`}
                >
                  {slaComplianceRate < 70 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                  )}
                  {summary.overdueCases} Overdue
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span
                  className={`text-3xl font-bold font-mono tabular-nums ${
                    slaComplianceRate < 70 ? 'text-[#B91C1C] dark:text-rose-200' : 'text-ink'
                  }`}
                >
                  {slaComplianceRate}%
                </span>
                {slaComplianceRate < 70 && (
                  <span className="font-mono text-[11px] font-bold text-[#DC2626] dark:text-rose-400 uppercase tracking-wide whitespace-nowrap">
                    Critical Alert
                  </span>
                )}
              </div>
              <p
                className={`mt-2 text-xs leading-relaxed ${
                  slaComplianceRate < 70
                    ? 'text-[#991B1B]/80 dark:text-rose-300/80 font-medium'
                    : 'text-stone-500'
                }`}
              >
                Cases resolved or maintained within standard 30-day investigation SLA.
              </p>
            </div>

            {/* Inter-Bureau Overlap Density */}
            <div className="p-4 rounded-xl bg-white dark:bg-card border border-[#E2DEC9] dark:border-line shadow-[0_1px_2px_rgba(20,20,18,0.04)] hover:border-[#C5BFA8] transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-500 truncate">
                  Inter-Bureau Overlap Density
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-mono text-xs font-bold tabular-nums whitespace-nowrap shrink-0">
                  {summary.unresolvedOverlapsCount} Pending Review
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold font-mono tabular-nums text-ink">
                  {summary.flaggedOverlapsCount} Pairs
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                Cross-bureau correlation rate:{' '}
                <span className="font-mono font-semibold text-ink">
                  {summary.totalCases > 0
                    ? Math.round((summary.flaggedOverlapsCount / summary.totalCases) * 100)
                    : 0}
                  %
                </span>{' '}
                of complaints share entity ties.
              </p>
            </div>

            {/* Repeat-Target Institutions */}
            <div className="p-4 rounded-xl bg-white dark:bg-card border border-[#E2DEC9] dark:border-line shadow-[0_1px_2px_rgba(20,20,18,0.04)] hover:border-[#C5BFA8] transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-500 truncate">
                  Repeat-Target Institutions
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-mono text-xs font-bold whitespace-nowrap shrink-0">
                  Multi-Agency
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold font-mono tabular-nums text-ink">
                  {summary.repeatOffenderInstitutions}{' '}
                  <span className="text-stone-400 text-lg font-normal">/ {summary.activeInstitutions}</span>
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                Institutions with concurrent inquiries across multiple administrative bureaus.
              </p>
            </div>

            {/* Joint Inquiries Activated */}
            <div className="p-4 rounded-xl bg-white dark:bg-card border border-[#E2DEC9] dark:border-line shadow-[0_1px_2px_rgba(20,20,18,0.04)] hover:border-[#C5BFA8] transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-500 truncate">
                  Joint Inquiries Activated
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-mono text-xs font-bold whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  Synchronized
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold font-mono tabular-nums text-ink">
                  {summary.jointInquiriesActive}
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                Active joint hearing / shared notice proceedings between partner bureaus.
              </p>
            </div>
          </div>

          {/* Cross-Bureau Correlation Matrix & Category Clusters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cross-Bureau Correlation Pairs */}
            <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#4A5535]" />
                  Inter-Bureau Overlap Correlation Channels
                </h2>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">Bilateral Pairs</span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                Frequency of concurrent complaints spanning across specific administrative bureau channels.
              </p>

              {Object.keys(matrix).length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">
                  No cross-bureau overlap pairs in the current authorized scope.
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(matrix).map(([pair, count]) => {
                    const [bureauA, bureauB] = pair.split(' <-> ');
                    return (
                      <div
                        key={pair}
                        className="py-2.5 px-3 rounded-lg border border-[#E2DEC9] dark:border-line bg-[#FAF9F5] dark:bg-slate-900/40 flex items-center justify-between gap-3 hover:border-[#C5BFA8] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="whitespace-nowrap text-[11px] font-mono font-semibold px-2 py-1 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-stone-700 rounded text-stone-800 dark:text-stone-200 truncate">
                            {(bureauA || '').replace(/_/g, ' ')}
                          </span>
                          <span className="text-stone-400 dark:text-stone-500 shrink-0 text-xs">⇄</span>
                          <span className="whitespace-nowrap text-[11px] font-mono font-semibold px-2 py-1 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-stone-700 rounded text-stone-800 dark:text-stone-200 truncate">
                            {(bureauB || '').replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="whitespace-nowrap font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 tabular-nums">
                            {count} Overlap{count > 1 ? 's' : ''}
                          </span>
                          <Link
                            href="/overlaps"
                            className="whitespace-nowrap text-xs text-[#4A5535] dark:text-[#8FA367] hover:underline inline-flex items-center font-medium"
                          >
                            Inspect <ArrowRight className="w-3 h-3 ml-0.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Predatory Practice Categories */}
            <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#4A5535]" />
                  Violation Category Distribution
                </h2>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">By Frequency</span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                Prevalence of predatory grievance types reported across all coordinated registries.
              </p>

              {cases.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">
                  No case data available for the current authorized scope.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const percentage = Math.round((count / cases.length) * 100);
                      const barColorClass = getCategoryColor(cat);
                      return (
                        <div key={cat} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-ink">
                              {cat.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
                              <span className="font-bold text-ink">{count} dockets</span>
                              <span className="text-stone-400">·</span>
                              <span className="text-stone-500 font-semibold">{percentage}%</span>
                            </div>
                          </div>
                          <div className="w-full h-2.5 bg-[#FAF9F5] dark:bg-slate-800 rounded-full border border-stone-200/60 dark:border-stone-700/60 overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
                              style={{ width: `${Math.max(percentage, 3)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Repeat Offender Priority Target Table */}
          <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-rose-600" />
                  Institutions Facing Multi-Bureau Investigations
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Entities with concurrent proceedings in 2 or more separate administrative agencies.
                </p>
              </div>
              <Link
                href="/institutions?riskRating=CRITICAL"
                className="text-xs font-semibold text-[#4A5535] dark:text-[#8FA367] hover:underline inline-flex items-center gap-1"
              >
                Directory View <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#E2DEC9] dark:border-line">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2DEC9] dark:border-line bg-[#FAF9F5] dark:bg-slate-900 text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3.5">AISHE Code</th>
                    <th className="py-2.5 px-3.5">Institution</th>
                    <th className="py-2.5 px-3.5">Location</th>
                    <th className="py-2.5 px-3.5">Active Inquiries</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DEC9]/60 dark:divide-line">
                  {institutions.filter((i) => i.activeCasesCount > 1).length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-stone-400 text-xs"
                      >
                        No repeat-offender institutions in the current authorized scope.
                      </td>
                    </tr>
                  ) : (
                    institutions
                      .filter((i) => i.activeCasesCount > 1)
                      .map((inst) => (
                        <tr key={inst.id} className="hover:bg-[#F9F8F3] dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-medium text-stone-700 dark:text-stone-300">
                            {inst.aisheCode}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-ink">
                            {inst.name}
                          </td>
                          <td className="py-3 px-3.5 text-stone-500">
                            {inst.district}, {inst.state}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] font-mono font-bold text-[11px] tabular-nums">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                              {inst.activeCasesCount} active cases
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <Link
                              href={`/institutions/${inst.id}`}
                              className="text-xs font-semibold text-[#4A5535] dark:text-[#8FA367] hover:underline"
                            >
                              Inspect Dossier →
                            </Link>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Architecture & Backend Info Box */}
          <div className="bg-[#242A1E] text-stone-100 rounded-xl p-5 border border-[#384227] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#384227] rounded-lg text-[#D1DBC0] border border-[#4A5535]">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    PostgreSQL & Python/FastAPI Backend Integration Specification
                  </h3>
                  <p className="text-xs text-stone-400">
                    PostgreSQL DDL schema and clean REST/RPC service contract prepared for the upcoming Python correlation engine.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed font-sans">
              CASEPULSE uses PostgreSQL as the authoritative data source via Next.js Route Handlers.
              Data source:{' '}
              <code className="text-[#D1DBC0] font-mono bg-black/25 px-1.5 py-0.5 rounded">{summary.dataSource}</code>
              {summary.syntheticRecordsPresent && (
                <span className="ml-2 font-mono text-[11px] text-amber-300">
                  · Synthetic records are included
                </span>
              )}
            </p>
          </div>
        </>
      )}

      {/* Export Modal */}
      <ExportDossierModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
