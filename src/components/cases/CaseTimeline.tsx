'use client';

import React from 'react';
import { TimelineEvent } from '@/types';
import { BureauBadge } from '@/components/ui/BureauBadge';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Gavel,
  RefreshCw,
  Send,
  UserCheck,
} from 'lucide-react';

interface CaseTimelineProps {
  events: TimelineEvent[];
}

export function CaseTimeline({ events }: CaseTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-line rounded-2xl bg-card">
        No administrative timeline events recorded for this docket yet.
      </div>
    );
  }

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'FILING':
        return <FileText className="w-4 h-4 text-brand" />;
      case 'NOTICE_ISSUED':
        return <Send className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'HEARING':
        return <Gavel className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'OVERLAP_FLAG':
        return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'INTER_BUREAU_SYNC':
        return <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'STATUS_CHANGE':
        return <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'PENALTY_ISSUED':
        return <FileSpreadsheet className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'CLOSURE':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <UserCheck className="w-4 h-4 text-slate-500" />;
    }
  };

  const getEventBadge = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'OVERLAP_FLAG':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case 'INTER_BUREAU_SYNC':
        return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
      case 'NOTICE_ISSUED':
        return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      case 'HEARING':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
      case 'FILING':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
      {events.map((evt) => {
        const dateObj = new Date(evt.timestamp);
        const formattedDate = dateObj.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const formattedTime = dateObj.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div key={evt.id} className="relative group">
            {/* Timeline node icon */}
            <div className="absolute -left-[30px] top-1 w-6 h-6 rounded-full bg-card border-2 border-slate-300 dark:border-white/20 flex items-center justify-center shadow-xs">
              {getEventIcon(evt.type)}
            </div>

            {/* Event Content Card */}
            <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getEventBadge(
                      evt.type
                    )}`}
                  >
                    {evt.type.replace(/_/g, ' ')}
                  </span>
                  <BureauBadge bureauId={evt.bureau} size="sm" />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {formattedDate} · {formattedTime} IST
                </div>
              </div>

              <h4 className="text-xs font-bold text-ink">
                {evt.action}
              </h4>

              <div className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                {evt.notes}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Authorized Actor: <strong className="text-ink-soft">{evt.actor}</strong>
                </span>
                <span className="font-mono text-[10px]">{evt.id}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
