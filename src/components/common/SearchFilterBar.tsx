'use client';

import React from 'react';
import { Search, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { BUREAUS } from '@/data/synthetic-dataset';

export interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBureau: string;
  onBureauChange: (b: string) => void;
  selectedStatus: string;
  onStatusChange: (s: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  overdueOnly: boolean;
  onOverdueToggle: (v: boolean) => void;
  overlapOnly: boolean;
  onOverlapToggle: (v: boolean) => void;
  onReset: () => void;
  overdueCount?: number;
  overlapCount?: number;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  selectedBureau,
  onBureauChange,
  selectedStatus,
  onStatusChange,
  selectedCategory,
  onCategoryChange,
  overdueOnly,
  onOverdueToggle,
  overlapOnly,
  onOverlapToggle,
  onReset,
  overdueCount,
  overlapCount,
}: SearchFilterBarProps) {
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedBureau !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    overdueOnly ||
    overlapOnly;

  return (
    <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-3 shadow-[0_1px_2px_rgba(20,20,18,0.04)] space-y-2.5">
      {/* Responsive Command Row: Search + 3 Dropdowns */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter dockets by ID, AISHE, institution, or keyword…"
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line bg-stone-50/50 dark:bg-slate-900 text-ink placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4A5535] focus:bg-white font-medium"
          />
        </div>

        {/* 3 Select Dropdowns */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          <select
            value={selectedBureau}
            onChange={(e) => onBureauChange(e.target.value)}
            aria-label="Filter by originating bureau"
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-stone-50/50 dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-1 focus:ring-[#4A5535] shrink-0"
          >
            <option value="ALL">All Bureaus</option>
            {BUREAUS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shortName}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter by investigation status"
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-stone-50/50 dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-1 focus:ring-[#4A5535] shrink-0"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New Intake</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="HEARING_SCHEDULED">Hearing Scheduled</option>
            <option value="ACTION_PENDING">Action Pending</option>
            <option value="JOINT_INQUIRY">Joint Inquiry Active</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Filter by violation category"
            className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-stone-50/50 dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-1 focus:ring-[#4A5535] shrink-0 max-w-[170px] truncate"
          >
            <option value="ALL">All Violations</option>
            <option value="CAPITATION_FEE">Capitation Fee</option>
            <option value="WITHHOLDING_DOCUMENTS">Withholding Certs</option>
            <option value="GHOST_FACULTY">Ghost Faculty</option>
            <option value="RAGGING_HARASSMENT">Ragging & Safety</option>
            <option value="INFRASTRUCTURE_DEFICIT">Infrastructure</option>
            <option value="UNAPPROVED_COURSES">Unapproved Courses</option>
            <option value="FALSE_ACCREDITATION">False Accreditation</option>
          </select>
        </div>
      </div>

      {/* Quick Filter Chips & Reset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mr-1">
            Quick Filters:
          </span>

          {/* Overdue SLA Chip Toggle */}
          <button
            type="button"
            onClick={() => onOverdueToggle(!overdueOnly)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all select-none shadow-2xs ${
              overdueOnly
                ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                : 'bg-stone-50/60 dark:bg-slate-900 text-ink-muted border-line hover:border-slate-300 hover:text-ink'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                overdueOnly ? 'bg-[#DC2626] animate-pulse' : 'bg-slate-400'
              }`}
            />
            <AlertCircle className={`w-3 h-3 ${overdueOnly ? 'text-[#DC2626]' : 'text-slate-400'}`} />
            <span>Overdue SLA Only</span>
            {overdueCount !== undefined && (
              <span className="font-mono text-[10px] px-1 rounded bg-white/80 dark:bg-slate-800 border border-current">
                {overdueCount}
              </span>
            )}
          </button>

          {/* Cross-Bureau Overlap Chip Toggle */}
          <button
            type="button"
            onClick={() => onOverlapToggle(!overlapOnly)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all select-none shadow-2xs ${
              overlapOnly
                ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-stone-50/60 dark:bg-slate-900 text-ink-muted border-line hover:border-slate-300 hover:text-ink'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                overlapOnly ? 'bg-[#B45309]' : 'bg-slate-400'
              }`}
            />
            <AlertTriangle className={`w-3 h-3 ${overlapOnly ? 'text-[#B45309]' : 'text-slate-400'}`} />
            <span>Cross-Bureau Overlap</span>
            {overlapCount !== undefined && (
              <span className="font-mono text-[10px] px-1 rounded bg-white/80 dark:bg-slate-800 border border-current">
                {overlapCount}
              </span>
            )}
          </button>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Clear active filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
