import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { runMigrations } from '../../scripts/db-migrate';
import { seedDemoData } from '../../scripts/db-seed';
import { provisionOfficer } from '../../scripts/provision-officer';
import { lookupOfficerInDb } from '../../src/lib/server/actor-provider';
import { GET as dashboardSummary } from '../../src/app/api/dashboard/summary/route';
import { GET as listInstitutions } from '../../src/app/api/institutions/route';
import { GET as getInstitution } from '../../src/app/api/institutions/[id]/route';
import { GET as listCases } from '../../src/app/api/cases/route';
import { GET as getCase } from '../../src/app/api/cases/[id]/route';
import { GET as getRelated } from '../../src/app/api/cases/[id]/related/route';
import { GET as listOverlaps } from '../../src/app/api/overlaps/route';
import { GET as listReviews } from '../../src/app/api/overlaps/[id]/reviews/route';
import { POST as appendCaseAction } from '../../src/app/api/cases/[id]/actions/route';
import { POST as appendOverlapReview } from '../../src/app/api/overlaps/[id]/reviews/route';

const databaseUrl = process.env.DATABASE_URL_TEST;

test('PostgreSQL migrations, constraints, and repeatable synthetic seed', {
  skip: databaseUrl ? false : 'Set DATABASE_URL_TEST to run PostgreSQL integration checks.',
}, async () => {
  const schema = `casepulse_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 3000,
    options: `-c search_path=${schema}`,
  });
  try {
    await runMigrations(pool);
    await runMigrations(pool);
    const firstSeed = await seedDemoData(pool);
    const secondSeed = await seedDemoData(pool);
    assert.deepEqual(secondSeed, firstSeed);
    const syntheticRows = await pool.query('SELECT count(*)::int AS count FROM complaint_cases WHERE is_synthetic');
    assert.equal(syntheticRows.rows[0].count, firstSeed.cases);
    const pair = await pool.query(`SELECT a.id AS source, b.id AS target FROM complaint_cases a
      CROSS JOIN complaint_cases b WHERE a.id < b.id
      AND NOT EXISTS (SELECT 1 FROM case_relationships r
        WHERE LEAST(r.source_case_id, r.target_case_id) = a.id AND GREATEST(r.source_case_id, r.target_case_id) = b.id)
      LIMIT 1`);
    assert.ok(pair.rows[0]);
    await assert.rejects(pool.query(`INSERT INTO case_relationships (id, source_case_id, target_case_id, relationship_kind, match_type,
      confidence_score, matcher_version, flagged_at) VALUES ('bad-kind', $1, $2, 'INVALID', 'CONFIRMED_ID', 50, 'test', now())`,
    [pair.rows[0].source, pair.rows[0].target]));
    const audit = await pool.query('SELECT id FROM case_actions LIMIT 1');
    if (audit.rows[0]) {
      await assert.rejects(pool.query('UPDATE case_actions SET notes = $2 WHERE id = $1', [audit.rows[0].id, 'tampered']));
    }

    const global = globalThis as typeof globalThis & { casePulsePgPool?: Pool };
    const previousPool = global.casePulsePgPool;
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env['NODE_ENV'];
    const previousAuthMode = env['CASEPULSE_AUTH_MODE'];
    global.casePulsePgPool = pool;
    env['NODE_ENV'] = 'development';
    env['CASEPULSE_AUTH_MODE'] = 'demo';
    try {
      const caseId = (await pool.query('SELECT id FROM complaint_cases ORDER BY id LIMIT 1')).rows[0].id as string;
      const institutionId = (await pool.query('SELECT id FROM institutions ORDER BY id LIMIT 1')).rows[0].id as string;
      const relationshipId = (await pool.query('SELECT id FROM case_relationships ORDER BY id LIMIT 1')).rows[0].id as string;
      const context = (id: string) => ({ params: Promise.resolve({ id }) });

      const summaryResponse = await dashboardSummary(new Request('http://local/api/dashboard/summary'));
      const summary = await summaryResponse.json();
      assert.equal(summaryResponse.status, 200);
      assert.equal(summary.data.totalCases, firstSeed.cases);
      assert.equal(summary.data.syntheticDemoData, true);

      const institutionResponse = await listInstitutions(new Request('http://local/api/institutions?page=1&pageSize=2'));
      const institutionList = await institutionResponse.json();
      assert.equal(institutionResponse.status, 200);
      const visibleInstitutionCount = await pool.query(`SELECT count(*)::int AS count FROM institutions i
        WHERE EXISTS (SELECT 1 FROM institution_bureaus ib WHERE ib.institution_id = i.id)`);
      assert.equal(institutionList.meta.totalCount, visibleInstitutionCount.rows[0].count);
      assert.equal(institutionList.data.length, 2);
      assert.equal(institutionList.data[0].isSynthetic, true);
      assert.equal((await getInstitution(new Request('http://local/api/institutions/id'), context(institutionId))).status, 200);

      const casesResponse = await listCases(new Request('http://local/api/cases?page=1&pageSize=2'));
      const cases = await casesResponse.json();
      assert.equal(casesResponse.status, 200);
      assert.equal(cases.meta.totalCount, firstSeed.cases);
      assert.equal(cases.data.length, 2);
      assert.equal((await getCase(new Request('http://local/api/cases/id'), context(caseId))).status, 200);
      assert.equal((await getRelated(new Request('http://local/api/cases/id/related'), context(caseId))).status, 200);
      assert.equal((await listOverlaps(new Request('http://local/api/overlaps?page=1&pageSize=10'))).status, 200);
      assert.equal((await listReviews(new Request('http://local/api/overlaps/id/reviews'), context(relationshipId))).status, 200);

      // Persistent writes: action append and versioned review both use database transactions.
      const actionBefore = Number((await pool.query('SELECT count(*)::int AS count FROM case_actions WHERE case_id = $1', [caseId])).rows[0].count);
      const actionResponse = await appendCaseAction(new Request(`http://local/api/cases/${caseId}/actions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: 'integration-forged-0001', type: 'NOTE_ADDED', notes: 'Integration action', officerId: 'FORGED-ID' }),
      }), context(caseId));
      assert.equal(actionResponse.status, 400, 'request supplied actor identity is rejected');
      const acceptedAction = await appendCaseAction(new Request(`http://local/api/cases/${caseId}/actions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: 'integration-action-0001', type: 'NOTE_ADDED', notes: 'Integration action' }),
      }), context(caseId));
      assert.equal(acceptedAction.status, 201);
      const actionData = await acceptedAction.json();
      assert.equal(actionData.data.action.actor.id, 'DEMO-OFFICER-001');
      assert.equal(Number((await pool.query('SELECT count(*)::int AS count FROM case_actions WHERE case_id = $1', [caseId])).rows[0].count), actionBefore + 1);
      const duplicateAction = await appendCaseAction(new Request(`http://local/api/cases/${caseId}/actions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: 'integration-action-0001', type: 'NOTE_ADDED', notes: 'Integration action' }),
      }), context(caseId));
      assert.equal(duplicateAction.status, 201);
      assert.equal((await duplicateAction.json()).data.action.id, actionData.data.action.id);
      assert.equal(Number((await pool.query('SELECT count(*)::int AS count FROM case_actions WHERE case_id = $1', [caseId])).rows[0].count), actionBefore + 1);

      const transitionCase = (await pool.query(`SELECT id FROM complaint_cases WHERE status = 'NEW' ORDER BY id LIMIT 1`)).rows[0]?.id as string | undefined;
      if (transitionCase) {
        const beforeTransition = Number((await pool.query(`SELECT count(*)::int AS count FROM case_actions WHERE case_id = $1 AND action_type = 'STATUS_CHANGE'`, [transitionCase])).rows[0].count);
        const transitionResponse = await appendCaseAction(new Request(`http://local/api/cases/${transitionCase}/actions`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: 'integration-status-0001', type: 'NOTE_ADDED', notes: 'Begin investigation', nextStatus: 'UNDER_INVESTIGATION' }),
        }), context(transitionCase));
        assert.equal(transitionResponse.status, 201);
        const transitionResult = await transitionResponse.json();
        assert.equal(transitionResult.data.case.status, 'UNDER_INVESTIGATION');
        assert.equal(transitionResult.data.action.type, 'STATUS_CHANGE');
        assert.equal(Number((await pool.query(`SELECT count(*)::int AS count FROM case_actions WHERE case_id = $1 AND action_type = 'STATUS_CHANGE'`, [transitionCase])).rows[0].count), beforeTransition + 1);
      }

      const relVersion = Number((await pool.query('SELECT version FROM case_relationships WHERE id = $1', [relationshipId])).rows[0].version);
      const reviewRequest = (expectedVersion: number) => new Request(`http://local/api/overlaps/${relationshipId}/reviews`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'FURTHER_COORDINATION', notes: 'Integration review', expectedVersion }),
      });
      const reviewsBefore = Number((await pool.query('SELECT count(*)::int AS count FROM overlap_reviews WHERE relationship_id = $1', [relationshipId])).rows[0].count);
      const reviewResponse = await appendOverlapReview(reviewRequest(relVersion), context(relationshipId));
      assert.equal(reviewResponse.status, 201);
      const reviewData = await reviewResponse.json();
      assert.equal(reviewData.data.relationship.version, relVersion + 1);
      assert.equal(reviewData.data.review.reviewer.id, 'DEMO-OFFICER-001');
      assert.equal(Number((await pool.query('SELECT count(*)::int AS count FROM overlap_reviews WHERE relationship_id = $1', [relationshipId])).rows[0].count), reviewsBefore + 1);
      const staleResponse = await appendOverlapReview(reviewRequest(relVersion), context(relationshipId));
      assert.equal(staleResponse.status, 409);
      assert.equal(Number((await pool.query('SELECT version FROM case_relationships WHERE id = $1', [relationshipId])).rows[0].version), relVersion + 1);

      // A failed history insert must roll back the corresponding status/version update.
      await pool.query(`CREATE FUNCTION fail_casepulse_action_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.action_type = 'STATUS_CHANGE' THEN RAISE EXCEPTION 'integration failure'; END IF; RETURN NEW; END $$`);
      await pool.query(`CREATE TRIGGER fail_casepulse_action_insert BEFORE INSERT ON case_actions FOR EACH ROW EXECUTE FUNCTION fail_casepulse_action_insert()`);
      try {
        const rollbackCase = transitionCase ?? caseId;
        const currentCase = (await pool.query('SELECT status FROM complaint_cases WHERE id = $1', [rollbackCase])).rows[0].status as string;
        const desired = currentCase === 'NEW' ? 'UNDER_INVESTIGATION' : 'CLOSED';
        const actionCount = Number((await pool.query(`SELECT count(*)::int AS count FROM case_actions WHERE case_id = $1`, [rollbackCase])).rows[0].count);
        const failed = await appendCaseAction(new Request(`http://local/api/cases/${rollbackCase}/actions`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'integration-rollback-0001', type: 'NOTE_ADDED', notes: 'must rollback', nextStatus: desired }),
        }), context(rollbackCase));
        assert.equal(failed.status, 500);
        assert.equal((await pool.query('SELECT status FROM complaint_cases WHERE id = $1', [rollbackCase])).rows[0].status, currentCase);
        assert.equal(Number((await pool.query('SELECT count(*)::int AS count FROM case_actions WHERE case_id = $1', [rollbackCase])).rows[0].count), actionCount);
      } finally {
        await pool.query('DROP TRIGGER fail_casepulse_action_insert ON case_actions');
        await pool.query('DROP FUNCTION fail_casepulse_action_insert()');
      }

      // A failed immutable review append must roll back the current relationship decision/version.
      await pool.query(`CREATE FUNCTION fail_casepulse_review_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'integration failure'; END $$`);
      await pool.query(`CREATE TRIGGER fail_casepulse_review_insert BEFORE INSERT ON overlap_reviews FOR EACH ROW EXECUTE FUNCTION fail_casepulse_review_insert()`);
      try {
        const currentVersion = Number((await pool.query('SELECT version FROM case_relationships WHERE id = $1', [relationshipId])).rows[0].version);
        const failed = await appendOverlapReview(new Request(`http://local/api/overlaps/${relationshipId}/reviews`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision: 'REJECTED', notes: 'must rollback', expectedVersion: currentVersion }),
        }), context(relationshipId));
        assert.equal(failed.status, 500);
        assert.equal(Number((await pool.query('SELECT version FROM case_relationships WHERE id = $1', [relationshipId])).rows[0].version), currentVersion);
      } finally {
        await pool.query('DROP TRIGGER fail_casepulse_review_insert ON overlap_reviews');
        await pool.query('DROP FUNCTION fail_casepulse_review_insert()');
      }
      await pool.query(`CREATE FUNCTION fail_casepulse_relationship_update() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'integration failure'; END $$`);
      await pool.query(`CREATE TRIGGER fail_casepulse_relationship_update BEFORE UPDATE ON case_relationships FOR EACH ROW EXECUTE FUNCTION fail_casepulse_relationship_update()`);
      try {
        const currentVersion = Number((await pool.query('SELECT version FROM case_relationships WHERE id = $1', [relationshipId])).rows[0].version);
        const reviewCount = Number((await pool.query('SELECT count(*)::int AS count FROM overlap_reviews WHERE relationship_id = $1', [relationshipId])).rows[0].count);
        const failed = await appendOverlapReview(new Request(`http://local/api/overlaps/${relationshipId}/reviews`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision: 'REJECTED', notes: 'must rollback', expectedVersion: currentVersion }),
        }), context(relationshipId));
        assert.equal(failed.status, 500);
        assert.equal(Number((await pool.query('SELECT version FROM case_relationships WHERE id = $1', [relationshipId])).rows[0].version), currentVersion);
        assert.equal(Number((await pool.query('SELECT count(*)::int AS count FROM overlap_reviews WHERE relationship_id = $1', [relationshipId])).rows[0].count), reviewCount);
      } finally {
        await pool.query('DROP TRIGGER fail_casepulse_relationship_update ON case_relationships');
        await pool.query('DROP FUNCTION fail_casepulse_relationship_update()');
      }

      // Verify PostgreSQL-backed OIDC actor lookup from migration 002
      const queryRunner = (text: string, values: unknown[] = []) => pool.query(text, values);
      const activeOfficer = await lookupOfficerInDb('https://auth.casepulse.local', 'demo-officer-001', queryRunner as unknown as typeof import('../../src/lib/server/db').query);
      assert.equal(activeOfficer.id, 'DEMO-OFFICER-001');
      assert.equal(activeOfficer.roles.includes('CROSS_BUREAU_VIEW'), true);

      // Inactive officer rejection from database
      await assert.rejects(
        lookupOfficerInDb('https://auth.casepulse.local', 'demo-officer-inactive', queryRunner as unknown as typeof import('../../src/lib/server/db').query),
        (err: { status: number; code: string }) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );

      // Unprovisioned identity rejection
      await assert.rejects(
        lookupOfficerInDb('https://untrusted.idp', 'unknown-sub', queryRunner as unknown as typeof import('../../src/lib/server/db').query),
        (err: { status: number; code: string }) => {
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );

      // Verify safe idempotent officer provisioning
      const provisioned = await provisionOfficer(pool, {
        id: 'OFF-TEST-PROVISIONED',
        email: 'test.officer@bureau.gov.in',
        name: 'Test Officer',
        designation: 'Auditor',
        issuer: 'https://gov.in/oidc',
        subject: 'sub-test-999',
        bureaus: ['AICTE_APPROVAL'],
        roles: ['OFFICER'],
        active: true,
      });
      assert.equal(provisioned.id, 'OFF-TEST-PROVISIONED');
      const lookupNew = await lookupOfficerInDb('https://gov.in/oidc', 'sub-test-999', queryRunner as unknown as typeof import('../../src/lib/server/db').query);
      assert.equal(lookupNew.id, 'OFF-TEST-PROVISIONED');
      assert.deepEqual(lookupNew.bureauCodes, ['AICTE_APPROVAL']);
      assert.deepEqual(lookupNew.roles, ['OFFICER']);
    } finally {
      global.casePulsePgPool = previousPool;
      if (previousNodeEnv === undefined) delete env['NODE_ENV'];
      else env['NODE_ENV'] = previousNodeEnv;
      if (previousAuthMode === undefined) delete env['CASEPULSE_AUTH_MODE'];
      else env['CASEPULSE_AUTH_MODE'] = previousAuthMode;
    }
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
