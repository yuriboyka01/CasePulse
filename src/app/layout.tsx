import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { getAuthUiConfig } from '@/lib/server/auth-presentation';
import { ApplicationFrame } from '@/components/layout/ApplicationFrame';

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
            <ApplicationFrame isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode}>
              {children}
            </ApplicationFrame>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
