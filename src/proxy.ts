import { NextResponse, type NextRequest } from 'next/server';

const DEMO_ENTRY_COOKIE = 'casepulse-demo-entered';
const PUBLIC_PATHS = new Set(['/login', '/signup']);

/**
 * Page-level sign-in gate. This only redirects visitors who have no session cookie at all;
 * every API route still resolves and authorizes the actor server-side, so this is a UX
 * guard, not the authorization boundary.
 */
export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const isOidcConfigured = Boolean(
    process.env.AUTH_OIDC_ISSUER?.trim() &&
    process.env.AUTH_OIDC_CLIENT_ID?.trim() &&
    (process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim())
  );
  const isDevelopmentDemo =
    process.env.NODE_ENV === 'development' &&
    process.env.CASEPULSE_AUTH_MODE === 'demo';
  const isExplicitProductionDemo =
    process.env.NODE_ENV === 'production' &&
    process.env.CASEPULSE_DEMO_ENABLED === 'true';

  const isDemoModeEnabled = (isDevelopmentDemo || isExplicitProductionDemo) && !isOidcConfigured;
  const hasDemoEntry = isDemoModeEnabled && request.cookies.get(DEMO_ENTRY_COOKIE)?.value === '1';
  const hasAuthJsSession = request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token');
  if (hasDemoEntry || hasAuthJsSession) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
