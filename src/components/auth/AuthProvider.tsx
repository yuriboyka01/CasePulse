'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';

export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Client-side session provider wrapper for Auth.js.
 * Encapsulates SessionProvider so that app components can consume session context
 * without exposing server secrets or environment variables to client code.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
