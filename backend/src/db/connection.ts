import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL
  ? process.env.TEST_DATABASE_URL
  : (process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/restaurant_pos_db');

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export interface QueryOptions {
  tenantId?: string | null;
  isSuperAdmin?: boolean;
}

/**
 * Execute a query with tenant context set for PostgreSQL Row-Level Security.
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: any[] = [],
  options?: QueryOptions
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    // Set tenant context (transaction‑local when possible)
    if (options?.tenantId) {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [options.tenantId]);
    } else if (options?.isSuperAdmin) {
      await client.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    } else {
      // Explicitly clear any previous context – fail‑closed behaviour
      await client.query(`SELECT set_config('app.current_tenant_id', '', true);`);
      await client.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    }

    const result = await client.query<T>(text, params);
    return result;
  } finally {
    // Ensure the session variables are cleared before the client returns to the pool
    try {
      await client.query(`SELECT set_config('app.current_tenant_id', '', true);`);
      await client.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    } catch (e) {
      // ignore cleanup errors – the pool will discard a broken client
    }
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction with tenant context.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
  options?: QueryOptions
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Set tenant context for the whole transaction (local to this transaction)
    if (options?.tenantId) {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [options.tenantId]);
    } else if (options?.isSuperAdmin) {
      await client.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    } else {
      await client.query(`SELECT set_config('app.current_tenant_id', '', true);`);
      await client.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    }

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Clean up session variables before returning client to the pool
    try {
      await client.query(`SELECT set_config('app.current_tenant_id', '', true);`);
      await client.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    } catch (e) {
      // ignore cleanup errors
    }
    client.release();
  }
}


/**
 * Execute multiple queries in a transaction with tenant context.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
  options?: QueryOptions
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (options?.tenantId) {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [options.tenantId]);
    } else if (options?.isSuperAdmin) {
      await client.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    } else {
      await client.query(`SELECT set_config('app.current_tenant_id', '', true);`);
      await client.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    }

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
