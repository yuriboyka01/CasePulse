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
  accentVariant?: 'danger' | 'warning' | 'info' | 'success' | 'neutral';
}

const BADGE_STYLES: Record<NonNullable<MetricCardProps['badge']>['variant'], string> = {
  danger: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  warning: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  success: 'bg-[#ECFDF5] text-[#047857] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  info: 'bg-brand-soft text-brand border-brand/25',
  neutral: 'bg-muted text-ink-soft border-line',
};

export function MetricCard({ label, value, description, icon, badge, href }: MetricCardProps) {
  const content = (
    <SpotlightCard
      tilt
      className="group flex h-full flex-col justify-between overflow-hidden rounded-xl border border-[#E2DEC9] bg-white dark:border-line dark:bg-card p-4 shadow-[0_4px_20px_-2px_rgba(20,20,18,0.05),inset_0_1px_0_0_rgba(255,255,255,0.85)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:border-[#C5BFA8] hover:shadow-md cursor-pointer"
    >
      <div className="relative z-[2]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</span>
          {icon && <span className="rounded-lg bg-[#F4F2EC] dark:bg-raised p-1.5 text-brand ring-1 ring-line/50">{icon}</span>}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-ink" aria-live="off">
            <AnimatedNumber value={value} />
          </span>
          {badge && (
            <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-tight ${BADGE_STYLES[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">{description}</p>
      </div>

      {href && (
        <div className="relative z-[2] mt-3.5 -mx-4 -mb-4 flex items-center justify-between border-t border-line/60 bg-[#F4F2EC]/60 px-4 py-2 text-[11px] font-semibold text-ink-muted transition-colors group-hover:text-brand group-hover:bg-[#F4F2EC] dark:bg-card-muted/40 dark:group-hover:bg-card-muted">
          <span>View records</span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      )}
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
