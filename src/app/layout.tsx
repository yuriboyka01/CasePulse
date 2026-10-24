import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { getAuthUiConfig } from '@/lib/server/auth-presentation';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CASEPULSE | Inter-Bureau Regulatory Intelligence Command',
  description:
    'National grievance & regulatory complaint monitoring platform with explainable deterministic cross-bureau correlation. SIH 2026 Problem Statement 26264.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOidcConfigured, isDemoMode } = getAuthUiConfig();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('casepulse-theme')!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <Navbar isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
            <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-7">
              {children}
            </main>
            <footer className="border-t border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-4 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
              <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">CASEPULSE</span>
                  <span>— Smart India Hackathon 2026 (Problem Statement 26264)</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  <span>Deterministic Correlation Engine v2</span>
                  <span>·</span>
                  <span>PostgreSQL Authoritative Store</span>
                </div>
              </div>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
