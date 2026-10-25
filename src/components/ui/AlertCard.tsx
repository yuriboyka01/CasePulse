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
          border: 'border-l-4 border-l-rose-500',
          icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
          badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
          badgeText: 'SLA BREACH',
          actionColor: 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300',
        };
      case 'OVERLAP':
        return {
          border: 'border-l-4 border-l-amber-500',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
          badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
          badgeText: 'CROSS-BUREAU OVERLAP',
          actionColor: 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300',
        };
      case 'RISK':
      default:
        return {
          border: 'border-l-4 border-l-violet-500',
          icon: <ShieldAlert className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />,
          badge: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
          badgeText: 'MULTI-BUREAU TARGET',
          actionColor: 'text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300',
        };
    }
  };

  const style = getStyling();

  return (
    <div
      className={`p-4 rounded-xl border border-line bg-card shadow-xs hover:shadow-md transition-all duration-200 ${style.border} flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {style.icon}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wide ${style.badge}`}
            >
              {style.badgeText}
            </span>
          </div>
          <span className="text-[11px] text-ink-muted font-mono">
            {meta}
          </span>
        </div>

        <h4 className="mt-2.5 text-sm font-bold text-ink line-clamp-1">
          {title}
        </h4>
        <p className="mt-1 text-xs text-ink-soft line-clamp-2 leading-relaxed">
          {subtitle}
        </p>
      </div>

      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
        <Link
          href={href}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.actionColor} transition-colors group`}
        >
          <span>{actionText}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
