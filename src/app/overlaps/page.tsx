'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  GitPullRequest,
  Info,
  RotateCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { CaseOverlap, RelationshipStatus } from '@/types';
import { apiClient, ApiClientError, OverlapFilters } from '@/lib/api-client';
import { OverlapReviewPanel } from '@/components/overlaps/OverlapReviewPanel';

function OverlapsContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMatchType, setSelectedMatchType] = useState<string>('ALL');

  const [overlaps, setOverlaps] = useState<CaseOverlap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);

  const fetchOverlaps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: OverlapFilters = {
        page: 1,
        pageSize: 100,
      };
      if (selectedStatus !== 'ALL') {
        filters.status = selectedStatus as RelationshipStatus;
      }
      if (selectedMatchType !== 'ALL') {
        filters.matchType = selectedMatchType;
      }
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }

      const res = await apiClient.getOverlaps(filters);
      setOverlaps(res.data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err);
      } else {
        setError(new ApiClientError(0, 'UNKNOWN_ERROR', 'Failed to retrieve overlap relationships from backend.'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, selectedMatchType, searchQuery]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const filters: OverlapFilters = {
          page: 1,
          pageSize: 100,
        };
        if (selectedStatus !== 'ALL') {
          filters.status = selectedStatus as RelationshipStatus;
        }
        if (selectedMatchType !== 'ALL') {
          filters.matchType = selectedMatchType;
        }
        if (searchQuery.trim()) {
          filters.search = searchQuery.trim();
        }

        const res = await apiClient.getOverlaps(filters);
        if (!ignore) {
          setOverlaps(res.data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          if (err instanceof ApiClientError) {
            setError(err);
          } else {
            setError(new ApiClientError(0, 'UNKNOWN_ERROR', 'Failed to retrieve overlap relationships from backend.'));
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [selectedStatus, selectedMatchType, searchQuery]);

  const handleReviewSuccess = (updatedRelationship: CaseOverlap) => {
    setOverlaps((prev) =>
      prev.map((o) => (o.id === updatedRelationship.id ? { ...o, ...updatedRelationship } : o))
    );
  };

  const totalOverlaps = overlaps.length;
  const unreviewedCount = overlaps.filter((o) => o.status === 'PROPOSED' || o.status === 'UNREVIEWED').length;
  const confirmedCount = overlaps.filter((o) => o.status === 'CONFIRMED').length;
  const furtherCoordCount = overlaps.filter((o) => o.status === 'FURTHER_COORDINATION').length;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Cross-Bureau Overlap Review Workbench
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                {unreviewedCount} PENDING REVIEW
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
              Inspect multi-attribute deterministic correlation evidence, compare paired dockets across regulatory silos, and record traceable triage actions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Deterministic v2.0 Engine
            </span>
          </div>
        </div>

        {/* Methodology explanation callout */}
        <div className="mt-4 p-4 bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 rounded-xl text-xs flex items-start gap-3 border border-blue-200/80 dark:border-blue-900/60">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-blue-950 dark:text-blue-100">Verification Protocol:</strong> CASEPULSE surfaces matching identifiers (AISHE/Permanent ID), geospatial proximity, and predatory pattern co-occurrence. A shared institution code indicates jurisdictional synergy; officers must verify allegation independence before initiating joint inquiry or dismissal.
          </div>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Overlaps Flagged
          </span>
          <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 block">
            {totalOverlaps}
          </span>
        </div>

        <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
            Pending Triage (PROPOSED)
          </span>
          <span className="text-2xl font-extrabold font-mono text-amber-900 dark:text-amber-200 mt-1 block">
            {unreviewedCount}
          </span>
        </div>

        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
            Confirmed Matches
          </span>
          <span className="text-2xl font-extrabold font-mono text-emerald-900 dark:text-emerald-200 mt-1 block">
            {confirmedCount}
          </span>
        </div>

        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider block">
            Further Coordination
          </span>
          <span className="text-2xl font-extrabold font-mono text-indigo-900 dark:text-indigo-200 mt-1 block">
            {furtherCoordCount}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search overlap by ID, Docket No, Institution name, or rationale..."
            className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Match Type:</span>
            <select
              value={selectedMatchType}
              onChange={(e) => setSelectedMatchType(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              <option value="ALL">All Match Types</option>
              <option value="CONFIRMED_ID">Confirmed ID (AISHE / AICTE ID)</option>
              <option value="HIGH_PROBABILITY_NAME">High Probability Name / District</option>
              <option value="PATTERN_CORRELATION">Category / Behavioral Pattern</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              <option value="ALL">All Statuses</option>
              <option value="PROPOSED">Pending Triage (PROPOSED)</option>
              <option value="CONFIRMED">Confirmed Matches (CONFIRMED)</option>
              <option value="FURTHER_COORDINATION">Further Coordination</option>
              <option value="REJECTED">Dismissed / False Positive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content State: Error, Loading, Empty, or List */}
      {error ? (
        <div className="p-8 text-center bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl shadow-xs">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            {error.status === 401
              ? 'Authentication Required'
              : error.status === 403
              ? 'Cross-Bureau Access Denied'
              : error.status === 503
              ? 'PostgreSQL Service Unavailable'
              : 'Unable to Load Overlaps'}
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 max-w-md mx-auto">
            {error.userFriendlyMessage}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={fetchOverlaps}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="p-16 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Querying authoritative cross-bureau overlap relationships...
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Fetching PostgreSQL records</p>
        </div>
      ) : overlaps.length === 0 ? (
        <div className="p-14 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No cross-bureau overlaps matching your filter criteria
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting the triage status or search query to inspect other flagged case correlations.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {overlaps.map((overlap) => (
            <OverlapReviewPanel
              key={overlap.id}
              overlap={overlap}
              onReviewSuccess={handleReviewSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverlapsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading Cross-Bureau Overlaps...</p>
        </div>
      }
    >
      <OverlapsContent />
    </Suspense>
  );
}
