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
import { apiClient, ApiClientError, DashboardSummary } from '@/lib/api-client';
import { CaseComplaint, CaseOverlap, Institution } from '@/types';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface AnalyticsData {
  summary: DashboardSummary;
  cases: CaseComplaint[];
  institutions: Institution[];
  overlaps: CaseOverlap[];
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
    const pairKey = [o.sourceBureau, o.targetBureau].sort().join(' ⟷ ');
    matrix[pairKey] = (matrix[pairKey] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Regulatory Intelligence & Cross-Bureau Analytics
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              {summary ? 'POSTGRESQL' : 'CONNECTING...'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Systemic violation trends, inter-agency correlation density, and statutory SLA compliance monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Executive Summary Export
          </button>
        </div>
      </div>

      {/* Loading */}
      {loadState === 'loading' && (
        <div className="py-16 text-center text-slate-500">
          <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading analytics data…</p>
        </div>
      )}

      {/* Error */}
      {loadState === 'error' && (
        <div className="p-5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
              Analytics data unavailable
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{error}</p>
          </div>
          <button
            onClick={() => void fetchData()}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 cursor-pointer"
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
            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Statutory SLA Compliance
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {slaComplianceRate}%
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    slaComplianceRate < 70
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {summary.overdueCases} Overdue
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Cases resolved or maintained within standard 30-day investigation SLA.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Inter-Bureau Overlap Density
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {summary.flaggedOverlapsCount} Pairs
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  {summary.unresolvedOverlapsCount} Pending Review
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Cross-bureau correlation rate:{' '}
                {summary.totalCases > 0
                  ? Math.round((summary.flaggedOverlapsCount / summary.totalCases) * 100)
                  : 0}
                % of complaints share entity ties.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Repeat-Target Institutions
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {summary.repeatOffenderInstitutions} of {summary.activeInstitutions}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                  Multi-Agency
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Institutions with concurrent inquiries across multiple administrative bureaus.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Joint Inquiries Activated
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {summary.jointInquiriesActive}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Synchronized
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Active joint hearing / shared notice proceedings between partner bureaus.
              </p>
            </div>
          </div>

          {/* Cross-Bureau Correlation Matrix & Category Clusters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cross-Bureau Correlation Pairs */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-500" />
                  Inter-Bureau Overlap Correlation Channels
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">Bilateral Pairs</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Frequency of concurrent complaints spanning across specific administrative bureau channels.
              </p>

              {Object.keys(matrix).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No cross-bureau overlap pairs in the current authorized scope.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(matrix).map(([pair, count]) => {
                    const [bureauA, bureauB] = pair.split(' ⟷ ');
                    return (
                      <div
                        key={pair}
                        className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {bureauA.replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-400 font-bold">⟷</span>
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {bureauB.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            {count} Overlap{count > 1 ? 's' : ''}
                          </span>
                          <Link
                            href="/overlaps"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
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
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  Violation Category Distribution
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">By Frequency</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Prevalence of predatory grievance types reported across all coordinated registries.
              </p>

              {cases.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No case data available for the current authorized scope.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const percentage = Math.round((count / cases.length) * 100);
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {cat.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-slate-500 text-[11px]">
                              {count} dockets ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-700 dark:bg-slate-300 rounded-full"
                              style={{ width: `${percentage}%` }}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-rose-500" />
                  Institutions Facing Multi-Bureau Investigations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Entities with concurrent proceedings in 2 or more separate administrative agencies.
                </p>
              </div>
              <Link
                href="/institutions?riskRating=CRITICAL"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Directory View <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">AISHE Code</th>
                    <th className="py-2.5 px-3">Institution</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Active Inquiries</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {institutions.filter((i) => i.activeCasesCount > 1).length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-slate-400 text-xs"
                      >
                        No repeat-offender institutions in the current authorized scope.
                      </td>
                    </tr>
                  ) : (
                    institutions
                      .filter((i) => i.activeCasesCount > 1)
                      .map((inst) => (
                        <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                            {inst.aisheCode}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {inst.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {inst.district}, {inst.state}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                            {inst.activeCasesCount} active cases
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              href={`/institutions/${inst.id}`}
                              className="text-blue-600 hover:underline font-medium"
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
          <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/30 rounded text-blue-400">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    PostgreSQL & Python/FastAPI Backend Integration Specification
                  </h3>
                  <p className="text-xs text-slate-400">
                    PostgreSQL DDL schema and clean REST/RPC service contract prepared for the upcoming Python correlation engine.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              CASEPULSE uses PostgreSQL as the authoritative data source via Next.js Route Handlers.
              Data source:{' '}
              <code className="text-blue-300">{summary.dataSource}</code>
              {summary.syntheticRecordsPresent && <span className="ml-2 font-semibold text-amber-300">· Synthetic records are included</span>}
            </p>
          </div>
        </>
      )}

      {/* Export Modal */}
      <ExportDossierModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
