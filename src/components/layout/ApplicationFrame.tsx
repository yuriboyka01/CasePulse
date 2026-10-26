'use client';

import { ViewTransition, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AssistantWidget } from '@/components/assistant/AssistantWidget';
import { AssistantModalProvider } from '@/components/assistant/AssistantContext';
import { AppSidebar, TopBar } from '@/components/layout/Navbar';

export function ApplicationFrame({
  children,
  isOidcConfigured,
  isDemoMode,
}: {
  children: ReactNode;
  isOidcConfigured: boolean;
  isDemoMode: boolean;
}) {
  const pathname = usePathname();
  const isAccountRoute = pathname === '/login' || pathname === '/signup';

  if (isAccountRoute) {
    return <main className="min-h-screen bg-[#F4F4EF] text-[#252923] dark:bg-[#111511] dark:text-ink">{children}</main>;
  }

  return (
    <AssistantModalProvider>
      <div className="min-h-screen lg:flex">
        <AppSidebar isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <TopBar isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
          <main className="w-full flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <ViewTransition enter="page-enter" exit="page-exit" default="none">
              {children}
            </ViewTransition>
          </main>
          <footer className="border-t border-[#DFDBD2] dark:border-line bg-[#EFECE6]/80 dark:bg-card/70 px-4 py-3 text-xs text-ink-muted sm:px-6">
            <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" /><span className="font-semibold text-ink">CASEPULSE</span><span>· Inter-Bureau Intelligence</span></div>
              <div className="flex items-center gap-3 font-mono text-[10px]"><span>Deterministic Correlation Engine v2</span><span>·</span><span>PostgreSQL Authoritative Store</span></div>
            </div>
          </footer>
        </div>
      </div>
      <AssistantWidget />
    </AssistantModalProvider>
  );
}
