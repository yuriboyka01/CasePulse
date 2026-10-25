'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CaseOverlap, OverlapStatus, RelationshipStatus, ReviewDecision } from '@/types';
import { BureauBadge } from '@/components/ui/BureauBadge';
import { OverlapStatusBadge, OverlapTypeBadge } from '@/components/ui/StatusBadge';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck,
  History,
  Link2,
  RotateCw,
  UserCheck,
} from 'lucide-react';
import { apiClient, ApiClientError, OverlapReviewRecord } from '@/lib/api-client';

interface OverlapReviewPanelProps {
  overlap: CaseOverlap;
  onReviewSuccess?: (relationship: CaseOverlap, review: OverlapReviewRecord) => void;
  onTriage?: (overlapId: string, status: OverlapStatus, notes: string, officerName?: string) => void;
}

export function OverlapReviewPanel({ overlap, onReviewSuccess, onTriage }: OverlapReviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(overlap.reviewerNotes || '');
  
  // Supported review decisions only: CONFIRMED, REJECTED, FURTHER_COORDINATION
  const initialDecision: ReviewDecision =
    overlap.status === 'REJECTED' || overlap.status === 'DISMISSED_FALSE_POSITIVE'
      ? 'REJECTED'
      : overlap.status === 'FURTHER_COORDINATION'
      ? 'FURTHER_COORDINATION'
      : 'CONFIRMED';

  const [decisionChoice, setDecisionChoice] = useState<ReviewDecision>(initialDecision);
  const [currentVersion, setCurrentVersion] = useState<number | undefined>(overlap.version);
  const [currentStatus, setCurrentStatus] = useState<OverlapStatus | RelationshipStatus>(overlap.status);
  const [latestDecision, setLatestDecision] = useState(overlap.latestDecision ?? null);

  const [reviewHistory, setReviewHistory] = useState<OverlapReviewRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const hasValidVersion =
    typeof currentVersion === 'number' && Number.isInteger(currentVersion) && currentVersion >= 1;

  // Load immutable review history from the backend
  useEffect(() => {
    let ignore = false;
    async function fetchReviews() {
      try {
        const res = await apiClient.getOverlapReviews(overlap.id);
        if (!ignore) {
          setReviewHistory(res.data);
          if (res.data.length > 0) {
            const newest = res.data[0];
            setCurrentVersion(newest.newVersion);
            setCurrentStatus(newest.decision);
          }
        }
      } catch {
        // If reviews cannot be loaded, fail gracefully without fake data
      }
    }

    fetchReviews();
    return () => {
      ignore = true;
    };
  }, [overlap.id]);

  const handleCommitDecision = async () => {
    if (!hasValidVersion || currentVersion === undefined) {
      setFeedback({
        type: 'error',
        message:
          'Authoritative relationship version is missing from backend contract. Cannot submit review without a valid version.',
      });
      return;
    }

    if (!notes.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please provide official justification or rationale before recording decision.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await apiClient.recordOverlapReview(overlap.id, {
        decision: decisionChoice,
        notes: notes.trim(),
        expectedVersion: currentVersion,
      });

      const updatedRelationship = response.relationship;
      const reviewRecord = response.review;

      setCurrentVersion(updatedRelationship.version);
      setCurrentStatus(updatedRelationship.status);
      setLatestDecision(updatedRelationship.latestDecision ?? null);
      setReviewHistory((prev) => [reviewRecord, ...prev]);

      setFeedback({
        type: 'success',
        message: `Decision successfully recorded. Relationship status updated to ${updatedRelationship.status} (version ${updatedRelationship.version}).`,
      });

      onReviewSuccess?.(updatedRelationship, reviewRecord);
      if (onTriage) {
        onTriage(
          overlap.id,
          updatedRelationship.status as OverlapStatus,
          notes.trim(),
          reviewRecord.reviewer.displayName
        );
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.isConflict) {
          setFeedback({
            type: 'error',
            message:
              'Version Conflict (HTTP 409): Another officer updated this relationship. The current state has been refreshed. Please review and re-submit.',
          });
          // Refresh state from server
          try {
            const fresh = await apiClient.getOverlapReviews(overlap.id);
            setReviewHistory(fresh.data);
            if (fresh.data.length > 0) {
              const newest = fresh.data[0];
              setCurrentVersion(newest.newVersion);
              setCurrentStatus(newest.decision);
            }
          } catch {
            // Ignore secondary fetch failure
          }
        } else {
          setFeedback({
            type: 'error',
            message: err.userFriendlyMessage,
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: 'Failed to persist decision to the regulatory service layer. Please retry.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-card border border-[#E2DEC9] dark:border-line rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(20,20,18,0.04)] hover:shadow-md hover:border-[#C5BFA8] transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-[#FAF9F5] dark:bg-slate-900/60 border-b border-[#E2DEC9] dark:border-line flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-ink bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-stone-700 px-2.5 py-1 rounded-md tabular-nums">
            {overlap.id}
          </span>
          <OverlapTypeBadge type={overlap.matchType} />
          {overlap.relationshipKind && (
            <span className="inline-flex items-center rounded-full border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-xs font-semibold text-stone-800 dark:text-stone-200">
              {overlap.relationshipKind === 'SAME_INSTITUTION'
                ? 'Same institution'
                : overlap.relationshipKind === 'RELATED_INCIDENT'
                ? 'Related incident'
                : 'Potential duplicate complaint'}
            </span>
          )}
          <OverlapStatusBadge status={currentStatus} />
          {hasValidVersion && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700 tabular-nums">
              v{currentVersion}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-500 font-medium">Confidence:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-2 bg-stone-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    overlap.confidenceScore >= 90
                      ? 'bg-emerald-600'
                      : overlap.confidenceScore >= 70
                      ? 'bg-amber-500'
                      : 'bg-[#4A5535]'
                  }`}
                  style={{ width: `${overlap.confidenceScore}%` }}
                />
              </div>
              <span className="font-mono font-extrabold text-ink tabular-nums">
                {overlap.confidenceScore}
              </span>
            </div>
            <span className="hidden sm:inline text-[10px] text-stone-400">Heuristic score</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse match breakdown' : 'Expand match breakdown'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Cross-Bureau Connection Visualizer */}
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-11 gap-4 items-stretch">
        {/* Source Docket Card */}
        <div className="md:col-span-5 p-4 rounded-xl border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900/40 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <BureauBadge bureauId={overlap.sourceBureau} size="sm" />
              <span className="font-mono text-xs font-bold text-[#4A5535] dark:text-[#8FA367]">
                <Link href={`/cases/${overlap.sourceCaseId}`} className="hover:underline">
                  {overlap.sourceCaseId}
                </Link>
              </span>
            </div>
            <p className="text-sm font-bold text-ink line-clamp-2">
              {overlap.sourceCaseTitle || 'Case title not supplied'}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {overlap.sourceCaseCategory?.replaceAll('_', ' ') || 'Category unavailable'}
            </p>
          </div>
          
          <div className="mt-4 pt-3 border-t border-[#E2DEC9]/60 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
            <span className="text-stone-400 text-[11px] font-mono">
              {overlap.sourceFilingDate && `Filed ${new Date(overlap.sourceFilingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            </span>
            <Link
              href={`/cases/${overlap.sourceCaseId}`}
              className="text-[#4A5535] dark:text-[#8FA367] hover:underline font-semibold text-xs inline-flex items-center gap-1"
            >
              Open File <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Central Correlation Link Symbol */}
        <div className="md:col-span-1 flex flex-row md:flex-col items-center justify-center gap-2 py-2 text-stone-500">
          <div className="p-2.5 rounded-full bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-stone-700 text-[#4A5535] shadow-2xs">
            <Link2 className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-center leading-tight max-w-[80px]">
            {overlap.relationshipKind === 'SAME_INSTITUTION'
              ? 'Shared Campus'
              : overlap.relationshipKind === 'RELATED_INCIDENT'
              ? 'Related Pattern'
              : 'Matched Pair'}
          </span>
        </div>

        {/* Target Docket Card */}
        <div className="md:col-span-5 p-4 rounded-xl border border-[#E2DEC9] dark:border-line bg-white dark:bg-slate-900/40 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <BureauBadge bureauId={overlap.targetBureau} size="sm" />
              <span className="font-mono text-xs font-bold text-[#4A5535] dark:text-[#8FA367]">
                <Link href={`/cases/${overlap.targetCaseId}`} className="hover:underline">
                  {overlap.targetCaseId}
                </Link>
              </span>
            </div>
            <p className="text-sm font-bold text-ink line-clamp-2">
              {overlap.targetCaseTitle || 'Case title not supplied'}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {overlap.targetCaseCategory?.replaceAll('_', ' ') || 'Category unavailable'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2DEC9]/60 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
            <span className="text-stone-400 text-[11px] font-mono">
              {overlap.targetFilingDate && `Filed ${new Date(overlap.targetFilingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            </span>
            <Link
              href={`/cases/${overlap.targetCaseId}`}
              className="text-[#4A5535] dark:text-[#8FA367] hover:underline font-semibold text-xs inline-flex items-center gap-1"
            >
              Open File <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Shared institution context */}
      <div className="px-4 sm:px-5 pb-4">
        <div className="rounded-xl border border-[#E2DEC9] dark:border-line bg-[#FAF9F5] dark:bg-slate-900/40 px-4 py-3 flex items-start gap-3">
          <Building2 className="w-4 h-4 text-[#4A5535] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Shared Regulated Institution</p>
            <p className="mt-0.5 text-xs font-bold text-ink">{overlap.institutionName}</p>
            <p className="mt-0.5 text-[11px] text-stone-500 leading-relaxed">
              Deterministic identifier match. Shared campus identity establishes jurisdictional overlap; allegations require joint review.
            </p>
          </div>
        </div>
      </div>

      {/* Why System Flagged This Overlap */}
      <div className="px-4 sm:px-5 pb-5">
        <div className="p-4 bg-[#FFFBEB] dark:bg-amber-950/30 border border-[#FDE68A] dark:border-amber-800/60 rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Explainable Detection Findings ({overlap.reasons.length} factors)
          </div>
          <ul className="space-y-1 text-xs text-amber-950 dark:text-amber-200/90 list-disc list-inside">
            {overlap.reasons.map((r, idx) => (
              <li key={idx} className="leading-relaxed">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Expandable Deep Evidence Verification Matrix */}
      {isExpanded && (
        <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
              Deterministic Evidence Verification Matrix
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {overlap.evidenceMatches.map((ev, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    ev.isMatch
                      ? 'bg-slate-50 dark:bg-slate-900/60 border-line'
                      : 'bg-slate-50/40 border-line text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-ink">
                      {ev.label}
                    </span>
                    {ev.isMatch ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success-ink bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Exact match
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Distinct values</span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-muted leading-normal">
                    {ev.description}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono bg-white dark:bg-slate-950 p-2 rounded-lg border border-line">
                    <div>
                      <span className="text-slate-400 block font-sans text-[9px] uppercase">Source value</span>
                      <span className="text-ink font-bold truncate block">
                        {ev.sourceVal || ev.sourceValue || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans text-[9px] uppercase">Sister record</span>
                      <span className="text-ink font-bold truncate block">
                        {ev.targetVal || ev.targetValue || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Administrative Action */}
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs">
            <span className="font-bold text-success-ink uppercase tracking-wide text-[10px] block mb-1">
              Recommended Coordination Protocol
            </span>
            <p className="text-emerald-950 dark:text-emerald-200/90 leading-relaxed">
              {overlap.recommendedAction}
            </p>
          </div>
        </div>
      )}

      {/* Authorized Officer's Decision Chamber */}
      <div className="p-4 sm:p-5 bg-card-muted border-t border-line space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
            <UserCheck className="w-4 h-4 text-brand" />
            <span>Authorized Officer Decision Chamber</span>
          </div>

          <div className="text-xs text-slate-500 font-mono flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                hasValidVersion
                  ? 'bg-slate-200 dark:bg-slate-800 text-ink-soft'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {hasValidVersion ? `Version ${currentVersion}` : 'Version Contract Missing'}
            </span>
            {latestDecision?.reviewedAt && (
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Updated: {new Date(latestDecision.reviewedAt).toLocaleDateString('en-IN')} by{' '}
                  <strong className="text-ink-soft">
                    {latestDecision.reviewer.displayName}
                  </strong>
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Missing Version Warning */}
        {!hasValidVersion && (
          <div className="p-3 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Authoritative relationship version is missing from the backend API response. Review submissions are disabled until a valid version is loaded.
            </span>
          </div>
        )}

        {/* Feedback alert banner */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
        )}

        {/* Form Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
              Authorized Reviewer
            </label>
            <div className="text-xs py-2 px-3 rounded-xl border border-line bg-card text-ink-soft flex items-center justify-between">
              <span className="font-medium">Server-Resolved Session Identity</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-success-ink border border-emerald-200 dark:border-emerald-800">
                Authenticated
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Dual-bureau or ADMIN authority is resolved authoritatively on the server.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
              Triage Decision Classification
            </label>
            <select
              value={decisionChoice}
              onChange={(e) => setDecisionChoice(e.target.value as ReviewDecision)}
              disabled={isSubmitting || !hasValidVersion}
              className="w-full text-xs py-2 px-3 rounded-xl border border-line bg-card text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="CONFIRMED">Verified Inter-Bureau Correlation (CONFIRMED)</option>
              <option value="REJECTED">Reject / Dismiss as False Positive (REJECTED)</option>
              <option value="FURTHER_COORDINATION">Requires Further Inter-Bureau Coordination (FURTHER_COORDINATION)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
            Official Regulatory Rationale & Coordination Directives
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting || !hasValidVersion}
            placeholder="Record formal justification, findings, communication with sister bureau directorate, or hearing instructions..."
            className="w-full text-xs p-3 rounded-xl border border-line bg-card text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Append-Only Review Audit History */}
        {reviewHistory.length > 0 && (
          <div className="border border-[#E2DEC9] dark:border-line rounded-xl p-3.5 bg-white dark:bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#4A5535]" />
                Immutable Review Audit Trail (Append-Only)
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {reviewHistory.length} {reviewHistory.length === 1 ? 'entry' : 'entries'} on file
              </span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {reviewHistory.map((rev) => (
                <div
                  key={rev.id}
                  className="p-2.5 rounded-lg border border-[#E2DEC9]/60 dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-950/40 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <OverlapStatusBadge status={rev.decision} />
                      <span className="text-[10px] font-mono text-stone-500">
                        v{rev.previousVersion} → v{rev.newVersion}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400">
                      {new Date(rev.reviewedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      {new Date(rev.reviewedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })} IST
                    </span>
                  </div>
                  {rev.notes && (
                    <p className="text-ink-soft text-[11px] leading-relaxed">
                      {rev.notes}
                    </p>
                  )}
                  <div className="text-[10px] text-slate-400">
                    Reviewer: <strong className="text-ink-soft">{rev.reviewer?.displayName || 'Officer'}</strong> ({rev.reviewer?.bureauId})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Operational Triage Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-ink-muted hover:text-slate-900 dark:hover:text-slate-100 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Evidence Matrix' : 'Inspect Full Evidence Matrix'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCommitDecision}
              disabled={isSubmitting || !hasValidVersion}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-xs hover:shadow cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Persisting Decision...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Record Review Decision</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
