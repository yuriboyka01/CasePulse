'use client';

import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  FlaskConical,
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
 *
 * Supported states:
 * - loading: Accessible pending status indicator.
 * - authenticated: Identity label + accessible Sign out action.
 * - unauthenticated + demo mode enabled: Clear "Development demo mode" indicator (no false auth claims).
 * - unauthenticated + OIDC configured: "Sign in" action invoking signIn('oidc').
 * - unauthenticated + OIDC unconfigured: Neutral "Sign-in not configured" indicator.
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-slate-400 bg-slate-900 border border-slate-800 ${className}`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-hidden="true" />
        <span className="text-[11px]">Checking session...</span>
        <span className="sr-only">Checking authentication status</span>
      </div>
    );
  }

  // State 2: Authenticated session
  if (status === 'authenticated') {
    const userLabel =
      session?.user?.name || session?.user?.email || 'Authenticated Officer';
    const fullIdentity =
      session?.user?.name && session?.user?.email
        ? `${session.user.name} (${session.user.email})`
        : userLabel;

    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="w-full text-[11px] text-red-300 bg-red-950/70 border border-red-800/80 px-2 py-1 rounded flex items-center justify-between gap-1"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-300 hover:text-white cursor-pointer ml-1 font-bold"
              aria-label="Dismiss error notification"
            >
              ×
            </button>
          </div>
        )}

        {isDemoMode && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30"
            title="Development demo mode is active alongside this session"
          >
            <FlaskConical className="w-3 h-3 text-amber-400" aria-hidden="true" />
            Demo Mode
          </span>
        )}

        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200"
          title={`Authenticated Identity: ${fullIdentity}`}
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="font-medium max-w-[130px] sm:max-w-[160px] truncate">
            {userLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          aria-label={`Sign out ${userLabel}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin text-slate-400" aria-hidden="true" />
          ) : (
            <LogOut className="w-3 h-3 text-slate-400" aria-hidden="true" />
          )}
          <span>{isPending ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>
    );
  }

  // State 3: Unauthenticated with Development Demo Mode enabled
  if (isDemoMode) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div
          role="status"
          aria-label="Development demo mode active. Synthetic officer access only, not real authentication."
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30"
          title="Development demo mode: Synthetic officer access is active for local testing. This is not real authentication."
        >
          <FlaskConical className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold">Development demo mode</span>
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
            className="w-full text-[11px] text-red-300 bg-red-950/70 border border-red-800/80 px-2 py-1 rounded flex items-center justify-between gap-1"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-300 hover:text-white cursor-pointer ml-1 font-bold"
              aria-label="Dismiss error notification"
            >
              ×
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

  // State 5: Unauthenticated with OIDC not configured and demo mode not enabled
  return (
    <div
      role="status"
      aria-label="Authentication status: Sign-in not configured"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-900 text-slate-400 border border-slate-800 ${className}`}
      title="OpenID Connect identity provider is not configured in this environment."
    >
      <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      <span>Sign-in not configured</span>
    </div>
  );
}
