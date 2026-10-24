import { Pool } from 'pg';
import { BUREAUS, CASES, DEMO_DATASET_VERSION, INSTITUTIONS } from '../src/data/synthetic-dataset';
import { detectCrossBureauOverlaps } from '../src/lib/correlation-engine';
import { runMigrations } from './db-migrate';

export function classifySeedRelationship(matchType: string, sourceInstitutionId?: string, targetInstitutionId?: string) {
  // Candidate matching never proves two complaints are duplicates.
  if (sourceInstitutionId && sourceInstitutionId === targetInstitutionId) return 'SAME_INSTITUTION';
  return matchType === 'CONFIRMED_ID' ? 'SAME_INSTITUTION' : 'RELATED_INCIDENT';
}

export async function seedDemoData(pool: Pick<Pool, 'query' | 'connect'>) {
  await runMigrations(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(262640002)');

    for (const bureau of BUREAUS) {
      await client.query(`
        INSERT INTO bureaus (code, name, short_name, department, jurisdiction, is_synthetic)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (code) DO NOTHING
      `, [bureau.id, bureau.name, bureau.shortName, bureau.department, bureau.jurisdiction]);
    }

    for (const institution of INSTITUTIONS) {
      await client.query(`
        INSERT INTO institutions (id, aishe_code, aicte_permanent_id, name, normalized_name, category,
          state, district, pincode, address, affiliated_university, established_year, approved_intake,
          risk_rating, is_synthetic)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
        ON CONFLICT (id) DO NOTHING
      `, [institution.id, institution.aisheCode || null, institution.aictePermanentId || null,
        institution.name, institution.normalizedName, institution.category, institution.state,
        institution.district, institution.pincode, institution.address, institution.affiliatedUniversity,
        institution.establishedYear, institution.approvedIntake, institution.riskRating]);
      for (const bureauCode of institution.bureauInvolvement) {
        await client.query(`INSERT INTO institution_bureaus (institution_id, bureau_code)
          VALUES ($1, $2) ON CONFLICT DO NOTHING`, [institution.id, bureauCode]);
      }
    }

    for (const item of CASES) {
      await client.query(`
        INSERT INTO complaint_cases (id, bureau_code, institution_id, title, description, category, severity,
          status, complainant_type, filing_date, sla_due_date, assigned_officer_name,
          assigned_officer_designation, assigned_officer_email, evidence_files_count, is_synthetic)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
        ON CONFLICT (id) DO NOTHING
      `, [item.id, item.bureauId, item.institutionId, item.title, item.description, item.category,
        item.severity, item.status, item.complainantType, item.filingDate, item.slaDueDate,
        item.assignedOfficer.name, item.assignedOfficer.designation, item.assignedOfficer.email,
        item.evidenceFilesCount]);

      await client.query(`INSERT INTO institution_bureaus (institution_id, bureau_code)
        VALUES ($1, $2) ON CONFLICT DO NOTHING`, [item.institutionId, item.bureauId]);

      for (const event of item.timeline) {
        await client.query(`
          INSERT INTO case_actions (id, case_id, occurred_at, actor_display_name, bureau_code,
            action_type, action, notes, is_synthetic)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
          ON CONFLICT (id) DO NOTHING
        `, [event.id, item.id, event.timestamp, event.actor, event.bureau, event.type, event.action, event.notes]);
      }
    }

    const overlaps = detectCrossBureauOverlaps(CASES, INSTITUTIONS);
    for (const overlap of overlaps) {
      const sourceInstitutionId = CASES.find((item) => item.id === overlap.sourceCaseId)?.institutionId;
      const targetInstitutionId = CASES.find((item) => item.id === overlap.targetCaseId)?.institutionId;
      await client.query(`
        INSERT INTO case_relationships (id, source_case_id, target_case_id, relationship_kind,
          match_type, confidence_score, status, reasons, evidence_matches, recommended_action,
          matcher_version, flagged_at, is_synthetic)
        VALUES ($1, $2, $3, $4, $5, $6, 'PROPOSED', $7::jsonb, $8::jsonb, $9, $10, $11, true)
        ON CONFLICT (id) DO NOTHING
      `, [overlap.id, overlap.sourceCaseId, overlap.targetCaseId,
        classifySeedRelationship(overlap.matchType, sourceInstitutionId, targetInstitutionId), overlap.matchType, overlap.confidenceScore,
        JSON.stringify(overlap.reasons), JSON.stringify(overlap.evidenceMatches),
        overlap.recommendedAction, DEMO_DATASET_VERSION, overlap.flaggedDate]);
    }

    const DEMO_OFFICERS = [
      {
        id: 'DEMO-OFFICER-001',
        email: 'demo.lead@casepulse.local',
        name: 'CASEPULSE Development Demo Officer',
        designation: 'Inter-Bureau Lead Investigator',
        issuer: 'https://auth.casepulse.local',
        subject: 'demo-officer-001',
        bureaus: BUREAUS.map((b) => b.id),
        roles: ['OFFICER', 'CROSS_BUREAU_VIEW'],
        active: true,
      },
      {
        id: 'DEMO-OFFICER-AICTE',
        email: 'officer.aicte@casepulse.local',
        name: 'AICTE Approvals Officer',
        designation: 'Approval Review Officer',
        issuer: 'https://auth.casepulse.local',
        subject: 'demo-officer-aicte',
        bureaus: ['AICTE_APPROVAL'],
        roles: ['OFFICER'],
        active: true,
      },
      {
        id: 'DEMO-OFFICER-INACTIVE',
        email: 'officer.inactive@casepulse.local',
        name: 'Deactivated Former Officer',
        designation: 'Former Officer',
        issuer: 'https://auth.casepulse.local',
        subject: 'demo-officer-inactive',
        bureaus: ['AICTE_APPROVAL'],
        roles: ['OFFICER'],
        active: false,
      },
    ];

    for (const off of DEMO_OFFICERS) {
      await client.query(`
        INSERT INTO officers (id, email, display_name, designation, is_active, is_synthetic)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (id) DO NOTHING
      `, [off.id, off.email, off.name, off.designation, off.active]);

      await client.query(`
        INSERT INTO officer_identities (id, officer_id, issuer, subject)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (issuer, subject) DO NOTHING
      `, [`IDN-${off.id}`, off.id, off.issuer, off.subject]);

      for (const b of off.bureaus) {
        await client.query(`
          INSERT INTO officer_bureaus (officer_id, bureau_code)
          VALUES ($1, $2)
          ON CONFLICT (officer_id, bureau_code) DO NOTHING
        `, [off.id, b]);
      }

      for (const r of off.roles) {
        await client.query(`
          INSERT INTO officer_roles (officer_id, role)
          VALUES ($1, $2)
          ON CONFLICT (officer_id, role) DO NOTHING
        `, [off.id, r]);
      }
    }

    const nonSyntheticConflict = await client.query(`
      SELECT
        (SELECT count(*) FROM bureaus WHERE code = ANY($1::text[]) AND NOT is_synthetic) +
        (SELECT count(*) FROM institutions WHERE id = ANY($2::text[]) AND NOT is_synthetic) +
        (SELECT count(*) FROM complaint_cases WHERE id = ANY($3::text[]) AND NOT is_synthetic) +
        (SELECT count(*) FROM case_actions WHERE id = ANY($4::text[]) AND NOT is_synthetic) +
        (SELECT count(*) FROM case_relationships WHERE id = ANY($5::text[]) AND NOT is_synthetic) +
        (SELECT count(*) FROM officers WHERE id = ANY($6::text[]) AND NOT is_synthetic) AS count
    `, [BUREAUS.map((row) => row.id), INSTITUTIONS.map((row) => row.id), CASES.map((row) => row.id),
      CASES.flatMap((row) => row.timeline.map((event) => event.id)), overlaps.map((row) => row.id),
      DEMO_OFFICERS.map((row) => row.id)]);
    if (Number(nonSyntheticConflict.rows[0].count) > 0) {
      throw new Error('A demo seed identifier is already used by a non-synthetic record.');
    }

    await client.query('COMMIT');
    return {
      bureaus: BUREAUS.length,
      institutions: INSTITUTIONS.length,
      cases: CASES.length,
      actions: CASES.reduce((n, item) => n + item.timeline.length, 0),
      relationships: overlaps.length,
      officers: DEMO_OFFICERS.length,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.CASEPULSE_ALLOW_SYNTHETIC_SEED !== 'true') {
    throw new Error('Set CASEPULSE_ALLOW_SYNTHETIC_SEED=true in a non-production environment to seed demo data.');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be configured for demo seeding.');
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3_000, application_name: 'casepulse-seed' });
  try {
    const counts = await seedDemoData(pool);
    console.info(`Synthetic demo seed complete: ${JSON.stringify(counts)} (${DEMO_DATASET_VERSION}).`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/db-seed.ts')) {
  main().catch(() => {
    console.error('Synthetic demo seed failed. Check DATABASE_URL and PostgreSQL availability.');
    process.exitCode = 1;
  });
}
