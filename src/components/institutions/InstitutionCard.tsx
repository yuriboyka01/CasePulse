'use client';

import React from 'react';
import Link from 'next/link';
import { Institution } from '@/types';
import { RiskBadge } from '@/components/ui/StatusBadge';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { ChevronRight, MapPin } from 'lucide-react';

interface InstitutionCardProps {
  institution: Institution;
}

export function InstitutionCard({ institution }: InstitutionCardProps) {
  return (
    <SpotlightCard
      tilt
      className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-4 shadow-[0_1px_2px_rgba(20,20,18,0.04)] hover:border-[#C5BFA8] hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full group"
    >
      <div>
        {/* Top Meta: Monospace ID Pill on left, Semantic Risk Badge on right */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-[#F4F2EC] dark:bg-slate-800/80 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-ink-soft">
            <span>AISHE: {institution.aisheCode}</span>
            {institution.aictePermanentId && (
              <>
                <span className="text-slate-400">·</span>
                <span>AICTE: {institution.aictePermanentId}</span>
              </>
            )}
          </div>
          <RiskBadge rating={institution.riskRating} />
        </div>

        {/* Institution Title */}
        <h3 className="mt-3 text-sm font-bold text-ink line-clamp-2 leading-snug group-hover:text-[#4A5535] dark:group-hover:text-emerald-400 transition-colors">
          {institution.name}
        </h3>

        {/* Location & Details */}
        <div className="mt-2 space-y-1 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate">
              {institution.district}, {institution.state} (PIN: <span className="font-mono">{institution.pincode}</span>)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            Affiliation: {institution.affiliatedUniversity}
          </div>
        </div>

        {/* Bureau Involvement */}
        <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
            Coordinating Bureaus
          </div>
          <div className="flex flex-wrap gap-1.5">
            {institution.bureauInvolvement.length > 0 ? (
              institution.bureauInvolvement.map((b) => (
                <BureauBadge key={b} bureauId={b} size="sm" />
              ))
            ) : (
              <span className="text-[11px] text-slate-400">No active complaints across bureaus</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer stats & high-contrast command action */}
      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <div>
            <span className="text-ink-muted block text-[10px] uppercase font-bold tracking-tight">Active Cases</span>
            <strong className="font-mono text-ink text-sm font-bold tabular-nums">
              {institution.activeCasesCount}
            </strong>
          </div>
          <div className="border-l border-line pl-3">
            <span className="text-ink-muted block text-[10px] uppercase font-bold tracking-tight">Total History</span>
            <span className="font-mono text-ink-muted text-sm font-bold tabular-nums">
              {institution.totalCasesCount}
            </span>
          </div>
        </div>

        <Link
          href={`/institutions/${institution.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DFDBD2] dark:border-line bg-stone-50 dark:bg-slate-800 text-ink-soft transition-all duration-200 group-hover:bg-[#4A5535] group-hover:border-[#4A5535] group-hover:text-white shadow-2xs"
        >
          <span>Dossier</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </SpotlightCard>
  );
}
