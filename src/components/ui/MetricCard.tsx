'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { SpotlightCard } from '@/components/ui/SpotlightCard';

interface MetricCardProps {
  label: string;
  value: number;
  description: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant: 'danger' | 'warning' | 'info' | 'success' | 'neutral';
  };
  href?: string;
  isUrgent?: boolean;
}

const BADGE_STYLES: Record<NonNullable<MetricCardProps['badge']>['variant'], string> = {
  danger: 'bg-danger/10 text-danger-ink border-danger/25',
  warning: 'bg-warning/10 text-warning-ink border-warning/25',
  success: 'bg-success/10 text-success-ink border-success/25',
  info: 'bg-brand-soft text-brand border-brand/25',
  neutral: 'bg-muted text-ink-soft border-line',
};

export function MetricCard({ label, value, description, icon, badge, href, isUrgent }: MetricCardProps) {
  const content = (
    <SpotlightCard
      tilt
      className={`surface-edge group h-full rounded-xl border p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 hover:shadow-[var(--shadow-lift)] sm:p-5 ${isUrgent ? 'border-danger/35 bg-danger/5' : 'border-line bg-card/85'}`}
    >
      <div className="relative z-[2]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</span>
          {icon && <span className="rounded-lg bg-raised p-1.5 text-brand ring-1 ring-line">{icon}</span>}
        </div>
        <div className="mt-3 flex min-h-12 items-end justify-between gap-2">
          <span className="font-display text-[2.6rem] font-medium leading-none tracking-tight text-ink [font-variant-numeric:lining-nums_tabular-nums]" aria-live="off">
            <AnimatedNumber value={value} />
          </span>
          {badge && <span className={`mb-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${BADGE_STYLES[badge.variant]}`}>{badge.text}</span>}
        </div>
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{description}</p>
        {href && (
          <div className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-3 text-[11px] font-semibold text-brand">
            <span>View records</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
        )}
      </div>
    </SpotlightCard>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      {content}
    </Link>
  ) : (
    content
  );
}
