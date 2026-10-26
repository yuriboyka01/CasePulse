'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Download, FileText, RefreshCw } from 'lucide-react';
import { exportDocketsToCsv } from '@/lib/export-utils';
import { SearchFilterBar } from '@/components/common/SearchFilterBar';
import { WorkspaceHeader } from '@/components/common/WorkspaceHeader';
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
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const handleExportCsv = () => {
    if (cases.length === 0) return;
    const result = exportDocketsToCsv(cases);
    setToastNotice(`✓ Exported ${result.count} filtered dockets to CSV`);
    setTimeout(() => setToastNotice(null), 4000);
  };

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

  const overdueCount = cases.filter((c) => c.isOverdue).length;
  const overlapCount = cases.filter((c) => c.crossBureauFlag).length;

  const displayCount =
    loadState === 'success' ? totalCount : loadState === 'loading' ? '…' : '—';

  return (
    <div className="space-y-4">
      {/* Sleek Workspace Command Header */}
      <WorkspaceHeader
        eyebrows={
          <>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5535]">
              Case Intelligence
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 tabular-nums">
              {displayCount} DOCKETS
            </span>
            {cases.some((record) => record.isSynthetic) && (
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50">
                Synthetic records
              </span>
            )}
          </>
        }
        title="Inter-Bureau Complaint & Case Register"
        subtitle="Authoritative multi-agency registry of grievances across AICTE, UGC, State DTEs, Anti-Ragging Cell, and Consumer Forum."
        actions={
          <>
            <Link href="/cases/new" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:opacity-90">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Register received case</span>
            </Link>
            <button
              onClick={handleExportCsv}
              disabled={cases.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-line bg-white hover:bg-stone-50 dark:bg-card dark:hover:bg-card-muted text-ink-soft shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-ink-muted" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setIsExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-line bg-white hover:bg-stone-50 dark:bg-card dark:hover:bg-card-muted text-ink-soft shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-ink-muted" />
              <span>Export Register Data</span>
            </button>
          </>
        }
      />

      {/* Unified Command Filter Bar */}
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
        overdueCount={overdueCount}
        overlapCount={overlapCount}
      />

      {/* Loading state */}
      {loadState === 'loading' && (
        <div className="py-16 text-center text-ink-muted rounded-2xl border border-line bg-card shadow-xs">
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
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 bg-card text-danger-ink hover:bg-rose-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Case Table */}
      {loadState === 'success' && <ComplaintTable cases={cases} />}

      {toastNotice && (
        <div role="status" className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-950/80 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{toastNotice}</span>
        </div>
      )}

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
