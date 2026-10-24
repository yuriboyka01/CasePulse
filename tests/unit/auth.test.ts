import test from 'node:test';
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
import type { Pool } from 'pg';
import { GET as listCases } from '../../src/app/api/cases/route';
import { GET as getCase } from '../../src/app/api/cases/[id]/route';
import { GET as dashboardSummary } from '../../src/app/api/dashboard/summary/route';
import { GET as getInstitution } from '../../src/app/api/institutions/[id]/route';
import { resolveActor, requireActor, canReadBureau, canReadCrossBureau } from '../../src/lib/server/actor-provider';
import { CasePulseRepository } from '../../src/lib/server/repository';
import type { Actor } from '../../src/lib/server/types';

const TEST_SECRET = '01234567890123456789012345678901';

function setEnv(name: string, value: string | undefined) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  };
}

async function createAuthCookie(claims: { sub: string; iss?: string; expired?: boolean }): Promise<string> {
  const token = await encode({
    token: {
      sub: claims.sub,
      iss: claims.iss ?? 'https://auth.gov.in',
    },
    secret: TEST_SECRET,
    salt: 'authjs.session-token',
    maxAge: claims.expired ? -100 : 3600,
  });
  return `authjs.session-token=${token}`;
}

const mockPoolWithOfficer = (officer: {
  id: string;
  displayName: string;
  isActive: boolean;
  bureauCodes: string[];
  roles: string[];
} | null) => ({
  query: async (text: string) => {
    if (text.includes('FROM officers')) {
      if (!officer) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          id: officer.id,
          displayName: officer.displayName,
          isActive: officer.isActive,
          bureauCodes: officer.bureauCodes,
          roles: officer.roles,
        }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  },
} as unknown as Pool);

test('1. Missing session returns 401 UNAUTHENTICATED', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', undefined);
  const restoreSecret = setEnv('AUTH_SECRET', TEST_SECRET);
  try {
    const res = await listCases(new Request('http://local/api/cases'));
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  } finally {
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('2. Invalid or expired session is rejected with 401', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', undefined);
  const restoreSecret = setEnv('AUTH_SECRET', TEST_SECRET);
  try {
    // Malformed/tampered cookie
    const malformedReq = new Request('http://local/api/cases', {
      headers: { cookie: 'authjs.session-token=malformed-tampered-token-value' },
    });
    const malformedRes = await listCases(malformedReq);
    assert.equal(malformedRes.status, 401);
    assert.equal((await malformedRes.json()).error.code, 'UNAUTHENTICATED');

    // Expired token
    const expiredCookie = await createAuthCookie({ sub: 'user_123', expired: true });
    const expiredReq = new Request('http://local/api/cases', {
      headers: { cookie: expiredCookie },
    });
    const expiredRes = await listCases(expiredReq);
    assert.equal(expiredRes.status, 401);
    assert.equal((await expiredRes.json()).error.code, 'UNAUTHENTICATED');
  } finally {
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('3. Valid OIDC identity with no provisioned CASEPULSE account is denied with 403', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', undefined);
  const restoreSecret = setEnv('AUTH_SECRET', TEST_SECRET);
  const globalWithPool = globalThis as typeof globalThis & { casePulsePgPool?: Pool };
  const prevPool = globalWithPool.casePulsePgPool;
  globalWithPool.casePulsePgPool = mockPoolWithOfficer(null); // No officer row

  try {
    const cookie = await createAuthCookie({ sub: 'unprovisioned-officer-sub' });
    const res = await listCases(new Request('http://local/api/cases', {
      headers: { cookie },
    }));
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.match(body.error.message, /no active CASEPULSE officer account is provisioned/);
  } finally {
    globalWithPool.casePulsePgPool = prevPool;
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('4. Inactive actor is denied with 403', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', undefined);
  const restoreSecret = setEnv('AUTH_SECRET', TEST_SECRET);
  const globalWithPool = globalThis as typeof globalThis & { casePulsePgPool?: Pool };
  const prevPool = globalWithPool.casePulsePgPool;
  globalWithPool.casePulsePgPool = mockPoolWithOfficer({
    id: 'OFF-DEACTIVATED',
    displayName: 'Former Officer',
    isActive: false, // Inactive
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'],
  });

  try {
    const cookie = await createAuthCookie({ sub: 'deactivated-sub' });
    const res = await listCases(new Request('http://local/api/cases', {
      headers: { cookie },
    }));
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.match(body.error.message, /deactivated/);
  } finally {
    globalWithPool.casePulsePgPool = prevPool;
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('5. Client-supplied actor ID, roles, or bureau codes cannot elevate access', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', undefined);
  const restoreSecret = setEnv('AUTH_SECRET', TEST_SECRET);
  const globalWithPool = globalThis as typeof globalThis & { casePulsePgPool?: Pool };
  const prevPool = globalWithPool.casePulsePgPool;

  // Single-bureau officer provisioned in database
  globalWithPool.casePulsePgPool = mockPoolWithOfficer({
    id: 'OFF-REAL-001',
    displayName: 'AICTE Officer',
    isActive: true,
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'],
  });

  try {
    const cookie = await createAuthCookie({ sub: 'real-sub' });
    const spoofedReq = new Request('http://local/api/cases', {
      headers: {
        cookie,
        'x-officer-id': 'ADMIN-999',
        'x-actor-id': 'SUPERUSER',
        'x-role': 'ADMIN',
        'x-roles': 'ADMIN,CROSS_BUREAU_VIEW',
        'x-bureau': 'ALL',
      },
    });

    const actor = await requireActor(spoofedReq);
    assert.equal(actor.id, 'OFF-REAL-001');
    assert.deepEqual(actor.roles, ['OFFICER']);
    assert.deepEqual(actor.bureauCodes, ['AICTE_APPROVAL']);
    assert.equal(canReadCrossBureau(actor), false);
    assert.equal(canReadBureau(actor, 'UGC_VIGILANCE'), false);
  } finally {
    globalWithPool.casePulsePgPool = prevPool;
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('6. Officer can access permitted bureau cases', async () => {
  const actor: Actor = {
    id: 'OFF-1',
    displayName: 'AICTE Officer',
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'],
    isDemo: false,
  };

  const queries: { text: string; values: unknown[] }[] = [];
  const repo = new CasePulseRepository(async (text, values = []) => {
    queries.push({ text, values });
    if (text.includes('SELECT count(*)')) {
      return { rows: [{ total: 1 }], rowCount: 1 };
    }
    return {
      rows: [{
        id: 'CP-AICTE-001',
        bureauId: 'AICTE_APPROVAL',
        institutionId: 'INST-001',
        institutionName: 'Test Tech',
        aisheCode: 'C-100',
        title: 'Approval Deficit',
        description: 'Test case',
        category: 'UNAPPROVED_COURSES',
        severity: 'HIGH',
        status: 'UNDER_INVESTIGATION',
        complainantType: 'STUDENT',
        filingDate: new Date().toISOString(),
        slaDueDate: new Date().toISOString(),
        assignedOfficerId: 'OFF-1',
        assignedOfficerName: 'AICTE Officer',
        assignedOfficerDesignation: 'Reviewer',
        evidenceFilesCount: 2,
        crossBureauFlag: false,
        overlapIds: [],
        isSynthetic: false,
      }],
      rowCount: 1,
    };
  });

  const res = await repo.listCases({ page: 1, pageSize: 25 }, actor);
  assert.equal(res.meta.totalCount, 1);
  assert.equal(res.data[0].id, 'CP-AICTE-001');
  assert.deepEqual(queries[0].values[0], ['AICTE_APPROVAL']);
});

test('7. Officer cannot retrieve another bureau case by list filters or direct ID', async () => {
  const actor: Actor = {
    id: 'OFF-1',
    displayName: 'AICTE Officer',
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'],
    isDemo: false,
  };

  const repo = new CasePulseRepository(async () => ({ rows: [], rowCount: 0 }));

  // Requesting unauthorized bureau via filter throws 403
  await assert.rejects(
    async () => repo.listCases({ page: 1, pageSize: 25, bureau: 'UGC_VIGILANCE' }, actor),
    (err: { status: number; code: string }) => {
      assert.equal(err.status, 403);
      assert.equal(err.code, 'FORBIDDEN');
      return true;
    }
  );

  // Requesting out-of-scope direct ID returns null (handled as non-disclosing 404 by route)
  const caseData = await repo.getCase('CP-UGC-999', actor);
  assert.equal(caseData, null);

  // Institution route context check
  const context = (id: string) => ({ params: Promise.resolve({ id }) });
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const globalWithPool = globalThis as typeof globalThis & { casePulsePgPool?: Pool };
  const prevPool = globalWithPool.casePulsePgPool;
  globalWithPool.casePulsePgPool = {
    query: async () => ({ rows: [], rowCount: 0 }),
  } as unknown as Pool;

  try {
    // Non-existent or inaccessible institution returns 404
    const notFoundRes = await getInstitution(new Request('http://local/api/institutions/NON_EXISTENT'), context('NON_EXISTENT'));
    assert.equal(notFoundRes.status, 404);
    assert.equal((await notFoundRes.json()).error.code, 'NOT_FOUND');

    const notFoundCaseRes = await getCase(new Request('http://local/api/cases/NON_EXISTENT'), context('NON_EXISTENT'));
    assert.equal(notFoundCaseRes.status, 404);
  } finally {
    globalWithPool.casePulsePgPool = prevPool;
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('8. Related-case endpoints do not leak out-of-scope case data', async () => {
  const singleBureauActor: Actor = {
    id: 'OFF-1',
    displayName: 'AICTE Officer',
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'],
    isDemo: false,
  };

  const queries: { text: string; values: unknown[] }[] = [];
  const repo = new CasePulseRepository(async (text, values = []) => {
    queries.push({ text, values });
    if (text.includes('SELECT id FROM complaint_cases')) {
      return { rows: [{ id: 'CP-AICTE-001' }], rowCount: 1 };
    }
    // Cross-bureau SQL WHERE requires source AND target in scopedBureaus
    return { rows: [], rowCount: 0 };
  });

  const res = await repo.getRelatedCases('CP-AICTE-001', singleBureauActor);
  assert.ok(Array.isArray(res));
  assert.equal(res?.length, 0);
  assert.deepEqual(queries[1].values, ['CP-AICTE-001', ['AICTE_APPROVAL']]);
  assert.match(queries[1].text, /source\.bureau_code = ANY\(\$2::text\[\]\) AND target\.bureau_code = ANY\(\$2::text\[\]\)/);
});

test('9. Cross-bureau overlaps and review history obey the chosen scope policy', async () => {
  const singleBureauActor: Actor = {
    id: 'OFF-1',
    displayName: 'AICTE Officer',
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'],
    isDemo: false,
  };

  const dualBureauActor: Actor = {
    id: 'OFF-2',
    displayName: 'Dual Bureau Officer',
    bureauCodes: ['AICTE_APPROVAL', 'UGC_VIGILANCE'],
    roles: ['OFFICER'],
    isDemo: false,
  };

  const crossBureauOfficer: Actor = {
    id: 'OFF-3',
    displayName: 'Cross Bureau Officer',
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER', 'CROSS_BUREAU_VIEW'],
    isDemo: false,
  };

  // Scope check on listOverlapReviews:
  // Requires both bureaus or cross-bureau view
  const repoSingle = new CasePulseRepository(async (text, values = []) => {
    if (text.includes('SELECT r.id FROM case_relationships')) {
      // In PostgreSQL: source AND target must match scopedBureaus
      const scoped = values[1] as string[];
      if (scoped.includes('AICTE_APPROVAL') && scoped.includes('UGC_VIGILANCE')) {
        return { rows: [{ id: 'OVL-1' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('SELECT count(*)')) {
      return { rows: [{ total: 1 }], rowCount: 1 };
    }
    return { rows: [{ id: 'REV-1', decision: 'CONFIRMED', notes: 'Valid match' }], rowCount: 1 };
  });

  // Single-bureau officer receives null -> 404 NOT_FOUND
  const reviewsSingle = await repoSingle.listOverlapReviews('OVL-1', singleBureauActor);
  assert.equal(reviewsSingle, null);

  // Dual-bureau officer receives reviews result
  const reviewsDual = await repoSingle.listOverlapReviews('OVL-1', dualBureauActor);
  assert.ok(reviewsDual !== null);

  // Cross-bureau officer receives reviews result
  const reviewsCross = await repoSingle.listOverlapReviews('OVL-1', crossBureauOfficer);
  assert.ok(reviewsCross !== null);
});

test('10. Dashboard counts are scoped correctly to authorized bureau', async () => {
  const singleBureauActor: Actor = {
    id: 'OFF-1',
    displayName: 'AICTE Officer',
    bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'],
    isDemo: false,
  };

  const queries: { text: string; values: unknown[] }[] = [];
  const repo = new CasePulseRepository(async (text, values = []) => {
    queries.push({ text, values });
    return {
      rows: [{
        asOf: new Date().toISOString(),
        totalCases: 10,
        pendingCases: 6,
        overdueCases: 2,
        criticalCases: 1,
        repeatOffenderInstitutions: 1,
        flaggedOverlapsCount: 0,
        unresolvedOverlapsCount: 0,
        jointInquiriesActive: 0,
        activeInstitutions: 5,
        allSynthetic: false,
        bureauCounts: { AICTE_APPROVAL: 10 },
      }],
      rowCount: 1,
    };
  });

  const summary = await repo.dashboardSummary(singleBureauActor);
  assert.equal(summary.totalCases, 10);
  assert.deepEqual(summary.bureauCounts, { AICTE_APPROVAL: 10 });
  assert.deepEqual(queries[0].values[0], ['AICTE_APPROVAL']);
  assert.match(queries[0].text, /b\.code = ANY\(\$1::text\[\]\)/);
});

test('11. Admin/cross-bureau access follows explicit role policy', () => {
  const plainOfficer: Actor = {
    id: '1', displayName: 'Officer', bureauCodes: ['AICTE_APPROVAL'],
    roles: ['OFFICER'], isDemo: false,
  };
  const crossOfficer: Actor = {
    id: '2', displayName: 'Cross Officer', bureauCodes: ['AICTE_APPROVAL'],
    roles: ['CROSS_BUREAU_VIEW'], isDemo: false,
  };
  const adminOfficer: Actor = {
    id: '3', displayName: 'Admin', bureauCodes: ['AICTE_APPROVAL'],
    roles: ['ADMIN'], isDemo: false,
  };

  assert.equal(canReadCrossBureau(plainOfficer), false);
  assert.equal(canReadCrossBureau(crossOfficer), true);
  assert.equal(canReadCrossBureau(adminOfficer), true);

  assert.equal(canReadBureau(plainOfficer, 'AICTE_APPROVAL'), true);
  assert.equal(canReadBureau(plainOfficer, 'UGC_VIGILANCE'), false);

  assert.equal(canReadBureau(crossOfficer, 'AICTE_APPROVAL'), true);
  assert.equal(canReadBureau(crossOfficer, 'UGC_VIGILANCE'), true);

  assert.equal(canReadBureau(adminOfficer, 'AICTE_APPROVAL'), true);
  assert.equal(canReadBureau(adminOfficer, 'UGC_VIGILANCE'), true);
});

test('12. Demo mode is denied when NODE_ENV=production', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'production');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const restoreSecret = setEnv('AUTH_SECRET', undefined);
  try {
    const actor = await resolveActor(new Request('http://local/api/cases'));
    assert.equal(actor, null);

    await assert.rejects(
      async () => requireActor(new Request('http://local/api/cases')),
      (err: { status: number; code: string }) => {
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHENTICATED');
        return true;
      }
    );
  } finally {
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('13. Missing OIDC configuration fails closed in production', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'production');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', undefined);
  const restoreSecret = setEnv('AUTH_SECRET', undefined);
  const restoreNextAuthSecret = setEnv('NEXTAUTH_SECRET', undefined);
  try {
    const actor = await resolveActor(new Request('http://local/api/cases'));
    assert.equal(actor, null);

    await assert.rejects(
      async () => requireActor(new Request('http://local/api/cases')),
      (err: { status: number; code: string }) => {
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHENTICATED');
        return true;
      }
    );
  } finally {
    restoreNextAuthSecret();
    restoreSecret();
    restoreAuthMode();
    restoreNodeEnv();
  }
});

test('14. Database errors do not turn into fabricated successful responses', async () => {
  const restoreNodeEnv = setEnv('NODE_ENV', 'development');
  const restoreAuthMode = setEnv('CASEPULSE_AUTH_MODE', 'demo');
  const globalWithPool = globalThis as typeof globalThis & { casePulsePgPool?: Pool };
  const prevPool = globalWithPool.casePulsePgPool;
  globalWithPool.casePulsePgPool = {
    query: async () => {
      const err = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
      throw err;
    },
  } as unknown as Pool;

  try {
    const res = await dashboardSummary(new Request('http://local/api/dashboard/summary'));
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(body.data, undefined);
  } finally {
    globalWithPool.casePulsePgPool = prevPool;
    restoreAuthMode();
    restoreNodeEnv();
  }
});
