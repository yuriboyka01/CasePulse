'use client';

import React from 'react';
import { Search, X, Filter, AlertCircle, AlertTriangle } from 'lucide-react';
import { BUREAUS } from '@/data/synthetic-dataset';

interface SearchFilterBarProps {
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
}: SearchFilterBarProps) {
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedBureau !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    overdueOnly ||
    overlapOnly;

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Search Input Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Case ID, AISHE Code, Institution Name, or Allegation keywords..."
            className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Dropdown Filters & Quick Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
        {/* Bureau Select */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Originating Bureau
          </label>
          <select
            value={selectedBureau}
            onChange={(e) => onBureauChange(e.target.value)}
            className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Bureaus (Multi-Agency)</option>
            {BUREAUS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shortName}
              </option>
            ))}
          </select>
        </div>

        {/* Case Status */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Investigation Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>

        {/* Complaint Category */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Violation Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="CAPITATION_FEE">Capitation Fee / Extortion</option>
            <option value="WITHHOLDING_DOCUMENTS">Withholding Certificates</option>
            <option value="GHOST_FACULTY">Ghost Faculty / Fake Cadre</option>
            <option value="RAGGING_HARASSMENT">Ragging & Safety Violation</option>
            <option value="INFRASTRUCTURE_DEFICIT">Infrastructure Deficit</option>
            <option value="UNAPPROVED_COURSES">Unapproved Courses / Seats</option>
            <option value="FALSE_ACCREDITATION">False Accreditation / Claims</option>
          </select>
        </div>

        {/* Quick Toggles: Overdue SLA */}
        <div className="flex items-center pt-2 sm:pt-5">
          <label
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all w-full select-none ${
              overdueOnly
                ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                : 'bg-slate-50/60 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => onOverdueToggle(e.target.checked)}
              className="sr-only"
            />
            <AlertCircle className={`w-3.5 h-3.5 ${overdueOnly ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Overdue SLA Only</span>
          </label>
        </div>

        {/* Quick Toggles: Cross-Bureau Overlap */}
        <div className="flex items-center pt-2 sm:pt-5">
          <label
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all w-full select-none ${
              overlapOnly
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-slate-50/60 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={overlapOnly}
              onChange={(e) => onOverlapToggle(e.target.checked)}
              className="sr-only"
            />
            <AlertTriangle className={`w-3.5 h-3.5 ${overlapOnly ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Cross-Bureau Overlap</span>
          </label>
        </div>
      </div>
    </div>
  );
}
