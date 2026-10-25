'use client';

import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  Loader2,
  LogIn,
  LogOut,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

export interface AuthControlsProps {
  isOidcConfigured?: boolean;
  isDemoMode?: boolean;
  onActionComplete?: () => void;
  className?: string;
}

/**
 * Accessible authentication controls component for desktop and mobile navigation.
 * High-contrast S-Tier design supporting both Light and Dark themes.
 */
export function AuthControls({
  isOidcConfigured = false,
  isDemoMode = false,
  onActionComplete,
  className = '',
}: AuthControlsProps) {
  const { data: session, status } = useSession();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsPending(true);
    setErrorMessage(null);
    try {
      await signIn('oidc');
      onActionComplete?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to connect to identity provider.';
      setErrorMessage(message);
    } finally {
      setIsPending(false);
    }
  };

  const handleSignOut = async () => {
    setIsPending(true);
    setErrorMessage(null);
    try {
      await signOut({ callbackUrl: '/' });
      onActionComplete?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete sign-out.';
      setErrorMessage(message);
    } finally {
      setIsPending(false);
    }
  };

  // State 1: Session loading
  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-ink-muted bg-muted border border-line ${className}`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" aria-hidden="true" />
        <span className="text-[11px] font-medium">Checking session...</span>
        <span className="sr-only">Checking authentication status</span>
      </div>
    );
  }

  // State 2: Authenticated session
  if (status === 'authenticated') {
    const userLabel = isDemoMode
      ? 'Local officer'
      : session?.user?.name || session?.user?.email || 'Authenticated Officer';
    const fullIdentity =
      isDemoMode
        ? 'Local workspace officer'
        : session?.user?.name && session?.user?.email
        ? `${session.user.name} (${session.user.email})`
        : userLabel;

    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="w-full text-[11px] text-danger-ink bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 px-2.5 py-1 rounded-md flex items-center justify-between gap-1"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-danger-ink hover:opacity-80 cursor-pointer ml-1 font-bold"
              aria-label="Dismiss error notification"
            >
              Ã—
            </button>
          </div>
        )}

        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-line text-xs text-ink"
          title={`Authenticated Identity: ${fullIdentity}`}
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold max-w-[130px] sm:max-w-[160px] truncate">
            {userLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          aria-label={`Sign out ${userLabel}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-ink-soft hover:text-ink bg-raised hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin text-slate-400" aria-hidden="true" />
          ) : (
            <LogOut className="w-3 h-3 text-ink-muted" aria-hidden="true" />
          )}
          <span>{isPending ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>
    );
  }

  // State 3: Unauthenticated with local workspace access enabled
  if (isDemoMode) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div
          role="status"
          aria-label="Local workspace access is active."
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-2xs"
          title="Local workspace access"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Local access</span>
        </div>
      </div>
    );
  }

  // State 4: Unauthenticated with OIDC configured
  if (isOidcConfigured) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="w-full text-[11px] text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-800/80 px-2 py-1 rounded flex items-center justify-between gap-1"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-600 dark:text-red-300 hover:opacity-80 cursor-pointer ml-1 font-bold"
              aria-label="Dismiss error notification"
            >
              Ã—
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isPending}
          aria-label="Sign in with OpenID Connect"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{isPending ? 'Connecting...' : 'Sign in'}</span>
        </button>
      </div>
    );
  }

  // State 5: Unauthenticated with no configured identity provider or local access
  return (
    <div
      role="status"
      aria-label="Authentication status: Sign-in not configured"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 ${className}`}
      title="OpenID Connect identity provider is not configured in this environment."
    >
      <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      <span>Sign-in not configured</span>
    </div>
  );
}
