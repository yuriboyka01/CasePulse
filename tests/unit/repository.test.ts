import test from 'node:test';
import assert from 'node:assert/strict';
import { CasePulseRepository } from '../../src/lib/server/repository';
import type { Actor } from '../../src/lib/server/types';

const actor: Actor = {
  id: 'OFFICER-1', displayName: 'Test Officer', bureauCodes: ['AICTE_APPROVAL'],
  roles: [], isDemo: false,
};

test('case pagination is parameterized and ordered deterministically', async () => {
  const calls: { text: string; values: unknown[] }[] = [];
  const repo = new CasePulseRepository(async (text, values = []) => {
    calls.push({ text, values });
    return { rows: calls.length === 1 ? [{ total: 4 }] : [], rowCount: 0 };
  });
  const result = await repo.listCases({ page: 2, pageSize: 2, status: 'NEW', search: 'alpha' }, actor);
  assert.deepEqual(result.meta, { page: 2, pageSize: 2, totalCount: 4 });
  assert.match(calls[1].text, /ORDER BY c\.filing_date DESC, c\.id ASC/);
  assert.match(calls[1].text, /ESCAPE '!'/);
  assert.deepEqual(calls[1].values, [['AICTE_APPROVAL'], '%alpha%', 'NEW', 2, 2]);
  assert.doesNotMatch(calls[1].text, /alpha/);
});

test('case overlap filter only includes non-rejected relationships', async () => {
  let statement = '';
  const repo = new CasePulseRepository(async (text) => {
    statement = text;
    return { rows: [{ total: 0 }], rowCount: 0 };
  });
  await repo.listCases({ page: 1, pageSize: 25, overlapOnly: true }, actor);
  assert.match(statement, /r\.status <> 'REJECTED'/);
});

test('overlap bureau filtering binds both sides and keeps stable ordering', async () => {
  const calls: { text: string; values: unknown[] }[] = [];
  const repo = new CasePulseRepository(async (text, values = []) => {
    calls.push({ text, values });
    return { rows: [{ total: 0 }], rowCount: 0 };
  });
  await repo.listOverlaps({ page: 1, pageSize: 25, bureau: 'UGC_VIGILANCE' }, actor);
  assert.match(calls[1].text, /source\.bureau_code = \$2 OR target\.bureau_code = \$3/);
  assert.match(calls[1].text, /ORDER BY r\.confidence_score DESC, r\.flagged_at DESC, r\.id ASC/);
  assert.deepEqual(calls[1].values, [['AICTE_APPROVAL'], 'UGC_VIGILANCE', 'UGC_VIGILANCE', 25, 0]);
});

test('missing institution and case records return null', async () => {
  const repo = new CasePulseRepository(async () => ({ rows: [], rowCount: 0 }));
  assert.equal(await repo.getInstitution('missing', actor), null);
  assert.equal(await repo.getCase('missing', actor), null);
});

test('dashboard overview returns empty lists without widening the actor scope', async () => {
  const calls: { text: string; values: unknown[] }[] = [];
  const repo = new CasePulseRepository(async (text, values = []) => {
    calls.push({ text, values });
    if (text.includes('AS "allSynthetic"')) {
      return { rows: [{ asOf: '2026-10-24T00:00:00Z', totalCases: 0, pendingCases: 0, overdueCases: 0, criticalCases: 0, repeatOffenderInstitutions: 0, flaggedOverlapsCount: 0, unresolvedOverlapsCount: 0, jointInquiriesActive: 0, activeInstitutions: 0, allSynthetic: false, hasSyntheticRecords: false, bureauCounts: { AICTE_APPROVAL: 0 } }], rowCount: 1 };
    }
    if (text.includes('count(*)::int AS total')) return { rows: [{ total: 0 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });

  const result = await repo.dashboardOverview(actor);
  assert.deepEqual(result.priorityCases, []);
  assert.deepEqual(result.pendingOverlaps, []);
  assert.deepEqual(result.recentCases, []);
  assert.equal(result.summary.totalCases, 0);

  const priorityQuery = calls.find(({ text }) => text.includes('c.severity = \'CRITICAL\''));
  const pendingQuery = calls.find(({ text }) => text.includes("r.status IN ('PROPOSED', 'FURTHER_COORDINATION')"));
  assert.ok(priorityQuery);
  assert.ok(pendingQuery);
  assert.match(priorityQuery.text, /c\.bureau_code = ANY\(\$1::text\[\]\)/);
  assert.match(priorityQuery.text, /c\.status NOT IN \('RESOLVED', 'CLOSED'\)/);
  assert.match(priorityQuery.text, /c\.sla_due_date < now\(\) THEN c\.sla_due_date END ASC/);
  assert.match(priorityQuery.text, /LIMIT 5/);
  assert.deepEqual(priorityQuery.values, [['AICTE_APPROVAL']]);
  assert.match(pendingQuery.text, /source\.bureau_code = ANY\(\$1::text\[\]\)/);
  assert.match(pendingQuery.text, /target\.bureau_code = ANY\(\$1::text\[\]\)/);
  assert.match(pendingQuery.text, /WHEN 'PROPOSED' THEN 0 ELSE 1 END ASC, r\.flagged_at ASC, r\.id ASC/);
  assert.match(pendingQuery.text, /LIMIT 3/);
  assert.deepEqual(pendingQuery.values, [['AICTE_APPROVAL']]);
});
