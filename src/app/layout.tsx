import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { AuthProvider } from '@/components/auth/AuthProvider';
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
  title: 'CASEPULSE | Inter-Bureau Institution Complaint Monitoring Platform',
  description:
    'Intelligent regulatory complaint monitoring platform with explainable cross-bureau case correlation. SIH 2026 Problem Statement 26264 Prototype.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOidcConfigured, isDemoMode } = getAuthUiConfig();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f5f4ef] text-[#202b2a] font-sans selection:bg-[#176b63] selection:text-white">
        <AuthProvider>
          <Navbar isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
          <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
            {children}
          </main>
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-4 px-4 sm:px-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>
                <strong>CASEPULSE</strong> — Smart India Hackathon 2026 (Problem Statement 26264)
              </span>
              <span className="font-mono text-[11px]">
                Prototype Architecture: Next.js + TypeScript + Deterministic Correlation Engine
              </span>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
