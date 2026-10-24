'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  RotateCw,
  Search,
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
    <div className="space-y-6 text-[#202b2a]">
      {/* Header */}
      <div className="border-b border-[#dedfd6] pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#202b2a]">
                Cross-Bureau Overlap Review Workbench
              </h1>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fff2d9] text-[#805619] border border-[#e7d4a8]">
                {unreviewedCount} PENDING REVIEW
              </span>
            </div>
            <p className="text-sm text-[#65716c] mt-2 max-w-2xl leading-6">
              Review the evidence behind cross-bureau links, compare the underlying records, and leave a traceable decision.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono">
              Rule set v1.0 · score is a review signal, not a probability
            </span>
          </div>
        </div>

        {/* Methodology explanation callout */}
        <div className="mt-5 p-4 bg-[#e8efea] text-[#34443e] rounded-xl text-sm flex items-start gap-3 border border-[#d3e0d7]">
          <Info className="w-4 h-4 text-[#176b63] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-[#202b2a]">How to read a suggested relationship:</strong> CASEPULSE surfaces matching identifiers, case context, and patterns for an officer to review. An institution match is not proof that two complaints describe the same incident. Check each evidence value and its source before recording a decision.
          </div>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-[#fffefa] border border-[#dedfd6] rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Overlaps Flagged
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
            {totalOverlaps}
          </span>
        </div>

        <div className="p-4 bg-[#fff8e9] border border-[#eadbb7] rounded-xl">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
            Pending Triage (PROPOSED)
          </span>
          <span className="text-xl font-bold font-mono text-amber-900 dark:text-amber-200 mt-1 block">
            {unreviewedCount}
          </span>
        </div>

        <div className="p-4 bg-[#edf5ef] border border-[#d2e3d6] rounded-xl">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
            Confirmed Matches
          </span>
          <span className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-200 mt-1 block">
            {confirmedCount}
          </span>
        </div>

        <div className="p-4 bg-[#eef1f7] border border-[#d9deea] rounded-xl">
          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">
            Further Coordination
          </span>
          <span className="text-xl font-bold font-mono text-indigo-900 dark:text-indigo-200 mt-1 block">
            {furtherCoordCount}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#fffefa] border border-[#dedfd6] rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search overlap by ID, Docket No, Institution name, or rationale..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#d7dcd4] bg-[#fbfbf7] text-[#202b2a] placeholder:text-[#8b958d] focus:outline-none focus:ring-2 focus:ring-[#176b63]/25 focus:border-[#176b63]"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-medium text-slate-500 shrink-0">Match Type:</span>
            <select
              value={selectedMatchType}
              onChange={(e) => setSelectedMatchType(e.target.value)}
              className="text-sm py-2 px-3 rounded-lg border border-[#d7dcd4] bg-[#fffefa] text-[#202b2a] focus-visible:outline-[#176b63] w-full sm:w-auto min-w-0 max-w-full"
            >
              <option value="ALL">All Match Types</option>
              <option value="CONFIRMED_ID">Confirmed ID Matches (AISHE/Permanent ID)</option>
              <option value="HIGH_PROBABILITY_NAME">High Probability Name / Location</option>
              <option value="PATTERN_CORRELATION">Category / Behavioral Pattern</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-medium text-slate-500 shrink-0">Triage Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-sm py-2 px-3 rounded-lg border border-[#d7dcd4] bg-[#fffefa] text-[#202b2a] focus-visible:outline-[#176b63] w-full sm:w-auto min-w-0 max-w-full"
            >
              <option value="ALL">All Triage Statuses</option>
              <option value="PROPOSED">Pending Triage (PROPOSED)</option>
              <option value="CONFIRMED">Confirmed Matches (CONFIRMED)</option>
              <option value="FURTHER_COORDINATION">Further Coordination (FURTHER_COORDINATION)</option>
              <option value="REJECTED">Dismissed / False Positive (REJECTED)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content State: Error, Loading, Empty, or List */}
      {error ? (
        <div className="p-8 text-center bg-[#fff6f3] border border-[#ead0c8] rounded-xl">
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
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md mx-auto">
            {error.userFriendlyMessage}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={fetchOverlaps}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="p-16 text-center bg-[#fffefa] border border-[#dedfd6] rounded-xl">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Querying authoritative cross-bureau overlap relationships...
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Fetching PostgreSQL records</p>
        </div>
      ) : overlaps.length === 0 ? (
        <div className="p-12 text-center bg-[#fffefa] border border-[#dedfd6] rounded-xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            No cross-bureau overlaps matching your filter criteria
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
