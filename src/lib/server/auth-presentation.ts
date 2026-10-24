import 'server-only';

export interface AuthUiConfig {
  isOidcConfigured: boolean;
  isDemoMode: boolean;
}

/**
 * Evaluates whether OpenID Connect and development demo mode are active.
 *
 * Requirements:
 * - Server-only module: never imported into client bundles.
 * - Extracts only boolean flags based on environment variable presence.
 * - Never returns client secrets, issuer URLs, or tokens to prevent leaking secrets to client bundles.
 */
export function getAuthUiConfig(): AuthUiConfig {
  const issuer = process.env.AUTH_OIDC_ISSUER?.trim();
  const clientId = process.env.AUTH_OIDC_CLIENT_ID?.trim();
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

  // OIDC requires an issuer, client ID, and an Auth.js session secret.
  const isOidcConfigured = Boolean(issuer && clientId && secret);

  // Development demo mode is strictly allowed only when NODE_ENV === 'development' AND CASEPULSE_AUTH_MODE === 'demo'.
  // Fails closed if attempted in production or when not explicitly requested.
  const isDemoMode =
    process.env.NODE_ENV === 'development' && process.env.CASEPULSE_AUTH_MODE === 'demo';

  return {
    isOidcConfigured,
    isDemoMode,
  };
}
