'use client';

import Link from 'next/link';
import { ArrowRight, AlertCircle, GitPullRequest } from 'lucide-react';
import type { CaseComplaint } from '@/types';

interface WorkQueueProps {
  cases: CaseComplaint[];
  unresolvedRelationships: number;
  detectedRelationships: number;
}

/** Task-first entry point into the case register and cross-bureau review. */
export function WorkQueue({ cases, unresolvedRelationships, detectedRelationships }: WorkQueueProps) {
  const priorities = cases.filter((item) => item.isOverdue || item.severity === 'CRITICAL').slice(0, 4);

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4" aria-label="Operational priorities">
      <div className="rounded-xl border border-[#dedfd6] bg-[#fffefa] p-5 shadow-[0_2px_8px_rgba(32,43,42,0.025)]">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#176b63]">Work queue</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#202b2a]">Needs your attention</h2>
            <p className="mt-1 text-sm text-[#65716c]">Deadline breaches and critical cases, surfaced before the wider registry.</p>
          </div>
          <Link href="/cases" className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-[#176b63] hover:text-[#10564f]">Open register <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {priorities.length ? (
          <div className="divide-y divide-[#e9e9e2]">
            {priorities.map((item) => (
              <Link key={item.id} href={`/cases?search=${encodeURIComponent(item.id)}`} className="group flex items-start gap-3 py-3 first:pt-2 last:pb-0">
                <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${item.isOverdue ? 'text-[#a63d3d]' : 'text-[#8a5a16]'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#176b63]">{item.id}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${item.isOverdue ? 'text-[#a63d3d]' : 'text-[#8a5a16]'}`}>{item.isOverdue ? 'Deadline breached' : 'Critical severity'}</span>
                  </span>
                  <span className="mt-1 block text-sm font-medium text-[#283431] group-hover:text-[#176b63]">{item.title}</span>
                  <span className="mt-1 block text-xs text-[#65716c]">{item.institutionName} · {item.bureauId.replaceAll('_', ' ')}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#9aa39d] transition-transform group-hover:translate-x-0.5 group-hover:text-[#176b63]" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#cfd8d1] bg-[#f7f8f3] px-4 py-6 text-sm text-[#596761]">No critical or overdue cases are surfaced in this workspace.</div>
        )}
      </div>
      <div className="rounded-xl border border-[#dedfd6] bg-[#eeeee7] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65716c]">Coordination review</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-[#202b2a]">Potential relationships</h2>
          <span className="font-mono text-2xl font-semibold text-[#176b63]">{String(unresolvedRelationships).padStart(2, '0')}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#596761]">Proposed links need evidence review before they become operational findings. A shared institution identifier does not prove a duplicate complaint.</p>
        <div className="mt-4 border-t border-[#d9dcd2] pt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#65716c]"><GitPullRequest className="h-3.5 w-3.5" /> {detectedRelationships} detected in this dataset</span>
          <Link href="/overlaps" className="inline-flex items-center gap-1 rounded-md bg-[#176b63] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#10564f]">Review evidence <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
    </section>
  );
}
