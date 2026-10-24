'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Eye,
  Info,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
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
import {
  Bureau,
  CaseComplaint,
  CaseOverlap,
  Institution,
  OverlapStatus,
} from '@/types';
import { apiClient, ApiClientError } from '@/lib/api-client';

type SelectedItem =
  | { type: 'INSTITUTION'; data: Institution }
  | { type: 'CASE'; data: CaseComplaint }
  | { type: 'OVERLAP'; data: CaseOverlap }
  | { type: 'BUREAU'; data: Bureau }
  | null;

type LoadState = 'idle' | 'loading' | 'success' | 'error';

export default function ExplorerClient() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [overlaps, setOverlaps] = useState<CaseOverlap[]>([]);

  const [selectedBureau, setSelectedBureau] = useState<string>('ALL');
  const [selectedInstitution, setSelectedInstitution] = useState<string>('ALL');
  const [relationFilter, setRelationFilter] = useState<'ALL' | 'CONFIRMED' | 'POTENTIAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [viewMode, setViewMode] = useState<'GRAPH' | 'MATRIX'>('GRAPH');

  // Bureaus come from the static config (not an API call)
  const bureaus = BUREAUS;

  const fetchData = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const [instRes, overlapsRes] = await Promise.all([
        apiClient.getInstitutions({ pageSize: 100 }),
        apiClient.getOverlaps({ pageSize: 100 }),
      ]);
      setInstitutions(instRes.data);
      setOverlaps(overlapsRes.data);
      setLoadState('success');
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.userFriendlyMessage
          : 'Failed to load topology data. Please retry.';
      setLoadError(msg);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [instRes, overlapsRes] = await Promise.all([
          apiClient.getInstitutions({ pageSize: 100 }),
          apiClient.getOverlaps({ pageSize: 100 }),
        ]);
        if (ignore) return;
        setInstitutions(instRes.data);
        setOverlaps(overlapsRes.data);
        setLoadState('success');
      } catch (err) {
        if (ignore) return;
        const msg =
          err instanceof ApiClientError
            ? err.userFriendlyMessage
            : 'Failed to load topology data. Please retry.';
        setLoadError(msg);
        setLoadState('error');
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

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
          o.sourceCaseId.toLowerCase().includes(q) || o.targetCaseId.toLowerCase().includes(q);
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
    if (activeInstitutionIds.size === 0 && selectedInstitution === 'ALL') {
      return institutions;
    }
    return institutions.filter((i) => activeInstitutionIds.has(i.id));
  }, [institutions, activeInstitutionIds, selectedInstitution]);

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Network className="w-5 h-5 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Inter-Bureau Relationship Explorer
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-mono">
                {loadState === 'success' ? filteredOverlaps.length : '…'} CORRELATIONS
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visual map of confirmed and potential regulatory links connecting institutions, case dockets, and coordinating bureaus.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-900 text-xs font-semibold">
              <button
                onClick={() => setViewMode('GRAPH')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'GRAPH'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Visual Topology
              </button>
              <button
                onClick={() => setViewMode('MATRIX')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'MATRIX'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Correlation Matrix
              </button>
            </div>
          </div>
        </div>

        {/* Legend strip */}
        <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Topology Legend:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
              <span className="text-slate-300">Administrative Bureau</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-purple-500 ring-2 ring-purple-500/30" />
              <span className="text-slate-300">Regulated Institution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-500 inline-block" />
              <span className="text-emerald-400 font-medium">Confirmed Relationship</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-amber-400 inline-block" />
              <span className="text-amber-300 font-medium">Potential Overlap (Pending Triage)</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Click any node or link to inspect evidence and launch case details
          </div>
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
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {loadState === 'success' && (
        <>
          {/* Control / Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by institution, case docket ID, or overlap reference..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                />
              </div>

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Search
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Bureau Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Filter by Bureau Channel
                </label>
                <select
                  value={selectedBureau}
                  onChange={(e) => setSelectedBureau(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
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
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Focus Specific Institution
                </label>
                <select
                  value={selectedInstitution}
                  onChange={(e) => setSelectedInstitution(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
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
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Relationship Status Filter
                </label>
                <select
                  value={relationFilter}
                  onChange={(e) =>
                    setRelationFilter(e.target.value as 'ALL' | 'CONFIRMED' | 'POTENTIAL')
                  }
                  className="w-full text-xs py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="ALL">All Relationships (Confirmed & Potential)</option>
                  <option value="CONFIRMED">Confirmed / Joint Inquiry Only</option>
                  <option value="POTENTIAL">Potential / Unreviewed Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Workspace: Visual Graph Canvas or Matrix + Evidence Inspector Side Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Graph/Matrix Area */}
            <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-md relative min-h-[560px] flex flex-col justify-between">
              {viewMode === 'GRAPH' ? (
                <div className="w-full overflow-auto relative">
                  <svg
                    viewBox="0 0 900 640"
                    className="w-full h-auto min-w-[700px] select-none"
                    style={{ background: 'radial-gradient(ellipse at center, #191e1b 0%, #0c0f0e 100%)' }}
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
                    </defs>

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

                        const strokeColor = edge.isConfirmed
                          ? '#72b79a' // emerald-500
                          : edge.status === 'DISMISSED_FALSE_POSITIVE' ||
                            edge.status === 'REJECTED'
                          ? '#6b776e' // slate-500
                          : '#eba23d'; // amber-500

                        return (
                          <g
                            key={edge.id}
                            className="cursor-pointer transition-opacity group"
                            onClick={() => setSelectedItem({ type: 'OVERLAP', data: edge.overlap })}
                          >
                            {/* Hover trigger target */}
                            <line
                              x1={edge.x1}
                              y1={edge.y1}
                              x2={edge.x2}
                              y2={edge.y2}
                              stroke="transparent"
                              strokeWidth="14"
                            />
                            {/* Visible Line */}
                            <line
                              x1={edge.x1}
                              y1={edge.y1}
                              x2={edge.x2}
                              y2={edge.y2}
                              stroke={strokeColor}
                              strokeWidth={isSelected ? 3.5 : edge.isConfirmed ? 2.5 : 1.75}
                              strokeDasharray={edge.isConfirmed ? undefined : '5 4'}
                              strokeOpacity={isSelected ? 1 : 0.65}
                              filter={
                                isSelected || edge.isConfirmed
                                  ? 'url(#glow-emerald)'
                                  : 'url(#glow-amber)'
                              }
                              className="transition-all hover:stroke-white hover:opacity-100"
                            />
                          </g>
                        );
                      })}
                    </g>

                    {/* Bureau Nodes (Outer ring) */}
                    <g className="bureau-nodes">
                      {graphNodes.bureauNodes.map((node) => {
                        const isSelected =
                          selectedItem?.type === 'BUREAU' && selectedItem.data.id === node.rawId;

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            className="cursor-pointer transition-transform duration-200"
                            onClick={() => setSelectedItem({ type: 'BUREAU', data: node.data })}
                          >
                            <circle
                              r="28"
                              fill="#191e1b"
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
                      {graphNodes.instNodes.map((node) => {
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
                            className="cursor-pointer transition-transform duration-200"
                            onClick={() =>
                              setSelectedItem({ type: 'INSTITUTION', data: node.data })
                            }
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
                              fill="#191e1b"
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
                              className="pointer-events-none"
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
                                <span className="text-slate-500 font-bold">⟷</span>
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
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-2xs space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
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
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                    <Network className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Select an Entity or Link
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {selectedItem.data.id}
                      </span>
                      <OverlapStatusBadge status={selectedItem.data.status} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedItem.data.institutionName}
                    </h3>
                  </div>

                  {/* Relationship Kind */}
                  {selectedItem.data.relationshipKind && (
                    <div className="p-2 rounded bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-[11px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 block mb-0.5">
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
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
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
                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-1.5">
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
                    <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900/40">
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
                          className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px]"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <strong className="text-slate-800 dark:text-slate-200">
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

                  {/* Triage — redirect to /overlaps for authorized write action */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Authorized Officer Triage Decision
                    </span>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Triage decisions require officer authentication and are processed through the Overlap Review queue.
                    </p>
                    <Link
                      href={`/overlaps`}
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
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedItem.data.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedItem.data.district}, {selectedItem.data.state}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">ACTIVE CASES</span>
                      <span className="text-sm font-bold text-rose-600">
                        {selectedItem.data.activeCasesCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">APPROVED INTAKE</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
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

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
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
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedItem.data.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{selectedItem.data.department}</p>
                  </div>

                  <div className="space-y-2 p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Jurisdiction
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {selectedItem.data.jurisdiction}
                      </span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Contact Officer
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {selectedItem.data.contactOfficer}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 block text-[11px] font-mono mt-0.5">
                        {selectedItem.data.contactEmail}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <Link
                      href={`/cases?bureau=${selectedItem.data.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 transition-colors"
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
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {selectedItem.data.id}
                      </span>
                      <BureauBadge bureauId={selectedItem.data.bureauId} size="sm" />
                      <StatusBadge status={selectedItem.data.status} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedItem.data.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedItem.data.institutionName}
                    </p>
                  </div>

                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
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

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
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
        </>
      )}
    </div>
  );
}
