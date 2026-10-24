import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';

export async function runMigrations(pool: Pick<Pool, 'connect'>, migrationsDirectory = join(process.cwd(), 'db', 'migrations')) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(262640001)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name text PRIMARY KEY,
      checksum_sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ migration_name: string; checksum_sha256: string }>(
      'SELECT migration_name, checksum_sha256 FROM schema_migrations'
    );
    const appliedChecksums = new Map(applied.rows.map((row) => [row.migration_name, row.checksum_sha256]));
    const files = (await readdir(migrationsDirectory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort();

    for (const filename of files) {
      const source = await readFile(join(migrationsDirectory, filename), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const existing = appliedChecksums.get(filename);
      if (existing && existing !== checksum) {
        throw new Error(`Applied migration ${filename} has changed; add a new migration instead.`);
      }
      if (existing) continue;
      await client.query(source);
      await client.query(
        'INSERT INTO schema_migrations (migration_name, checksum_sha256) VALUES ($1, $2)',
        [filename, checksum]
      );
      console.info(`Applied migration ${filename}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    (client as PoolClient).release();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be configured for migrations.');
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3_000, application_name: 'casepulse-migrations' });
  try {
    await runMigrations(pool);
    console.info('Database migrations are current.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/db-migrate.ts')) {
  main().catch(() => {
    console.error('Database migrations failed. Check DATABASE_URL and PostgreSQL availability.');
    process.exitCode = 1;
  });
}
