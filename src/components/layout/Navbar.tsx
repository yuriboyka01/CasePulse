'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  FileText,
  Layers,
  LineChart,
  Menu,
  Moon,
  Network,
  RotateCcw,
  Scale,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import { DEMO_DATASET_LABEL } from '@/data/synthetic-dataset';
import { AuthControls } from '@/components/auth/AuthControls';
import { useTheme } from '@/components/theme/ThemeProvider';

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: <Layers className="w-4 h-4" /> },
  {
    label: 'Cross-Bureau Overlaps',
    href: '/overlaps',
    icon: <AlertTriangle className="w-4 h-4" />,
    badge: 'REVIEW',
  },
  { label: 'Case Register', href: '/cases', icon: <FileText className="w-4 h-4" /> },
  { label: 'Institution Directory', href: '/institutions', icon: <Building2 className="w-4 h-4" /> },
  { label: 'Intelligence & Reports', href: '/analytics', icon: <LineChart className="w-4 h-4" /> },
  { label: 'Relationship Explorer', href: '/explorer', icon: <Network className="w-4 h-4" /> },
];

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );
}

function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex items-center space-x-1" aria-label="Desktop navigation">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold border border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

interface MobileNavLinksProps {
  onClose: () => void;
  isOidcConfigured?: boolean;
  isDemoMode?: boolean;
}

function MobileNavLinks({
  onClose,
  isOidcConfigured,
  isDemoMode,
}: MobileNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md"
      aria-label="Mobile navigation"
    >
      <div className="px-4 py-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold border border-blue-200/80 dark:border-blue-800/80'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Mobile AuthControls & Theme Toggle */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2">
        <AuthControls
          isOidcConfigured={isOidcConfigured}
          isDemoMode={isDemoMode}
          onActionComplete={onClose}
        />
        <ThemeToggleButton />
      </div>
    </nav>
  );
}

export interface NavbarProps {
  isOidcConfigured?: boolean;
  isDemoMode?: boolean;
}

export function Navbar({
  isOidcConfigured = false,
  isDemoMode = false,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 sticky top-0 z-40 backdrop-blur-md">
      {/* Top Regulatory Identity Strip */}
      <div className="bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200/80 dark:border-white/10 px-4 py-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
            <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            CASEPULSE
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="hidden sm:inline">SIH 2026 Problem Statement 26264: Inter-Bureau Complaint Correlation Platform</span>
          <span className="sm:hidden">SIH 2026 PS 26264</span>
        </div>

        {/* Synthetic Demo Label */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {DEMO_DATASET_LABEL}
          </span>
          <span
            title="Data is persisted in PostgreSQL. In-browser reset is disabled; run npm run db:seed to reseed demo records."
            className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-700/50 cursor-not-allowed select-none font-medium"
            aria-disabled="true"
          >
            <RotateCcw className="w-3 h-3 opacity-50" />
            Reset: Seed script only
          </span>
        </div>
      </div>

      {/* Main Nav Bar */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center justify-between min-h-16">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-base text-slate-900 dark:text-white">
                CASEPULSE
              </span>
              <span className="text-[10px] block text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                Regulatory Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links in Suspense */}
          <Suspense fallback={<div className="hidden lg:flex h-8 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />}>
            <NavLinks />
          </Suspense>
        </div>

        {/* Desktop Controls (Auth + Bureau Status + Theme Toggle) */}
        <div className="hidden lg:flex items-center gap-3.5">
          <AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" />

          {/* Bureau Status Badge */}
          <div className="flex items-center gap-2.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
            <div
              className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
              title="6 Coordinating Bureaus Active"
              aria-hidden="true"
            />
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Joint Desk
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                6 Bureaus Active
              </span>
            </div>
          </div>

          <ThemeToggleButton />
        </div>

        {/* Mobile Controls (Status dot + Hamburger toggle) */}
        <div className="flex lg:hidden items-center gap-2">
          <ThemeToggleButton />
          <div
            className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 mr-1"
            title="6 Coordinating Bureaus Active"
            aria-hidden="true"
          />
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <Suspense fallback={<div className="lg:hidden h-10 bg-slate-100 dark:bg-slate-900" />}>
          <MobileNavLinks
            onClose={() => setMobileMenuOpen(false)}
            isOidcConfigured={isOidcConfigured}
            isDemoMode={isDemoMode}
          />
        </Suspense>
      )}
    </header>
  );
}
