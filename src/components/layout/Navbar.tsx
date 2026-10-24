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
  Network,
  RotateCcw,
  Scale,
  Shield,
  X,
} from 'lucide-react';
import { DEMO_DATASET_LABEL } from '@/data/synthetic-dataset';
import { AuthControls } from '@/components/auth/AuthControls';

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

function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center space-x-1" aria-label="Desktop navigation">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isActive
                ? 'bg-[#e2f0eb] text-[#10564f] font-semibold'
                : 'text-[#596761] hover:text-[#202b2a] hover:bg-[#f0f1eb]'
            }`}
          >
            {item.icon}
            {item.label}
            {item.badge && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
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
      className="md:hidden border-t border-[#dedfd6] bg-[#fffefa]/95 backdrop-blur-sm"
      aria-label="Mobile navigation"
    >
      <div className="px-4 py-2 space-y-0.5">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#e2f0eb] text-[#10564f] font-semibold'
                  : 'text-[#596761] hover:text-[#202b2a] hover:bg-[#f0f1eb]'
              }`}
            >
              {item.icon}
              {item.label}
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Mobile AuthControls */}
      <div className="border-t border-[#dedfd6] px-4 py-3 bg-[#f5f4ef]">
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2">
          Officer Authentication
        </div>
        <AuthControls
          isOidcConfigured={isOidcConfigured}
          isDemoMode={isDemoMode}
          onActionComplete={onClose}
        />
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

  // Reset is not available — data is persisted in PostgreSQL and cannot be
  // reset from the browser. This action has been disabled.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _resetDisabled = true;

  return (
    <header className="border-b border-[#dedfd6] bg-[#fffefa]/95 text-[#202b2a] sticky top-0 z-40 backdrop-blur-md">
      {/* Top Regulatory Identity Strip */}
      <div className="bg-[#eeeee7] border-b border-[#dedfd6] px-4 py-1.5 flex flex-wrap items-center justify-between text-[11px] text-[#65716c]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-[#263b36]">
            <Scale className="w-3.5 h-3.5 text-[#176b63]" />
            CASEPULSE
          </span>
          <span className="text-[#a5aca5]">|</span>
          <span>SIH 2026 Problem Statement 26264: Inter-Bureau Complaint Correlation Platform</span>
        </div>

        {/* Synthetic Demo Label */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#fff2d9] text-[#805619] border border-[#e7d4a8]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {DEMO_DATASET_LABEL}
          </span>
          {/* Reset is not applicable — data is persisted in PostgreSQL */}
          <span
            title="Data is persisted in PostgreSQL. In-browser reset is disabled; run npm run db:seed to reseed demo records."
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[#65716c] bg-[#e6e7df] border border-[#d2d5cb] cursor-not-allowed select-none font-medium"
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
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#176b63] flex items-center justify-center text-white shadow-xs">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-base text-[#202b2a]">CASEPULSE</span>
              <span className="text-[10px] block text-[#65716c] uppercase tracking-widest font-mono">
                Regulatory Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links in Suspense */}
          <Suspense fallback={<div className="hidden md:flex h-8 w-64 bg-slate-900 rounded" />}>
            <NavLinks />
          </Suspense>
        </div>

        {/* Desktop Controls (Auth + Bureau Status) */}
        <div className="hidden md:flex items-center gap-4">
          <AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />

          <div className="h-5 w-px bg-[#dedfd6]" aria-hidden="true" />

          {/* Bureau Status Badge */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-[#283431]">
                Inter-Bureau Joint Desk
              </span>
              <span className="text-[10px] text-[#65716c] font-mono">
                6 Coordinating Bureaus Active
              </span>
            </div>
            <div
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
              title="6 Coordinating Bureaus Active"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Mobile Controls (Status dot + Hamburger toggle) */}
        <div className="flex md:hidden items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
            title="6 Coordinating Bureaus Active"
            aria-hidden="true"
          />
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <Suspense fallback={<div className="md:hidden h-10 bg-slate-900" />}>
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
