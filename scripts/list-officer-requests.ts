import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be configured.');
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000, application_name: 'casepulse-access-review' });
  try {
    const result = await pool.query(
      `SELECT id, email, display_name AS "displayName", requested_bureau_code AS "bureauCode",
        request_note AS note, submitted_at AS "submittedAt"
       FROM officer_access_requests WHERE status = 'PENDING'
       ORDER BY submitted_at ASC, id ASC`
    );
    if (result.rows.length === 0) {
      console.info('No pending officer access requests.');
      return;
    }
    for (const request of result.rows) {
      console.info(`${request.id} | ${request.email} | ${request.displayName} | ${request.bureauCode} | ${request.submittedAt}`);
      if (request.note) console.info(`  Note: ${String(request.note).replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 1000)}`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/list-officer-requests.ts')) {
  main().catch((error) => {
    console.error('Could not list officer access requests:', (error as Error).message);
    process.exitCode = 1;
  });
}
