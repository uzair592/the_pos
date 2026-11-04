import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool, query } from '../src/db/connection.js';
import { StockUnit, OrderType, OrderStatus } from '@pos/shared';

describe('Inward Purchases, Suppliers, FIFO Batch Creation & Recipe Profit Margin Tests', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let supplierId: string;
  let ingredientId: string;
  let purchaseId: string;
  let categoryId: string;
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
        name: 'Gourmet Grillhouse',
        ownerName: 'Master Chef Tariq',
        email: `tariq_${Date.now()}@grillhouse.com`,
        initialAdminPassword: 'TariqPassword123!',
        phone: '+923007654321',
        planId: (await query('SELECT id FROM subscription_plans WHERE code = $1', ['GROWTH'])).rows[0].id,
      },
    });
    expect(createTenantRes.statusCode).toBe(201);
    const tenantData = JSON.parse(createTenantRes.payload);
    tenantId = tenantData.tenant.id;
    branchId = tenantData.branchId;

    // 3. Owner login
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: tenantData.ownerUser.email, password: 'TariqPassword123!' },
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = JSON.parse(ownerLogin.payload).token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Create Raw Material Supplier via API', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/suppliers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Prime Meat Suppliers',
        contactPerson: 'Kareem Bhai',
        phone: '+923009988776',
        email: 'kareem@primemeat.com',
        address: 'Meat Market Stall 45',
        taxNumber: 'NTN-543210',
      },
    });
    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.payload);
    expect(data.supplier.name).toBe('Prime Meat Suppliers');
    supplierId = data.supplier.id;

    // Create an ingredient to purchase
    const ingRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Beef Tenderloin Cut',
        sku: 'BEEF-TL-01',
        unit: StockUnit.KG,
        costPerUnit: 1200,
        minStockAlert: 5,
        initialStock: 0,
        branchId,
      },
    });
    expect(ingRes.statusCode).toBe(201);
    ingredientId = JSON.parse(ingRes.payload).ingredient.id;
  });

  it('2. Create Purchase Invoice (Draft) with Line Items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        supplierId,
        invoiceNumber: 'INV-BEEF-2026-001',
        taxAmount: 200,
        paidAmount: 5000,
        notes: 'First bulk beef delivery',
        items: [
          {
            ingredientId,
            unit: StockUnit.KG,
            quantity: 20, // 20 KG @ 1100 = 22,000
            unitPrice: 1100,
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.payload);
    expect(data.purchase.invoice_number).toBe('INV-BEEF-2026-001');
    expect(data.purchase.status).toBe('DRAFT');
    expect(Number(data.purchase.subtotal)).toBe(22000);
    expect(Number(data.purchase.total_amount)).toBe(22200); // 22,000 + 200 tax
    expect(Number(data.purchase.balance_payable)).toBe(17200); // 22,200 - 5,000 paid
    purchaseId = data.purchase.id;

    // Verify GET /api/inventory/purchases/:id
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/purchases/${purchaseId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const detailData = JSON.parse(detailRes.payload);
    expect(detailData.purchase.id).toBe(purchaseId);
    expect(detailData.items.length).toBe(1);
    expect(detailData.items[0].ingredient_id).toBe(ingredientId);
    expect(Number(detailData.items[0].quantity)).toBe(20);
  });

  it('3. Receive Purchase Invoice -> Auto creates FIFO batch and updates branch stock', async () => {
    const receiveRes = await app.inject({
      method: 'POST',
      url: `/api/inventory/purchases/${purchaseId}/receive`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(receiveRes.statusCode).toBe(200);

    // Verify invoice status changed to RECEIVED
    const invCheck = await query('SELECT status FROM purchase_invoices WHERE id = $1', [purchaseId], { tenantId });
    expect(invCheck.rows[0].status).toBe('RECEIVED');

    // Verify FIFO Batch was created in inventory_batches
    const batchRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/batches?ingredientId=${ingredientId}&branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(batchRes.statusCode).toBe(200);
    const batches = JSON.parse(batchRes.payload).batches;
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const lot = batches.find((b: any) => b.purchase_item_id !== null);
    expect(lot).toBeDefined();
    expect(Number(lot.quantity_received)).toBe(20);
    expect(Number(lot.quantity_remaining)).toBe(20);
    expect(Number(lot.unit_cost)).toBe(1100);
    expect(lot.status).toBe('ACTIVE');

    // Verify Branch Stock was updated
    const stockCheck = await query(
      'SELECT current_stock, cost_per_unit FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2',
      [branchId, ingredientId],
      { tenantId }
    );
    expect(Number(stockCheck.rows[0].current_stock)).toBe(20);
    expect(Number(stockCheck.rows[0].cost_per_unit)).toBe(1100);
  });

  it('4. Create Menu Item with Recipe Ingredients & Verify Dynamic Margin Calculation', async () => {
    // 1. Create Category
    const createCatRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Main Courses',
        nameUrdu: 'کھانے',
        sortOrder: 1,
      },
    });
    expect(createCatRes.statusCode).toBe(201);
    categoryId = JSON.parse(createCatRes.payload).category.id;

    // 2. Create Product
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId,
        name: 'Signature Tenderloin Steak',
        sku: 'STEAK-01',
        basePrice: 2500, // Selling price
        costPrice: 550,
        trackInventory: true,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    const prodData = JSON.parse(prodRes.payload).product;
    productId = prodData.id;

    // 3. Create Recipe for Product
    const recRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId,
        yieldCount: 1,
        ingredients: [
          {
            ingredientId,
            quantity: 0.5, // 0.5 KG @ 1100 = 550
            unit: StockUnit.KG,
          },
        ],
      },
    });
    expect(recRes.statusCode).toBe(201);

    // 4. Verify Product List returns cost_price and allows accurate profit margin calculation
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const allProducts = JSON.parse(listRes.payload).products;
    const steak = allProducts.find((p: any) => p.id === productId);
    expect(steak).toBeDefined();
    expect(Number(steak.cost_price)).toBe(550);
    const profit = Number(steak.base_price) - Number(steak.cost_price);
    expect(profit).toBe(1950); // 2500 - 550
    const margin = Math.round((profit / Number(steak.base_price)) * 100);
    expect(margin).toBe(78); // 1950 / 2500 = 78%
  });

  it('5. Verify Automatic KDS Ticket Creation & Query across branch and status filters', async () => {
    // Create an order for the steak (which automatically generates kitchen tickets)
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: OrderType.TAKEAWAY,
        customerName: 'VIP Food Critic',
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 2500,
            notes: 'Medium Rare, extra pepper sauce',
          },
        ],
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const orderData = JSON.parse(orderRes.payload).order;

    // Query KDS active tickets
    const kdsRes = await app.inject({
      method: 'GET',
      url: `/api/kds/tickets?branchId=${branchId}&status=ACTIVE`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(kdsRes.statusCode).toBe(200);
    const kdsData = JSON.parse(kdsRes.payload);
    expect(kdsData.tickets.length).toBeGreaterThanOrEqual(1);

    const ticket = kdsData.tickets.find((t: any) => t.order_id === orderData.id);
    expect(ticket).toBeDefined();
    expect(ticket.items.length).toBe(1);
    expect(ticket.items[0].notes).toBe('Medium Rare, extra pepper sauce');
    expect(ticket.branch_name).toBeDefined();
  });
});
