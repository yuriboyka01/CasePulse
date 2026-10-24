import test from 'node:test';
import assert from 'node:assert/strict';
import { canWriteCaseAction, canWriteOverlapReview } from '../../src/lib/server/actor-provider';
import { parseCaseActionBody, parseOverlapReviewBody } from '../../src/lib/server/validation';
import type { Actor } from '../../src/lib/server/types';
import { POST as caseAction } from '../../src/app/api/cases/[id]/actions/route';
import { POST as overlapReview } from '../../src/app/api/overlaps/[id]/reviews/route';

const officer: Actor = { id: 'OFF-1', displayName: 'Officer', bureauCodes: ['AICTE_APPROVAL'], roles: [], isDemo: false };
const crossView: Actor = { ...officer, roles: ['CROSS_BUREAU_VIEW'] };
const admin: Actor = { ...officer, roles: ['ADMIN'] };

test('write permissions separate read-only cross-bureau access from ADMIN', () => {
  assert.equal(canWriteCaseAction(officer, 'AICTE_APPROVAL'), true);
  assert.equal(canWriteCaseAction(officer, 'UGC_VIGILANCE'), false);
  assert.equal(canWriteCaseAction(crossView, 'UGC_VIGILANCE'), false);
  assert.equal(canWriteCaseAction(admin, 'UGC_VIGILANCE'), true);
  assert.equal(canWriteOverlapReview(officer, 'AICTE_APPROVAL', 'UGC_VIGILANCE'), false);
  assert.equal(canWriteOverlapReview({ ...officer, bureauCodes: ['AICTE_APPROVAL', 'UGC_VIGILANCE'] }, 'AICTE_APPROVAL', 'UGC_VIGILANCE'), true);
  assert.equal(canWriteOverlapReview(crossView, 'AICTE_APPROVAL', 'UGC_VIGILANCE'), false);
  assert.equal(canWriteOverlapReview(admin, 'AICTE_APPROVAL', 'UGC_VIGILANCE'), true);
});

test('write payload parsers validate fields and reject client-supplied actor identity', () => {
  assert.deepEqual(parseCaseActionBody({ idempotencyKey: 'entry-0001', type: 'NOTICE_ISSUED', notes: ' Filed ' }), { idempotencyKey: 'entry-0001', type: 'NOTICE_ISSUED', notes: 'Filed' });
  assert.deepEqual(parseOverlapReviewBody({ decision: 'CONFIRMED', notes: '', expectedVersion: 3 }), { decision: 'CONFIRMED', notes: '', expectedVersion: 3 });
  assert.throws(() => parseCaseActionBody({ idempotencyKey: 'entry-0001', type: 'MADE_UP', notes: 'x' }));
  assert.throws(() => parseCaseActionBody({ idempotencyKey: 'entry-0001', type: 'NOTE_ADDED', notes: 'x'.repeat(4001) }));
  assert.throws(() => parseCaseActionBody({ idempotencyKey: 'entry-0001', type: 'NOTE_ADDED', notes: 'x', officerId: 'forged' }));
  assert.throws(() => parseOverlapReviewBody({ decision: 'JOINT_INQUIRY_INITIATED', notes: '', expectedVersion: 1 }));
  assert.throws(() => parseOverlapReviewBody({ decision: 'REJECTED', notes: '', expectedVersion: 0 }));
  assert.throws(() => parseOverlapReviewBody({ decision: 'REJECTED', notes: '', expectedVersion: 1, reviewerName: 'forged' }));
});

test('write endpoints return 401 without an authenticated server-resolved actor', async () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  const previousAuthMode = env.CASEPULSE_AUTH_MODE;
  const previousSecret = env.AUTH_SECRET;
  env.NODE_ENV = 'test';
  delete env.CASEPULSE_AUTH_MODE;
  delete env.AUTH_SECRET;
  try {
    const ctx = { params: Promise.resolve({ id: 'case-1' }) };
    assert.equal((await caseAction(new Request('http://local/api/cases/case-1/actions', { method: 'POST', body: '{}' }), ctx)).status, 401);
    assert.equal((await overlapReview(new Request('http://local/api/overlaps/rel-1/reviews', { method: 'POST', body: '{}' }), ctx)).status, 401);
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV; else env.NODE_ENV = previousNodeEnv;
    if (previousAuthMode === undefined) delete env.CASEPULSE_AUTH_MODE; else env.CASEPULSE_AUTH_MODE = previousAuthMode;
    if (previousSecret === undefined) delete env.AUTH_SECRET; else env.AUTH_SECRET = previousSecret;
  }
});

test('write endpoints report missing PostgreSQL as a visible service failure', async () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  const previousAuthMode = env.CASEPULSE_AUTH_MODE;
  const previousDatabaseUrl = env.DATABASE_URL;
  env.NODE_ENV = 'development';
  env.CASEPULSE_AUTH_MODE = 'demo';
  delete env.DATABASE_URL;
  try {
    const response = await caseAction(new Request('http://local/api/cases/case-1/actions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'unit-test-0001', type: 'NOTE_ADDED', notes: 'test' }),
    }), { params: Promise.resolve({ id: 'case-1' }) });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(body.data, undefined);
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV; else env.NODE_ENV = previousNodeEnv;
    if (previousAuthMode === undefined) delete env.CASEPULSE_AUTH_MODE; else env.CASEPULSE_AUTH_MODE = previousAuthMode;
    if (previousDatabaseUrl === undefined) delete env.DATABASE_URL; else env.DATABASE_URL = previousDatabaseUrl;
  }
});
