import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/db/connection.js';
import { query } from '../src/db/connection.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper to run a query with a specific tenant context.
 */
async function q(sql: string, params: any[] = [], tenantId?: string) {
  return await query(sql, params, tenantId ? { tenantId } : undefined);
}

let tenantA: string;
let tenantB: string;
let branchA: string;
let branchB: string;

beforeAll(async () => {
  // Ensure test DB is clean – this will run against the TEST_DATABASE_URL
  // Create two tenants (restaurants) directly via INSERTs.
  tenantA = uuidv4();
  tenantB = uuidv4();

  await q(`INSERT INTO tenants (id, name, email, owner_name, phone) VALUES ($1, 'Tenant A', 'a@example.com', 'Owner A', '111')`, [tenantA]);
  await q(`INSERT INTO tenants (id, name, email, owner_name, phone) VALUES ($1, 'Tenant B', 'b@example.com', 'Owner B', '222')`, [tenantB]);

  // Create a branch for each tenant.
  const resA = await q(`INSERT INTO branches (id, tenant_id, name, code, phone, address, city) VALUES (gen_random_uuid(), $1, 'Main', 'MAIN', '111', 'Addr', 'City') RETURNING id`, [], tenantA);
  branchA = resA.rows[0].id;
  const resB = await q(`INSERT INTO branches (id, tenant_id, name, code, phone, address, city) VALUES (gen_random_uuid(), $1, 'Main', 'MAIN', '222', 'Addr', 'City') RETURNING id`, [], tenantB);
  branchB = resB.rows[0].id;
});

afterAll(async () => {
  // Clean up test data.
  await q(`DELETE FROM order_items`);
  await q(`DELETE FROM orders`);
  await q(`DELETE FROM branches`);
  await q(`DELETE FROM tenants`);
  await pool.end();
});

describe('PostgreSQL RLS tenant isolation', () => {
  it('Tenant A can read its own branches', async () => {
    const result = await q('SELECT * FROM branches WHERE id = $1', [branchA], tenantA);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].tenant_id).toBe(tenantA);
  });

  it('Tenant A cannot read Tenant B branches', async () => {
    const result = await q('SELECT * FROM branches WHERE id = $1', [branchB], tenantA);
    expect(result.rowCount).toBe(0);
  });

  it('Tenant B cannot read Tenant A branches', async () => {
    const result = await q('SELECT * FROM branches WHERE id = $1', [branchA], tenantB);
    expect(result.rowCount).toBe(0);
  });

  it('Tenant A cannot insert a branch owned by Tenant B', async () => {
    await expect(
      q(`INSERT INTO branches (id, tenant_id, name, code, phone, address, city) VALUES (gen_random_uuid(), $1, 'Bad', 'BAD', '000', 'Addr', 'City')`, [], tenantB)
    ).rejects.toThrow();
  });

  it('Tenant A cannot change tenant_id of its own row to Tenant B', async () => {
    await expect(
      q('UPDATE branches SET tenant_id = $1 WHERE id = $2', [tenantB, branchA], tenantA)
    ).rejects.toThrow();
  });

  it('Missing tenant context returns no rows (fail‑closed)', async () => {
    const result = await q('SELECT * FROM branches'); // no tenantId passed
    expect(result.rowCount).toBe(0);
  });

  it('Connection pool does not leak tenant context', async () => {
    // First query as Tenant A
    await q('SELECT 1', [], tenantA);
    // Immediately run as Tenant B on the same pool client (pool will reuse connections)
    const res = await q('SELECT * FROM branches WHERE id = $1', [branchB], tenantB);
    expect(res.rowCount).toBe(1);
  });
});
