'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Network,
} from 'lucide-react';
import { BUREAUS } from '@/data/synthetic-dataset';
import { MetricCard } from '@/components/ui/MetricCard';
import { WorkQueue } from '@/components/dashboard/WorkQueue';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { BureauConstellation } from '@/components/ui/BureauConstellation';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { ComplaintTable } from '@/components/cases/ComplaintTable';
import { ExportDossierModal } from '@/components/common/ExportDossierModal';
import { apiClient, ApiClientError, type DashboardOverview } from '@/lib/api-client';

type LoadState = 'loading' | 'success' | 'error';

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading command dashboard">
      <div className="flex animate-pulse flex-col justify-between gap-5 rounded-2xl border border-line bg-card p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="w-full space-y-3"><div className="h-7 w-3/5 rounded bg-muted" /><div className="h-3 w-4/5 rounded bg-muted" /><div className="h-3 w-2/3 rounded bg-muted" /></div>
        <div className="flex gap-2"><div className="h-9 w-28 rounded-lg bg-muted" /><div className="h-9 w-28 rounded-lg bg-muted" /></div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-line bg-card p-5"><div className="h-3 w-2/3 rounded bg-muted" /><div className="mt-5 h-8 w-1/3 rounded bg-muted" /><div className="mt-4 h-3 w-full rounded bg-muted" /><div className="mt-2 h-3 w-4/5 rounded bg-muted" /></div>)}</div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12"><div className="h-[390px] animate-pulse rounded-2xl border border-line bg-card xl:col-span-7" /><div className="h-[390px] animate-pulse rounded-2xl border border-line bg-card xl:col-span-5" /></div>
      <div className="h-72 animate-pulse rounded-2xl border border-line bg-card" />
      <span className="sr-only">Loading current records and metrics</span>
    </div>
  );
}

function DashboardReveal({ order, children }: { order: number; children: React.ReactNode }) {
  return <div className="dashboard-reveal" data-order={order}>{children}</div>;
}

export default function OverviewDashboardPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const requestSequence = useRef(0);

  const fetchDashboard = useCallback(async () => {
    const requestId = ++requestSequence.current;
    try {
      const overview = await apiClient.getDashboardOverview();
      if (requestId !== requestSequence.current) return;
      setData(overview);
      setLoadState('success');
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof ApiClientError ? err.userFriendlyMessage : 'Unable to load the command dashboard. Please retry.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void fetchDashboard(), 0);
    return () => window.clearTimeout(task);
  }, [fetchDashboard]);

  const retryDashboard = () => {
    setLoadState('loading');
    setError(null);
    void fetchDashboard();
  };

  if (loadState === 'loading' || (loadState === 'success' && !data)) return <DashboardSkeleton />;
  if (loadState === 'error' || !data) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-danger/25 bg-card p-6 text-center shadow-[var(--shadow-card)]" role="alert">
        <AlertCircle className="mx-auto h-8 w-8 text-danger" />
        <h1 className="mt-3 text-lg font-bold text-ink">Dashboard unavailable</h1>
        <p className="mt-1 text-sm text-ink-muted">{error ?? 'The current records could not be retrieved.'}</p>
        <button type="button" onClick={retryDashboard} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <AlertTriangle className="h-4 w-4" /> Retry
        </button>
      </section>
    );
  }

  const { summary, priorityCases, pendingOverlaps, recentCases } = data;
  const constellationNodes = BUREAUS.filter((bureau) => Object.hasOwn(summary.bureauCounts, bureau.id)).map((bureau) => ({ id: bureau.id, label: bureau.shortName, count: summary.bureauCounts[bureau.id] ?? 0 }));

  return (
    <div className="space-y-6">
      <DashboardReveal order={0}>
        <SpotlightCard as="section" className="surface-edge relative overflow-hidden rounded-2xl border border-[#E2DEC9] dark:border-line bg-white/95 dark:bg-card/90 p-5 sm:p-6 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[1.5px] bg-gradient-to-r from-transparent via-[#4A5535] to-transparent opacity-80" aria-hidden="true" />
          <div className="relative z-[2] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5535]">
                  Command overview
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[#EFECE6] dark:bg-card-muted px-2.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {summary.dataSource}
                </span>
                {summary.syntheticRecordsPresent && (
                  <span className="rounded-full border border-warning/30 bg-[#FFFBEB] dark:bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                    Synthetic records
                  </span>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink leading-tight">
                Inter-Bureau <span className="text-brass">Operational Command</span>
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-ink-muted leading-relaxed line-clamp-2 max-w-2xl">
                Statutory case priorities, cross-bureau correlation radar, and workloads across authorized bureaus in real-time coordination.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {summary.unresolvedOverlapsCount > 0 && (
                  <Link
                    href="/overlaps"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#4A5535] hover:bg-[#384227] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Review {summary.unresolvedOverlapsCount.toLocaleString('en-IN')} unresolved links
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setIsExportOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white hover:bg-stone-50 dark:bg-card dark:hover:bg-card-muted px-3.5 py-2 text-xs font-semibold text-ink-soft shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Executive dossier
                </button>
                <Link
                  href="/explorer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white hover:bg-stone-50 dark:bg-card dark:hover:bg-card-muted px-3.5 py-2 text-xs font-semibold text-ink-soft shadow-2xs transition-colors"
                >
                  <Network className="h-3.5 w-3.5" />
                  Explore relationships
                </Link>
              </div>
            </div>

            <div className="relative hidden lg:block h-[190px] xl:h-[210px] w-[320px] xl:w-[380px] rounded-xl border border-line/60 bg-gradient-to-b from-[#F4F2EC]/60 to-[#EFECE6]/40 dark:from-card-muted/40 dark:to-card-muted/10 overflow-hidden shrink-0 shadow-inner">
              <BureauConstellation nodes={constellationNodes} className="absolute inset-0" />
              <p className="pointer-events-none absolute bottom-2 left-0 right-3 text-right text-[9px] uppercase tracking-[0.16em] text-ink-muted">
                3D Bureau Constellation · Joint Desk Core
              </p>
            </div>
          </div>
        </SpotlightCard>
      </DashboardReveal>

      <DashboardReveal order={1}>
        <section aria-label="Operational metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Registered cases" value={summary.totalCases} description="All case records available within your authorized bureau scope." icon={<FileText className="h-4 w-4" />} badge={{ text: 'All records', variant: 'neutral' }} href="/cases" />
          <MetricCard label="Open cases" value={summary.pendingCases} description="Cases that have not reached a resolved or closed status." icon={<Clock3 className="h-4 w-4" />} badge={{ text: `${summary.totalCases ? Math.round((summary.pendingCases / summary.totalCases) * 100) : 0}% active`, variant: 'info' }} href="/cases" />
          <MetricCard label="Overdue cases" value={summary.overdueCases} description="Open cases past their recorded service-level due date." icon={<AlertCircle className="h-4 w-4" />} badge={{ text: 'Action needed', variant: 'danger' }} isUrgent={summary.overdueCases > 0} href="/cases?overdueOnly=true" />
          <MetricCard label="Critical cases" value={summary.criticalCases} description="Cases marked critical by the source record severity." icon={<AlertTriangle className="h-4 w-4" />} badge={{ text: 'High severity', variant: 'warning' }} isUrgent={summary.criticalCases > 0} href="/cases" />
          <MetricCard label="Unresolved links" value={summary.unresolvedOverlapsCount} description="Proposed or further-coordination relationships awaiting closure." icon={<Network className="h-4 w-4" />} badge={{ text: `${summary.flaggedOverlapsCount.toLocaleString('en-IN')} detected`, variant: 'warning' }} isUrgent={summary.unresolvedOverlapsCount > 0} href="/overlaps" />
        </section>
      </DashboardReveal>

      <DashboardReveal order={2}>
        <WorkQueue cases={priorityCases} pendingOverlaps={pendingOverlaps} unresolvedRelationships={summary.unresolvedOverlapsCount} detectedRelationships={summary.flaggedOverlapsCount} />
      </DashboardReveal>

      <DashboardReveal order={3}>
        <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="bureau-workload-title">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 id="bureau-workload-title" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft"><BarChart3 className="h-4 w-4 text-brand" /> Bureau caseload distribution</h2>
              <p className="mt-1 text-xs text-ink-muted">Case records by originating bureau in your current scope.</p>
            </div>
            <span className="self-start rounded-md bg-card-muted px-2.5 py-1 font-mono text-xs font-semibold text-ink-soft sm:self-auto">{summary.totalCases.toLocaleString('en-IN')} total</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {BUREAUS.filter((bureau) => Object.hasOwn(summary.bureauCounts, bureau.id)).map((bureau) => {
              const count = summary.bureauCounts[bureau.id] ?? 0;
              const percentage = summary.totalCases > 0 ? Math.round((count / summary.totalCases) * 100) : 0;
              return (
                <SpotlightCard as={Link} key={bureau.id} href={`/cases?bureau=${bureau.id}`} className="group block rounded-xl border border-[#E2DEC9] dark:border-line bg-white dark:bg-card p-4 shadow-[0_1px_2px_rgba(20,20,18,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C5BFA8] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><BureauBadge bureauId={bureau.id} size="sm" /><h3 className="mt-1.5 truncate text-xs font-bold text-ink group-hover:text-brand">{bureau.shortName}</h3></div>
                    <div className="text-right"><span className="font-mono text-base font-extrabold text-ink">{count.toLocaleString('en-IN')}</span><span className="block font-mono text-[10px] text-ink-muted">{percentage}%</span></div>
                  </div>
                  <div className="my-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${bureau.shortName} share of cases`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-strong transition-[width] duration-700" style={{ width: `${percentage}%` }} /></div>
                  <span className="flex items-center justify-between gap-2 text-[10px] text-ink-muted"><span className="truncate">{bureau.contactOfficer.split('(')[0].trim()}</span><span className="shrink-0 font-mono">{count.toLocaleString('en-IN')} cases</span></span>
                </SpotlightCard>
              );
            })}
          </div>
        </section>
      </DashboardReveal>

      <DashboardReveal order={4}>
        <section className="space-y-3.5" aria-labelledby="recent-cases-title">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div><h2 id="recent-cases-title" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft"><FileText className="h-4 w-4 text-brand" /> Recently filed cases</h2><p className="mt-1 text-xs text-ink-muted">Latest case records, separate from the priority queue above.</p></div>
            <Link href="/cases" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-strong">Browse all {summary.totalCases.toLocaleString('en-IN')} cases <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          {recentCases.length > 0 ? <ComplaintTable cases={recentCases} /> : <div className="rounded-xl border border-dashed border-line bg-card px-4 py-10 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-success" /><p className="mt-2 text-sm font-semibold text-ink">No case records yet</p><p className="mt-1 text-xs text-ink-muted">New cases will appear here when they are available in your scope.</p></div>}
        </section>
      </DashboardReveal>

      {summary.syntheticRecordsPresent && <p className="text-center text-[10px] text-ink-muted">Synthetic records are included · Source: {summary.dataSource}</p>}
      <ExportDossierModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
