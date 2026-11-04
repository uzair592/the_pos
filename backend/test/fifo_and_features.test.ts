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

  it('M5: Takeaway Customer Info & Delivery Dispatch with Customer & Rider Details', async () => {
    // 1. Create Takeaway order with customer info
    const takeawayRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: 'TAKEAWAY',
        customerName: 'Bilal Ahmed',
        customerPhone: '+923001234567',
        items: [{ productId, quantity: 1, unitPrice: 850, modifiers: [] }],
        idempotencyKey: `test-takeaway-${Date.now()}`,
      },
    });
    expect(takeawayRes.statusCode).toBe(201);
    const takeawayOrder = JSON.parse(takeawayRes.payload).order;
    expect(takeawayOrder.customer_name).toBe('Bilal Ahmed');
    expect(takeawayOrder.customer_phone).toBe('+923001234567');

    // 2. Create Delivery order with Customer, Address, Fee, and Assigned Rider
    const deliveryRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: 'DELIVERY',
        customerName: 'Ali Khan',
        customerPhone: '+923009876543',
        deliveryAddress: 'House 42, Street 5, F-7/2, Islamabad',
        deliveryFee: 150,
        riderName: 'Tariq Mahmood',
        riderPhone: '+923215551234',
        items: [{ productId, quantity: 2, unitPrice: 850, modifiers: [] }],
        idempotencyKey: `test-delivery-${Date.now()}`,
      },
    });
    expect(deliveryRes.statusCode).toBe(201);
    const deliveryOrder = JSON.parse(deliveryRes.payload).order;
    expect(deliveryOrder.customer_name).toBe('Ali Khan');
    expect(deliveryOrder.customer_phone).toBe('+923009876543');
    expect(deliveryOrder.delivery_address).toBe('House 42, Street 5, F-7/2, Islamabad');
    expect(Number(deliveryOrder.delivery_fee)).toBe(150);
    expect(deliveryOrder.rider_name).toBe('Tariq Mahmood');
    expect(deliveryOrder.rider_phone).toBe('+923215551234');

    // 3. Verify receipt endpoint returns rider and delivery details for thermal & dispatch printing
    const receiptRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${deliveryOrder.id}/receipt`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(receiptRes.statusCode).toBe(200);
    const receipt = JSON.parse(receiptRes.payload).receipt;
    expect(receipt.customerName).toBe('Ali Khan');
    expect(receipt.customerPhone).toBe('+923009876543');
    expect(receipt.riderName).toBe('Tariq Mahmood');
    expect(receipt.riderPhone).toBe('+923215551234');
    expect(receipt.deliveryAddress).toBe('House 42, Street 5, F-7/2, Islamabad');
    expect(Number(receipt.deliveryFee)).toBe(150);
  });

  it('M6: Daily Daybook Operational & Financial Ledger Verification', async () => {
    // 1. Fetch Expense Categories and ensure seeded categories exist
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/financial/expenses/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(catRes.statusCode).toBe(200);
    const categories = JSON.parse(catRes.payload).categories;
    expect(categories.length).toBeGreaterThan(0);
    const categoryId = categories[0].id;

    // 2. Record an expense today
    const expRes = await app.inject({
      method: 'POST',
      url: '/api/financial/expenses',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        categoryId,
        amount: 450,
        paymentMethod: 'CASH',
        description: 'Kitchen cleaning liquid and mops',
      },
    });
    expect(expRes.statusCode).toBe(201);
    const recordedExpense = JSON.parse(expRes.payload).expense;
    expect(Number(recordedExpense.amount)).toBe(450);

    // 3. Record wastage adjustment for ingredient
    const wasteRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjustments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        ingredientId,
        movementType: 'WASTAGE',
        quantity: 0.5,
        reason: 'Dropped on floor during kitchen rush',
      },
    });
    expect(wasteRes.statusCode).toBe(201);

    // 4. Query Daily Daybook for today
    const dNow = new Date();
    const todayStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
    const daybookRes = await app.inject({
      method: 'GET',
      url: `/api/financial/daybook?date=${todayStr}&branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(daybookRes.statusCode).toBe(200);
    const { daybook } = JSON.parse(daybookRes.payload);
    

    // Verify daybook high-level structure
    expect(daybook).toBeDefined();
    expect(daybook.date).toBe(todayStr);
    expect(daybook.branchId).toBe(branchId);
    expect(daybook.summary).toBeDefined();
    expect(daybook.paymentMethods).toBeInstanceOf(Array);
    expect(daybook.purchases).toBeInstanceOf(Array);
    expect(daybook.ingredientConsumptions).toBeInstanceOf(Array);
    expect(daybook.wastageRecords).toBeInstanceOf(Array);
    expect(daybook.expenses).toBeInstanceOf(Array);
    expect(daybook.salesOrders).toBeInstanceOf(Array);

    // Verify recorded expense is present in daybook
    const foundExp = daybook.expenses.find((e: any) => e.id === recordedExpense.id);
    expect(foundExp).toBeDefined();
    expect(Number(foundExp.amount)).toBe(450);
    expect(foundExp.description).toBe('Kitchen cleaning liquid and mops');

    // Verify wastage record is present in daybook
    const foundWaste = daybook.wastageRecords.find((w: any) => w.ingredientId === ingredientId);
    expect(foundWaste).toBeDefined();
    expect(foundWaste.reason).toBe('Dropped on floor during kitchen rush');
    expect(Number(foundWaste.quantity)).toBe(0.5);

    // Verify financial balances in summary
    expect(daybook.summary.totalExpensesAmount).toBeGreaterThanOrEqual(450);
    expect(daybook.summary.totalWastageCost).toBeGreaterThanOrEqual(0);
    expect(typeof daybook.summary.grossProfit).toBe('number');
    expect(typeof daybook.summary.netDailyProfit).toBe('number');
    expect(typeof daybook.summary.netOperatingCashPosition).toBe('number');

    // 5. Query Daybook without branchId (All branches tenant-wide)
    const allBranchesRes = await app.inject({
      method: 'GET',
      url: `/api/financial/daybook?date=${todayStr}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(allBranchesRes.statusCode).toBe(200);
    const allBranchesData = JSON.parse(allBranchesRes.payload).daybook;
    expect(allBranchesData.branchName).toContain('All Branches');
    expect(allBranchesData.expenses.some((e: any) => e.id === recordedExpense.id)).toBe(true);
  });

  it('M7: Cash & Bank Accounts, POS Bank Payment Attribution, and Fund Transfers (Cash <-> Bank)', async () => {
    // 1. Fetch bank accounts (auto-seeded default account should be present)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/financial/bank-accounts',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.payload);
    const accounts = listData.bankAccounts || listData.accounts;
    expect(accounts.length).toBeGreaterThanOrEqual(1);
    const defaultAccount = accounts.find((a: any) => a.isDefault) || accounts[0];
    expect(defaultAccount).toBeDefined();
    const defaultInitialBalance = Number(defaultAccount.currentBalance);

    // 2. Create a second bank account
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/financial/bank-accounts',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        accountName: 'HBL Operating Account',
        bankName: 'Habib Bank Limited',
        accountNumber: 'PK12HABB00001234567890',
        branchName: 'DHA Phase 5 Branch',
        openingBalance: 15000,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createData = JSON.parse(createRes.payload);
    const hblAccount = createData.bankAccount || createData.account;
    expect(hblAccount.accountName).toBe('HBL Operating Account');
    expect(Number(hblAccount.currentBalance)).toBe(15000);

    // 3. Create an order and checkout using BANK_TRANSFER linked to HBL account
    const orderRes = await app.inject({
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
            quantity: 1,
            unitPrice: 1500,
          },
        ],
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const order = JSON.parse(orderRes.payload).order;
    const orderId = order.id;
    const orderGrandTotal = Number(order.grand_total);

    // Checkout order paying orderGrandTotal via Bank Transfer to HBL
    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/checkout`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        payments: [
          {
            method: 'BANK_TRANSFER',
            amount: orderGrandTotal,
            bankAccountId: hblAccount.id,
            reference: 'TXN-BANK-9988',
          },
        ],
      },
    });
    expect(checkoutRes.statusCode).toBe(200);

    // Verify HBL account balance increased by orderGrandTotal
    const checkHblRes = await app.inject({
      method: 'GET',
      url: '/api/financial/bank-accounts',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const refreshedData = JSON.parse(checkHblRes.payload);
    const refreshedAccounts = refreshedData.bankAccounts || refreshedData.accounts;
    const refreshedHbl = refreshedAccounts.find((a: any) => a.id === hblAccount.id);
    expect(Number(refreshedHbl.currentBalance)).toBe(15000 + orderGrandTotal);

    // 4. Record Cash to Bank Transfer (Deposit from Cash Drawer into HBL)
    const depositRes = await app.inject({
      method: 'POST',
      url: '/api/financial/cash-bank/transfers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        transferType: 'CASH_TO_BANK',
        toBankAccountId: hblAccount.id,
        amount: 3000,
        referenceNumber: 'SLIP-DEP-4451',
        notes: 'Excess evening cash deposit to HBL',
      },
    });
    expect(depositRes.statusCode).toBe(201);
    const depositTransfer = JSON.parse(depositRes.payload).transfer;
    expect(depositTransfer.transferType).toBe('CASH_TO_BANK');
    expect(Number(depositTransfer.amount)).toBe(3000);

    // Check HBL balance increased by 3000
    const afterDepRes = await app.inject({
      method: 'GET',
      url: '/api/financial/bank-accounts',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const afterDepData = JSON.parse(afterDepRes.payload);
    const afterDepHbl = (afterDepData.bankAccounts || afterDepData.accounts).find((a: any) => a.id === hblAccount.id);
    expect(Number(afterDepHbl.currentBalance)).toBe(15000 + orderGrandTotal + 3000);

    // 5. Record Bank to Cash Transfer (Withdraw cash from HBL to replenish drawer)
    const withdrawRes = await app.inject({
      method: 'POST',
      url: '/api/financial/cash-bank/transfers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        transferType: 'BANK_TO_CASH',
        fromBankAccountId: hblAccount.id,
        amount: 1500,
        referenceNumber: 'ATM-WITHDRAW-1102',
        notes: 'ATM cash replenishment for petty cash drawer',
      },
    });
    expect(withdrawRes.statusCode).toBe(201);

    // Check HBL balance decreased by 1500
    const afterWithRes = await app.inject({
      method: 'GET',
      url: '/api/financial/bank-accounts',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const afterWithData = JSON.parse(afterWithRes.payload);
    const afterWithHbl = (afterWithData.bankAccounts || afterWithData.accounts).find((a: any) => a.id === hblAccount.id);
    expect(Number(afterWithHbl.currentBalance)).toBe(15000 + orderGrandTotal + 3000 - 1500);

    // 6. Record Bank to Bank Transfer (From HBL to Default Account)
    const b2bRes = await app.inject({
      method: 'POST',
      url: '/api/financial/cash-bank/transfers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        transferType: 'BANK_TO_BANK',
        fromBankAccountId: hblAccount.id,
        toBankAccountId: defaultAccount.id,
        amount: 2700,
        referenceNumber: 'ONLINE-IBFT-7762',
        notes: 'Interbank fund transfer',
      },
    });
    expect(b2bRes.statusCode).toBe(201);

    // Check HBL decreased by 2700
    // Check Default account increased by 2700
    const afterB2bRes = await app.inject({
      method: 'GET',
      url: '/api/financial/bank-accounts',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const finalData = JSON.parse(afterB2bRes.payload);
    const finalAccounts = finalData.bankAccounts || finalData.accounts;
    const finalHbl = finalAccounts.find((a: any) => a.id === hblAccount.id);
    const finalDefault = finalAccounts.find((a: any) => a.id === defaultAccount.id);
    expect(Number(finalHbl.currentBalance)).toBe(15000 + orderGrandTotal + 3000 - 1500 - 2700);
    expect(Number(finalDefault.currentBalance)).toBe(defaultInitialBalance + 2700);

    // 7. Verify Cash & Bank Summary
    const summaryRes = await app.inject({
      method: 'GET',
      url: '/api/financial/cash-bank/summary',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(summaryRes.statusCode).toBe(200);
    const { summary } = JSON.parse(summaryRes.payload);
    expect(summary).toBeDefined();
    expect(typeof summary.totalCashInHand).toBe('number');
    expect(typeof summary.totalBankBalance).toBe('number');
    expect(summary.totalLiquidFunds).toBe(summary.totalCashInHand + summary.totalBankBalance);
    expect(summary.bankAccounts.length).toBeGreaterThanOrEqual(2);

    // 8. Verify Cash & Bank Transfers list
    const transfersRes = await app.inject({
      method: 'GET',
      url: '/api/financial/cash-bank/transfers',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(transfersRes.statusCode).toBe(200);
    const { transfers } = JSON.parse(transfersRes.payload);
    expect(transfers.length).toBeGreaterThanOrEqual(3);
    expect(transfers.some((t: any) => t.referenceNumber === 'SLIP-DEP-4451')).toBe(true);
    expect(transfers.some((t: any) => t.referenceNumber === 'ATM-WITHDRAW-1102')).toBe(true);
    expect(transfers.some((t: any) => t.referenceNumber === 'ONLINE-IBFT-7762')).toBe(true);

    // 9. Verify Cash & Bank Unified Ledger
    const ledgerRes = await app.inject({
      method: 'GET',
      url: '/api/financial/cash-bank/ledger',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ledgerRes.statusCode).toBe(200);
    const { ledger } = JSON.parse(ledgerRes.payload);
    expect(ledger.length).toBeGreaterThanOrEqual(3);
  });

  it('M8: Bill-Wise Profit and Loss Report, Channel Filtering, and CSV Export', async () => {
    // 1. Fetch Bill-Wise Profit and Loss Report
    const reportRes = await app.inject({
      method: 'GET',
      url: '/api/financial/reports/bill-profit-loss',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(reportRes.statusCode).toBe(200);
    const data = JSON.parse(reportRes.payload);

    // Verify summary structure
    expect(data.summary).toBeDefined();
    expect(data.summary.totalBills).toBeGreaterThanOrEqual(1);
    expect(typeof data.summary.totalNetSales).toBe('number');
    expect(typeof data.summary.totalCogs).toBe('number');
    expect(typeof data.summary.totalGrossProfit).toBe('number');
    expect(typeof data.summary.averageMarginPercent).toBe('number');
    expect(data.summary.profitableBillsCount).toBeGreaterThanOrEqual(1);

    // Verify bills list
    expect(data.bills).toBeInstanceOf(Array);
    expect(data.bills.length).toBeGreaterThanOrEqual(1);

    const sampleBill = data.bills[0];
    expect(sampleBill.id).toBeDefined();
    expect(sampleBill.orderNumber).toBeDefined();
    expect(sampleBill.createdAt).toBeDefined();
    expect(sampleBill.orderType).toBeDefined();
    expect(typeof sampleBill.subtotal).toBe('number');
    expect(typeof sampleBill.netSales).toBe('number');
    expect(typeof sampleBill.fifoCogs).toBe('number');
    expect(typeof sampleBill.grossProfit).toBe('number');
    expect(typeof sampleBill.grossMarginPercent).toBe('number');
    expect(sampleBill.items).toBeInstanceOf(Array);
    expect(sampleBill.items.length).toBeGreaterThanOrEqual(1);

    // Verify item-level calculations
    const sampleItem = sampleBill.items[0];
    expect(sampleItem.productName).toBeDefined();
    expect(typeof sampleItem.unitPrice).toBe('number');
    expect(typeof sampleItem.totalPrice).toBe('number');
    expect(typeof sampleItem.cogs).toBe('number');
    expect(typeof sampleItem.grossProfit).toBe('number');
    expect(typeof sampleItem.grossMarginPercent).toBe('number');

    // 2. Filter by Order Type
    const dineInRes = await app.inject({
      method: 'GET',
      url: '/api/financial/reports/bill-profit-loss?orderType=DINE_IN',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(dineInRes.statusCode).toBe(200);
    const dineInData = JSON.parse(dineInRes.payload);
    expect(dineInData.bills.every((b: any) => b.orderType === 'DINE_IN')).toBe(true);

    // 3. Search Filter by Order Number
    const searchRes = await app.inject({
      method: 'GET',
      url: `/api/financial/reports/bill-profit-loss?search=${sampleBill.orderNumber}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchData = JSON.parse(searchRes.payload);
    expect(searchData.bills.some((b: any) => b.orderNumber === sampleBill.orderNumber)).toBe(true);

    // 4. Test CSV Export
    const csvRes = await app.inject({
      method: 'GET',
      url: '/api/financial/reports/bill-profit-loss/export',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.payload).toContain('Order Number,Date,Time,Channel');
    expect(csvRes.payload).toContain('Gross Profit,Gross Margin %');
    expect(csvRes.payload).toContain(sampleBill.orderNumber);
  });
});
