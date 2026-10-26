import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Pool } from 'pg';

async function main() {
  const { values } = parseArgs({
    options: { request: { type: 'string' }, id: { type: 'string' } },
    strict: true,
  });
  if (!values.request) throw new Error('Usage: npm run auth:approve-request -- --request <request-id> [--id <officer-id>]');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be configured.');

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000, application_name: 'casepulse-access-review' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, email, display_name AS "displayName", requested_bureau_code AS "bureauCode", password_hash AS "passwordHash"
       FROM officer_access_requests WHERE id = $1 AND status = 'PENDING' FOR UPDATE`,
      [values.request]
    );
    const accessRequest = result.rows[0] as {
      id: string;
      email: string;
      displayName: string;
      bureauCode: string;
      passwordHash: string;
    } | undefined;
    if (!accessRequest?.passwordHash) throw new Error('Pending access request was not found.');

    const officerId = values.id || `OFF-${randomUUID().slice(0, 12).toUpperCase()}`;
    const reviewer = process.env.USERNAME || process.env.USER || 'administrator';
    await client.query(
      `INSERT INTO officers (id, email, display_name, designation, is_active, is_synthetic)
       VALUES ($1, $2, $3, 'Officer', true, false)`,
      [officerId, accessRequest.email, accessRequest.displayName]
    );
    await client.query(
      `INSERT INTO officer_password_credentials (officer_id, password_hash) VALUES ($1, $2)`,
      [officerId, accessRequest.passwordHash]
    );
    await client.query(
      `INSERT INTO officer_bureaus (officer_id, bureau_code) VALUES ($1, $2)`,
      [officerId, accessRequest.bureauCode]
    );
    await client.query(`INSERT INTO officer_roles (officer_id, role) VALUES ($1, 'OFFICER')`, [officerId]);
    await client.query(
      `UPDATE officer_access_requests SET status = 'APPROVED', password_hash = NULL,
        reviewed_at = now(), reviewed_by = $2 WHERE id = $1`,
      [accessRequest.id, reviewer]
    );
    await client.query('COMMIT');
    console.info(`Approved access request for ${accessRequest.email}. Officer ID: ${officerId}. Bureau: ${accessRequest.bureauCode}.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/approve-officer-request.ts')) {
  main().catch((error) => {
    console.error('Officer access approval failed:', (error as Error).message);
    process.exitCode = 1;
  });
}
