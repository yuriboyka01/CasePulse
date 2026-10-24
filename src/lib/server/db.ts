import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { DatabaseUnavailableError } from './errors';

declare global {
  // Keep a single connection pool through Next.js development hot reloads.
  var casePulsePgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (globalThis.casePulsePgPool) return globalThis.casePulsePgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseUnavailableError();
  const poolSize = Number(process.env.DATABASE_POOL_SIZE || 10);
  if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 40) {
    throw new DatabaseUnavailableError();
  }

  const pool = new Pool({
    connectionString,
    max: poolSize,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    application_name: 'casepulse-next',
  });
  pool.on('error', () => {
    // Pool error messages can include connection information; keep logs sanitized.
    console.error('CASEPULSE PostgreSQL idle client error');
  });
  globalThis.casePulsePgPool = pool;
  return pool;
}

export function isConnectionFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const item = error as { code?: string; errno?: string; name?: string };
  return Boolean(
    item.name === 'DatabaseUnavailableError' ||
    item.code?.startsWith('08') ||
    ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', '57P01', '57P02', '57P03', '53300'].includes(item.code ?? item.errno ?? '')
  );
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  try {
    return await getPool().query<Row>(text, values);
  } catch (error) {
    if (isConnectionFailure(error)) throw new DatabaseUnavailableError();
    throw error;
  }
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch {
    throw new DatabaseUnavailableError();
  }

  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof DatabaseUnavailableError) throw error;
    throw error;
  } finally {
    client.release();
  }
}
