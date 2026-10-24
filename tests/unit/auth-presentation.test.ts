import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthUiConfig } from '../../src/lib/server/auth-presentation';

function setEnv(name: string, value: string | undefined) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  };
}

test('auth-presentation: OIDC is configured when issuer, client ID, and AUTH_SECRET are set', () => {
  const restoreIssuer = setEnv('AUTH_OIDC_ISSUER', 'https://auth.gov.in');
  const restoreClientId = setEnv('AUTH_OIDC_CLIENT_ID', 'casepulse-portal');
  const restoreSecret = setEnv('AUTH_SECRET', 'secret_key_1234567890123456789012');
  const restoreNextAuthSecret = setEnv('NEXTAUTH_SECRET', undefined);
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', undefined);

  try {
    const config = getAuthUiConfig();
    assert.equal(config.isOidcConfigured, true);
    assert.equal(config.isDemoMode, false);
    // Ensure no secrets or sensitive data are leaked
    assert.deepEqual(Object.keys(config).sort(), ['isDemoMode', 'isOidcConfigured']);
  } finally {
    restoreAuthMode();
    restoreNextAuthSecret();
    restoreSecret();
    restoreClientId();
    restoreIssuer();
  }
});

test('auth-presentation: OIDC is configured when NEXTAUTH_SECRET is used', () => {
  const restoreIssuer = setEnv('AUTH_OIDC_ISSUER', 'https://auth.gov.in');
  const restoreClientId = setEnv('AUTH_OIDC_CLIENT_ID', 'casepulse-portal');
  const restoreSecret = setEnv('AUTH_SECRET', undefined);
  const restoreNextAuthSecret = setEnv('NEXTAUTH_SECRET', 'nextauth_secret_1234567890123456');

  try {
    const config = getAuthUiConfig();
    assert.equal(config.isOidcConfigured, true);
  } finally {
    restoreNextAuthSecret();
    restoreSecret();
    restoreClientId();
    restoreIssuer();
  }
});

test('auth-presentation: OIDC is not configured if issuer is missing', () => {
  const restoreIssuer = setEnv('AUTH_OIDC_ISSUER', undefined);
  const restoreClientId = setEnv('AUTH_OIDC_CLIENT_ID', 'casepulse-portal');
  const restoreSecret = setEnv('AUTH_SECRET', 'secret_key_1234567890123456789012');

  try {
    const config = getAuthUiConfig();
    assert.equal(config.isOidcConfigured, false);
  } finally {
    restoreSecret();
    restoreClientId();
    restoreIssuer();
  }
});

test('auth-presentation: OIDC is not configured if client ID is missing', () => {
  const restoreIssuer = setEnv('AUTH_OIDC_ISSUER', 'https://auth.gov.in');
  const restoreClientId = setEnv('AUTH_OIDC_CLIENT_ID', undefined);
  const restoreSecret = setEnv('AUTH_SECRET', 'secret_key_1234567890123456789012');

  try {
    const config = getAuthUiConfig();
    assert.equal(config.isOidcConfigured, false);
  } finally {
    restoreSecret();
    restoreClientId();
    restoreIssuer();
  }
});

test('auth-presentation: OIDC is not configured if secret is missing', () => {
  const restoreIssuer = setEnv('AUTH_OIDC_ISSUER', 'https://auth.gov.in');
  const restoreClientId = setEnv('AUTH_OIDC_CLIENT_ID', 'casepulse-portal');
  const restoreSecret = setEnv('AUTH_SECRET', undefined);
  const restoreNextAuthSecret = setEnv('NEXTAUTH_SECRET', undefined);

  try {
    const config = getAuthUiConfig();
    assert.equal(config.isOidcConfigured, false);
  } finally {
    restoreNextAuthSecret();
    restoreSecret();
    restoreClientId();
    restoreIssuer();
  }
});

test('auth-presentation: Development demo mode is active only in development with demo mode set', () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const restoreSecret = setEnv('AUTH_SECRET', undefined);
  const restoreNextAuthSecret = setEnv('NEXTAUTH_SECRET', undefined);

  try {
    const config = getAuthUiConfig();
    assert.equal(config.isDemoMode, true);
    assert.equal(config.isOidcConfigured, false);
  } finally {
    restoreNextAuthSecret();
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('auth-presentation: Demo mode fails closed in production', () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'production');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', 'demo');

  try {
    const config = getAuthUiConfig();
    assert.equal(config.isDemoMode, false);
  } finally {
    restoreAuthMode();
    restoreNodeEnv();
  }
});
