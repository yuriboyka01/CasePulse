import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { GET as dashboardSummary } from '../../src/app/api/dashboard/summary/route';
import { GET as dashboardOverview } from '../../src/app/api/dashboard/overview/route';
import { GET as listCases } from '../../src/app/api/cases/route';

function setEnv(name: string, value: string | undefined) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  };
}

test('API endpoints reject requests without a server-resolved actor', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'test');
  const restoreAuth = setEnv('CASEPULSE_AUTH_MODE', undefined);
  try {
    const response = await dashboardSummary(new Request('http://local/api/dashboard/summary'));
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
    assert.ok(body.error.requestId);
    const overviewResponse = await dashboardOverview(new Request('http://local/api/dashboard/overview'));
    const overviewBody = await overviewResponse.json();
    assert.equal(overviewResponse.status, 401);
    assert.equal(overviewBody.error.code, 'UNAUTHENTICATED');
  } finally {
    restoreAuth();
    restoreNodeEnv();
  }
});

test('dashboard overview database failures remain visible and return no success payload', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuth = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const restoreDatabase = setEnv('DATABASE_URL', undefined);
  try {
    const response = await dashboardOverview(new Request('http://local/api/dashboard/overview'));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(body.data, undefined);
  } finally {
    restoreDatabase();
    restoreAuth();
    restoreNodeEnv();
  }
});

test('invalid query parameters are rejected before database access', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuth = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const restoreDatabase = setEnv('DATABASE_URL', undefined);
  try {
    const response = await listCases(new Request('http://local/api/cases?page=0'));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  } finally {
    restoreDatabase();
    restoreAuth();
    restoreNodeEnv();
  }
});

test('database failures return a visible service error, never fabricated data', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuth = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const restoreDatabase = setEnv('DATABASE_URL', undefined);
  try {
    const response = await dashboardSummary(new Request('http://local/api/dashboard/summary'));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(body.data, undefined);
  } finally {
    restoreDatabase();
    restoreAuth();
    restoreNodeEnv();
  }
});

test('database connection failures return 503 without fabricated data', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuth = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const globalWithPool = globalThis as typeof globalThis & { casePulsePgPool?: Pool };
  const previousPool = globalWithPool.casePulsePgPool;
  const connectionError = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
  globalWithPool.casePulsePgPool = {
    query: async () => { throw connectionError; },
  } as unknown as Pool;

  try {
    const response = await dashboardSummary(new Request('http://local/api/dashboard/summary'));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(body.data, undefined);
  } finally {
    globalWithPool.casePulsePgPool = previousPool;
    restoreAuth();
    restoreNodeEnv();
  }
});
