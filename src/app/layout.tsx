import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { ViewTransition } from 'react';
import './globals.css';
import { AppSidebar, TopBar } from '@/components/layout/Navbar';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { getAuthUiConfig } from '@/lib/server/auth-presentation';
import { AssistantWidget } from '@/components/assistant/AssistantWidget';
import { AssistantModalProvider } from '@/components/assistant/AssistantContext';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], axes: ['opsz'] });

export const metadata: Metadata = {
  title: 'CASEPULSE | Inter-Bureau Regulatory Intelligence Command',
  description:
    'Inter-bureau complaint intelligence with explainable deterministic cross-bureau correlation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { isOidcConfigured, isDemoMode } = getAuthUiConfig();

  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('casepulse-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full font-sans text-foreground selection:bg-blue-600 selection:text-white transition-colors duration-200">
        <div aria-hidden="true" className="atmosphere" />
        <ThemeProvider>
          <AuthProvider>
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
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
