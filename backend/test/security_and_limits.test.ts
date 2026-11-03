import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool } from '../src/db/connection.js';

describe('Security, Limits, and Entitlements Enforcement Tests', () => {
  let app: any;
  let superAdminToken: string;
  let starterOwnerToken: string;
  let starterTenantId: string;
  let starterBranchId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
    await seedDatabase();
    app = buildApp();
    await app.ready();

    // 1. Super Admin Login
    const saLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/platform/login',
      payload: { email: 'admin@posplatform.com', password: 'AdminPass123!' },
    });
    superAdminToken = JSON.parse(saLogin.payload).token;

    // Get Starter Plan (max 1 branch, 5 staff, 2 devices, no KDS)
    const plansRes = await app.inject({
      method: 'GET',
      url: '/api/platform/plans',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const starterPlan = JSON.parse(plansRes.payload).plans.find((p: any) => p.code === 'STARTER');

    // Create Restaurant on Starter Plan
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/platform/tenants',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'Single Branch Cafe',
        ownerName: 'Cafe Owner',
        email: `cafe.${Date.now()}@test.com`,
        phone: '03009988776',
        planId: starterPlan.id,
        initialAdminPassword: 'CafePassword123!',
        trialDays: 14,
      },
    });
    const data = JSON.parse(createRes.payload);
    starterTenantId = data.tenant.id;
    starterBranchId = data.branchId;

    // Login as Starter Owner
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: data.ownerUser.email, password: 'CafePassword123!' },
    });
    starterOwnerToken = JSON.parse(ownerLogin.payload).token;
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  it('proves Starter plan cannot create a second branch (Branch limit = 1)', async () => {
    const branchRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/branches',
      headers: { authorization: `Bearer ${starterOwnerToken}` },
      payload: {
        name: 'Second Branch Unauthorized',
        code: 'BRANCH-2',
        phone: '03001112233',
        address: 'DHA Phase 5',
        city: 'Lahore',
      },
    });
    expect(branchRes.statusCode).toBe(403);
    const body = JSON.parse(branchRes.payload);
    expect(body.code).toBe('BRANCH_LIMIT_REACHED');
  });

  it('proves Starter plan cannot access KDS (Feature entitlement enforcement)', async () => {
    const kdsRes = await app.inject({
      method: 'GET',
      url: '/api/kds/tickets',
      headers: { authorization: `Bearer ${starterOwnerToken}` },
    });
    expect(kdsRes.statusCode).toBe(403);
    const body = JSON.parse(kdsRes.payload);
    expect(body.code).toBe('FEATURE_NOT_ENTITLED');
    expect(body.feature).toBe('kds');
  });

  it('proves suspended restaurant account is blocked from login and API operations', async () => {
    // 1. Super Admin suspends the restaurant
    const suspendRes = await app.inject({
      method: 'PUT',
      url: `/api/platform/tenants/${starterTenantId}/status`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { isActive: false, reason: 'Payment overdue' },
    });
    expect(suspendRes.statusCode).toBe(200);

    // 2. Token calls should now be rejected as suspended
    const checkRes = await app.inject({
      method: 'GET',
      url: '/api/restaurant/settings',
      headers: { authorization: `Bearer ${starterOwnerToken}` },
    });
    expect(checkRes.statusCode).toBe(403);
    const body = JSON.parse(checkRes.payload);
    expect(['ACCOUNT_SUSPENDED', 'SUBSCRIPTION_SUSPENDED']).toContain(body.code);

    // 3. Reactivate restaurant
    await app.inject({
      method: 'PUT',
      url: `/api/platform/tenants/${starterTenantId}/status`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { isActive: true },
    });
  });

  it('proves unauthenticated requests cannot access restaurant or platform endpoints', async () => {
    const noAuthPlatform = await app.inject({
      method: 'GET',
      url: '/api/platform/dashboard',
    });
    expect(noAuthPlatform.statusCode).toBe(401);

    const noAuthRestaurant = await app.inject({
      method: 'GET',
      url: '/api/restaurant/settings',
    });
    expect(noAuthRestaurant.statusCode).toBe(401);
  });
});
