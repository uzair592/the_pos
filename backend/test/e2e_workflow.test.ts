import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool } from '../src/db/connection.js';

describe('Complete Restaurant POS E2E Business Workflow', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let cashierToken: string;
  let tenantId: string;
  let branchId: string;
  let floorId: string;
  let tableId: string;
  let categoryId: string;
  let productId: string;
  let ingredientBunId: string;
  let ingredientPattyId: string;
  let cashierId: string;
  let shiftId: string;
  let orderId: string;
  let kotTicketId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
    await seedDatabase();
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  it('Step 1 & 2: Super Admin logs in and registers a new restaurant with Growth Plan', async () => {
    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/platform/login',
      payload: { email: 'admin@posplatform.com', password: 'AdminPass123!' },
    });
    expect(loginRes.statusCode).toBe(200);
    superAdminToken = JSON.parse(loginRes.payload).token;

    // Fetch Plan
    const plansRes = await app.inject({
      method: 'GET',
      url: '/api/platform/plans',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    const plans = JSON.parse(plansRes.payload).plans;
    const growthPlan = plans.find((p: any) => p.code === 'GROWTH') || plans[0];

    // Create Restaurant
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/platform/tenants',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'The Karachi Grill House',
        legalName: 'Karachi Grill House Pvt Ltd',
        ownerName: 'Tariq Khan',
        email: `tariq.${Date.now()}@grillhouse.com`,
        phone: '03211234567',
        country: 'Pakistan',
        currency: 'PKR',
        timeZone: 'Asia/Karachi',
        businessType: 'FINE_DINE',
        planId: growthPlan.id,
        initialAdminPassword: 'OwnerPassword123!',
        trialDays: 14,
      },
    });
    expect(regRes.statusCode).toBe(201);
    const data = JSON.parse(regRes.payload);
    tenantId = data.tenant.id;
    branchId = data.branchId;

    // Login as Owner
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: data.ownerUser.email,
        password: 'OwnerPassword123!',
      },
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = JSON.parse(ownerLogin.payload).token;
  });

  it('Step 3 & 4: Owner completes onboarding and configures tax and service charges', async () => {
    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/onboarding',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        legalName: 'Karachi Grill House Pvt Ltd',
        phone: '03211234567',
        address: 'Clifton Block 4',
        city: 'Karachi',
        currency: 'PKR',
        currencySymbol: 'Rs.',
        timeZone: 'Asia/Karachi',
        taxRatePercent: 13.0, // Sindh Sales Tax
        taxRegistrationNumber: 'NTN-9876543-2',
        isTaxInclusive: false,
        serviceChargePercent: 5.0,
        initialBranchName: 'Clifton Flagship Branch',
        receiptSettings: {
          paperWidth: '80mm',
          showLogo: true,
          showTaxBreakdown: true,
          showCashierName: true,
          bilingualUrduEnglish: true,
          headerText: 'Karachi Grill House - Clifton',
          footerText: 'Thank you for dining with us!',
        },
      },
    });
    if (onboardRes.statusCode !== 200) {
      console.error('ONBOARDING ERROR:', onboardRes.payload);
    }
    expect(onboardRes.statusCode).toBe(200);

    // Verify settings updated
    const settingsRes = await app.inject({
      method: 'GET',
      url: '/api/restaurant/settings',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const s = JSON.parse(settingsRes.payload).settings;
    expect(Number(s.tax_rate_percent)).toBe(13);
    expect(Number(s.service_charge_percent)).toBe(5);
  });

  it('Step 5 & 6: Owner creates dining floors, tables, ingredients, and recipe for menu items', async () => {
    // Floor
    const floorRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/floors',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { branchId, name: 'Ground Floor Dining', sortOrder: 1 },
    });
    expect(floorRes.statusCode).toBe(201);
    floorId = JSON.parse(floorRes.payload).floor.id;

    // Table
    const tableRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/tables',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { branchId, floorId, tableNumber: 'T-10', capacity: 4 },
    });
    expect(tableRes.statusCode).toBe(201);
    tableId = JSON.parse(tableRes.payload).table.id;

    // Raw Ingredients
    const bunRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Brioche Burger Bun',
        sku: 'ING-BUN-01',
        unit: 'PCS',
        costPerUnit: 40,
        minStockAlert: 10,
        initialBranchStock: { [branchId]: 100 },
      },
    });
    expect(bunRes.statusCode).toBe(201);
    ingredientBunId = JSON.parse(bunRes.payload).ingredient.id;

    const pattyRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Beef Patty 150g',
        sku: 'ING-PATTY-01',
        unit: 'PCS',
        costPerUnit: 180,
        minStockAlert: 15,
        initialBranchStock: { [branchId]: 50 },
      },
    });
    expect(pattyRes.statusCode).toBe(201);
    ingredientPattyId = JSON.parse(pattyRes.payload).ingredient.id;

    // Category
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Gourmet Burgers' },
    });
    categoryId = JSON.parse(catRes.payload).category.id;

    // Product
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId,
        name: 'Classic Smash Burger',
        sku: 'PRD-SMASH-01',
        basePrice: 750,
        costPrice: 220,
        station: 'KITCHEN',
        trackInventory: true,
      },
    });
    productId = JSON.parse(prodRes.payload).product.id;

    // Recipe linking product with ingredients
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId,
        yieldCount: 1,
        ingredients: [
          { ingredientId: ingredientBunId, quantity: 1, unit: 'PCS' },
          { ingredientId: ingredientPattyId, quantity: 1, unit: 'PCS' },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);
  });

  it('Step 7 & 8: Owner creates a Cashier account and Cashier logs in', async () => {
    const cashierEmail = `cashier.${Date.now()}@grillhouse.com`;
    const createCashier = await app.inject({
      method: 'POST',
      url: '/api/restaurant/users',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        email: cashierEmail,
        password: 'CashierPass123!',
        fullName: 'Bilal Cashier',
        role: 'CASHIER',
        branchId,
      },
    });
    expect(createCashier.statusCode).toBe(201);
    cashierId = JSON.parse(createCashier.payload).user.id;

    // Cashier logs in
    const cashierLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: cashierEmail,
        password: 'CashierPass123!',
        deviceFingerprint: 'terminal-pos-01-fingerprint',
        deviceName: 'Front Counter Terminal',
      },
    });
    expect(cashierLogin.statusCode).toBe(200);
    cashierToken = JSON.parse(cashierLogin.payload).token;
  });

  it('Step 9: Cashier opens shift with PKR 5000 opening cash', async () => {
    const openRes = await app.inject({
      method: 'POST',
      url: '/api/financial/shifts/open',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        branchId,
        registerName: 'Counter 1 POS',
        openingCash: 5000,
      },
    });
    expect(openRes.statusCode).toBe(201);
    shiftId = JSON.parse(openRes.payload).shift.id;
  });

  it('Step 10 & 11: Cashier creates order for 2 Smash Burgers (Dine-In, Table T-10) and generates KOT', async () => {
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        branchId,
        orderType: 'DINE_IN',
        tableId,
        coverCount: 2,
        shiftId,
        items: [
          {
            productId,
            quantity: 2,
            unitPrice: 750,
            notes: 'Extra crispy patties',
          },
        ],
        idempotencyKey: `order-idemp-${Date.now()}`,
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const orderData = JSON.parse(orderRes.payload).order;
    orderId = orderData.id;

    // Verify Table status updated to OCCUPIED
    const tablesRes = await app.inject({
      method: 'GET',
      url: `/api/restaurant/tables?branchId=${branchId}`,
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    const tableObj = JSON.parse(tablesRes.payload).tables.find((t: any) => t.id === tableId);
    expect(tableObj.status).toBe('OCCUPIED');

    // Verify KOT ticket was created for KITCHEN
    const kdsRes = await app.inject({
      method: 'GET',
      url: `/api/kds/tickets?branchId=${branchId}&station=KITCHEN`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(kdsRes.statusCode).toBe(200);
    const tickets = JSON.parse(kdsRes.payload).tickets;
    const foundKOT = tickets.find((t: any) => t.order_id === orderId);
    expect(foundKOT).toBeDefined();
    expect(foundKOT.status).toBe('PENDING');
    kotTicketId = foundKOT.id;
  });

  it('Step 12: Kitchen staff advances KOT: Pending -> Accepted -> Preparing -> Ready', async () => {
    // Accepted
    await app.inject({
      method: 'PUT',
      url: `/api/kds/tickets/${kotTicketId}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'ACCEPTED' },
    });

    // Preparing
    await app.inject({
      method: 'PUT',
      url: `/api/kds/tickets/${kotTicketId}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'PREPARING' },
    });

    // Ready
    const readyRes = await app.inject({
      method: 'PUT',
      url: `/api/kds/tickets/${kotTicketId}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'READY' },
    });
    expect(readyRes.statusCode).toBe(200);
    expect(JSON.parse(readyRes.payload).ticket.status).toBe('READY');
  });

  it('Step 13 & 14: Cashier checks out order with cash; verifies table freed and recipe inventory deducted', async () => {
    // Fetch order total to pay exact
    const orderDetailRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${orderId}`,
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    const order = JSON.parse(orderDetailRes.payload).order;
    const grandTotal = Number(order.grand_total);
    expect(grandTotal).toBeGreaterThan(1500); // 1500 subtotal + 13% tax + 5% service charge

    // Complete Checkout with Cash
    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/checkout`,
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        payments: [
          {
            amount: 2000,
            method: 'CASH',
          },
        ],
        changeGiven: 2000 - grandTotal,
      },
    });
    expect(checkoutRes.statusCode).toBe(200);
    const completed = JSON.parse(checkoutRes.payload).order;
    expect(completed.status).toBe('COMPLETED');
    expect(completed.payment_status).toBe('PAID');

    // Verify Table is now AVAILABLE
    const tableRes = await app.inject({
      method: 'GET',
      url: `/api/restaurant/tables?branchId=${branchId}`,
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    const tableObj = JSON.parse(tableRes.payload).tables.find((t: any) => t.id === tableId);
    expect(tableObj.status).toBe('AVAILABLE');

    // Verify Inventory was deducted: 2 burgers = 2 buns and 2 patties deducted
    const stockRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const ingredients = JSON.parse(stockRes.payload).ingredients;
    const bun = ingredients.find((i: any) => i.id === ingredientBunId);
    const patty = ingredients.find((i: any) => i.id === ingredientPattyId);

    // Initial stock was 100 buns and 50 patties
    expect(Number(bun.current_stock)).toBe(98);
    expect(Number(patty.current_stock)).toBe(48);
  });

  it('Step 15 & 16: Cashier performs cash movement and closes shift with variance calculation', async () => {
    // Record Cash Out: PKR 200 for kitchen supplies
    const cashOutRes = await app.inject({
      method: 'POST',
      url: '/api/financial/shifts/cash-movement',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        shiftId,
        movementType: 'CASH_OUT',
        amount: 200,
        reason: 'Emergency ice purchase',
      },
    });
    expect(cashOutRes.statusCode).toBe(201);

    // Get current shift to check expected cash
    const currentShiftRes = await app.inject({
      method: 'GET',
      url: '/api/financial/shifts/current',
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    const curShift = JSON.parse(currentShiftRes.payload).shift;
    const expectedCash = Number(curShift.expected_cash);

    // Close Shift with actual counted cash = expectedCash - 10 (slight shortage of Rs 10)
    const closeRes = await app.inject({
      method: 'POST',
      url: `/api/financial/shifts/close?shiftId=${shiftId}`,
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        actualCash: expectedCash - 10,
        closingNotes: 'Shift reconciled; Rs 10 minor discrepancy in drawer change.',
      },
    });
    expect(closeRes.statusCode).toBe(200);
    const closedShift = JSON.parse(closeRes.payload).shift;
    expect(closedShift.status).toBe('CLOSED');
    expect(Number(closedShift.cash_variance)).toBe(-10);
  });

  it('Step 17: Owner reviews financial summary: Net Sales, COGS, Gross Profit, Operating Profit', async () => {
    const today = new Date().toISOString();
    const repRes = await app.inject({
      method: 'GET',
      url: `/api/financial/reports/summary?branchId=${branchId}&startDate=${today.split('T')[0]}T00:00:00Z&endDate=${today.split('T')[0]}T23:59:59Z`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(repRes.statusCode).toBe(200);
    const report = JSON.parse(repRes.payload).report;

    expect(report.totalOrders).toBe(1);
    expect(Number(report.grossSales)).toBe(1500); // 2 * 750
    expect(Number(report.netSales)).toBe(1500);
    expect(Number(report.costOfGoodsSold)).toBe(440); // 2 * (40 bun + 180 patty) = 440
    expect(Number(report.grossProfit)).toBe(1060); // 1500 - 440 = 1060
    expect(report.grossMarginPercent).toBeCloseTo(70.67, 1);
  });
});
