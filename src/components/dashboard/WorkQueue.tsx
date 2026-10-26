'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Clock, GitPullRequest, Radar } from 'lucide-react';
import type { CaseComplaint, CaseOverlap } from '@/types';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { SpotlightCard } from '@/components/ui/SpotlightCard';

interface WorkQueueProps {
  cases: CaseComplaint[];
  pendingOverlaps: CaseOverlap[];
  unresolvedRelationships: number;
  detectedRelationships: number;
}

function formatFlaggedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function WorkQueue({ cases, pendingOverlaps, unresolvedRelationships, detectedRelationships }: WorkQueueProps) {
  const reviewedRelationships = Math.max(detectedRelationships - unresolvedRelationships, 0);
  const unresolvedAngle = detectedRelationships > 0
    ? (unresolvedRelationships / detectedRelationships) * 360
    : 0;

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-12" aria-label="Priority actions and relationship status">
      <SpotlightCard className="flex flex-col rounded-2xl border border-[#E2DEC9] dark:border-line bg-white dark:bg-card p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)] transition-all duration-200 hover:shadow-md hover:border-[#C5BFA8] sm:p-6 xl:col-span-7">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-danger-ink">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse" /> Priority queue
            </p>
            <h2 className="mt-1.5 text-lg font-bold tracking-tight text-ink">Cases needing attention</h2>
            <p className="mt-1 text-xs text-ink-muted">Overdue deadlines first, followed by open critical cases.</p>
          </div>
          <Link href="/cases?overdueOnly=true" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            Case register <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {cases.length > 0 ? (
          <ul className="divide-y divide-line/60">
            {cases.map((item) => (
              <li key={item.id}>
                <Link href={`/cases/${item.id}`} className="group flex items-start gap-3 rounded-xl px-2.5 py-3 transition-colors hover:bg-[#F9F8F3] dark:hover:bg-slate-800/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
                  <span className={`mt-0.5 rounded-lg p-1.5 ${item.isOverdue ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                    {item.isOverdue ? <AlertCircle className="h-4 w-4" aria-hidden="true" /> : <Clock className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink">{item.id}</span>
                      <BureauBadge bureauId={item.bureauId} size="sm" />
                      <span className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold ${item.isOverdue ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800/60' : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50'}`}>
                        {item.isOverdue ? 'OVERDUE' : 'CRITICAL'}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-ink group-hover:text-brand">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">{item.institutionName} · Due {formatFlaggedDate(item.slaDueDate)}</span>
                  </span>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-card-muted px-5 py-8 text-center">
            <div><p className="text-sm font-semibold text-ink">No priority cases right now</p><p className="mt-1 text-xs text-ink-muted">There are no open overdue or critical cases in your authorized scope.</p></div>
          </div>
        )}
      </SpotlightCard>

      <SpotlightCard className="flex flex-col rounded-2xl border border-[#E2DEC9] dark:border-line bg-white dark:bg-card p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)] transition-all duration-200 hover:shadow-md hover:border-[#C5BFA8] sm:p-6 xl:col-span-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand"><Radar className="h-3.5 w-3.5" /> Correlation radar</p>
            <h2 className="mt-1 text-base font-bold tracking-tight text-ink">Relationship review</h2>
          </div>
          <Link href="/overlaps" className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Open review</Link>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#F4F2EC]/60 dark:bg-card-muted p-3.5 border border-line/60">
          <div
            role="img"
            aria-label={`${unresolvedRelationships} unresolved relationships and ${reviewedRelationships} confirmed or rejected relationships`}
            className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full"
            style={{ background: detectedRelationships > 0 ? `conic-gradient(var(--warning) 0deg ${unresolvedAngle}deg, var(--success) ${unresolvedAngle}deg 360deg)` : 'var(--muted)' }}
          >
            <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-white dark:bg-card text-center">
              <span><span className="block font-mono text-base font-bold leading-none text-ink">{detectedRelationships.toLocaleString('en-IN')}</span><span className="mt-1 block text-[8px] uppercase tracking-wide text-ink-muted">total</span></span>
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-2" aria-label="Relationship status counts">
            <div className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-ink-muted"><span className="h-2 w-2 rounded-full bg-warning" />Unresolved</span><strong className="font-mono text-ink">{unresolvedRelationships.toLocaleString('en-IN')}</strong></div>
            <div className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-ink-muted"><span className="h-2 w-2 rounded-full bg-success" />Confirmed / rejected</span><strong className="font-mono text-ink">{reviewedRelationships.toLocaleString('en-IN')}</strong></div>
          </div>
        </div>

        <div className="mt-4 flex-1">
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Oldest items awaiting review</h3><span className="font-mono text-[10px] text-ink-muted">{unresolvedRelationships.toLocaleString('en-IN')} open</span></div>
          {pendingOverlaps.length > 0 ? (
            <ul className="divide-y divide-line/60">
              {pendingOverlaps.slice(0, 2).map((overlap) => (
                <li key={overlap.id}>
                  <Link href={`/overlaps?search=${encodeURIComponent(overlap.id)}`} className="group block rounded-lg p-2 transition-colors hover:bg-[#F9F8F3] dark:hover:bg-slate-800/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-semibold text-ink group-hover:text-brand">{overlap.institutionName}</span>
                      <span className="shrink-0 font-mono text-[10px] text-ink-muted">{overlap.id}</span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-ink-muted"><span className="truncate">{overlap.sourceCaseId} ↔ {overlap.targetCaseId}</span><span className="shrink-0 font-mono">{formatFlaggedDate(overlap.flaggedAt ?? overlap.flaggedDate)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-card-muted px-3 py-4 text-center text-xs text-ink-muted">No unresolved relationships require review.</p>
          )}
        </div>
        <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[10px] leading-relaxed text-ink-muted"><GitPullRequest className="mt-0.5 h-3 w-3 shrink-0" />A shared institution is not, by itself, evidence that complaints are duplicates.</p>
      </SpotlightCard>
    </section>
  );
}
