'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Building2, RefreshCw, Search } from 'lucide-react';
import { InstitutionCard } from '@/components/institutions/InstitutionCard';
import { WorkspaceHeader } from '@/components/common/WorkspaceHeader';
import { apiClient, ApiClientError, InstitutionFilters } from '@/lib/api-client';
import { Institution } from '@/types';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

function InstitutionsContent() {
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedRisk, setSelectedRisk] = useState<string>(searchParams.get('riskRating') || 'ALL');
  const [selectedState, setSelectedState] = useState<string>('ALL');

  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // States extracted from loaded data for filter dropdown
  const [availableStates, setAvailableStates] = useState<string[]>([]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInstitutions = useCallback(async (filters: InstitutionFilters) => {
    setLoadState('loading');
    setError(null);
    try {
      const res = await apiClient.getInstitutions({ ...filters, pageSize: 100 });
      setInstitutions(res.data);
      setTotalCount(res.meta.totalCount);

      // Extract unique states for the state filter dropdown
      if (!filters.state || filters.state === 'ALL') {
        const states = Array.from(new Set(res.data.map((i) => i.state))).sort();
        setAvailableStates(states);
      }

      setLoadState('success');
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.userFriendlyMessage
          : 'Failed to load institutions. Please retry.';
      setError(msg);
      setLoadState('error');
      setInstitutions([]);
      setTotalCount(0);
    }
  }, []);

  useEffect(() => {
    const filters: InstitutionFilters = {
      search: searchQuery,
      riskRating: selectedRisk,
      state: selectedState,
    };

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void fetchInstitutions(filters);
    }, 250);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery, selectedRisk, selectedState, fetchInstitutions]);

  const criticalCount = institutions.filter((i) => i.riskRating === 'CRITICAL').length;
  const repeatCount = institutions.filter((i) => i.activeCasesCount > 1).length;

  const displayCount =
    loadState === 'success' ? totalCount : loadState === 'loading' ? '…' : '—';

  return (
    <div className="space-y-4">
      {/* Workspace Command Header */}
      <WorkspaceHeader
        eyebrows={
          <>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5535] dark:text-[#8FA367]">
              Entity Registry
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700 tabular-nums">
              {displayCount} INSTITUTIONS
            </span>
            {institutions.some((record) => record.isSynthetic) && (
              <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" role="note">
                SYNTHETIC RECORDS INCLUDED
              </span>
            )}
          </>
        }
        title="Institution Intelligence Directory"
        subtitle="Master database of regulated technical, university, and medical institutes mapped to national AISHE and AICTE permanent identifiers."
        actions={
          loadState === 'success' ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900 font-mono text-xs font-semibold tabular-nums shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                {criticalCount} Critical Risk
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900 font-mono text-xs font-semibold tabular-nums shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                {repeatCount} Repeat Targets
              </span>
            </div>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-3 shadow-[0_1px_2px_rgba(20,20,18,0.04)] flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Institution Name, AISHE Code, AICTE ID, or District..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E2DEC9] dark:border-line bg-[#FAF9F5] dark:bg-slate-900 text-ink placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#4A5535]/25 focus:border-[#4A5535] font-medium transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="text-xs py-2 px-3 rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-[#4A5535]/25 focus:border-[#4A5535] cursor-pointer"
          >
            <option value="ALL">All Risk Ratings</option>
            <option value="CRITICAL">Critical Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>

          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="text-xs py-2 px-3 rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-[#4A5535]/25 focus:border-[#4A5535] cursor-pointer"
          >
            <option value="ALL">All States</option>
            {availableStates.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {(searchQuery || selectedRisk !== 'ALL' || selectedState !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRisk('ALL');
                setSelectedState('ALL');
              }}
              className="text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 px-2 py-1 cursor-pointer transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loadState === 'loading' && (
        <div className="py-16 text-center text-ink-muted rounded-2xl border border-line bg-card shadow-xs">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Filtering institution directory records…</p>
        </div>
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 flex items-start gap-3.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-900 dark:text-rose-300">
              Unable to load institution directory
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{error}</p>
          </div>
          <button
            onClick={() =>
              void fetchInstitutions({
                search: searchQuery,
                riskRating: selectedRisk,
                state: selectedState,
              })
            }
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 bg-card text-danger-ink hover:bg-rose-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Directory Cards Grid */}
      {loadState === 'success' && (
        <div>
          {institutions.length === 0 ? (
            <div className="p-14 text-center bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl shadow-xs">
              <Building2 className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
              <h3 className="text-sm font-bold text-ink">
                No institutions match the filter criteria
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                Try clearing your search or expanding the state selection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {institutions.map((inst) => (
                <InstitutionCard key={inst.id} institution={inst} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InstitutionsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading Institution Directory...</p>
        </div>
      }
    >
      <InstitutionsContent />
    </Suspense>
  );
}
