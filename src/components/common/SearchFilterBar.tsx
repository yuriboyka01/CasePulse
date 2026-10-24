'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-3">
      {/* Search Input Row */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Case ID, AISHE Code, Institution Name, or Allegation keywords..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Dropdown Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
        {/* Bureau Select */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Originating Bureau
          </label>
          <select
            value={selectedBureau}
            onChange={(e) => onBureauChange(e.target.value)}
            className="w-full text-xs py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
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
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Investigation Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full text-xs py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
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
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Violation Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full text-xs py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
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

        {/* Quick Toggles */}
        <div className="flex items-center gap-2 pt-4">
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => onOverdueToggle(e.target.checked)}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
            />
            <span className={overdueOnly ? 'text-rose-600 font-bold' : ''}>
              Overdue SLA Only
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 pt-4">
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={overlapOnly}
              onChange={(e) => onOverlapToggle(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
            />
            <span className={overlapOnly ? 'text-amber-600 font-bold' : ''}>
              Has Cross-Bureau Overlap
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
