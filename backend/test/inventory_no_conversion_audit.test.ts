import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { query } from '../src/db/connection.js';
import { StockMovementType } from '@pos/shared';

describe('Inventory Audit: Disabled Auto-Conversion & Complete Stock Operations', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let secondBranchId: string;
  let supplierId: string;
  let testIngredientId: string;
  let testCartonIngredientId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Reset lingering device sessions
    await query("DELETE FROM active_device_sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE email = 'owner@lahorekarahi.com')", [], { isSuperAdmin: true });

    // Login as owner
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'owner@lahorekarahi.com',
        password: 'Password123!',
        deviceFingerprint: 'test-inv-audit-fp',
        deviceName: 'Audit Suite',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    ownerToken = body.token;
    tenantId = body.user.tenantId;
    branchId = body.user.branchId;

    // Fetch branches
    const { rows: bRows } = await query(
      'SELECT id FROM branches WHERE tenant_id = $1 ORDER BY created_at ASC',
      [tenantId],
      { tenantId }
    );
    branchId = bRows[0].id;
    secondBranchId = bRows.length > 1 ? bRows[1].id : bRows[0].id;

    // Get a supplier
    const { rows: sRows } = await query(
      'SELECT id FROM suppliers WHERE tenant_id = $1 LIMIT 1',
      [tenantId],
      { tenantId }
    );
    supplierId = sRows[0].id;

    // Create a weighed ingredient in Grams (G)
    const ingRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Audit Chicken Fillet (G)',
        sku: `AUDIT-CHK-${Date.now()}`,
        category: 'Meat & Poultry',
        unit: 'G',
        baseUnit: 'G',
        purchaseUnit: 'G',
        conversionFactor: 1,
        purchaseCost: 1.5,
        costPerUnit: 1.5,
        initialStock: 1000, // 1000 G initial
        branchId,
      },
    });
    expect(ingRes.statusCode).toBe(201);
    testIngredientId = ingRes.json().ingredient.id;

    // Create a packaged ingredient in Cartons
    const cartonRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Audit Tissue Boxes (Carton)',
        sku: `AUDIT-CTN-${Date.now()}`,
        category: 'Packaging & Disposables',
        unit: 'CARTON',
        baseUnit: 'CARTON',
        purchaseUnit: 'CARTON',
        conversionFactor: 1,
        purchaseCost: 500,
        costPerUnit: 500,
        initialStock: 10, // 10 cartons initial
        branchId,
      },
    });
    expect(cartonRes.statusCode).toBe(201);
    testCartonIngredientId = cartonRes.json().ingredient.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Purchasing respects exact quantities without auto unit conversion (Grams stay Grams, Cartons stay Cartons)', async () => {
    // Buy 500 Grams of chicken
    const purchaseGrams = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        supplierId,
        branchId,
        invoiceNumber: `INV-G-${Date.now()}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        receiveNow: true,
        items: [
          {
            ingredientId: testIngredientId,
            unit: 'G',
            quantity: 500, // Entered 500 G
            unitPrice: 1.5,
          },
        ],
      },
    });
    expect(purchaseGrams.statusCode).toBe(201);

    // Stock was 1000 G, should now be exactly 1500 G (NOT 1000 + 500,000!)
    const { rows: stRows1 } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testIngredientId],
      { tenantId }
    );
    expect(Number(stRows1[0].current_stock)).toBe(1500);

    // Buy 5 Cartons of tissue
    const purchaseCartons = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        supplierId,
        branchId,
        invoiceNumber: `INV-CTN-${Date.now()}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        receiveNow: true,
        items: [
          {
            ingredientId: testCartonIngredientId,
            unit: 'CARTON',
            quantity: 5, // Entered 5 Cartons
            unitPrice: 500,
          },
        ],
      },
    });
    expect(purchaseCartons.statusCode).toBe(201);

    // Stock was 10, should now be exactly 15 Cartons (NOT multiplied into 360 pieces!)
    const { rows: stRows2 } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testCartonIngredientId],
      { tenantId }
    );
    expect(Number(stRows2[0].current_stock)).toBe(15);
  });

  it('2. Operations: Stock Addition (Surplus / Inward correction)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjustments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        ingredientId: testIngredientId,
        movementType: StockMovementType.ADJUSTMENT_ADD,
        quantity: 200,
        reason: 'Recount surplus addition',
      },
    });
    expect(res.statusCode).toBe(201);

    // Stock was 1500, now 1700
    const { rows } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testIngredientId],
      { tenantId }
    );
    expect(Number(rows[0].current_stock)).toBe(1700);
  });

  it('3. Operations: Wastage / Spoilage deduction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjustments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        ingredientId: testIngredientId,
        movementType: StockMovementType.WASTAGE,
        quantity: 100,
        reason: 'Kitchen prep trim wastage',
      },
    });
    expect(res.statusCode).toBe(201);

    // Stock was 1700, now 1600
    const { rows } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testIngredientId],
      { tenantId }
    );
    expect(Number(rows[0].current_stock)).toBe(1600);
  });

  it('4. Operations: Damaged Stock deduction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjustments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        ingredientId: testCartonIngredientId,
        movementType: StockMovementType.DAMAGED,
        quantity: 2,
        reason: 'Water damaged cartons in warehouse',
      },
    });
    expect(res.statusCode).toBe(201);

    // Stock was 15 cartons, now 13
    const { rows } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testCartonIngredientId],
      { tenantId }
    );
    expect(Number(rows[0].current_stock)).toBe(13);
  });

  it('5. Operations: Expired Stock deduction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjustments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        ingredientId: testIngredientId,
        movementType: StockMovementType.EXPIRED,
        quantity: 50,
        reason: 'Past expiration date disposal',
      },
    });
    expect(res.statusCode).toBe(201);

    // Stock was 1600, now 1550
    const { rows } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testIngredientId],
      { tenantId }
    );
    expect(Number(rows[0].current_stock)).toBe(1550);
  });

  it('6. Operations: Physical Stock Counting (Reconciliation to exact counted value)', async () => {
    // Current stock is 1550 G. Physical audit count in kitchen discovers 1500 G.
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjustments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        ingredientId: testIngredientId,
        movementType: StockMovementType.PHYSICAL_COUNT,
        quantity: 1500, // Exact counted physical stock
        reason: 'Monthly end-of-shift physical stock audit',
      },
    });
    expect(res.statusCode).toBe(201);

    // Stock must reconcile directly to 1500 G
    const { rows } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testIngredientId],
      { tenantId }
    );
    expect(Number(rows[0].current_stock)).toBe(1500);
  });

  it('7. Operations: Purchase Return to Supplier (Debit Note)', async () => {
    const returnRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases/return',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        supplierId,
        branchId,
        invoiceNumber: 'INV-CTN-TEST',
        items: [
          {
            ingredientId: testCartonIngredientId,
            quantity: 3, // Returning 3 cartons
            returnPrice: 500,
          },
        ],
        reason: 'Defective carton packaging returned to vendor',
      },
    });
    expect(returnRes.statusCode).toBe(201);

    // Stock was 13 cartons, now 10
    const { rows: stRows } = await query(
      'SELECT current_stock FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, testCartonIngredientId],
      { tenantId }
    );
    expect(Number(stRows[0].current_stock)).toBe(10);

    // Verify stock_movement logged with RETURN_TO_SUPPLIER
    const { rows: mvRows } = await query(
      "SELECT * FROM stock_movements WHERE branch_id = $1 AND ingredient_id = $2 AND movement_type = 'RETURN_TO_SUPPLIER' ORDER BY created_at DESC LIMIT 1",
      [branchId, testCartonIngredientId],
      { tenantId }
    );
    expect(mvRows.length).toBe(1);
    expect(Number(mvRows[0].quantity)).toBe(-3);
    expect(Number(mvRows[0].stock_before)).toBe(13);
    expect(Number(mvRows[0].stock_after)).toBe(10);
  });
});

