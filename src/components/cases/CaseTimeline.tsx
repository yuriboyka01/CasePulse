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
      <div className="p-6 text-center text-xs text-slate-500 border border-dashed rounded-lg">
        No administrative timeline events recorded for this docket yet.
      </div>
    );
  }

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'FILING':
        return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
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
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300';
      case 'INTER_BUREAU_SYNC':
        return 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300';
      case 'NOTICE_ISSUED':
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300';
      case 'HEARING':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300';
      case 'FILING':
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
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
            <div className="absolute -left-[30px] top-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center shadow-xs">
              {getEventIcon(evt.type)}
            </div>

            {/* Event Content Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getEventBadge(
                      evt.type
                    )}`}
                  >
                    {evt.type.replace(/_/g, ' ')}
                  </span>
                  <BureauBadge bureauId={evt.bureau} size="sm" />
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {formattedDate} • {formattedTime} IST
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {evt.action}
              </h4>

              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {evt.notes}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Authorized Actor: <strong className="text-slate-600 dark:text-slate-300">{evt.actor}</strong>
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
