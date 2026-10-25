'use client';

import React from 'react';

export interface WorkspaceHeaderProps {
  eyebrows?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function WorkspaceHeader({
  eyebrows,
  title,
  subtitle,
  actions,
  children,
  className = '',
}: WorkspaceHeaderProps) {
  return (
    <header
      className={`relative overflow-hidden rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-[0_1px_2px_rgba(20,20,18,0.04)] transition-all ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Eyebrow + Serif Title + Subtitle */}
        <div className="min-w-0 flex-1">
          {eyebrows && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {eyebrows}
            </div>
          )}
          <h1 className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-ink leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-xs text-ink-muted leading-relaxed line-clamp-1 sm:line-clamp-none max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right Side: Actions and/or Graphic */}
        {(actions || children) && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
            {actions}
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
