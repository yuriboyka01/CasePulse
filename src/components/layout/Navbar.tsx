'use client';

import React, { useEffect, useState } from 'react';
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
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { AuthControls } from '@/components/auth/AuthControls';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAssistantModal } from '@/components/assistant/AssistantContext';
import { apiClient } from '@/lib/api-client';
import { BrandMark } from '@/components/common/BrandMark';

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: <Layers className="h-4 w-4" /> },
  { label: 'Cross-Bureau Overlaps', href: '/overlaps', icon: <AlertTriangle className="h-4 w-4" />, badge: 'REVIEW' },
  { label: 'Case Register', href: '/cases', icon: <FileText className="h-4 w-4" /> },
  { label: 'Institution Directory', href: '/institutions', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Intelligence & Reports', href: '/analytics', icon: <LineChart className="h-4 w-4" /> },
  { label: 'Relationship Explorer', href: '/explorer', icon: <Network className="h-4 w-4" /> },
];

const PAGE_TITLES = NAV_ITEMS.map(({ label, href }) => ({ label, href }));

function getPageTitle(pathname: string | null) {
  if (pathname === '/login') return 'Officer sign-in';
  if (pathname === '/cases/new') return 'Register received case';
  return PAGE_TITLES.find(({ href }) => href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(`${href}/`))?.label ?? 'CASEPULSE';
}

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
            className={`group relative flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-all ${
              collapsed ? 'justify-center' : ''
            } ${
              active
                ? 'bg-white dark:bg-slate-800 font-semibold text-ink shadow-[0_1px_2px_rgba(20,20,18,0.06)] border border-[#DFDBD2] dark:border-line'
                : 'text-ink-muted hover:bg-white/60 dark:hover:bg-raised hover:text-ink'
            }`}
          >
            {active && (
              <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[#4A5535]" />
            )}
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="min-w-0 flex-1 whitespace-nowrap text-[13px]">{item.label}</span>}
            {item.badge && !collapsed && (
              <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight text-warning">
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
  const { toggleAssistant } = useAssistantModal();
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <>
      <aside className={`hidden shrink-0 flex-col border-r border-[#DFDBD2] dark:border-line bg-[#EFECE6] dark:bg-[#151A17] transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen ${collapsed ? 'w-[76px]' : 'w-[264px]'}`}>
        <div className={`flex h-[64px] items-center border-b border-[#DFDBD2] dark:border-line px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="CASEPULSE overview">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-brand-strong/40"><BrandMark className="h-9 w-9" /></span>
            {!collapsed && <span className="min-w-0"><span className="block text-sm font-bold tracking-wide text-ink">CASEPULSE</span><span className="block truncate text-[9px] uppercase tracking-[0.16em] text-ink-muted">Regulatory intelligence</span></span>}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {!collapsed && <p className="mb-2.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Workspace</p>}
          <NavigationItems collapsed={collapsed} />
        </div>
        <div className="border-t border-[#DFDBD2] dark:border-line p-3">
          {!collapsed && (
            <div className="mb-3 rounded-lg border border-[#DFDBD2] dark:border-line bg-white/70 dark:bg-card-muted/60 p-2.5 text-[9.5px] leading-relaxed text-ink-muted">
              <span className="font-semibold text-ink-soft block mb-0.5">Jurisdictional Notice</span>
              Shared matches indicate regulatory overlap. Verify independence before joint action.
            </div>
          )}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink cursor-pointer"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          {collapsed && (
            <div className="mt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleAssistant}
                aria-label="Ask CASEPULSE AI"
                title="Ask CASEPULSE AI"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DFDBD2] dark:border-line bg-white dark:bg-slate-800 text-brand transition-colors hover:bg-stone-50"
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <ThemeToggleButton />
            </div>
          )}
        </div>
      </aside>

      <div className="lg:hidden">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#DFDBD2] dark:border-line bg-[#EFECE6]/95 dark:bg-card/95 px-4 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-wide text-ink"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white"><BrandMark className="h-8 w-8" /></span>CASEPULSE</Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAssistant}
              aria-label="Ask CASEPULSE AI"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DFDBD2] dark:border-line bg-white dark:bg-slate-800 text-brand"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <ThemeToggleButton />
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DFDBD2] dark:border-line text-ink"><Menu className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[#DFDBD2] dark:border-line bg-[#F4F2EC] dark:bg-background px-4 py-2">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{pageTitle}</p><p className="text-[9px] text-ink-muted">Operational workspace</p></div>
        </div>
        {mobileOpen && <div className="fixed inset-0 z-50 bg-black/45" onClick={() => setMobileOpen(false)}>
          <aside className="flex h-full w-[min(88vw,320px)] flex-col border-r border-[#DFDBD2] dark:border-line bg-[#EFECE6] dark:bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-14 items-center justify-between border-b border-[#DFDBD2] dark:border-line px-4"><Link href="/" onClick={() => setMobileOpen(false)} className="inline-flex items-center gap-2 font-bold tracking-wide text-ink"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white"><BrandMark className="h-8 w-8" /></span>CASEPULSE</Link><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-ink-muted hover:bg-raised"><X className="h-4 w-4" /></button></div>
            <div className="flex-1 overflow-y-auto p-3"><NavigationItems onNavigate={() => setMobileOpen(false)} /></div>
            <div className="border-t border-[#DFDBD2] dark:border-line p-4">
              <AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
              <Link href="/login" onClick={() => setMobileOpen(false)} className="mt-3 inline-flex text-xs font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline">Sign-in information</Link>
            </div>
          </aside>
        </div>}
      </div>
    </>
  );
}





export function TopBar({ isOidcConfigured = false, isDemoMode = false }: NavbarProps) {
  const pathname = usePathname();
  const { toggleAssistant } = useAssistantModal();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 hidden min-h-[64px] items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 bg-[#EFECE6]/80 dark:bg-[#0E110E]/80 px-6 backdrop-blur-md lg:flex">
      <div className="min-w-0">
        <p className="font-display truncate text-lg font-semibold tracking-tight text-ink">{pageTitle}</p>
        <p className="text-[10px] text-ink-muted">Operational workspace</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-lg border border-[#DFDBD2] dark:border-line bg-white dark:bg-card px-3 py-1.5 shadow-[0_1px_2px_rgba(20,20,18,0.03)]">
          <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_18%,transparent)]" />
          <span className="text-[11px] font-semibold text-ink">Joint Desk</span>
          <span className="text-[10px] text-ink-muted">6 bureaus</span>
        </span>

        {/* Prominent "Ask CASEPULSE AI" Button */}
        <button
          type="button"
          onClick={toggleAssistant}
          aria-label="Ask CASEPULSE AI casework assistant"
          className="group inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-b from-[#586540] to-[#424C2F] text-white shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 active:translate-y-[1px] transition-all cursor-pointer border border-[#6b7b4f]/40"
        >
          <Sparkles className="h-3.5 w-3.5 text-emerald-200 transition-transform group-hover:scale-110" />
          <span>Ask CASEPULSE AI</span>
        </button>

        <AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
        <Link href="/login" className="text-[10px] font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline" aria-label="Sign-in information">Access info</Link>
        <ThemeToggleButton />
      </div>
    </header>
  );
}
