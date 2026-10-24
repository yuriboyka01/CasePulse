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
      // Refresh latest relationship version before a new review attempt
      let targetExpectedVersion = currentVersion;
      try {
        const fresh = await apiClient.getOverlapReviews(overlap.id, 1, 1);
        if (fresh.data.length > 0) {
          targetExpectedVersion = fresh.data[0].newVersion;
          setCurrentVersion(targetExpectedVersion);
        }
      } catch {
        // Fall back to current known version
      }

      const res = await apiClient.recordOverlapReview(overlap.id, {
        decision: decisionChoice,
        notes: notes.trim(),
        expectedVersion: targetExpectedVersion,
      });

      // Update state upon server persistence confirmation
      setCurrentVersion(res.relationship.version);
      setCurrentStatus(res.relationship.status);
      setLatestDecision(
        res.relationship.latestDecision ?? {
          decision: res.review.decision,
          notes: res.review.notes,
          reviewedAt: res.review.reviewedAt,
          reviewer: res.review.reviewer,
        }
      );

      // Append new review record to history
      setReviewHistory((prev) => [res.review, ...prev.filter((r) => r.id !== res.review.id)]);
      setNotes('');
      setFeedback({
        type: 'success',
        message: `Review decision "${res.review.decision}" successfully committed to PostgreSQL database (Version ${res.review.newVersion}).`,
      });

      onReviewSuccess?.(res.relationship, res.review);
      if (onTriage) {
        onTriage(
          overlap.id,
          res.relationship.status as OverlapStatus,
          res.review.notes,
          res.review.reviewer.displayName
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
    <div className="bg-[#fffefa] border border-[#dedfd6] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(32,43,42,0.035)] transition-colors">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-[#f0f1eb] border-b border-[#dedfd6] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
            {overlap.id}
          </span>
          <OverlapTypeBadge type={overlap.matchType} />
          {overlap.relationshipKind && (
            <span className="inline-flex items-center rounded-full border border-[#cddfd6] bg-[#e8f2ed] px-2.5 py-1 text-[10px] font-semibold text-[#205e50]">
              {overlap.relationshipKind === 'SAME_INSTITUTION' ? 'Same institution' : overlap.relationshipKind === 'RELATED_INCIDENT' ? 'Related incident' : 'Potential duplicate complaint'}
            </span>
          )}
          <OverlapStatusBadge status={currentStatus} />
          {hasValidVersion && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              v{currentVersion}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#65716c] font-medium">Match score:</span>
            <div className="flex items-center gap-1">
              <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    overlap.confidenceScore >= 90
                      ? 'bg-emerald-500'
                      : overlap.confidenceScore >= 70
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${overlap.confidenceScore}%` }}
                />
              </div>
              <span className="font-mono font-semibold text-[#283431]">
                {overlap.confidenceScore}
              </span>
            </div>
            <span className="hidden sm:inline text-[10px] text-[#65716c]">Heuristic score, not probability</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse match breakdown' : 'Expand match breakdown'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Cross-Bureau Connection Visualizer */}
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-11 gap-3 sm:gap-4 items-stretch">
        {/* Source Docket Card */}
        <div className="md:col-span-5 p-4 rounded-lg border border-[#dedfd6] bg-[#fbfbf7]">
          <div className="flex items-center justify-between mb-1.5">
            <BureauBadge bureauId={overlap.sourceBureau} size="sm" />
            <span className="font-mono text-xs font-semibold text-[#176b63]">
              <Link href={`/cases/${overlap.sourceCaseId}`} className="hover:underline">
                {overlap.sourceCaseId}
              </Link>
            </span>
          </div>
          <p className="text-sm font-semibold leading-5 text-[#202b2a]">
            {overlap.sourceCaseTitle || 'Case title not supplied'}
          </p>
          <p className="mt-1 text-xs text-[#65716c]">{overlap.sourceCaseCategory?.replaceAll('_', ' ') || 'Category unavailable'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {overlap.sourceCaseStatus && <span className="rounded-full border border-[#d9ded6] bg-white px-2 py-1 text-[#596761]">{overlap.sourceCaseStatus.replaceAll('_', ' ')}</span>}
            {overlap.sourceFilingDate && <span className="text-[#65716c]">Filed {new Date(overlap.sourceFilingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
          </div>
          <div className="mt-3 text-[11px] text-[#65716c] flex items-center justify-between gap-2">
            <span>Originating record</span>
            <Link
              href={`/cases/${overlap.sourceCaseId}`}
              className="text-[#176b63] hover:text-[#10564f] hover:underline inline-flex items-center gap-0.5"
            >
              Open File <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Central Correlation Link Symbol */}
        <div className="md:col-span-1 flex flex-row md:flex-col items-center justify-center gap-2 text-[#65716c] py-1">
          <div className="p-2 rounded-full bg-[#e8f2ed] border border-[#cddfd6] text-[#176b63]">
            <Link2 className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-semibold text-center leading-4">{overlap.relationshipKind === 'SAME_INSTITUTION' ? 'Same institution' : overlap.relationshipKind === 'RELATED_INCIDENT' ? 'Related incident' : overlap.relationshipKind === 'POTENTIAL_DUPLICATE_COMPLAINT' ? 'Duplicate candidate' : 'Suggested link'}</span>
        </div>

        {/* Target Docket Card */}
        <div className="md:col-span-5 p-4 rounded-lg border border-[#dedfd6] bg-[#fbfbf7]">
          <div className="flex items-center justify-between mb-1.5">
            <BureauBadge bureauId={overlap.targetBureau} size="sm" />
            <span className="font-mono text-xs font-semibold text-[#176b63]">
              <Link href={`/cases/${overlap.targetCaseId}`} className="hover:underline">
                {overlap.targetCaseId}
              </Link>
            </span>
          </div>
          <p className="text-sm font-semibold leading-5 text-[#202b2a]">
            {overlap.targetCaseTitle || 'Case title not supplied'}
          </p>
          <p className="mt-1 text-xs text-[#65716c]">{overlap.targetCaseCategory?.replaceAll('_', ' ') || 'Category unavailable'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {overlap.targetCaseStatus && <span className="rounded-full border border-[#d9ded6] bg-white px-2 py-1 text-[#596761]">{overlap.targetCaseStatus.replaceAll('_', ' ')}</span>}
            {overlap.targetFilingDate && <span className="text-[#65716c]">Filed {new Date(overlap.targetFilingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
          </div>
          <div className="mt-3 text-[11px] text-[#65716c] flex items-center justify-between gap-2">
            <span>Related record</span>
            <Link
              href={`/cases/${overlap.targetCaseId}`}
              className="text-[#176b63] hover:text-[#10564f] hover:underline inline-flex items-center gap-0.5"
            >
              Open File <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 pb-4">
        <div className="rounded-lg border border-[#dedfd6] bg-[#f7f8f3] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65716c]">Shared institution context</p>
          <p className="mt-1 text-sm font-semibold text-[#283431]">{overlap.institutionName}</p>
          <p className="mt-1 text-xs leading-5 text-[#65716c]">This establishes a possible entity connection only. It does not establish that the complaints describe the same incident or are duplicates.</p>
        </div>
      </div>

      {/* Why System Flagged This Overlap */}
      <div className="px-4 sm:px-5 pb-5">
        <div className="p-4 bg-[#fff8e9] border border-[#eadbb7] rounded-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Why this relationship was suggested
          </div>
          <ul className="space-y-1 text-xs text-amber-950 dark:text-amber-200/90 list-disc list-inside">
            {overlap.reasons.map((r, idx) => (
              <li key={idx} className="leading-snug">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Expandable Deep Evidence Verification Matrix */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Evidence comparison
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {overlap.evidenceMatches.map((ev, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded border ${
                    ev.isMatch
                      ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
                      : 'bg-slate-50/40 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {ev.label}
                    </span>
                    {ev.isMatch ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 rounded">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Identifier aligns
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Values differ</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {ev.description}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px] font-mono bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[#65716c] block">Source value</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate block">
                        {ev.sourceVal || ev.sourceValue || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#65716c] block">Other record value</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate block">
                        {ev.targetVal || ev.targetValue || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Administrative Action */}
          <div className="p-4 bg-[#e8efea] border border-[#d3e0d7] rounded-lg text-sm">
            <span className="font-semibold text-[#205e50] uppercase tracking-wide text-[11px] block mb-1">
              Recommended Coordination Protocol
            </span>
            <p className="text-[#34443e] leading-relaxed">
              {overlap.recommendedAction}
            </p>
          </div>
        </div>
      )}

      {/* Authorized Officer's Decision Chamber */}
      <div className="p-4 sm:p-5 bg-[#f5f4ef] border-t border-[#dedfd6] space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Record your review decision
          </div>

          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                hasValidVersion
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {hasValidVersion ? `Version ${currentVersion}` : 'Version Contract Missing'}
            </span>
            {latestDecision?.reviewedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Last Persisted: {new Date(latestDecision.reviewedAt).toLocaleDateString('en-IN')} by{' '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {latestDecision.reviewer.displayName}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Missing Version Warning */}
        {!hasValidVersion && (
          <div className="p-2.5 rounded text-xs bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Authoritative relationship version is missing from the backend API response. Review submissions are disabled until a valid version is loaded.
            </span>
          </div>
        )}

        {/* Feedback alert banner */}
        {feedback && (
          <div
            className={`p-2.5 rounded text-xs flex items-center gap-2 ${
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
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Form Controls: No editable reviewer identity! */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Authorized Reviewer
            </label>
            <div className="text-xs py-1.5 px-2.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Server-Resolved Session Identity</span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Authenticated Actor</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Dual-bureau or ADMIN authority is resolved authoritatively on the server.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Triage Decision Classification
            </label>
            <select
              value={decisionChoice}
              onChange={(e) => setDecisionChoice(e.target.value as ReviewDecision)}
              disabled={isSubmitting || !hasValidVersion}
              className="w-full text-sm py-2.5 px-3 rounded-lg border border-[#d7dcd4] bg-[#fffefa] text-[#202b2a] font-medium focus-visible:outline-[#176b63] disabled:opacity-50"
            >
              <option value="CONFIRMED">Verified Inter-Bureau Correlation (CONFIRMED)</option>
              <option value="REJECTED">Reject / Dismiss as False Positive (REJECTED)</option>
              <option value="FURTHER_COORDINATION">Requires Further Inter-Bureau Coordination (FURTHER_COORDINATION)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Official Regulatory Rationale & Coordination Directives
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting || !hasValidVersion}
            placeholder="Record formal justification, findings, communication with sister bureau directorate, or hearing instructions..."
            className="w-full text-sm p-3 rounded-lg border border-[#d7dcd4] bg-[#fffefa] text-[#202b2a] placeholder:text-[#8b958d] focus:outline-none focus:ring-2 focus:ring-[#176b63]/25 disabled:opacity-50"
          />
        </div>

        {/* Append-Only Review Audit History */}
        {reviewHistory.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-white dark:bg-slate-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                Immutable Review Audit Trail (Append-Only)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {reviewHistory.length} {reviewHistory.length === 1 ? 'entry' : 'entries'} on file
              </span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {reviewHistory.map((rev) => (
                <div
                  key={rev.id}
                  className="p-2 rounded border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <OverlapStatusBadge status={rev.decision} />
                      <span className="text-[10px] font-mono text-slate-500">
                        v{rev.previousVersion} → v{rev.newVersion}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
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
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      {rev.notes}
                    </p>
                  )}
                  <div className="text-[10px] text-slate-400">
                    Reviewer: <strong className="text-slate-600 dark:text-slate-300">{rev.reviewer?.displayName || 'Officer'}</strong> ({rev.reviewer?.bureauId})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Operational Triage Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? 'Hide Evidence Matrix' : 'Inspect Full Evidence Matrix'}
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCommitDecision}
              disabled={isSubmitting || !hasValidVersion}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#176b63] hover:bg-[#10564f] disabled:bg-[#9aada7] disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Persisting Decision...
                </>
              ) : (
                <>
                  <FileCheck className="w-3.5 h-3.5" />
                  Record review decision
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
