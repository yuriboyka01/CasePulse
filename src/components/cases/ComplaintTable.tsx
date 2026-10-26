'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaseComplaint, CaseStatus } from '@/types';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  FileText,
} from 'lucide-react';

interface ComplaintTableProps {
  cases: CaseComplaint[];
  isLoading?: boolean;
}

function getNextActionSummary(status: CaseStatus, isOverdue: boolean): { action: string; urgency: 'normal' | 'high' } {
  switch (status) {
    case 'NEW':
      return { action: 'Documentary Intake Review & Show-Cause Notice', urgency: 'normal' };
    case 'UNDER_INVESTIGATION':
      return {
        action: isOverdue ? 'Emergency Spot Inspection (SLA Exceeded)' : 'Field Verification & Biometric Audit',
        urgency: isOverdue ? 'high' : 'normal',
      };
    case 'HEARING_SCHEDULED':
      return { action: 'Appellate Committee Evidentiary Hearing', urgency: 'high' };
    case 'ACTION_PENDING':
      return { action: 'Statutory Penalty & Remediation Enforcement', urgency: 'high' };
    case 'JOINT_INQUIRY':
      return { action: 'Multi-Bureau Synchronized Inquiry Protocol', urgency: 'high' };
    case 'RESOLVED':
      return { action: 'Compliance Certification Archival', urgency: 'normal' };
    case 'CLOSED':
      return { action: 'Closed Record / Final Order Stored', urgency: 'normal' };
    default:
      return { action: 'Administrative Review', urgency: 'normal' };
  }
}

export function ComplaintTable({ cases, isLoading }: ComplaintTableProps) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-10 text-center text-slate-500 shadow-xs">
        <Clock className="w-6 h-6 animate-spin mx-auto mb-2.5 text-[#4A5535]" />
        <p className="text-xs font-semibold text-ink">Loading regulatory case records...</p>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-12 text-center shadow-xs">
        <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <h4 className="text-sm font-bold text-ink">
          No matching complaints found
        </h4>
        <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
          Adjust your search terms, bureau jurisdiction, or status filters to display case files.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06),inset_0_1px_0_0_rgba(255,255,255,0.8)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.08)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#DFDBD2] dark:border-line bg-[#EFECE6]/80 dark:bg-[#0E110E]/80 text-[10.5px] font-bold uppercase tracking-wider text-ink-muted">
              <th className="py-2.5 px-3 w-[130px] min-w-[125px]">Case Docket</th>
              <th className="py-2.5 px-2.5 w-[85px] min-w-[80px]">Bureau</th>
              <th className="py-2.5 px-3 min-w-[210px] max-w-[260px]">Target Institution</th>
              <th className="py-2.5 px-3 min-w-[200px] max-w-[250px]">Allegation & Category</th>
              <th className="py-2.5 px-2.5 min-w-[130px] max-w-[155px]">Assigned Officer</th>
              <th className="py-2.5 px-3 min-w-[170px] max-w-[210px]">Next Action & SLA</th>
              <th className="py-2.5 px-3 min-w-[160px] text-right">Status & Scope</th>
              <th className="py-2.5 px-3 w-[80px] text-right pr-3.5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
            {cases.map((c) => {
              const filingDateFormatted = new Date(c.filingDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              const slaDateFormatted = new Date(c.slaDueDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              const nextAction = getNextActionSummary(c.status, c.isOverdue);

              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/cases/${c.id}`)}
                  className="hover:bg-[#F9F8F3] dark:hover:bg-[#1B211B]/60 transition-colors group cursor-pointer"
                >
                  {/* Case Docket */}
                  <td className="py-2.5 px-3 w-[130px] min-w-[125px] align-top">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/cases/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs font-bold text-ink hover:text-brand transition-colors"
                      >
                        {c.id}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, c.id)}
                        aria-label={`Copy Docket ID ${c.id}`}
                        title="Copy Docket ID"
                        className="opacity-0 group-hover:opacity-100 hover:text-brand text-ink-muted transition-opacity p-0.5 rounded cursor-pointer"
                      >
                        {copiedId === c.id ? (
                          <Check className="w-3 h-3 text-success" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] font-sans text-ink-muted mt-0.5">
                      Filed: <span className="font-mono">{filingDateFormatted}</span>
                    </div>
                  </td>

                  {/* Bureau */}
                  <td className="py-2.5 px-2.5 w-[85px] min-w-[80px] align-top whitespace-nowrap">
                    <BureauBadge bureauId={c.bureauId} size="sm" />
                  </td>

                  {/* Target Institution: line-clamp-2 wraps onto at most 2 lines */}
                  <td className="py-2.5 px-3 min-w-[210px] max-w-[260px] align-top">
                    <Link
                      href={`/institutions/${c.institutionId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-ink hover:text-brand block line-clamp-2 leading-snug transition-colors"
                      title={c.institutionName}
                    >
                      {c.institutionName}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono text-[9.5px] font-semibold px-1.5 py-0.2 rounded bg-[#F4F2EC] dark:bg-[#1B211B] text-ink-muted border border-line/60">
                        AISHE: {c.aisheCode}
                      </span>
                    </div>
                  </td>

                  {/* Allegation & Category: line-clamp-2 allows 2 full lines of wrapping */}
                  <td className="py-2.5 px-3 min-w-[200px] max-w-[250px] align-top">
                    <div
                      className="font-semibold text-ink line-clamp-2 leading-snug"
                      title={c.title}
                    >
                      {c.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono text-[9px] uppercase font-bold tracking-tight text-ink-muted px-1.5 py-0.2 rounded bg-[#F4F2EC] dark:bg-[#1B211B] border border-line/60">
                        {c.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>

                  {/* Assigned Officer */}
                  <td className="py-2.5 px-2.5 min-w-[130px] max-w-[155px] align-top">
                    <div className="font-semibold text-ink truncate" title={c.assignedOfficer.name}>
                      {c.assignedOfficer.name}
                    </div>
                    <div className="text-[10px] text-ink-muted truncate" title={c.assignedOfficer.designation}>
                      {c.assignedOfficer.designation}
                    </div>
                  </td>

                  {/* Next Action & SLA */}
                  <td className="py-2.5 px-3 min-w-[170px] max-w-[210px] align-top">
                    <div
                      className={`font-semibold text-xs truncate ${
                        nextAction.urgency === 'high' ? 'text-warning-ink' : 'text-ink-soft'
                      }`}
                      title={nextAction.action}
                    >
                      {nextAction.action}
                    </div>
                    <div className="text-[10px] font-mono mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={c.isOverdue ? 'text-red-700 dark:text-red-300 font-bold' : 'text-ink-muted'}>
                        Due: {slaDateFormatted}
                      </span>
                      {c.isOverdue && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800/60 shadow-2xs">
                          OVERDUE
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Combined Status & Scope (Stacked Cleanly) */}
                  <td className="py-2.5 px-3 min-w-[160px] align-top text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={c.status} isOverdue={c.isOverdue} />
                      {c.crossBureauFlag ? (
                        <Link
                          href={`/overlaps?search=${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shadow-2xs"
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          <span>Overlap ({c.overlapIds.length || 1})</span>
                        </Link>
                      ) : (
                        <span className="text-[9.5px] text-ink-muted font-medium pr-1">
                          Single Bureau
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Compact Actions */}
                  <td className="py-2.5 px-3 w-[80px] align-top text-right pr-3.5 whitespace-nowrap">
                    <Link
                      href={`/cases/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-line bg-white dark:bg-[#141814] text-ink-soft hover:border-brand hover:text-brand transition-all shadow-2xs group-hover:border-brand/50"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-[#EFECE6]/50 dark:bg-[#0E110E]/70 border-t border-[#DFDBD2] dark:border-line text-xs text-ink-muted flex items-center justify-between">
        <span className="font-medium">Showing {cases.length} case docket(s)</span>
        <span className="font-mono text-[10.5px]">CASEPULSE Unified Bureau Grid</span>
      </div>
    </div>
  );
}
