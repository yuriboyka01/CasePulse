'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, GitPullRequest, Radar, Clock, ShieldAlert } from 'lucide-react';
import type { CaseComplaint } from '@/types';
import { BureauBadge } from '@/components/ui/BureauBadge';

interface WorkQueueProps {
  cases: CaseComplaint[];
  unresolvedRelationships: number;
  detectedRelationships: number;
}

/** Task-first entry point into the case register and cross-bureau review. */
export function WorkQueue({ cases, unresolvedRelationships, detectedRelationships }: WorkQueueProps) {
  const priorities = cases.filter((item) => item.isOverdue || item.severity === 'CRITICAL').slice(0, 4);

  return (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-5" aria-label="Operational priorities">
      {/* Left Column: Priority Work Queue */}
      <div className="xl:col-span-7 2xl:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Urgent Attention
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Statutory SLA Enforcements</span>
              </div>
              <h2 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Needs Immediate Intervention
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Deadline breaches and high-severity dockets prioritized ahead of routine filings.
              </p>
            </div>
            <Link
              href="/cases?overdueOnly=true"
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <span>Full Register</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {priorities.length ? (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {priorities.map((item) => (
                <Link
                  key={item.id}
                  href={`/cases/${item.id}`}
                  className="group flex items-start gap-3.5 py-3.5 first:pt-2 last:pb-1 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-xl px-2.5 -mx-2.5 transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    {item.isOverdue ? (
                      <div className="p-1 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                        <Clock className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.id}
                      </span>
                      <BureauBadge bureauId={item.bureauId} size="sm" />
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.isOverdue
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {item.isOverdue ? 'DEADLINE BREACHED' : 'CRITICAL SEVERITY'}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.institutionName} · {item.bureauId.replaceAll('_', ' ')}
                    </span>
                  </span>

                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-6 text-center text-xs text-slate-500">
              No critical or overdue cases surfaced in this jurisdiction.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Coordination Radar */}
      <div className="xl:col-span-5 2xl:col-span-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/60 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" style={{ animationDuration: '6s' }} />
              Correlation Radar
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              v2 Engine
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Pending Triage Pairs
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-agency cross-correlations requiring review
              </p>
            </div>
            <span className="font-mono text-4xl font-extrabold text-blue-600 dark:text-blue-400">
              {String(unresolvedRelationships).padStart(2, '0')}
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Automated multi-attribute engine matched potential overlaps using AISHE codes, geographic district bounds, and predatory patterns. Evidence review required before joint enforcement.
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <GitPullRequest className="h-3.5 w-3.5 text-blue-500" />
            <span>{detectedRelationships} total detected</span>
          </span>
          <Link
            href="/overlaps"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <span>Review Evidence</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
