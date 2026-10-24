'use client';

import React from 'react';
import Link from 'next/link';
import { Institution } from '@/types';
import { RiskBadge } from '@/components/ui/StatusBadge';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { Building2, ChevronRight, MapPin } from 'lucide-react';

interface InstitutionCardProps {
  institution: Institution;
}

export function InstitutionCard({ institution }: InstitutionCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between">
      <div>
        {/* Top Meta */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-mono text-[11px] font-semibold text-slate-500">
                AISHE: {institution.aisheCode}
              </span>
              {institution.aictePermanentId && (
                <span className="text-[10px] text-slate-400 ml-2 font-mono">
                  AICTE: {institution.aictePermanentId}
                </span>
              )}
            </div>
          </div>
          <RiskBadge rating={institution.riskRating} />
        </div>

        {/* Institution Title */}
        <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
          {institution.name}
        </h3>

        {/* Location & Details */}
        <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate">
              {institution.district}, {institution.state} (PIN: {institution.pincode})
            </span>
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            Affiliation: {institution.affiliatedUniversity}
          </div>
        </div>

        {/* Bureau Involvement */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Cross-Bureau Involvement
          </div>
          <div className="flex flex-wrap gap-1">
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

      {/* Footer stats & action */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Cases</span>
            <strong className="font-mono text-slate-900 dark:text-slate-100 text-sm">
              {institution.activeCasesCount}
            </strong>
          </div>
          <div className="border-l border-slate-200 dark:border-slate-800 pl-3">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total History</span>
            <span className="font-mono text-slate-600 dark:text-slate-300 text-sm">
              {institution.totalCasesCount}
            </span>
          </div>
        </div>

        <Link
          href={`/institutions/${institution.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
        >
          View Profile
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
