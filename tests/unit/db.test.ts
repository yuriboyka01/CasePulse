import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, isConnectionFailure } from '../../src/lib/server/db';
import { DatabaseUnavailableError } from '../../src/lib/server/errors';

test('database configuration failure is explicit and does not create an in-memory fallback', () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.throws(() => getPool(), DatabaseUnavailableError);
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});

test('PostgreSQL connection errors are distinguished from SQL errors', () => {
  assert.equal(isConnectionFailure({ code: 'ECONNREFUSED' }), true);
  assert.equal(isConnectionFailure({ code: '57P03' }), true);
  assert.equal(isConnectionFailure({ code: '42601' }), false);
  assert.equal(isConnectionFailure(new Error('query failed')), false);
});
