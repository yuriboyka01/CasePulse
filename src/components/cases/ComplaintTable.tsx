'use client';

import React from 'react';
import Link from 'next/link';
import { CaseComplaint, CaseStatus } from '@/types';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
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
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-slate-500 shadow-xs">
        <Clock className="w-6 h-6 animate-spin mx-auto mb-2.5 text-blue-500" />
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Loading regulatory case records...</p>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center shadow-xs">
        <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          No matching complaints found
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
          Adjust your search terms, bureau jurisdiction, or status filters to display case files.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-3.5 px-4">Case Docket</th>
              <th className="py-3.5 px-3">Bureau</th>
              <th className="py-3.5 px-4">Target Institution</th>
              <th className="py-3.5 px-4">Allegation & Category</th>
              <th className="py-3.5 px-3">Assigned Officer</th>
              <th className="py-3.5 px-4">Next Action & SLA</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 px-3">Cross-Bureau</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
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
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  {/* Case Docket */}
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    <Link
                      href={`/cases/${c.id}`}
                      className="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {c.id}
                    </Link>
                    <div className="text-[11px] font-sans text-slate-400 mt-0.5">
                      Filed: {filingDateFormatted}
                    </div>
                  </td>

                  {/* Bureau */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <BureauBadge bureauId={c.bureauId} size="sm" />
                  </td>

                  {/* Target Institution */}
                  <td className="py-3.5 px-4 max-w-[200px]">
                    <Link
                      href={`/institutions/${c.institutionId}`}
                      className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 block truncate transition-colors"
                      title={c.institutionName}
                    >
                      {c.institutionName}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 font-mono">
                      <span>AISHE: {c.aisheCode}</span>
                    </div>
                  </td>

                  {/* Allegation */}
                  <td className="py-3.5 px-4 max-w-[220px]">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={c.title}>
                      {c.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {c.category.replace(/_/g, ' ')}
                    </div>
                  </td>

                  {/* Assigned Officer */}
                  <td className="py-3.5 px-3 max-w-[170px]">
                    <div className="font-semibold text-slate-900 dark:text-white truncate" title={c.assignedOfficer.name}>
                      {c.assignedOfficer.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate" title={c.assignedOfficer.designation}>
                      {c.assignedOfficer.designation}
                    </div>
                  </td>

                  {/* Next Action & SLA */}
                  <td className="py-3.5 px-4 max-w-[200px]">
                    <div
                      className={`font-semibold truncate ${
                        nextAction.urgency === 'high' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
                      }`}
                      title={nextAction.action}
                    >
                      {nextAction.action}
                    </div>
                    <div className="text-[10px] font-mono mt-0.5 flex items-center gap-1.5">
                      <span className={c.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                        Due: {slaDateFormatted}
                      </span>
                      {c.isOverdue && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950 dark:text-rose-300">
                          OVERDUE
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <StatusBadge status={c.status} />
                  </td>

                  {/* Cross-Bureau Link */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {c.crossBureauFlag ? (
                      <Link
                        href={`/overlaps?search=${c.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Overlap</span>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">
                        Isolated
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <Link
                      href={`/cases/${c.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all shadow-2xs"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span className="font-medium">Showing {cases.length} case docket(s)</span>
        <span className="font-mono text-[11px]">CASEPULSE Benchmark Grid</span>
      </div>
    </div>
  );
}
