import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  ApiClientError,
  CaseActionPayload,
  OverlapReviewPayload,
} from '../../src/lib/api-client';

test('ApiClientError classifies HTTP status codes correctly', () => {
  const err401 = new ApiClientError(401, 'UNAUTHENTICATED', 'Missing token');
  assert.equal(err401.isAuthError, true);
  assert.equal(err401.isForbidden, false);
  assert.match(err401.userFriendlyMessage, /Authentication required/i);

  const err403 = new ApiClientError(403, 'FORBIDDEN', 'Access denied');
  assert.equal(err403.isForbidden, true);
  assert.match(err403.userFriendlyMessage, /Access denied/i);

  const err404 = new ApiClientError(404, 'NOT_FOUND', 'Case not found');
  assert.equal(err404.isNotFound, true);
  assert.match(err404.userFriendlyMessage, /Resource unavailable/i);

  const err409 = new ApiClientError(409, 'VERSION_CONFLICT', 'Stale version');
  assert.equal(err409.isConflict, true);
  assert.match(err409.userFriendlyMessage, /Review conflict/i);

  const err503 = new ApiClientError(503, 'DATABASE_UNAVAILABLE', 'Database offline');
  assert.equal(err503.isUnavailable, true);
  assert.match(err503.userFriendlyMessage, /database service is currently unavailable/i);

  const netErr = new ApiClientError(0, 'NETWORK_ERROR', 'Network connection failure');
  assert.equal(netErr.status, 0);
  assert.equal(netErr.code, 'NETWORK_ERROR');
});

test('apiClient.getCase makes same-origin request and returns case data', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      assert.match(url, /\/api\/cases\/CP-2026-0104$/);
      assert.equal(init?.credentials, 'same-origin');
      return new Response(
        JSON.stringify({
          data: {
            id: 'CP-2026-0104',
            bureauId: 'AICTE_APPROVAL',
            title: 'Test Case',
            status: 'UNDER_INVESTIGATION',
            actionHistory: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await apiClient.getCase('CP-2026-0104');
    assert.equal(res.id, 'CP-2026-0104');
    assert.equal(res.title, 'Test Case');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getCase throws ApiClientError on 404 or 503 without fake data fallback', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Test 404
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: 'Case was not found.',
            requestId: 'req-404',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );

    await assert.rejects(
      async () => apiClient.getCase('CP-UNKNOWN'),
      (err: unknown) => {
        assert(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'NOT_FOUND');
        assert.equal(err.requestId, 'req-404');
        return true;
      }
    );

    // Test 503
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'The persistent data service is unavailable.',
            requestId: 'req-503',
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );

    await assert.rejects(
      async () => apiClient.getCase('CP-2026-0104'),
      (err: unknown) => {
        assert(err instanceof ApiClientError);
        assert.equal(err.status, 503);
        assert.equal(err.code, 'DATABASE_UNAVAILABLE');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.recordCaseAction sends strictly allowed fields and omits actor identity', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let interceptedBody: Record<string, unknown> | null = null;
    let interceptedUrl: string | null = null;

    globalThis.fetch = async (input, init) => {
      interceptedUrl = String(input);
      interceptedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          data: {
            case: { id: 'CP-2026-0104', status: 'HEARING_SCHEDULED' },
            action: { id: 'ACT-999', type: 'STATUS_CHANGE', notes: 'Hearing arranged' },
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const payload: CaseActionPayload = {
      idempotencyKey: 'case-action-CP-2026-0104-logical-key-1',
      type: 'NOTICE_ISSUED',
      notes: 'Notice delivered to institution',
      nextStatus: 'HEARING_SCHEDULED',
    };

    const res = await apiClient.recordCaseAction('CP-2026-0104', payload);
    assert.match(interceptedUrl!, /\/api\/cases\/CP-2026-0104\/actions$/);
    assert.deepEqual(interceptedBody, {
      idempotencyKey: 'case-action-CP-2026-0104-logical-key-1',
      type: 'NOTICE_ISSUED',
      notes: 'Notice delivered to institution',
      nextStatus: 'HEARING_SCHEDULED',
    });

    // Verify actor, officer, or reviewer identity fields are NOT present in request payload
    assert.equal('actor' in interceptedBody!, false);
    assert.equal('officer' in interceptedBody!, false);
    assert.equal('officerId' in interceptedBody!, false);
    assert.equal('reviewerName' in interceptedBody!, false);

    assert.equal(res.case.status, 'HEARING_SCHEDULED');
    assert.equal(res.action.id, 'ACT-999');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.recordOverlapReview sends strictly decision, notes, expectedVersion', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let interceptedBody: Record<string, unknown> | null = null;
    let interceptedUrl: string | null = null;

    globalThis.fetch = async (input, init) => {
      interceptedUrl = String(input);
      interceptedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          data: {
            relationship: { id: 'OVL-01', status: 'CONFIRMED', version: 2 },
            review: {
              id: 'REV-01',
              decision: 'CONFIRMED',
              notes: 'Matches confirmed',
              previousVersion: 1,
              newVersion: 2,
            },
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const payload: OverlapReviewPayload = {
      decision: 'CONFIRMED',
      notes: 'Matches confirmed by AISHE record',
      expectedVersion: 1,
    };

    const res = await apiClient.recordOverlapReview('OVL-01', payload);
    assert.match(interceptedUrl!, /\/api\/overlaps\/OVL-01\/reviews$/);
    assert.deepEqual(interceptedBody, {
      decision: 'CONFIRMED',
      notes: 'Matches confirmed by AISHE record',
      expectedVersion: 1,
    });

    // Verify reviewer identity or roles are NEVER sent
    assert.equal('reviewer' in interceptedBody!, false);
    assert.equal('reviewerName' in interceptedBody!, false);
    assert.equal('officerId' in interceptedBody!, false);
    assert.equal('bureau' in interceptedBody!, false);

    assert.equal(res.relationship.version, 2);
    assert.equal(res.relationship.status, 'CONFIRMED');
    assert.equal(res.review.newVersion, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.recordOverlapReview handles 409 VERSION_CONFLICT error correctly', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'VERSION_CONFLICT',
            message: 'The overlap review is stale. Reload and submit the current version.',
            requestId: 'req-409',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );

    await assert.rejects(
      async () =>
        apiClient.recordOverlapReview('OVL-01', {
          decision: 'CONFIRMED',
          notes: 'Test note',
          expectedVersion: 1,
        }),
      (err: unknown) => {
        assert(err instanceof ApiClientError);
        assert.equal(err.status, 409);
        assert.equal(err.code, 'VERSION_CONFLICT');
        assert.equal(err.isConflict, true);
        assert.match(err.userFriendlyMessage, /conflict/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getOverlaps builds query strings and returns collection envelope', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl: string | null = null;
    globalThis.fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          data: [{ id: 'OVL-01', status: 'PROPOSED', version: 1 }],
          meta: { page: 1, pageSize: 25, totalCount: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await apiClient.getOverlaps({
      status: 'PROPOSED',
      matchType: 'CONFIRMED_ID',
      search: 'Apex',
    });

    assert.match(capturedUrl!, /\/api\/overlaps\?/);
    assert.match(capturedUrl!, /status=PROPOSED/);
    assert.match(capturedUrl!, /matchType=CONFIRMED_ID/);
    assert.match(capturedUrl!, /search=Apex/);
    assert.equal(res.data.length, 1);
    assert.equal(res.meta.totalCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getDashboardSummary makes same-origin request and returns summary data', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl: string | null = null;
    let capturedCredentials: RequestCredentials | undefined = undefined;
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedCredentials = init?.credentials;
      return new Response(
        JSON.stringify({
          data: {
            asOf: '2026-10-24T07:00:00Z',
            dataSource: 'POSTGRESQL',
            syntheticDemoData: true,
            syntheticRecordsPresent: true,
            totalCases: 13,
            pendingCases: 9,
            overdueCases: 3,
            criticalCases: 2,
            activeInstitutions: 8,
            repeatOffenderInstitutions: 3,
            flaggedOverlapsCount: 7,
            unresolvedOverlapsCount: 4,
            jointInquiriesActive: 1,
            bureauCounts: { AICTE_APPROVAL: 4, UGC_VIGILANCE: 3 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const summary = await apiClient.getDashboardSummary();
    assert.equal(capturedUrl, '/api/dashboard/summary');
    assert.equal(capturedCredentials, 'same-origin');
    assert.equal(summary.totalCases, 13);
    assert.equal(summary.pendingCases, 9);
    assert.equal(summary.dataSource, 'POSTGRESQL');
    assert.equal(summary.syntheticDemoData, true);
    assert.equal(summary.syntheticRecordsPresent, true);
    assert.equal(summary.overdueCases, 3);
    assert.equal(summary.flaggedOverlapsCount, 7);
    assert.equal(summary.unresolvedOverlapsCount, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getDashboardSummary throws ApiClientError on server error', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'PostgreSQL connection failed.',
            requestId: 'req-db-503',
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );

    await assert.rejects(
      async () => apiClient.getDashboardSummary(),
      (err: unknown) => {
        assert(err instanceof ApiClientError);
        assert.equal(err.status, 503);
        assert.equal(err.isUnavailable, true);
        assert.match(err.userFriendlyMessage, /database service/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getDashboardOverview returns the typed command dashboard response', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl: string | null = null;
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input);
      assert.equal(init?.credentials, 'same-origin');
      return new Response(JSON.stringify({
        data: {
          summary: {
            asOf: '2026-10-24T07:00:00Z', dataSource: 'POSTGRESQL', syntheticDemoData: true, syntheticRecordsPresent: true,
            totalCases: 0, pendingCases: 0, overdueCases: 0, criticalCases: 0,
            activeInstitutions: 0, repeatOffenderInstitutions: 0, flaggedOverlapsCount: 0,
            unresolvedOverlapsCount: 0, jointInquiriesActive: 0, bureauCounts: {},
          },
          priorityCases: [],
          pendingOverlaps: [],
          recentCases: [],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const overview = await apiClient.getDashboardOverview();
    assert.equal(capturedUrl, '/api/dashboard/overview');
    assert.equal(overview.summary.totalCases, 0);
    assert.deepEqual(overview.priorityCases, []);
    assert.deepEqual(overview.pendingOverlaps, []);
    assert.deepEqual(overview.recentCases, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getCases builds correct query string with filters', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl: string | null = null;
    globalThis.fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          data: [],
          meta: { page: 1, pageSize: 100, totalCount: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await apiClient.getCases({
      search: 'ghost faculty',
      bureau: 'AICTE_APPROVAL',
      status: 'UNDER_INVESTIGATION',
      category: 'GHOST_FACULTY',
      overdueOnly: true,
      overlapOnly: true,
      page: 2,
      pageSize: 50,
    });

    assert.match(capturedUrl!, /\/api\/cases\?/);
    assert.match(capturedUrl!, /search=ghost\+faculty/);
    assert.match(capturedUrl!, /bureau=AICTE_APPROVAL/);
    assert.match(capturedUrl!, /status=UNDER_INVESTIGATION/);
    assert.match(capturedUrl!, /category=GHOST_FACULTY/);
    assert.match(capturedUrl!, /overdueOnly=true/);
    assert.match(capturedUrl!, /overlapOnly=true/);
    assert.match(capturedUrl!, /page=2/);
    assert.match(capturedUrl!, /pageSize=50/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getCases omits ALL filters from query string', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl: string | null = null;
    globalThis.fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({ data: [], meta: { page: 1, pageSize: 25, totalCount: 0 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await apiClient.getCases({ bureau: 'ALL', status: 'ALL', category: 'ALL' });

    // 'ALL' filters must not appear in the query string sent to the server
    assert.ok(!capturedUrl!.includes('bureau=ALL'), 'bureau=ALL must not be sent');
    assert.ok(!capturedUrl!.includes('status=ALL'), 'status=ALL must not be sent');
    assert.ok(!capturedUrl!.includes('category=ALL'), 'category=ALL must not be sent');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getCases normalizes returned cases (timeline derived from actionHistory)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'CP-2026-0104',
              bureauId: 'AICTE_APPROVAL',
              title: 'Ghost Faculty Test',
              status: 'UNDER_INVESTIGATION',
              actionHistory: [
                {
                  id: 'ACT-1001',
                  caseId: 'CP-2026-0104',
                  occurredAt: '2026-08-01T10:00:00Z',
                  actor: { id: 'OFF-01', displayName: 'Demo Officer' },
                  bureauId: 'AICTE_APPROVAL',
                  type: 'FILING',
                  action: 'Complaint filed',
                  notes: 'Demo event.',
                },
              ],
            },
          ],
          meta: { page: 1, pageSize: 25, totalCount: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const res = await apiClient.getCases({});
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].id, 'CP-2026-0104');
    // normalizeCase should populate timeline from actionHistory
    assert.ok(Array.isArray(res.data[0].timeline), 'timeline should be an array');
    assert.equal(res.data[0].timeline.length, 1);
    assert.equal(res.data[0].timeline[0].timestamp, '2026-08-01T10:00:00Z');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getInstitutions builds correct query string with filters', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl: string | null = null;
    globalThis.fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          data: [],
          meta: { page: 1, pageSize: 100, totalCount: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await apiClient.getInstitutions({
      search: 'Apex',
      state: 'Maharashtra',
      riskRating: 'CRITICAL',
      bureau: 'AICTE_APPROVAL',
      page: 1,
      pageSize: 100,
    });

    assert.match(capturedUrl!, /\/api\/institutions\?/);
    assert.match(capturedUrl!, /search=Apex/);
    assert.match(capturedUrl!, /state=Maharashtra/);
    assert.match(capturedUrl!, /riskRating=CRITICAL/);
    assert.match(capturedUrl!, /bureau=AICTE_APPROVAL/);
    assert.match(capturedUrl!, /pageSize=100/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getInstitution makes same-origin request for a single institution', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl: string | null = null;
    globalThis.fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          data: {
            id: 'INST-001',
            aisheCode: 'C-19842',
            name: 'Apex Institute of Technology',
            riskRating: 'CRITICAL',
            bureauInvolvement: ['AICTE_APPROVAL'],
            activeCasesCount: 3,
            totalCasesCount: 5,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const inst = await apiClient.getInstitution('INST-001');
    assert.equal(capturedUrl, '/api/institutions/INST-001');
    assert.equal(inst.id, 'INST-001');
    assert.equal(inst.aisheCode, 'C-19842');
    assert.equal(inst.riskRating, 'CRITICAL');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiClient.getInstitution throws ApiClientError on 404', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: 'Institution not found.',
            requestId: 'req-inst-404',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );

    await assert.rejects(
      async () => apiClient.getInstitution('INST-UNKNOWN'),
      (err: unknown) => {
        assert(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.isNotFound, true);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
