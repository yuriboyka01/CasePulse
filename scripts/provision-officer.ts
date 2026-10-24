import { parseArgs } from 'node:util';
import { Pool, type PoolClient } from 'pg';
import { BUREAU_CODES, type BureauCode } from '../src/lib/server/types';

export const ALLOWED_ROLES = ['OFFICER', 'CROSS_BUREAU_VIEW', 'ADMIN'] as const;
export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export interface ProvisionOfficerOptions {
  id: string;
  email: string;
  name: string;
  designation?: string;
  issuer: string;
  subject: string;
  bureaus: BureauCode[];
  roles: AllowedRole[];
  active?: boolean;
}

export async function provisionOfficer(
  pool: Pick<Pool, 'connect'>,
  options: ProvisionOfficerOptions
) {
  const {
    id,
    email,
    name,
    designation = '',
    issuer,
    subject,
    bureaus,
    roles,
    active = true,
  } = options;

  if (!id || typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id)) {
    throw new Error('A valid officer id is required (alphanumeric, max 100 characters).');
  }
  if (!email || !email.includes('@')) {
    throw new Error('A valid officer email address is required.');
  }
  if (!name || name.trim() === '') {
    throw new Error('Officer display name is required.');
  }
  if (!issuer || issuer.trim() === '') {
    throw new Error('OIDC issuer URL is required.');
  }
  if (!subject || subject.trim() === '') {
    throw new Error('OIDC subject claim is required.');
  }
  if (!Array.isArray(bureaus) || bureaus.length === 0) {
    throw new Error('At least one valid bureau assignment is required.');
  }
  for (const bureau of bureaus) {
    if (!BUREAU_CODES.includes(bureau)) {
      throw new Error(`Invalid bureau code: ${bureau}. Allowed: ${BUREAU_CODES.join(', ')}.`);
    }
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error('At least one valid role is required (e.g. OFFICER, CROSS_BUREAU_VIEW, ADMIN).');
  }
  for (const role of roles) {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}. Allowed: ${ALLOWED_ROLES.join(', ')}.`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(262640003)');

    // 1. Upsert officer
    await client.query(
      `INSERT INTO officers (id, email, display_name, designation, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         designation = EXCLUDED.designation,
         is_active = EXCLUDED.is_active,
         updated_at = now()`,
      [id, email.trim().toLowerCase(), name.trim(), designation.trim(), active]
    );

    // 2. Upsert OIDC identity mapping
    const identityId = `IDN-${id}-${Buffer.from(issuer).toString('base64url').slice(0, 12)}`;
    await client.query(
      `INSERT INTO officer_identities (id, officer_id, issuer, subject)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (issuer, subject) DO UPDATE SET
         officer_id = EXCLUDED.officer_id`,
      [identityId, id, issuer.trim(), subject.trim()]
    );

    // 3. Sync bureau memberships
    await client.query('DELETE FROM officer_bureaus WHERE officer_id = $1', [id]);
    for (const bureau of bureaus) {
      await client.query(
        `INSERT INTO officer_bureaus (officer_id, bureau_code)
         VALUES ($1, $2)
         ON CONFLICT (officer_id, bureau_code) DO NOTHING`,
        [id, bureau]
      );
    }

    // 4. Sync roles
    await client.query('DELETE FROM officer_roles WHERE officer_id = $1', [id]);
    for (const role of roles) {
      await client.query(
        `INSERT INTO officer_roles (officer_id, role)
         VALUES ($1, $2)
         ON CONFLICT (officer_id, role) DO NOTHING`,
        [id, role]
      );
    }

    await client.query('COMMIT');
    return {
      id,
      email: email.trim().toLowerCase(),
      displayName: name.trim(),
      issuer: issuer.trim(),
      subject: subject.trim(),
      bureaus,
      roles,
      active,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    (client as PoolClient).release();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      id: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      designation: { type: 'string' },
      issuer: { type: 'string' },
      subject: { type: 'string' },
      bureaus: { type: 'string' },
      roles: { type: 'string' },
      active: { type: 'string' },
    },
    strict: true,
  });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured to provision officers.');
  }

  if (!values.id || !values.email || !values.name || !values.issuer || !values.subject || !values.bureaus || !values.roles) {
    console.error(`Usage:
  npx tsx scripts/provision-officer.ts \\
    --id <officer-id> \\
    --email <officer-email> \\
    --name "<Officer Display Name>" \\
    [--designation "<Designation>"] \\
    --issuer <oidc-issuer-url> \\
    --subject <oidc-subject-claim> \\
    --bureaus <bureau1,bureau2,...> \\
    --roles <role1,role2,...> \\
    [--active <true|false>]

Allowed bureaus: ${BUREAU_CODES.join(', ')}
Allowed roles: ${ALLOWED_ROLES.join(', ')}`);
    process.exit(1);
  }

  const bureaus = values.bureaus.split(',').map((b) => b.trim()) as BureauCode[];
  const roles = values.roles.split(',').map((r) => r.trim()) as AllowedRole[];
  const active = values.active === undefined || values.active.toLowerCase() === 'true';

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    application_name: 'casepulse-provision',
  });

  try {
    const result = await provisionOfficer(pool, {
      id: values.id,
      email: values.email,
      name: values.name,
      designation: values.designation,
      issuer: values.issuer,
      subject: values.subject,
      bureaus,
      roles,
      active,
    });
    console.info(`Successfully provisioned officer: ${result.id} (${result.displayName})`);
    console.info(`  Email: ${result.email}`);
    console.info(`  Identity: ${result.issuer} (sub: ${result.subject})`);
    console.info(`  Bureaus: ${result.bureaus.join(', ')}`);
    console.info(`  Roles: ${result.roles.join(', ')}`);
    console.info(`  Active: ${result.active}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/provision-officer.ts')) {
  main().catch((error) => {
    console.error('Officer provisioning failed:', (error as Error).message);
    process.exitCode = 1;
  });
}
