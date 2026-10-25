'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Eye,
  Info,
  Maximize2,
  Minus,
  Move,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
  Plus,
  X,
} from 'lucide-react';
import { BureauBadge } from '@/components/ui/BureauBadge';
import {
  OverlapStatusBadge,
  OverlapTypeBadge,
  RiskBadge,
  SeverityBadge,
  StatusBadge,
} from '@/components/ui/StatusBadge';
import { BUREAUS } from '@/data/synthetic-dataset';
import { WorkspaceHeader } from '@/components/common/WorkspaceHeader';
import {
  Bureau,
  CaseComplaint,
  CaseOverlap,
  Institution,
  OverlapStatus,
} from '@/types';
import { apiClient, ApiClientError, OverlapReviewRecord } from '@/lib/api-client';

type SelectedItem =
  | { type: 'INSTITUTION'; data: Institution }
  | { type: 'CASE'; data: CaseComplaint }
  | { type: 'OVERLAP'; data: CaseOverlap }
  | { type: 'BUREAU'; data: Bureau }
  | null;

type LoadState = 'idle' | 'loading' | 'success' | 'error';

/** Link bowed toward the graph centre so crossing links separate visually. */
function curvePath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx + (450 - mx) * 0.34;
  const cy = my + (320 - my) * 0.34;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export default function ExplorerClient() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [overlaps, setOverlaps] = useState<CaseOverlap[]>([]);
  const [institutionTotalCount, setInstitutionTotalCount] = useState(0);
  const [overlapTotalCount, setOverlapTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [selectedBureau, setSelectedBureau] = useState<string>('ALL');
  const [selectedInstitution, setSelectedInstitution] = useState<string>('ALL');
  const [relationFilter, setRelationFilter] = useState<'ALL' | 'CONFIRMED' | 'POTENTIAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [viewMode, setViewMode] = useState<'GRAPH' | 'MATRIX'>('GRAPH');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [reviewHistory, setReviewHistory] = useState<{
    overlapId: string;
    state: 'loaded' | 'error';
    records: OverlapReviewRecord[];
  } | null>(null);
  const panStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const pendingRequest = useRef<Promise<void> | null>(null);

  // Bureaus come from the static config (not an API call)
  const bureaus = BUREAUS;

  const fetchData = useCallback(async () => {
    if (pendingRequest.current) return pendingRequest.current;
    setLoadState('loading');
    setLoadError(null);
    const request = (async () => {
      try {
        const [instRes, overlapsRes] = await Promise.all([
          apiClient.getInstitutions({ pageSize: 100 }),
          apiClient.getOverlaps({ pageSize: 100 }),
        ]);
        setInstitutions(instRes.data);
        setOverlaps(overlapsRes.data);
        setInstitutionTotalCount(instRes.meta.totalCount);
        setOverlapTotalCount(overlapsRes.meta.totalCount);
        setLoadState('success');
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.userFriendlyMessage
            : 'Failed to load relationship data. Please retry.';
        setLoadError(msg);
        setLoadState('error');
      } finally {
        pendingRequest.current = null;
      }
    })();
    pendingRequest.current = request;
    return request;
  }, []);

  const canLoadMore = institutions.length < institutionTotalCount || overlaps.length < overlapTotalCount;

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !canLoadMore) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextInstitutionPage = Math.floor(institutions.length / 100) + 1;
      const nextOverlapPage = Math.floor(overlaps.length / 100) + 1;
      const [institutionPage, overlapPage] = await Promise.all([
        institutions.length < institutionTotalCount
          ? apiClient.getInstitutions({ page: nextInstitutionPage, pageSize: 100 })
          : Promise.resolve(null),
        overlaps.length < overlapTotalCount
          ? apiClient.getOverlaps({ page: nextOverlapPage, pageSize: 100 })
          : Promise.resolve(null),
      ]);
      if (institutionPage) {
        setInstitutions((current) => [...current, ...institutionPage.data]);
        setInstitutionTotalCount(institutionPage.meta.totalCount);
      }
      if (overlapPage) {
        setOverlaps((current) => [...current, ...overlapPage.data]);
        setOverlapTotalCount(overlapPage.meta.totalCount);
      }
    } catch (err) {
      setLoadMoreError(err instanceof ApiClientError ? err.userFriendlyMessage : 'Could not load more relationship records. Please retry.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [canLoadMore, institutionTotalCount, institutions, isLoadingMore, overlapTotalCount, overlaps]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedOverlapId = selectedItem?.type === 'OVERLAP' ? selectedItem.data.id : null;
  const selectedReviewHistory = selectedOverlapId && reviewHistory?.overlapId === selectedOverlapId
    ? reviewHistory
    : null;

  useEffect(() => {
    if (!selectedOverlapId) return;
    let ignore = false;
    void apiClient.getOverlapReviews(selectedOverlapId, 1, 5).then(
      (response) => {
        if (ignore) return;
        setReviewHistory({ overlapId: selectedOverlapId, state: 'loaded', records: response.data });
      },
      () => {
        if (ignore) return;
        setReviewHistory({ overlapId: selectedOverlapId, state: 'error', records: [] });
      }
    );
    return () => {
      ignore = true;
    };
  }, [selectedOverlapId]);

  const resetGraphView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleGraphPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('[data-graph-item]')) return;
    panStart.current = { pointerX: event.clientX, pointerY: event.clientY, ...pan };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const handleGraphPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!panStart.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPan({
      x: panStart.current.x + ((event.clientX - panStart.current.pointerX) * 900) / (bounds.width * zoom),
      y: panStart.current.y + ((event.clientY - panStart.current.pointerY) * 640) / (bounds.height * zoom),
    });
  };

  const handleGraphPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    panStart.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // Filtered dataset — map API statuses to legacy UI statuses for filter compatibility
  const filteredOverlaps = useMemo(() => {
    return overlaps.filter((o) => {
      const isConfirmed = o.status === 'CONFIRMED' || o.status === 'JOINT_INQUIRY_INITIATED';
      const isPotential =
        o.status === 'UNREVIEWED' || o.status === 'PROPOSED';

      if (relationFilter === 'CONFIRMED') {
        if (!isConfirmed) return false;
      }
      if (relationFilter === 'POTENTIAL') {
        if (!isPotential) return false;
      }
      if (selectedBureau !== 'ALL') {
        if (o.sourceBureau !== selectedBureau && o.targetBureau !== selectedBureau) return false;
      }
      if (selectedInstitution !== 'ALL') {
        if (o.institutionId !== selectedInstitution) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = o.institutionName.toLowerCase().includes(q);
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesCase =
          o.sourceCaseId.toLowerCase().includes(q) ||
          o.targetCaseId.toLowerCase().includes(q) ||
          (o.sourceCaseTitle?.toLowerCase().includes(q) ?? false) ||
          (o.targetCaseTitle?.toLowerCase().includes(q) ?? false);
        if (!matchesName && !matchesId && !matchesCase) return false;
      }
      return true;
    });
  }, [overlaps, relationFilter, selectedBureau, selectedInstitution, searchQuery]);

  // Active institution IDs present in current filtered overlaps or selected institution
  const activeInstitutionIds = useMemo(() => {
    const set = new Set<string>();
    filteredOverlaps.forEach((o) => set.add(o.institutionId));
    if (selectedInstitution !== 'ALL') {
      set.add(selectedInstitution);
    }
    return set;
  }, [filteredOverlaps, selectedInstitution]);

  const activeInstitutions = useMemo(() => {
    return institutions.filter((i) => activeInstitutionIds.has(i.id));
  }, [institutions, activeInstitutionIds]);

  // Node positions computed deterministically in a ring/cluster layout
  // Center: (cx, cy) = (450, 320)
  const graphNodes = useMemo(() => {
    const cx = 450;
    const cy = 320;
    const instRadius = 175;
    const bureauRadius = 280;

    // Institution nodes on inner circle
    const instNodes = activeInstitutions.map((inst, index) => {
      const angle = (2 * Math.PI * index) / Math.max(activeInstitutions.length, 1) - Math.PI / 2;
      return {
        id: `inst-${inst.id}`,
        rawId: inst.id,
        type: 'INSTITUTION' as const,
        label: inst.name,
        aishe: inst.aisheCode,
        risk: inst.riskRating,
        x: cx + instRadius * Math.cos(angle),
        y: cy + instRadius * Math.sin(angle),
        data: inst,
      };
    });

    // 6 Bureau nodes on outer perimeter
    const bureauNodes = bureaus.map((bureau, index) => {
      const angle = (2 * Math.PI * index) / bureaus.length - Math.PI / 2;
      return {
        id: `bureau-${bureau.id}`,
        rawId: bureau.id,
        type: 'BUREAU' as const,
        label: bureau.shortName,
        fullName: bureau.name,
        x: cx + bureauRadius * Math.cos(angle),
        y: cy + bureauRadius * Math.sin(angle),
        data: bureau,
      };
    });

    return { instNodes, bureauNodes };
  }, [activeInstitutions, bureaus]);

  // Graph Edges
  const graphEdges = useMemo(() => {
    const instMap = new Map(graphNodes.instNodes.map((n) => [n.rawId, n]));
    const bureauMap = new Map(graphNodes.bureauNodes.map((n) => [n.rawId, n]));

    const edges: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isConfirmed: boolean;
      status: OverlapStatus;
      confidence: number;
      overlap: CaseOverlap;
    }> = [];

    filteredOverlaps.forEach((ovl) => {
      const sourceBureauNode = bureauMap.get(ovl.sourceBureau);
      const targetBureauNode = bureauMap.get(ovl.targetBureau);
      const instNode = instMap.get(ovl.institutionId);

      if (instNode && sourceBureauNode && targetBureauNode) {
        const isConfirmed =
          ovl.status === 'CONFIRMED' || ovl.status === 'JOINT_INQUIRY_INITIATED';

        // Connect source bureau to institution
        edges.push({
          id: `${ovl.id}-src`,
          x1: sourceBureauNode.x,
          y1: sourceBureauNode.y,
          x2: instNode.x,
          y2: instNode.y,
          isConfirmed,
          status: ovl.status,
          confidence: ovl.confidenceScore,
          overlap: ovl,
        });

        // Connect target bureau to institution
        edges.push({
          id: `${ovl.id}-tgt`,
          x1: instNode.x,
          y1: instNode.y,
          x2: targetBureauNode.x,
          y2: targetBureauNode.y,
          isConfirmed,
          status: ovl.status,
          confidence: ovl.confidenceScore,
          overlap: ovl,
        });
      }
    });

    return edges;
  }, [filteredOverlaps, graphNodes]);

  // Nodes related to the current selection stay lit; everything else recedes.
  const focusSet = useMemo(() => {
    if (!selectedItem) return null;
    const bureauIds = new Set<string>();
    const institutionIds = new Set<string>();
    for (const edge of graphEdges) {
      const o = edge.overlap;
      const related =
        selectedItem.type === 'OVERLAP'
          ? o.id === selectedItem.data.id
          : selectedItem.type === 'INSTITUTION'
          ? o.institutionId === selectedItem.data.id
          : o.sourceBureau === selectedItem.data.id || o.targetBureau === selectedItem.data.id;
      if (related) {
        bureauIds.add(o.sourceBureau);
        bureauIds.add(o.targetBureau);
        institutionIds.add(o.institutionId);
      }
    }
    if (selectedItem.type === 'BUREAU') bureauIds.add(selectedItem.data.id);
    if (selectedItem.type === 'INSTITUTION') institutionIds.add(selectedItem.data.id);
    return { bureauIds, institutionIds };
  }, [selectedItem, graphEdges]);

  const nodeStyle = (kind: 'bureau' | 'institution', rawId: string, order: number): React.CSSProperties => {
    const lit = focusSet === null || (kind === 'bureau' ? focusSet.bureauIds : focusSet.institutionIds).has(rawId);
    return {
      opacity: lit ? 1 : 0.26,
      transition: 'opacity 200ms ease',
      animationDelay: `${Math.min(order, 14) * 45}ms`,
    };
  };

  return (
    <div className="space-y-4">
      {/* Workspace Command Header */}
      <WorkspaceHeader
        eyebrows={
          <>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5535] dark:text-[#8FA367]">
              Network Topology
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700 tabular-nums">
              {loadState === 'success' ? filteredOverlaps.length : '…'} CORRELATIONS
            </span>
            {(institutions.some((record) => record.isSynthetic) || overlaps.some((record) => record.isSynthetic)) && (
              <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" role="note">
                SYNTHETIC INCLUDED
              </span>
            )}
          </>
        }
        title="Inter-Bureau Relationship Explorer"
        subtitle="Visual map of confirmed and potential regulatory links connecting institutions, case dockets, and coordinating bureaus."
        actions={
          <div role="group" aria-label="Explorer view" className="inline-flex rounded-lg border border-[#E2DEC9] dark:border-line p-0.5 bg-stone-100 dark:bg-slate-900 text-xs font-semibold shadow-2xs">
            <button
              onClick={() => setViewMode('GRAPH')}
              aria-pressed={viewMode === 'GRAPH'}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'GRAPH'
                  ? 'bg-white dark:bg-card text-ink shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-ink'
              }`}
            >
              Visual Topology
            </button>
            <button
              onClick={() => setViewMode('MATRIX')}
              aria-pressed={viewMode === 'MATRIX'}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'MATRIX'
                  ? 'bg-white dark:bg-card text-ink shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-ink'
              }`}
            >
              Correlation Matrix
            </button>
          </div>
        }
      />

      {/* Legend strip */}
      <div className="p-3 bg-[#20241A] text-stone-200 border border-[#384227] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-stone-400 font-semibold uppercase tracking-wider text-[10px] font-mono">
            Topology Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
            <span className="text-stone-300">Administrative Bureau</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-purple-500 ring-2 ring-purple-500/30" />
            <span className="text-stone-300">Regulated Institution</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-emerald-500 inline-block" />
            <span className="text-emerald-400 font-medium">Confirmed Relationship</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t border-dashed border-amber-400 inline-block" />
            <span className="text-amber-300 font-medium">Potential Overlap (Pending Triage)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-stone-500 inline-block" />
            <span className="text-stone-400 font-medium">Rejected / Dismissed</span>
          </div>
        </div>

        <div className="text-[11px] text-stone-400">
          Select a node or link to inspect evidence. Keyboard users can Tab through graph items.
        </div>
      </div>

      {/* Loading / Error States */}
      {loadState === 'loading' && (
        <div className="py-12 text-center text-slate-500">
          <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading topology data…</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="p-5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
              Topology data unavailable
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{loadError}</p>
          </div>
          <button
            onClick={() => void fetchData()}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded border border-rose-300 dark:border-rose-700 bg-card text-danger-ink hover:bg-rose-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {loadState === 'success' && (
        <>
          {/* Control / Filter Bar */}
          <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl p-3.5 space-y-3 shadow-[0_1px_2px_rgba(20,20,18,0.04)]">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search relationships by institution, case, or reference"
                  placeholder="Search by institution, case docket ID, or overlap reference..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900 text-ink placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#4A5535]/25 focus:border-[#4A5535] font-medium transition-colors"
                />
              </div>

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear relationship search"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 bg-stone-100 rounded-lg border border-[#E2DEC9] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Search
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Bureau Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Filter by Bureau Channel
                </label>
                <select
                  value={selectedBureau}
                  onChange={(e) => setSelectedBureau(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-[#4A5535]/25 focus:border-[#4A5535] cursor-pointer"
                >
                  <option value="ALL">All Bureaus (Multi-Agency Network)</option>
                  {bureaus.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.shortName} ({b.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Institution Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Focus Specific Institution
                </label>
                <select
                  value={selectedInstitution}
                  onChange={(e) => setSelectedInstitution(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-[#4A5535]/25 focus:border-[#4A5535] cursor-pointer"
                >
                  <option value="ALL">All Institutions ({institutions.length} Registered)</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.aisheCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Relationship Status Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Relationship Status Filter
                </label>
                <select
                  value={relationFilter}
                  onChange={(e) =>
                    setRelationFilter(e.target.value as 'ALL' | 'CONFIRMED' | 'POTENTIAL')
                  }
                  className="w-full text-xs py-2 px-3 rounded-lg border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-[#4A5535]/25 focus:border-[#4A5535] cursor-pointer"
                >
                  <option value="ALL">All Relationships (Confirmed & Potential)</option>
                  <option value="CONFIRMED">Confirmed / Joint Inquiry Only</option>
                  <option value="POTENTIAL">Potential / Unreviewed Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mobile relationship list keeps every connection readable without horizontal graph scrolling. */}
          <section className="md:hidden space-y-3" aria-label="Relationship results">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Relationships</h2>
              <span className="text-xs text-slate-500">{filteredOverlaps.length} shown</span>
            </div>
            {filteredOverlaps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-slate-500" role="status">
                No relationships match these filters. Clear a filter or broaden your search.
              </div>
            ) : (
              filteredOverlaps.map((overlap) => {
                const selected = selectedItem?.type === 'OVERLAP' && selectedItem.data.id === overlap.id;
                return (
                  <React.Fragment key={overlap.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedItem({ type: 'OVERLAP', data: overlap })}
                      className={`w-full rounded-xl border p-4 text-left shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-400' : 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-mono text-xs font-bold text-brand-strong">{overlap.id}</span>
                        <OverlapStatusBadge status={overlap.status} />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">{overlap.institutionName}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        <BureauBadge bureauId={overlap.sourceBureau} size="sm" />
                        <span aria-hidden="true">→</span>
                        <BureauBadge bureauId={overlap.targetBureau} size="sm" />
                        <span className="ml-auto font-semibold">{overlap.confidenceScore}% match</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Cases {overlap.sourceCaseId} · {overlap.targetCaseId}</p>
                    </button>
                    {selected && (
                      <div className="rounded-b-xl border border-t-0 border-blue-300 bg-white p-4 text-xs dark:border-blue-800 dark:bg-slate-900" aria-label={`Evidence for ${overlap.id}`}>
                        {overlap.isSynthetic && <p role="note" className="mb-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">Synthetic records</p>}
                        <h3 className="font-semibold text-ink">Why this relationship was flagged</h3>
                        {overlap.reasons.length > 0 ? (
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ink-soft">{overlap.reasons.slice(0, 3).map((reason, index) => <li key={`${overlap.id}-reason-${index}`}>{reason}</li>)}</ul>
                        ) : <p className="mt-1 text-slate-500">No reason details were returned.</p>}
                        <div className="mt-3 space-y-2">
                          {overlap.evidenceMatches.slice(0, 3).map((evidence, index) => (
                            <div key={`${overlap.id}-evidence-${index}`} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
                              <p className="font-semibold text-ink">{evidence.label}{evidence.isMatch ? ' · Match' : ''}</p>
                              <p className="mt-0.5 leading-relaxed text-slate-500">{evidence.description}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <Link href={`/cases/${overlap.sourceCaseId}`} className="font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">Open {overlap.sourceCaseId}</Link>
                          <Link href={`/cases/${overlap.targetCaseId}`} className="font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">Open {overlap.targetCaseId}</Link>
                          <Link href={`/overlaps?search=${encodeURIComponent(overlap.id)}`} className="font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">Review history & triage</Link>
                        </div>
                        {reviewHistory?.overlapId === overlap.id && reviewHistory.state === 'loaded' && reviewHistory.records[0] && (
                          <p className="mt-3 border-t border-slate-200 pt-3 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                            Latest decision: <strong>{reviewHistory.records[0].decision.replace(/_/g, ' ')}</strong> · {reviewHistory.records[0].reviewer.displayName}
                          </p>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </section>

          {/* Main Workspace: navigable relationship graph or matrix and evidence inspector */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Graph/Matrix Area */}
            <div className="hidden md:flex md:col-span-12 lg:col-span-8 surface-edge bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-[var(--shadow-lift)] ring-1 ring-brand/15 relative min-h-[560px] flex-col justify-between">
              {viewMode === 'GRAPH' && (
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5 text-xs text-slate-300">
                  <div className="inline-flex items-center gap-2"><Move className="h-3.5 w-3.5 text-slate-400" /><span>Drag to pan · Use controls to zoom</span></div>
                  <div className="inline-flex items-center gap-1">
                    <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((value) => Math.max(0.7, Math.round((value - 0.15) * 100) / 100))} className="rounded-lg border border-slate-700 p-2 text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400"><Minus className="h-4 w-4" /></button>
                    <span className="min-w-12 text-center font-mono" aria-live="polite">{Math.round(zoom * 100)}%</span>
                    <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((value) => Math.min(1.8, Math.round((value + 0.15) * 100) / 100))} className="rounded-lg border border-slate-700 p-2 text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400"><Plus className="h-4 w-4" /></button>
                    <button type="button" aria-label="Fit graph to view" title="Fit graph to view" onClick={resetGraphView} className="ml-1 rounded-lg border border-slate-700 p-2 text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400"><Maximize2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
              {viewMode === 'GRAPH' ? (
                <div className="w-full relative">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.5)_100%)]" />
                    <span className="absolute left-3 top-3 h-4 w-4 border-l border-t border-brand/60" />
                    <span className="absolute right-3 top-3 h-4 w-4 border-r border-t border-brand/60" />
                    <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-brand/60" />
                    <span className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-brand/60" />
                  </div>
                  <svg
                    viewBox={`${(900 - 900 / zoom) / 2 - pan.x} ${(640 - 640 / zoom) / 2 - pan.y} ${900 / zoom} ${640 / zoom}`}
                    className={`relationship-graph w-full h-auto select-none touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ background: 'radial-gradient(ellipse at center, #191e1b 0%, #0c0f0e 100%)', aspectRatio: '900 / 640' }}
                    role="group"
                    aria-label="Relationship network graph. Use Tab to select nodes and links. Drag the background to pan."
                    aria-describedby="relationship-graph-description"
                    onPointerDown={handleGraphPointerDown}
                    onPointerMove={handleGraphPointerMove}
                    onPointerUp={handleGraphPointerUp}
                    onPointerCancel={handleGraphPointerUp}
                  >
                    <defs>
                      {/* Subtle Grid pattern */}
                      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path
                          d="M 30 0 L 0 0 0 30"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.04)"
                          strokeWidth="1"
                        />
                      </pattern>
                      {/* Glow filter for confirmed links */}
                      <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      <radialGradient id="node-bureau" cx="35%" cy="30%" r="80%">
                        <stop offset="0%" stopColor="#323c36" />
                        <stop offset="100%" stopColor="#171c19" />
                      </radialGradient>
                      <radialGradient id="node-inst" cx="35%" cy="30%" r="80%">
                        <stop offset="0%" stopColor="#24343e" />
                        <stop offset="100%" stopColor="#10181d" />
                      </radialGradient>
                      <filter id="glow-brass" x="-70%" y="-70%" width="240%" height="240%">
                        <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#c5a46d" floodOpacity="0.7" />
                      </filter>
                    </defs>

                    <title>Relationship network</title>
                    <desc id="relationship-graph-description">Regulatory bureaus connect through institutions where an API-backed relationship has been recorded. Select a graph item to inspect its source records and evidence.</desc>

                    <rect width="900" height="640" fill="url(#grid)" />

                    {/* Central watermark */}
                    <text
                      x="450"
                      y="320"
                      textAnchor="middle"
                      fill="rgba(152, 166, 154, 0.08)"
                      fontSize="28"
                      fontFamily="monospace"
                      fontWeight="bold"
                      letterSpacing="4"
                    >
                      CASEPULSE TOPOLOGY
                    </text>

                    {/* Concentric Reference Rings */}
                    <circle
                      cx="450"
                      cy="320"
                      r="175"
                      fill="none"
                      stroke="rgba(152, 166, 154, 0.12)"
                      strokeDasharray="4 4"
                    />
                    <circle
                      cx="450"
                      cy="320"
                      r="280"
                      fill="none"
                      stroke="rgba(152, 166, 154, 0.08)"
                      strokeDasharray="2 4"
                    />

                    {/* Edges */}
                    <g className="edges">
                      {graphEdges.map((edge) => {
                        const isSelected =
                          selectedItem?.type === 'OVERLAP' &&
                          selectedItem.data.id === edge.overlap.id;
                        const isRelatedToSelection =
                          (selectedItem?.type === 'INSTITUTION' && selectedItem.data.id === edge.overlap.institutionId) ||
                          (selectedItem?.type === 'BUREAU' &&
                            (selectedItem.data.id === edge.overlap.sourceBureau || selectedItem.data.id === edge.overlap.targetBureau));
                        const isDimmed = selectedItem !== null && !isSelected && !isRelatedToSelection;

                        const strokeColor = edge.isConfirmed
                          ? '#72b79a' // emerald-500
                          : edge.status === 'DISMISSED_FALSE_POSITIVE' ||
                            edge.status === 'REJECTED'
                          ? '#6b776e' // slate-500
                          : '#eba23d'; // amber-500

                        return (
                          <g
                            key={edge.id}
                            data-graph-item
                            role="button"
                            tabIndex={0}
                            aria-label={`${edge.overlap.sourceBureau} to ${edge.overlap.institutionName} relationship ${edge.overlap.id}, ${edge.status.replace(/_/g, ' ').toLowerCase()}`}
                            aria-pressed={isSelected}
                            className="cursor-pointer transition-opacity group focus:outline-hidden"
                            onClick={() => setSelectedItem({ type: 'OVERLAP', data: edge.overlap })}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedItem({ type: 'OVERLAP', data: edge.overlap });
                              }
                            }}
                          >
                            {/* Hover trigger target */}
                            <path d={curvePath(edge.x1, edge.y1, edge.x2, edge.y2)} fill="none" stroke="transparent" strokeWidth="14" />
                            {/* Visible Line */}
                            <>
                              <path
                                d={curvePath(edge.x1, edge.y1, edge.x2, edge.y2)}
                                fill="none"
                                stroke={strokeColor}
                                strokeLinecap="round"
                                strokeWidth={isSelected ? 3.5 : edge.isConfirmed ? 2.5 : 1.75}
                                strokeDasharray={edge.isConfirmed ? undefined : '5 4'}
                                strokeOpacity={isSelected || isRelatedToSelection ? 1 : isDimmed ? 0.12 : edge.isConfirmed ? 0.65 : 0.5}
                                filter={isSelected || edge.isConfirmed ? 'url(#glow-emerald)' : 'url(#glow-amber)'}
                                className="transition-all hover:stroke-white hover:opacity-100"
                              />
                              {(isSelected || isRelatedToSelection) && (
                                <path
                                  d={curvePath(edge.x1, edge.y1, edge.x2, edge.y2)}
                                  fill="none"
                                  stroke="#eae7de"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeDasharray="2 14"
                                  className="edge-flow pointer-events-none"
                                />
                              )}
                            </>
                          </g>
                        );
                      })}
                    </g>

                    {/* Bureau Nodes (Outer ring) */}
                    <g className="bureau-nodes">
                      {graphNodes.bureauNodes.map((node, nodeIndex) => {
                        const isSelected =
                          selectedItem?.type === 'BUREAU' && selectedItem.data.id === node.rawId;

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            data-graph-item
                            role="button"
                            tabIndex={0}
                            aria-label={`${node.fullName} bureau`}
                            style={nodeStyle('bureau', node.rawId, nodeIndex)}
                            aria-pressed={isSelected}
                            className="graph-node graph-enter group cursor-pointer transition-transform duration-200 focus:outline-hidden"
                            onClick={() => setSelectedItem({ type: 'BUREAU', data: node.data })}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedItem({ type: 'BUREAU', data: node.data });
                              }
                            }}
                          >
                            <circle
                              r="28"
                              fill="url(#node-bureau)"
                              filter={isSelected ? 'url(#glow-brass)' : undefined}
                              stroke={isSelected ? '#c5a46d' : '#3a443e'}
                              strokeWidth={isSelected ? '3' : '2'}
                              className="hover:stroke-blue-400"
                            />
                            <circle
                              r="24"
                              fill="#222925"
                              stroke="#515c55"
                              strokeWidth="1"
                            />
                            <text
                              textAnchor="middle"
                              dy="-2"
                              fill="#d9bc80"
                              fontSize="10"
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              {node.label}
                            </text>
                            <text
                              textAnchor="middle"
                              dy="11"
                              fill="#6b776e"
                              fontSize="8"
                              fontWeight="600"
                            >
                              BUREAU
                            </text>
                          </g>
                        );
                      })}
                    </g>

                    {/* Institution Nodes (Inner ring) */}
                    <g className="institution-nodes">
                      {graphNodes.instNodes.map((node, nodeIndex) => {
                        const isSelected =
                          selectedItem?.type === 'INSTITUTION' &&
                          selectedItem.data.id === node.rawId;

                        const ringColor =
                          node.risk === 'CRITICAL'
                            ? '#e57967' // rose-600
                            : node.risk === 'HIGH'
                            ? '#ea580c' // orange-600
                            : node.risk === 'MEDIUM'
                            ? '#eba23d' // amber-600
                            : '#72b79a'; // emerald-500

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            data-graph-item
                            role="button"
                            tabIndex={0}
                            aria-label={`${node.label}, ${node.risk.toLowerCase()} risk institution, AISHE ${node.aishe}`}
                            style={nodeStyle('institution', node.rawId, nodeIndex)}
                            aria-pressed={isSelected}
                            className="graph-node graph-enter group cursor-pointer transition-transform duration-200 focus:outline-hidden"
                            onClick={() =>
                              setSelectedItem({ type: 'INSTITUTION', data: node.data })
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedItem({ type: 'INSTITUTION', data: node.data });
                              }
                            }}
                          >
                            {/* Pulsing ring for critical risk */}
                            {node.risk === 'CRITICAL' && (
                              <circle
                                r="28"
                                fill="none"
                                stroke="#e57967"
                                strokeWidth="1.5"
                                strokeOpacity="0.4"
                                className="animate-ping"
                              />
                            )}

                            <circle
                              r="22"
                              fill="url(#node-inst)"
                              filter={isSelected ? 'url(#glow-brass)' : undefined}
                              stroke={isSelected ? '#ffffff' : ringColor}
                              strokeWidth={isSelected ? '3' : '2'}
                            />
                            <circle
                              r="18"
                              fill="#16222b"
                              stroke="rgba(255, 255, 255, 0.15)"
                              strokeWidth="1"
                            />

                            {/* Short code text */}
                            <text
                              textAnchor="middle"
                              dy="4"
                              fill="#ffffff"
                              fontSize="8"
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              {node.aishe.slice(0, 7)}
                            </text>

                            {/* Institutional Name Callout label */}
                            <text
                              textAnchor="middle"
                              dy="34"
                              fill="#c9cbbf"
                              fontSize="9"
                              fontWeight="600"
                              className={`pointer-events-none transition-opacity ${graphNodes.instNodes.length > 12 && !isSelected ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' : 'opacity-100'}`}
                            >
                              {node.label.length > 20
                                ? `${node.label.slice(0, 18)}...`
                                : node.label}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                  {filteredOverlaps.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                      <div role="status" className="max-w-sm rounded-2xl border border-slate-700 bg-slate-950/95 p-5 text-center shadow-xl">
                        <p className="text-sm font-semibold text-white">No relationships in this view</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">Broaden your search or reset the filters to see matching connections.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Matrix View */
                <div className="p-4 overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Overlap Reference</th>
                        <th className="py-2.5 px-3">Target Institution</th>
                        <th className="py-2.5 px-3">Bureaus Correlated</th>
                        <th className="py-2.5 px-3">Confidence</th>
                        <th className="py-2.5 px-3">Relationship Status</th>
                        <th className="py-2.5 px-3 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {filteredOverlaps.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-12 text-center font-sans text-slate-400">No relationships match these filters.</td></tr>
                      )}
                      {filteredOverlaps.map((ovl) => {
                        const isSelected =
                          selectedItem?.type === 'OVERLAP' && selectedItem.data.id === ovl.id;

                        return (
                          <tr
                            key={ovl.id}
                            onClick={() => setSelectedItem({ type: 'OVERLAP', data: ovl })}
                            className={`hover:bg-slate-900/60 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-950/40 text-blue-200' : 'text-slate-300'
                            }`}
                          >
                            <td className="py-3 px-3 font-bold text-blue-400">{ovl.id}</td>
                            <td className="py-3 px-3 font-sans font-medium text-white max-w-[200px] truncate">
                              {ovl.institutionName}
                            </td>
                            <td className="py-3 px-3 font-sans">
                              <div className="flex items-center gap-1.5">
                                <BureauBadge bureauId={ovl.sourceBureau} size="sm" />
                                <span className="text-slate-500 font-bold">⇄</span>
                                <BureauBadge bureauId={ovl.targetBureau} size="sm" />
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`font-bold ${
                                  ovl.confidenceScore >= 80
                                    ? 'text-emerald-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {ovl.confidenceScore}%
                              </span>
                            </td>
                            <td className="py-3 px-3 font-sans">
                              <OverlapStatusBadge status={ovl.status} />
                            </td>
                            <td className="py-3 px-3 text-right font-sans">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem({ type: 'OVERLAP', data: ovl });
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs cursor-pointer"
                              >
                                <Eye className="w-3 h-3" /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Canvas Footer toolbar */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span>
                    Active Graph Nodes:{' '}
                    <strong className="text-white font-mono">
                      {graphNodes.instNodes.length + graphNodes.bureauNodes.length}
                    </strong>
                  </span>
                  <span>
                    Active Edges:{' '}
                    <strong className="text-white font-mono">{filteredOverlaps.length}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Clear relationship search"
                    onClick={() => {
                      setSelectedBureau('ALL');
                      setSelectedInstitution('ALL');
                      setRelationFilter('ALL');
                      setSearchQuery('');
                      setSelectedItem(null);
                    }}
                    className="hover:text-white inline-flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset View
                  </button>
                </div>
              </div>
            </div>

            {/* Evidence & Details Inspector Side Panel */}
            <div className="hidden md:block md:col-span-12 lg:col-span-4 bg-card border border-line rounded-2xl p-5 shadow-xs space-y-4">
              <div className="border-b border-line pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                    Relationship & Evidence Inspector
                  </h2>
                </div>
                {selectedItem && (
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {!selectedItem ? (
                /* Empty State */
                <div className="py-12 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                    <Network className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink">
                    Select an Entity or Link
                  </h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Click on any institution node, bureau, or relationship line in the topology to view explainable correlation evidence, supporting match points, and operational options.
                  </p>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                    Or select an institution filter above to isolate cross-bureau paths.
                  </div>
                </div>
              ) : selectedItem.type === 'OVERLAP' ? (
                /* Overlap Inspector */
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-brand">
                        {selectedItem.data.id}
                      </span>
                      <OverlapStatusBadge status={selectedItem.data.status} />
                    </div>
                    <h3 className="text-sm font-bold text-ink">
                      {selectedItem.data.institutionName}
                    </h3>
                  </div>

                  {/* Relationship Kind */}
                  {selectedItem.data.relationshipKind && (
                    <div className="p-2 rounded bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-[11px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand block mb-0.5">
                        Relationship Type
                      </span>
                      <span className="text-blue-900 dark:text-blue-200 font-semibold">
                        {selectedItem.data.relationshipKind.replace(/_/g, ' ')}
                      </span>
                      {selectedItem.data.relationshipKind === 'SAME_INSTITUTION' && (
                        <p className="text-slate-500 mt-0.5 leading-snug">
                          Entity match — does not imply complaint duplication.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Match Score & Confidence */}
                  <div className="p-3 rounded bg-background border border-line space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">Confidence Metric:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {selectedItem.data.confidenceScore}% Corroboration
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${selectedItem.data.confidenceScore}%` }}
                      />
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      <OverlapTypeBadge type={selectedItem.data.matchType} />
                      <span className="text-[10px] text-slate-400 font-mono">
                        Flagged: {selectedItem.data.flaggedDate.split('T')[0]}
                      </span>
                    </div>
                  </div>

                  {/* Correlated Dockets */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Correlated Case Dockets
                    </span>
                    <div className="p-2.5 rounded border border-line bg-slate-50/50 dark:bg-slate-950/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <BureauBadge bureauId={selectedItem.data.sourceBureau} size="sm" />
                        <Link
                          href={`/cases/${selectedItem.data.sourceCaseId}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {selectedItem.data.sourceCaseId} <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex items-center justify-between">
                        <BureauBadge bureauId={selectedItem.data.targetBureau} size="sm" />
                        <Link
                          href={`/cases/${selectedItem.data.targetCaseId}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {selectedItem.data.targetCaseId} <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Explainable Detection Reasons */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Why Relationship Was Flagged
                    </span>
                    <ul className="space-y-1 text-ink-soft list-disc list-inside bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900/40">
                      {selectedItem.data.reasons.map((r, i) => (
                        <li key={i} className="leading-snug">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Multi-Point Evidence Preview */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Deterministic Evidence Matches
                    </span>
                    <div className="space-y-1.5">
                      {selectedItem.data.evidenceMatches.slice(0, 3).map((ev, i) => (
                        <div
                          key={i}
                          className="p-2 rounded border border-line bg-background text-[11px]"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <strong className="text-ink">
                              {ev.label}
                            </strong>
                            {ev.isMatch && (
                              <span className="text-emerald-600 font-semibold text-[10px] flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Verified
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 leading-snug">{ev.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Action */}
                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block mb-1">
                      Recommended Coordination
                    </span>
                    <p className="text-blue-950 dark:text-blue-200 leading-relaxed text-[11px]">
                      {selectedItem.data.recommendedAction}
                    </p>
                  </div>

                  {selectedItem.data.isSynthetic && (
                    <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">Synthetic records</p>
                  )}

                  <section className="rounded-xl border border-line p-3" aria-labelledby="relationship-history-heading">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 id="relationship-history-heading" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Review history</h3>
                      <span className="text-[10px] text-slate-400">Latest 5 entries</span>
                    </div>
                    {!selectedReviewHistory ? (
                      <p className="text-[11px] text-slate-500" role="status">Loading authoritative review history...</p>
                    ) : selectedReviewHistory.state === 'error' ? (
                      <p className="text-[11px] text-slate-500" role="status">Review history is temporarily unavailable.</p>
                    ) : selectedReviewHistory.records.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No decisions have been recorded for this relationship.</p>
                    ) : (
                      <ol className="space-y-2.5">
                        {selectedReviewHistory.records.map((review) => (
                          <li key={review.id} className="border-l-2 border-blue-300 pl-2.5 dark:border-blue-800">
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                              <span className="font-semibold text-ink">{review.decision.replace(/_/g, ' ')}</span>
                              <time className="text-[10px] text-slate-500" dateTime={review.reviewedAt}>{new Date(review.reviewedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-500">{review.reviewer.displayName} · Version {review.newVersion}</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-soft">{review.notes}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  {/* Triage — redirect to /overlaps for authorized write action */}
                  <div className="pt-2 border-t border-line space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Authorized Officer Triage Decision
                    </span>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Triage decisions require officer authentication and are processed through the Overlap Review queue.
                    </p>
                    <Link
                      href={`/overlaps?search=${encodeURIComponent(selectedItem.data.id)}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                    >
                      Open Overlap Review Queue
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : selectedItem.type === 'INSTITUTION' ? (
                /* Institution Inspector */
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        AISHE: {selectedItem.data.aisheCode}
                      </span>
                      <RiskBadge rating={selectedItem.data.riskRating} />
                    </div>
                    <h3 className="text-sm font-bold text-ink">
                      {selectedItem.data.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedItem.data.district}, {selectedItem.data.state}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded bg-background border border-line text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">ACTIVE CASES</span>
                      <span className="text-sm font-bold text-rose-600">
                        {selectedItem.data.activeCasesCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">APPROVED INTAKE</span>
                      <span className="text-sm font-bold text-ink">
                        {selectedItem.data.approvedIntake} / yr
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Bureaus Currently Involved
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.data.bureauInvolvement.map((b) => (
                        <BureauBadge key={b} bureauId={b} size="sm" />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line">
                    <Link
                      href={`/institutions/${selectedItem.data.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                    >
                      Open Complete Institution Dossier
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : selectedItem.type === 'BUREAU' ? (
                /* Bureau Inspector */
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="mb-2">
                      <BureauBadge bureauId={selectedItem.data.id} size="lg" />
                    </div>
                    <h3 className="text-sm font-bold text-ink">
                      {selectedItem.data.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{selectedItem.data.department}</p>
                  </div>

                  <div className="space-y-2 p-3 rounded bg-background border border-line text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Jurisdiction
                      </span>
                      <span className="text-ink-soft">
                        {selectedItem.data.jurisdiction}
                      </span>
                    </div>
                    <div className="border-t border-line pt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Contact Officer
                      </span>
                      <span className="text-ink-soft font-medium">
                        {selectedItem.data.contactOfficer}
                      </span>
                      <span className="text-brand block text-[11px] font-mono mt-0.5">
                        {selectedItem.data.contactEmail}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line">
                    <Link
                      href={`/cases?bureau=${selectedItem.data.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-line bg-raised hover:bg-slate-50 text-ink transition-colors"
                    >
                      View All Docket Filings for this Bureau
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : selectedItem.type === 'CASE' ? (
                /* Case Inspector */
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-brand">
                        {selectedItem.data.id}
                      </span>
                      <BureauBadge bureauId={selectedItem.data.bureauId} size="sm" />
                      <StatusBadge status={selectedItem.data.status} />
                    </div>
                    <h3 className="text-sm font-bold text-ink">
                      {selectedItem.data.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedItem.data.institutionName}
                    </p>
                  </div>

                  <div className="p-3 rounded bg-background border border-line space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Category:</span>
                      <span className="font-semibold">
                        {selectedItem.data.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Severity:</span>
                      <SeverityBadge severity={selectedItem.data.severity} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Officer:</span>
                      <span className="font-medium">{selectedItem.data.assignedOfficer.name}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line">
                    <Link
                      href={`/cases/${selectedItem.data.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                    >
                      Open Full Case File
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {(canLoadMore || isLoadingMore || loadMoreError) && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500" role="status">
                Showing {overlaps.length} of {overlapTotalCount} relationships and {institutions.length} of {institutionTotalCount} institutions. Search and filters apply to records loaded so far.
              </p>
              {loadMoreError && <p className="text-xs text-rose-600 dark:text-rose-300">{loadMoreError}</p>}
              {canLoadMore && (
                <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  {isLoadingMore ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  {isLoadingMore ? 'Loading records...' : 'Load next 100 records'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
