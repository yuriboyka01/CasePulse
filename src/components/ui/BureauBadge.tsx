'use client';

import { BureauCode } from '@/types';
import React from 'react';

interface BureauBadgeProps {
  bureauId: BureauCode;
  size?: 'sm' | 'md' | 'lg';
}

const BUREAU_CONFIG: Record<
  BureauCode,
  { label: string; short: string; bg: string; text: string; border: string }
> = {
  AICTE_APPROVAL: {
    label: 'AICTE Approval Bureau',
    short: 'AICTE',
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  UGC_VIGILANCE: {
    label: 'UGC Vigilance & Grievances',
    short: 'UGC',
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  STATE_DTE_MAHA: {
    label: 'State DTE Maharashtra',
    short: 'DTE-MH',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
  },
  STATE_DTE_KAR: {
    label: 'State DTE Karnataka',
    short: 'DTE-KA',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  NARC_ANTI_RAGGING: {
    label: 'National Anti-Ragging Cell',
    short: 'NARC',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  CONSUMER_FORUM: {
    label: 'Consumer Disputes Commission',
    short: 'CONSUMER',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
};

export function BureauBadge({ bureauId, size = 'md' }: BureauBadgeProps) {
  const config = BUREAU_CONFIG[bureauId] || {
    label: bureauId,
    short: bureauId,
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  };

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'lg'
      ? 'px-3 py-1 text-sm'
      : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center font-bold tracking-tight rounded-md border shadow-2xs ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
      title={config.label}
    >
      {config.short}
    </span>
  );
}

export function BureauFullName({ bureauId }: { bureauId: BureauCode }) {
  const config = BUREAU_CONFIG[bureauId];
  return <span className="font-semibold text-slate-900 dark:text-slate-100">{config?.label || bureauId}</span>;
}
