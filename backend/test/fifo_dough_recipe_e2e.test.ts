import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool, query } from '../src/db/connection.js';
import { OrderType } from '@pos/shared';

describe('FIFO Restructured Inventory: Dough & Pizza Real-World Acceptance Test', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let doughId: string;
  let pizzaProductId: string;
  let batch1Id: string;
  let batch2Id: string;

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

    // 2. Create Tenant & Branch
    const tenantRes = await app.inject({
      method: 'POST',
      url: '/api/platform/tenants',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'Pizza Italiana FIFO Test',
        ownerName: 'Mario Rossi',
        email: `mario_${Date.now()}@pizzaitaliana.com`,
        initialAdminPassword: 'MarioPassword123!',
        phone: '+923001112233',
        planId: (await query('SELECT id FROM subscription_plans WHERE code = $1', ['GROWTH'])).rows[0].id,
      },
    });
    expect(tenantRes.statusCode).toBe(201);
    const tenantData = JSON.parse(tenantRes.payload);
    tenantId = tenantData.tenant.id;
    branchId = tenantData.branchId;

    // 3. Owner login
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: tenantData.ownerUser.email, password: 'MarioPassword123!' },
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = JSON.parse(ownerLogin.payload).token;
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  it('1. First Purchase: Dough 3 KG @ Rs. 150/KG (auto-creates Dough & Supplier, receives stock)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        newSupplierName: 'Al-Madina Flour Mills',
        invoiceNumber: 'INV-DOUGH-001',
        receiveNow: true,
        taxAmount: 0,
        paidAmount: 450,
        items: [
          {
            name: 'Dough',
            quantity: 3,
            unit: 'KG',
            unitPrice: 150,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.payload);
    expect(data.purchase.status).toBe('RECEIVED');
    expect(Number(data.purchase.total_amount)).toBe(450);

    // Verify ingredient "Dough" was auto-created in ingredients table
    const ingRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ingRes.statusCode).toBe(200);
    const ings = JSON.parse(ingRes.payload).ingredients;
    const dough = ings.find((i: any) => i.name.toLowerCase() === 'dough');
    expect(dough).toBeDefined();
    doughId = dough.id;
    expect(dough.unit).toBe('KG');
    expect(Number(dough.current_stock)).toBe(3);
    expect(Number(dough.latest_purchase_price)).toBe(150);
    expect(Number(dough.total_stock_value)).toBe(450);

    // Verify Batch 1 created
    const batchesRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/batches?branchId=${branchId}&ingredientId=${doughId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(batchesRes.statusCode).toBe(200);
    const batchList = JSON.parse(batchesRes.payload).batches;
    expect(batchList.length).toBe(1);
    expect(Number(batchList[0].quantity_received)).toBe(3);
    expect(Number(batchList[0].quantity_remaining)).toBe(3);
    expect(Number(batchList[0].unit_cost)).toBe(150);
    expect(batchList[0].status).toBe('ACTIVE');
    batch1Id = batchList[0].id;
  });

  it('2. Second Purchase: Dough 5 KG @ Rs. 200/KG (reuses Dough, creates separate FIFO Batch 2)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        newSupplierName: 'BakeWell Supplies',
        invoiceNumber: 'INV-DOUGH-002',
        receiveNow: true,
        taxAmount: 0,
        paidAmount: 1000,
        items: [
          {
            name: 'Dough',
            quantity: 5,
            unit: 'KG',
            unitPrice: 200,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.payload);
    expect(data.purchase.status).toBe('RECEIVED');

    // Verify total stock is 8 KG Dough
    const ingRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const ings = JSON.parse(ingRes.payload).ingredients;
    const dough = ings.find((i: any) => i.id === doughId);
    expect(Number(dough.current_stock)).toBe(8); // 3 + 5
    expect(Number(dough.latest_purchase_price)).toBe(200);
    // Total stock value = (3 * 150) + (5 * 200) = 450 + 1000 = 1450
    expect(Number(dough.total_stock_value)).toBe(1450);

    // Verify both batches are separate and active
    const batchesRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/batches?branchId=${branchId}&ingredientId=${doughId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const batchList = JSON.parse(batchesRes.payload).batches;
    expect(batchList.length).toBe(2);

    // Sort by received_at / created_at
    batchList.sort((a: any, b: any) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
    expect(batchList[0].id).toBe(batch1Id);
    expect(Number(batchList[0].quantity_remaining)).toBe(3);
    expect(Number(batchList[0].unit_cost)).toBe(150);

    batch2Id = batchList[1].id;
    expect(Number(batchList[1].quantity_remaining)).toBe(5);
    expect(Number(batchList[1].unit_cost)).toBe(200);
  });

  it('3. Recipe Definition: Chicken Pizza consuming 0.25 KG Dough per pizza', async () => {
    // 1. Create Category
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Pizzas', sortOrder: 1 },
    });
    expect(catRes.statusCode).toBe(201);
    const categoryId = JSON.parse(catRes.payload).category.id;

    // 2. Create Menu Item: Chicken Pizza
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId,
        name: 'Chicken Pizza',
        sku: 'PIZZA-CHK-01',
        basePrice: 1200,
        station: 'KITCHEN',
        isAvailable: true,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    pizzaProductId = JSON.parse(prodRes.payload).product.id;

    // 3. Link Recipe: 0.25 KG Dough
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId: pizzaProductId,
        yieldCount: 1,
        ingredients: [
          {
            ingredientId: doughId,
            quantity: 0.25,
            unit: 'KG',
          },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);
  });

  it('4. Sale 1: Sell 16 Pizzas -> Deducts 4 KG Dough (3 KG @ 150 from Batch 1 + 1 KG @ 200 from Batch 2 = Rs. 650 COGS)', async () => {
    // Create POS Order: 16 Chicken Pizzas
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: OrderType.TAKEAWAY,
        customerName: 'Customer Sale 1',
        items: [
          {
            productId: pizzaProductId,
            quantity: 16,
            unitPrice: 1200,
          },
        ],
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const order = JSON.parse(orderRes.payload).order;

    // Complete & Pay Order (triggers automatic recipe FIFO stock deduction)
    const payRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/checkout`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        payments: [{ method: 'CASH', amount: Number(order.grand_total) }],
      },
    });
    expect(payRes.statusCode).toBe(200);

    // Verify FIFO Batch remaining quantities:
    // Batch 1: 3 KG -> 0 KG (exhausted)
    // Batch 2: 5 KG -> 4 KG remaining @ Rs. 200
    const batchesRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/batches?branchId=${branchId}&ingredientId=${doughId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const batchList = JSON.parse(batchesRes.payload).batches;
    const b1 = batchList.find((b: any) => b.id === batch1Id);
    const b2 = batchList.find((b: any) => b.id === batch2Id);

    expect(Number(b1.quantity_remaining)).toBe(0);
    expect(b1.status).toBe('EXHAUSTED');

    expect(Number(b2.quantity_remaining)).toBe(4);
    expect(b2.status).toBe('ACTIVE');

    // Total Dough remaining stock = 4 KG
    const ingRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const ings = JSON.parse(ingRes.payload).ingredients;
    const dough = ings.find((i: any) => i.id === doughId);
    expect(Number(dough.current_stock)).toBe(4);
    // Remaining stock value = 4 * 200 = Rs. 800
    expect(Number(dough.total_stock_value)).toBe(800);

    // Verify Order Consumption Report
    const usageRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/order-consumption?branchId=${branchId}&search=${order.order_number}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(usageRes.statusCode).toBe(200);
    const usage = JSON.parse(usageRes.payload);
    const orderUsage = usage.orders.find((o: any) => o.order_id === order.id);
    expect(orderUsage).toBeDefined();

    // Total COGS for this order = (3 * 150) + (1 * 200) = 450 + 200 = 650
    expect(Number(orderUsage.order_total_cogs)).toBe(650);
  });

  it('5. Sale 2: Sell 8 Pizzas -> Deducts 2 KG Dough from Batch 2 @ Rs. 200 = Rs. 400 COGS', async () => {
    // Create POS Order: 8 Chicken Pizzas
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: OrderType.TAKEAWAY,
        customerName: 'Customer Sale 2',
        items: [
          {
            productId: pizzaProductId,
            quantity: 8,
            unitPrice: 1200,
          },
        ],
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const order = JSON.parse(orderRes.payload).order;

    // Complete & Pay Order
    const payRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/checkout`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        payments: [{ method: 'CASH', amount: Number(order.grand_total) }],
      },
    });
    expect(payRes.statusCode).toBe(200);

    // Verify FIFO Batch remaining quantities:
    // Batch 2: was 4 KG, deducted 2 KG -> 2 KG remaining @ Rs. 200
    const batchesRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/batches?branchId=${branchId}&ingredientId=${doughId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const batchList = JSON.parse(batchesRes.payload).batches;
    const b2 = batchList.find((b: any) => b.id === batch2Id);

    expect(Number(b2.quantity_remaining)).toBe(2);
    expect(b2.status).toBe('ACTIVE');

    // Total Dough remaining stock = 2 KG
    const ingRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const ings = JSON.parse(ingRes.payload).ingredients;
    const dough = ings.find((i: any) => i.id === doughId);
    expect(Number(dough.current_stock)).toBe(2);
    // Remaining stock value = 2 * 200 = Rs. 400
    expect(Number(dough.total_stock_value)).toBe(400);

    // Verify Order Consumption Report for Sale 2
    const usageRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/order-consumption?branchId=${branchId}&search=${order.order_number}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const usage = JSON.parse(usageRes.payload);
    const orderUsage = usage.orders.find((o: any) => o.order_id === order.id);
    expect(orderUsage).toBeDefined();

    // Total COGS for this order = 2 * 200 = 400
    expect(Number(orderUsage.order_total_cogs)).toBe(400);
  });

  it('6. FIFO Valuation Report: Exactly matches remaining 2 KG Dough @ Rs. 200 = Rs. 400 total value', async () => {
    const valRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/valuation?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(valRes.statusCode).toBe(200);
    const valuation = JSON.parse(valRes.payload);

    expect(Number(valuation.summary.totalInventoryValue)).toBe(400);
    expect(valuation.summary.totalActiveBatchesCount).toBe(1);

    const doughItem = valuation.items.find((i: any) => i.ingredient_id === doughId);
    expect(doughItem).toBeDefined();
    expect(Number(doughItem.available_quantity)).toBe(2);
    expect(doughItem.unit).toBe('KG');
    expect(Number(doughItem.latest_purchase_price)).toBe(200);
    expect(Number(doughItem.remaining_stock_value)).toBe(400);
    expect(doughItem.remaining_batches.length).toBe(1);
    expect(doughItem.remaining_batches[0].batch_id).toBe(batch2Id);
    expect(Number(doughItem.remaining_batches[0].remaining_quantity)).toBe(2);
    expect(Number(doughItem.remaining_batches[0].unit_cost)).toBe(200);
    expect(Number(doughItem.remaining_batches[0].remaining_value)).toBe(400);
  });

  it('7. Where-Used Mapping: Dough is used in Chicken Pizza (24 units sold, 6 KG consumed, Rs. 1050 actual FIFO COGS)', async () => {
    const usageRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients/${doughId}/usage?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(usageRes.statusCode).toBe(200);
    const usage = JSON.parse(usageRes.payload);

    // 1. Verify ingredient metadata
    expect(usage.ingredient.id).toBe(doughId);
    expect(usage.ingredient.name).toBe('Dough');
    expect(usage.ingredient.unit).toBe('KG');
    expect(Number(usage.ingredient.availableStock)).toBe(2);
    expect(Number(usage.ingredient.stockValue)).toBe(400);
    expect(Number(usage.ingredient.latestPurchasePrice)).toBe(200);

    // 2. Verify menu item where used
    expect(usage.menuItems.length).toBe(1);
    const pizzaUsage = usage.menuItems[0];
    expect(pizzaUsage.productId).toBe(pizzaProductId);
    expect(pizzaUsage.productName).toBe('Chicken Pizza');
    expect(Number(pizzaUsage.usagePerItem)).toBe(0.25);
    expect(pizzaUsage.usageUnit).toBe('KG');
    expect(pizzaUsage.unitsSold).toBe(24); // 16 in Sale 1 + 8 in Sale 2
    expect(Number(pizzaUsage.totalTheoreticalConsumed)).toBe(6); // 24 * 0.25 = 6 KG
    expect(Number(pizzaUsage.actualConsumedQty)).toBe(6); // 4 KG + 2 KG = 6 KG
    expect(Number(pizzaUsage.actualConsumedCost)).toBe(1050); // 650 + 400 = Rs. 1050
    expect(pizzaUsage.usagePercentage).toBe(100);

    // 3. Verify summary totals
    expect(usage.summary.menuItemsCount).toBe(1);
    expect(usage.summary.totalUnitsSold).toBe(24);
    expect(Number(usage.summary.totalTheoreticalConsumed)).toBe(6);
    expect(Number(usage.summary.totalActualConsumedQty)).toBe(6);
    expect(Number(usage.summary.totalActualConsumedCost)).toBe(1050);

    // 4. Verify order-by-order FIFO log (Order 1 had 2 batch splits + Order 2 had 1 batch = 3 entries)
    expect(usage.recentOrders.length).toBe(3);
    expect(usage.recentOrders[0].productName).toBe('Chicken Pizza');
    expect(Number(usage.recentOrders[0].quantityConsumed)).toBe(2); // Sale 2: 2 KG from Batch 2
    expect(Number(usage.recentOrders[1].quantityConsumed)).toBe(3); // Sale 1: 3 KG from Batch 1
    expect(Number(usage.recentOrders[2].quantityConsumed)).toBe(1); // Sale 1: 1 KG from Batch 2
  });

  it('8. Menu Costing & Profitability: Chicken Pizza food cost calculated cleanly without duplication', async () => {
    const profRes = await app.inject({
      method: 'GET',
      url: `/api/costing/menu-profitability?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(profRes.statusCode).toBe(200);
    const prof = JSON.parse(profRes.payload);

    const pizza = prof.items.find((p: any) => p.productId === pizzaProductId);
    expect(pizza).toBeDefined();
    expect(pizza.hasRecipe).toBe(true);
    expect(pizza.ingredients.length).toBe(1);
    expect(pizza.ingredients[0].ingredientId).toBe(doughId);
    expect(Number(pizza.ingredients[0].enteredQuantity)).toBe(0.25);
    // Cost per KG based on branch stock = 181.25 -> 0.25 * 181.25 = 45.31 PKR
    expect(Number(pizza.ingredientCost)).toBe(45.31);
    expect(pizza.sellingPrice).toBe(1200);
    expect(pizza.grossProfit).toBe(1154.69);
    expect(pizza.status).toBe('EXCELLENT');
  });
});
