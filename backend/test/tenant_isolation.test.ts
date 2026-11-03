import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool } from '../src/db/connection.js';

describe('Multi-Tenant Isolation & Security Tests', () => {
  let app: any;
  let superAdminToken: string;
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantAId: string;
  let tenantBId: string;
  let tenantAProduct: any;
  let tenantABranchId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
    await seedDatabase();
    app = buildApp();
    await app.ready();

    // 1. Login as Super Admin
    const superAdminRes = await app.inject({
      method: 'POST',
      url: '/api/auth/platform/login',
      payload: {
        email: 'admin@posplatform.com',
        password: 'AdminPass123!',
      },
    });
    expect(superAdminRes.statusCode).toBe(200);
    superAdminToken = JSON.parse(superAdminRes.payload).token;

    // Get Growth Plan ID
    const plansRes = await app.inject({
      method: 'GET',
      url: '/api/platform/plans',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const plans = JSON.parse(plansRes.payload).plans;
    const plan = plans.find((p: any) => p.code === 'GROWTH') || plans[0];

    // 2. Create Restaurant A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/platform/tenants',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'Burger Haven Restaurant A',
        ownerName: 'Alice Owner',
        email: `alice.${Date.now()}@resta.com`,
        phone: '03001234567',
        planId: plan.id,
        initialAdminPassword: 'Password123!',
        trialDays: 14,
      },
    });
    expect(resA.statusCode).toBe(201);
    const dataA = JSON.parse(resA.payload);
    tenantAId = dataA.tenant.id;
    tenantABranchId = dataA.branchId;

    // 3. Create Restaurant B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/platform/tenants',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'Pizza Palace Restaurant B',
        ownerName: 'Bob Owner',
        email: `bob.${Date.now()}@restb.com`,
        phone: '03007654321',
        planId: plan.id,
        initialAdminPassword: 'Password123!',
        trialDays: 14,
      },
    });
    expect(resB.statusCode).toBe(201);
    const dataB = JSON.parse(resB.payload);
    tenantBId = dataB.tenant.id;

    // 4. Authenticate as Restaurant A Owner
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: dataA.ownerUser.email,
        password: 'Password123!',
      },
    });
    expect(loginA.statusCode).toBe(200);
    tenantAToken = JSON.parse(loginA.payload).token;

    // 5. Authenticate as Restaurant B Owner
    const loginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: dataB.ownerUser.email,
        password: 'Password123!',
      },
    });
    expect(loginB.statusCode).toBe(200);
    tenantBToken = JSON.parse(loginB.payload).token;

    // 6. Restaurant A creates a menu category & product
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: 'Gourmet Burgers',
        sortOrder: 1,
      },
    });
    expect(catRes.statusCode).toBe(201);
    const categoryA = JSON.parse(catRes.payload).category;

    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        categoryId: categoryA.id,
        name: 'Signature Angus Burger',
        sku: `ANGUS-${Date.now()}`,
        basePrice: 850,
        costPrice: 400,
        station: 'KITCHEN',
      },
    });
    expect(prodRes.statusCode).toBe(201);
    tenantAProduct = JSON.parse(prodRes.payload).product;
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  it('proves Restaurant B cannot see Restaurant A products in catalog list', async () => {
    const listResB = await app.inject({
      method: 'GET',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(listResB.statusCode).toBe(200);
    const productsB = JSON.parse(listResB.payload).products;
    const foundAProductInB = productsB.some((p: any) => p.id === tenantAProduct.id);
    expect(foundAProductInB).toBe(false);
  });

  it('proves Restaurant B cannot update Restaurant A product even when ID is known (IDOR attempt)', async () => {
    const editResB = await app.inject({
      method: 'PUT',
      url: `/api/menu/products/${tenantAProduct.id}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
      payload: {
        name: 'Hacked Burger Name by Restaurant B',
        basePrice: 1,
      },
    });
    expect(editResB.statusCode).toBe(404);

    // Verify Restaurant A product was untouched
    const verifyA = await app.inject({
      method: 'GET',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    const productsA = JSON.parse(verifyA.payload).products;
    const pA = productsA.find((p: any) => p.id === tenantAProduct.id);
    expect(pA.name).toBe('Signature Angus Burger');
    expect(Number(pA.base_price)).toBe(850);
  });

  it('proves Restaurant B cannot delete Restaurant A product', async () => {
    const delResB = await app.inject({
      method: 'DELETE',
      url: `/api/menu/products/${tenantAProduct.id}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(delResB.statusCode).toBe(200); // Route responds or ignores

    // Product still exists in Restaurant A
    const verifyA = await app.inject({
      method: 'GET',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    const productsA = JSON.parse(verifyA.payload).products;
    expect(productsA.some((p: any) => p.id === tenantAProduct.id)).toBe(true);
  });

  it('proves Restaurant B cannot view Restaurant A orders or receipts', async () => {
    // 1. Restaurant A creates an order
    const orderResA = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        branchId: tenantABranchId,
        orderType: 'COUNTER',
        items: [
          {
            productId: tenantAProduct.id,
            quantity: 2,
            unitPrice: 850,
          },
        ],
      },
    });
    expect(orderResA.statusCode).toBe(201);
    const orderA = JSON.parse(orderResA.payload).order;

    // 2. Restaurant B tries to access Restaurant A's order by ID
    const getOrderB = await app.inject({
      method: 'GET',
      url: `/api/orders/${orderA.id}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(getOrderB.statusCode).toBe(404);

    // 3. Restaurant B tries to get Restaurant A's receipt
    const getReceiptB = await app.inject({
      method: 'GET',
      url: `/api/orders/${orderA.id}/receipt`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(getReceiptB.statusCode).toBe(404);
  });
});
