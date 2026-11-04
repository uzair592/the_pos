import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool, query, withTransaction } from '../src/db/connection.js';
import { consumeIngredientFIFO, deductInventoryForOrder } from '../src/services/inventoryService.js';
import { generateTenantBackup, restoreTenantBackup } from '../src/services/backupService.js';
import { OrderStatus } from '@pos/shared';

describe('FIFO Inventory, Credential Management, Orders Hub & Backup System Tests', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let ownerUserId: string;
  let ingredientId: string;
  let productId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
    await seedDatabase();
    app = buildApp();
    await app.ready();

    // 1. Super Admin login
    const saLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/platform/login',
      payload: { email: 'admin@posplatform.com', password: 'AdminPass123!' },
    });
    expect(saLogin.statusCode).toBe(200);
    superAdminToken = JSON.parse(saLogin.payload).token;

    // 2. Create Tenant with Owner
    const createTenantRes = await app.inject({
      method: 'POST',
      url: '/api/platform/tenants',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'FIFO Test Bistro',
        ownerName: 'Chef Pierre',
        email: `pierre_${Date.now()}@testbistro.com`,
        initialAdminPassword: 'PierrePassword123!',
        phone: '+923001234567',
        planId: (await query('SELECT id FROM subscription_plans WHERE code = $1', ['GROWTH'])).rows[0].id,
      },
    });
    expect(createTenantRes.statusCode).toBe(201);
    const tenantData = JSON.parse(createTenantRes.payload);
    tenantId = tenantData.tenant.id;
    branchId = tenantData.branchId;
    ownerUserId = tenantData.ownerUser.id;

    // 3. Owner login
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: tenantData.ownerUser.email, password: 'PierrePassword123!' },
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = JSON.parse(ownerLogin.payload).token;

    // 4. Create Category, Ingredient & Product with Recipe
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Main Courses', sortOrder: 1 },
    });
    const categoryId = JSON.parse(catRes.payload).category.id;

    const ingRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Prime Ribeye Beef',
        sku: `BEEF-${Date.now()}`,
        unit: 'KG',
        costPerUnit: 150,
        minStockAlert: 2,
      },
    });
    ingredientId = JSON.parse(ingRes.payload).ingredient.id;

    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId,
        name: 'Signature Steak',
        sku: `STEAK-${Date.now()}`,
        basePrice: 1500,
        trackInventory: true,
      },
    });
    productId = JSON.parse(prodRes.payload).product.id;

    // Recipe: 2 KG Beef per Signature Steak
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId,
        yieldCount: 1,
        ingredients: [
          { ingredientId, quantity: 2, unit: 'KG' },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  it('M1: FIFO Multi-Batch Consumption Across Batches with Different Unit Costs & COGS', async () => {
    // Insert Batch 1: 5 KG @ PKR 100/KG (Older batch)
    const olderDate = new Date(Date.now() - 24 * 3600 * 1000);
    const b1Res = await query(
      `
      INSERT INTO inventory_batches (
        tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
      ) VALUES ($1, $2, $3, 5, 5, 100, $4, 'ACTIVE')
      RETURNING id, unit_cost, quantity_remaining
      `,
      [tenantId, branchId, ingredientId, olderDate],
      { tenantId }
    );
    const batch1Id = b1Res.rows[0].id;

    // Insert Batch 2: 10 KG @ PKR 200/KG (Newer batch)
    const newerDate = new Date();
    const b2Res = await query(
      `
      INSERT INTO inventory_batches (
        tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
      ) VALUES ($1, $2, $3, 10, 10, 200, $4, 'ACTIVE')
      RETURNING id, unit_cost, quantity_remaining
      `,
      [tenantId, branchId, ingredientId, newerDate],
      { tenantId }
    );
    const batch2Id = b2Res.rows[0].id;

    // Place Order for 4 Signature Steaks (Needs 4 * 2 = 8 KG of Beef)
    // FIFO expects:
    // 5 KG from Batch 1 @ 100 = 500 (Batch 1 exhausted)
    // 3 KG from Batch 2 @ 200 = 600 (Batch 2 has 7 KG remaining)
    // Total COGS = 1100
    const createOrderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: 'DINE_IN',
        items: [
          {
            productId,
            productName: 'Signature Steak',
            quantity: 4,
            unitPrice: 1500,
          },
        ],
      },
    });
    expect(createOrderRes.statusCode).toBe(201);
    const order = JSON.parse(createOrderRes.payload).order;

    // Checkout Order
    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/checkout`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        payments: [{ method: 'CASH', amount: Number(order.grand_total) }],
      },
    });
    expect(checkoutRes.statusCode).toBe(200);

    // Verify Batch 1 is EXHAUSTED (0 remaining)
    const checkB1 = await query('SELECT quantity_remaining, status FROM inventory_batches WHERE id = $1', [batch1Id], { tenantId });
    expect(Number(checkB1.rows[0].quantity_remaining)).toBe(0);
    expect(checkB1.rows[0].status).toBe('EXHAUSTED');

    // Verify Batch 2 has 7 KG remaining and is ACTIVE
    const checkB2 = await query('SELECT quantity_remaining, status FROM inventory_batches WHERE id = $1', [batch2Id], { tenantId });
    expect(Number(checkB2.rows[0].quantity_remaining)).toBe(7);
    expect(checkB2.rows[0].status).toBe('ACTIVE');

    // Verify order item COGS is exact sum: 500 + 600 = 1100
    const checkItem = await query('SELECT cogs, total_price FROM order_items WHERE order_id = $1', [order.id], { tenantId });
    expect(Number(checkItem.rows[0].cogs)).toBe(1100);

    // Verify Idempotency: re-running deduction does NOT double-deduct
    await withTransaction(async (client) => {
      const retryResult = await deductInventoryForOrder(client, tenantId, branchId, order.id, ownerUserId);
      expect(retryResult.deductedCount).toBe(0);
    }, { tenantId });

    // Verify Batch 2 still has 7 KG remaining
    const checkB2AfterRetry = await query('SELECT quantity_remaining FROM inventory_batches WHERE id = $1', [batch2Id], { tenantId });
    expect(Number(checkB2AfterRetry.rows[0].quantity_remaining)).toBe(7);

    // Verify Gross Profit in Financial Summary
    const summaryRes = await app.inject({
      method: 'GET',
      url: '/api/financial/reports/summary',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(summaryRes.statusCode).toBe(200);
    const report = JSON.parse(summaryRes.payload).report;
    expect(report.costOfGoodsSold).toBe(1100);
    expect(report.grossProfit).toBe(report.netSales - 1100);
  });

  it('M2: Order Lifecycle Transitions, Active Orders & Orders History', async () => {
    // 1. Create a Dine-In Order
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: 'DINE_IN',
        items: [{ productId, productName: 'Signature Steak', quantity: 1, unitPrice: 1500 }],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const testOrder = JSON.parse(createRes.payload).order;

    // 2. Verify order appears in Active Orders Hub
    const activeRes = await app.inject({
      method: 'GET',
      url: '/api/orders/active',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(activeRes.statusCode).toBe(200);
    const activeOrders = JSON.parse(activeRes.payload).orders;
    const foundActive = activeOrders.find((o: any) => o.id === testOrder.id);
    expect(foundActive).toBeDefined();

    // 3. Advance Status to PREPARING
    const prepRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${testOrder.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: OrderStatus.PREPARING },
    });
    expect(prepRes.statusCode).toBe(200);

    // 4. Advance Status to READY
    const readyRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${testOrder.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: OrderStatus.READY },
    });
    expect(readyRes.statusCode).toBe(200);

    // 5. Complete Order
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${testOrder.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: OrderStatus.COMPLETED },
    });
    expect(completeRes.statusCode).toBe(200);

    // 6. Verify order is removed from Active Orders
    const activeAfterComp = await app.inject({
      method: 'GET',
      url: '/api/orders/active',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const stillActive = JSON.parse(activeAfterComp.payload).orders.find((o: any) => o.id === testOrder.id);
    expect(stillActive).toBeUndefined();

    // 7. Verify order is found in All Orders History
    const historyRes = await app.inject({
      method: 'GET',
      url: `/api/orders?search=${testOrder.order_number}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(historyRes.statusCode).toBe(200);
    const history = JSON.parse(historyRes.payload).orders;
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].id).toBe(testOrder.id);

    // 8. Verify specific date filtering in All Orders History (Orders Hub)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const dateFilteredRes = await app.inject({
      method: 'GET',
      url: `/api/orders?startDate=${encodeURIComponent(startOfDay)}&endDate=${encodeURIComponent(endOfDay)}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(dateFilteredRes.statusCode).toBe(200);
    const datePayload = JSON.parse(dateFilteredRes.payload);
    expect(datePayload.orders.some((o: any) => o.id === testOrder.id)).toBe(true);
    expect(datePayload.summary).toBeDefined();
    expect(datePayload.summary.totalOrders).toBeGreaterThan(0);
    expect(datePayload.summary.totalAmount).toBeGreaterThan(0);

    // Past date returns 0 matching orders
    const pastStart = new Date(2020, 0, 1, 0, 0, 0, 0).toISOString();
    const pastEnd = new Date(2020, 0, 1, 23, 59, 59, 999).toISOString();
    const pastDateRes = await app.inject({
      method: 'GET',
      url: `/api/orders?startDate=${encodeURIComponent(pastStart)}&endDate=${encodeURIComponent(pastEnd)}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(pastDateRes.statusCode).toBe(200);
    const pastPayload = JSON.parse(pastDateRes.payload);
    expect(pastPayload.orders.length).toBe(0);
    expect(pastPayload.summary.totalOrders).toBe(0);
  });

  it('M3: Super Admin Updating Restaurant User Credentials & Session Revocation', async () => {
    const newEmail = `updated_owner_${Date.now()}@bistro.com`;
    const newPassword = 'NewSecurePassword123!';

    // Super Admin patches user credentials
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/platform/tenants/${tenantId}/users/${ownerUserId}/credentials`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        email: newEmail,
        password: newPassword,
        fullName: 'Executive Chef Pierre',
      },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(JSON.parse(patchRes.payload).passwordChanged).toBe(true);

    // Old credentials fail
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'pierre@testbistro.com', password: 'PierrePassword123!' },
    });
    expect(oldLogin.statusCode).toBe(401);

    // New credentials succeed
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: newEmail, password: newPassword },
    });
    expect(newLogin.statusCode).toBe(200);
    const newOwnerToken = JSON.parse(newLogin.payload).token;
    expect(newOwnerToken).toBeDefined();

    // Old token should be rejected due to incremented token_version
    const testOldToken = await app.inject({
      method: 'GET',
      url: '/api/restaurant/branches',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(testOldToken.statusCode).toBe(401);

    // Update ownerToken for subsequent tests
    ownerToken = newOwnerToken;
  });

  it('M4: Backup Generation, Integrity Verification, and Transactional Restore', async () => {
    // 1. Generate Backup
    const backupRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/backups/generate',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(backupRes.statusCode).toBe(200);
    const backupData = JSON.parse(backupRes.payload);
    expect(backupData.package).toBeDefined();
    expect(backupData.package.metadata.checksum).toBeDefined();
    expect(backupData.package.data.products.length).toBeGreaterThan(0);

    // 2. Verify backup history record was saved
    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/restaurant/backups',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(historyRes.statusCode).toBe(200);
    const backups = JSON.parse(historyRes.payload).backups;
    expect(backups.length).toBeGreaterThan(0);

    // 3. Restore Backup inside Transaction
    const restoreRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/backups/restore',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: backupData.package,
    });
    expect(restoreRes.statusCode).toBe(200);
    expect(JSON.parse(restoreRes.payload).success).toBe(true);

    // Verify products still exist after restore
    const productsRes = await app.inject({
      method: 'GET',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(productsRes.statusCode).toBe(200);
    const products = JSON.parse(productsRes.payload).products;
    expect(products.length).toBeGreaterThan(0);
  });
});
