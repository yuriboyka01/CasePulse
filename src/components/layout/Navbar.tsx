'use client';

import React, { ViewTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  LineChart,
  Menu,
  Moon,
  Network,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import { AuthControls } from '@/components/auth/AuthControls';
import { useTheme } from '@/components/theme/ThemeProvider';
import { apiClient } from '@/lib/api-client';

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: <Layers className="h-4 w-4" /> },
  { label: 'Cross-Bureau Overlaps', href: '/overlaps', icon: <AlertTriangle className="h-4 w-4" />, badge: 'REVIEW' },
  { label: 'Case Register', href: '/cases', icon: <FileText className="h-4 w-4" /> },
  { label: 'Institution Directory', href: '/institutions', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Intelligence & Reports', href: '/analytics', icon: <LineChart className="h-4 w-4" /> },
  { label: 'Relationship Explorer', href: '/explorer', icon: <Network className="h-4 w-4" /> },
];

const PAGE_TITLES = NAV_ITEMS.map(({ label, href }) => ({ label, href }));

function ThemeToggleButton() {
  const { toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden="true" />
    </button>
  );
}

function usePendingReviewCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await apiClient.getOverlaps({ status: 'PROPOSED', page: 1, pageSize: 1 });
        if (active) setCount(result.meta.totalCount);
      } catch {
        if (active) setCount(null);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  return count;
}

function NavigationItems({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const pendingCount = usePendingReviewCount();

  return (
    <nav aria-label="Primary navigation" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${active ? 'bg-brand-soft font-semibold text-brand' : 'text-ink-muted hover:bg-raised hover:text-ink'}`}
          >
            {active && <ViewTransition name="sidebar-active-indicator" default="none"><span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand" /></ViewTransition>}
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
            {item.badge && !collapsed && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-warning">
                {pendingCount === null ? 'REVIEW' : pendingCount}
              </span>
            )}
            {item.badge && collapsed && pendingCount !== null && pendingCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" aria-label={`${pendingCount} pending reviews`} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export interface NavbarProps {
  isOidcConfigured?: boolean;
  isDemoMode?: boolean;
}

export function AppSidebar({ isOidcConfigured = false, isDemoMode = false }: NavbarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES.find(({ href }) => href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(`${href}/`))?.label ?? 'CASEPULSE';

  return (
    <>
      <aside className={`hidden shrink-0 flex-col border-r border-line bg-card/70 backdrop-blur-xl transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen ${collapsed ? 'w-[76px]' : 'w-[260px]'}`}>
        <div className={`flex h-[72px] items-center border-b border-line px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="CASEPULSE overview">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-[var(--primary-foreground)] shadow-[0_8px_22px_-8px_color-mix(in_srgb,var(--brand)_75%,transparent)] ring-1 ring-brand-strong/40"><Shield className="h-4 w-4" /></span>
            {!collapsed && <span className="min-w-0"><span className="block text-sm font-bold tracking-wide text-ink">CASEPULSE</span><span className="block truncate text-[9px] uppercase tracking-[0.16em] text-ink-muted">Regulatory intelligence</span></span>}
          </Link>
        </div>
        <div className="flex-1 px-3 py-5">
          {!collapsed && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Workspace</p>}
          <NavigationItems collapsed={collapsed} />
        </div>
        <div className="border-t border-line p-3">
          {!collapsed && <div className="mb-3 rounded-lg border border-line bg-card-muted p-3 text-[10px] leading-relaxed text-ink-muted">Shared institution matches indicate jurisdictional overlap. Officers verify allegation independence before joint action.</div>}
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between'}`}>
            <AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} className={collapsed ? 'hidden' : 'min-w-0'} />
            <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          {collapsed && <div className="mt-2 flex justify-center"><ThemeToggleButton /></div>}
        </div>
      </aside>

      <div className="lg:hidden">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-card/95 px-4 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-wide text-ink"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[var(--primary-foreground)]"><Shield className="h-4 w-4" /></span>CASEPULSE</Link>
          <div className="flex items-center gap-2"><ThemeToggleButton /><button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink"><Menu className="h-4 w-4" /></button></div>
        </header>
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line bg-background px-4 py-2">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{pageTitle}</p><p className="text-[9px] text-ink-muted">Operational workspace</p></div>
        </div>
        {mobileOpen && <div className="fixed inset-0 z-50 bg-black/45" onClick={() => setMobileOpen(false)}>
          <aside className="flex h-full w-[min(88vw,320px)] flex-col border-r border-line bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-14 items-center justify-between border-b border-line px-4"><span className="font-bold tracking-wide text-ink">CASEPULSE</span><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-ink-muted hover:bg-raised"><X className="h-4 w-4" /></button></div>
            <div className="flex-1 overflow-y-auto p-3"><NavigationItems onNavigate={() => setMobileOpen(false)} /></div>
            <div className="border-t border-line p-4"><AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} /></div>
          </aside>
        </div>}
      </div>
    </>
  );
}

export function TopBar({ isOidcConfigured = false, isDemoMode = false }: NavbarProps) {
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES.find(({ href }) => href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(`${href}/`))?.label ?? 'CASEPULSE';

  return (
    <header className="sticky top-0 z-30 hidden min-h-[72px] items-center justify-between gap-4 border-b border-line bg-background/60 px-6 backdrop-blur-xl lg:flex">
      <div className="min-w-0"><p className="font-display truncate text-lg font-semibold tracking-tight text-ink">{pageTitle}</p><p className="text-[10px] text-ink-muted">Operational workspace</p></div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-1.5"><span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_18%,transparent)]" /><span className="text-[11px] font-semibold text-ink">Joint Desk</span><span className="text-[10px] text-ink-muted">6 bureaus</span></span>
        <AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
        <ThemeToggleButton />
      </div>
    </header>
  );
}
