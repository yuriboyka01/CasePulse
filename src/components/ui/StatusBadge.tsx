'use client';

import { CaseSeverity, CaseStatus, OverlapMatchType, OverlapStatus, RelationshipStatus, RiskRating } from '@/types';
import React from 'react';

interface StatusBadgeProps {
  status: CaseStatus;
  isOverdue?: boolean;
}

export function StatusBadge({ status, isOverdue }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'NEW':
        return {
          bg: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80',
          dot: 'bg-sky-500',
          label: 'New Intake',
        };
      case 'UNDER_INVESTIGATION':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/80',
          dot: 'bg-blue-500',
          label: 'Under Investigation',
        };
      case 'HEARING_SCHEDULED':
        return {
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/80',
          dot: 'bg-indigo-500',
          label: 'Hearing Scheduled',
        };
      case 'ACTION_PENDING':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80',
          dot: 'bg-amber-500',
          label: 'Action Pending',
        };
      case 'JOINT_INQUIRY':
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/80',
          dot: 'bg-purple-500',
          label: 'Joint Inquiry Active',
        };
      case 'RESOLVED':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80',
          dot: 'bg-emerald-500',
          label: 'Resolved',
        };
      case 'CLOSED':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          dot: 'bg-slate-500',
          label: 'Closed',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          dot: 'bg-slate-400',
          label: status,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
      {isOverdue && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
          OVERDUE
        </span>
      )}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: CaseSeverity }) {
  switch (severity) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
          <span className="w-1 h-1 rounded-full bg-[#DC2626]" />
          CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          <span className="w-1 h-1 rounded-full bg-[#B45309]" />
          HIGH
        </span>
      );
    case 'ELEVATED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          ELEVATED
        </span>
      );
    case 'ROUTINE':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          ROUTINE
        </span>
      );
  }
}

export function RiskBadge({ rating }: { rating: RiskRating }) {
  switch (rating) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
          CRITICAL RISK
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
          HIGH RISK
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          MEDIUM RISK
        </span>
      );
    case 'LOW':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#ECFDF5] border border-emerald-200 text-[#047857] dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-[#047857]" />
          LOW RISK
        </span>
      );
  }
}

export function OverlapTypeBadge({ type }: { type: OverlapMatchType }) {
  switch (type) {
    case 'CONFIRMED_ID':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Confirmed ID Match
        </span>
      );
    case 'HIGH_PROBABILITY_NAME':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          High-Probability Entity
        </span>
      );
    case 'PATTERN_CORRELATION':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Behavioral Pattern
        </span>
      );
  }
}

export function OverlapStatusBadge({ status }: { status: OverlapStatus | RelationshipStatus | string }) {
  switch (status) {
    case 'CONFIRMED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
          Verified Match
        </span>
      );
    case 'FURTHER_COORDINATION':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
          Further Coordination
        </span>
      );
    case 'JOINT_INQUIRY_INITIATED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
          Joint Inquiry Underway
        </span>
      );
    case 'REJECTED':
    case 'DISMISSED_FALSE_POSITIVE':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
          Dismissed (False Positive)
        </span>
      );
    case 'PROPOSED':
    case 'UNREVIEWED':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
          Pending Triage
        </span>
      );
  }
}
