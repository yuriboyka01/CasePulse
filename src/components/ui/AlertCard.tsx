'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';

interface AlertCardProps {
  type: 'OVERDUE' | 'OVERLAP' | 'RISK';
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  actionText?: string;
}

export function AlertCard({
  type,
  title,
  subtitle,
  meta,
  href,
  actionText = 'Review Details',
}: AlertCardProps) {
  const getStyling = () => {
    switch (type) {
      case 'OVERDUE':
        return {
          border: 'border-l-4 border-l-rose-500 border-slate-200 dark:border-slate-800',
          bg: 'bg-white dark:bg-slate-900',
          icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
          badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
          badgeText: 'SLA BREACH',
        };
      case 'OVERLAP':
        return {
          border: 'border-l-4 border-l-amber-500 border-slate-200 dark:border-slate-800',
          bg: 'bg-white dark:bg-slate-900',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
          badgeText: 'CROSS-BUREAU OVERLAP',
        };
      case 'RISK':
      default:
        return {
          border: 'border-l-4 border-l-purple-500 border-slate-200 dark:border-slate-800',
          bg: 'bg-white dark:bg-slate-900',
          icon: <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
          badgeText: 'MULTI-BUREAU TARGET',
        };
    }
  };

  const style = getStyling();

  return (
    <div
      className={`p-4 rounded-md border shadow-xs ${style.border} ${style.bg} flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {style.icon}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${style.badge}`}
            >
              {style.badgeText}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {meta}
          </span>
        </div>

        <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
          {title}
        </h4>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
          {subtitle}
        </p>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400 transition-colors"
        >
          {actionText}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
