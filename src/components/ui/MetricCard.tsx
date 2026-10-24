'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

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
  const getBadgeStyle = () => {
    switch (badge?.variant) {
      case 'danger':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      case 'success':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'neutral':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const content = (
    <div
      className={`relative p-5 rounded-xl border transition-all duration-200 ${
        isUrgent
          ? 'bg-rose-50/30 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60 shadow-xs hover:border-rose-300'
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-white/10 dark:hover:border-white/20 shadow-xs hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {icon && (
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
          {value}
        </div>
        {badge && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getBadgeStyle()}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
        {description}
      </p>

      {href && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
          <span>View records</span>
          <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group">
        {content}
      </Link>
    );
  }

  return content;
}
