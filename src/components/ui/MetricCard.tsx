'use client';

import React from 'react';
import Link from 'next/link';

interface MetricCardProps {
  label: string;
  value: number | string;
  description: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant: 'danger' | 'warning' | 'info' | 'success' | 'neutral';
  };
  href?: string;
  isUrgent?: boolean;
}

export function MetricCard({
  label,
  value,
  description,
  icon,
  badge,
  href,
  isUrgent,
}: MetricCardProps) {
  const content = (
    <div
      className={`relative p-5 rounded-lg border transition-colors ${
        isUrgent
          ? 'bg-rose-50/40 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60'
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {icon && <div className="text-slate-400 dark:text-slate-500">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
          {value}
        </div>
        {badge && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded border ${
              badge.variant === 'danger'
                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                : badge.variant === 'warning'
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                : badge.variant === 'success'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : badge.variant === 'info'
                ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-normal">
        {description}
      </p>
    </div>
  );

  if (href) {
    return <Link href={href} className="block group">{content}</Link>;
  }

  return content;
}
