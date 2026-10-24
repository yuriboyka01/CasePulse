'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Download, FileText, RefreshCw } from 'lucide-react';
import { SearchFilterBar } from '@/components/common/SearchFilterBar';
import { ComplaintTable } from '@/components/cases/ComplaintTable';
import { ExportDossierModal } from '@/components/common/ExportDossierModal';
import { apiClient, ApiClientError, CaseFilters } from '@/lib/api-client';
import { CaseComplaint } from '@/types';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

function CasesContent() {
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedBureau, setSelectedBureau] = useState(searchParams.get('bureau') || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'ALL');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdueOnly') === 'true');
  const [overlapOnly, setOverlapOnly] = useState(searchParams.get('overlapOnly') === 'true');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseComplaint[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search queries so we don't fetch on every keystroke
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCases = useCallback(
    async (filters: CaseFilters) => {
      setLoadState('loading');
      setError(null);
      try {
        const res = await apiClient.getCases({ ...filters, pageSize: 100 });
        setCases(res.data);
        setTotalCount(res.meta.totalCount);
        setLoadState('success');
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.userFriendlyMessage
            : 'Failed to load cases. Please retry.';
        setError(msg);
        setLoadState('error');
        setCases([]);
        setTotalCount(0);
      }
    },
    []
  );

  // Fetch whenever filters change, with debounce on search
  useEffect(() => {
    const filters: CaseFilters = {
      search: searchQuery,
      bureau: selectedBureau,
      status: selectedStatus,
      category: selectedCategory,
      overdueOnly: overdueOnly || undefined,
      overlapOnly: overlapOnly || undefined,
    };

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void fetchCases(filters);
    }, 250);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    searchQuery,
    selectedBureau,
    selectedStatus,
    selectedCategory,
    overdueOnly,
    overlapOnly,
    fetchCases,
  ]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBureau('ALL');
    setSelectedStatus('ALL');
    setSelectedCategory('ALL');
    setOverdueOnly(false);
    setOverlapOnly(false);
  };

  const displayCount =
    loadState === 'success' ? totalCount : loadState === 'loading' ? '…' : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Inter-Bureau Complaint & Case Register
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
              {displayCount} DOCKETS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Authoritative multi-agency registry of grievances across AICTE, UGC, State DTEs, Anti-Ragging Cell, and Consumer Forum.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Export Register Data</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedBureau={selectedBureau}
        onBureauChange={setSelectedBureau}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        overdueOnly={overdueOnly}
        onOverdueToggle={setOverdueOnly}
        overlapOnly={overlapOnly}
        onOverlapToggle={setOverlapOnly}
        onReset={handleResetFilters}
      />

      {/* Loading state */}
      {loadState === 'loading' && (
        <div className="py-16 text-center text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827] shadow-xs">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Filtering complaint registry dockets…</p>
        </div>
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 flex items-start gap-3.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-900 dark:text-rose-300">
              Unable to load case records
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{error}</p>
          </div>
          <button
            onClick={() =>
              void fetchCases({
                search: searchQuery,
                bureau: selectedBureau,
                status: selectedStatus,
                category: selectedCategory,
                overdueOnly: overdueOnly || undefined,
                overlapOnly: overlapOnly || undefined,
              })
            }
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Case Table */}
      {loadState === 'success' && <ComplaintTable cases={cases} />}

      {/* Export Modal */}
      <ExportDossierModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading Case Register...</p>
        </div>
      }
    >
      <CasesContent />
    </Suspense>
  );
}
