import { NextResponse } from 'next/server';

const DEMO_ENTRY_COOKIE = 'casepulse-demo-entered';

export async function POST(request: Request) {
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

  if ((!isDevelopmentDemo && !isExplicitProductionDemo) || isOidcConfigured) {
    return Response.json({ error: 'Demo access is not enabled.' }, { status: 404 });
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set({
    name: DEMO_ENTRY_COOKIE,
    value: '1',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
