import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool, query } from '../src/db/connection.js';
import { OrderType } from '@pos/shared';

describe('Recipe Costing, Food Cost Analysis, and Menu Item Profitability', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let supplierId: string;
  let chickenIngId: string;
  let cheeseIngId: string;
  let bunIngId: string;
  let sauceIngId: string;
  let oilIngId: string;
  let burgerProdId: string;
  let categoryId: string;

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
        name: 'Gourmet Bistro & Grill',
        ownerName: 'Chef Tariq',
        email: `tariq_${Date.now()}@gourmetbistro.com`,
        initialAdminPassword: 'TariqPassword123!',
        phone: '+923005551234',
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

    // 4. Create Category
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Artisan Burgers', sortOrder: 1 },
    });
    expect(catRes.statusCode).toBe(201);
    categoryId = JSON.parse(catRes.payload).category.id;

    // 5. Create Supplier
    const supRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/suppliers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Metro Cash & Carry Wholesale', contactPerson: 'Aslam', phone: '03001112233' },
    });
    expect(supRes.statusCode).toBe(201);
    supplierId = JSON.parse(supRes.payload).supplier.id;
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  it('Step 1: Setup raw ingredients matching user prompt specification (Chicken, Cheese, Bun, Sauce, Cooking Oil)', async () => {
    // Chicken: 1 KG = 1,000 G @ PKR 1,000/KG -> PKR 1.0000 / G
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Fresh Boneless Chicken',
        category: 'Meat & Poultry',
        sku: 'ING-CHIK-01',
        baseUnit: 'G',
        purchaseUnit: 'KG',
        conversionFactor: 1000,
        purchaseCost: 1000,
        minStockAlert: 500,
      },
    });
    expect(r1.statusCode).toBe(201);
    chickenIngId = JSON.parse(r1.payload).ingredient.id;

    // Cheese: 1 KG = 1,000 G @ PKR 1,500/KG -> PKR 1.5000 / G
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Cheddar Cheese Slices',
        category: 'Dairy & Eggs',
        sku: 'ING-CHS-01',
        baseUnit: 'G',
        purchaseUnit: 'KG',
        conversionFactor: 1000,
        purchaseCost: 1500,
        minStockAlert: 200,
      },
    });
    expect(r2.statusCode).toBe(201);
    cheeseIngId = JSON.parse(r2.payload).ingredient.id;

    // Bun: 1 PACK = 12 PCS @ PKR 300/PACK -> PKR 25.0000 / PCS
    const r3 = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Brioche Burger Buns',
        category: 'Bakery & Grains',
        sku: 'ING-BUN-01',
        baseUnit: 'PCS',
        purchaseUnit: 'PACK',
        conversionFactor: 12,
        purchaseCost: 300,
        minStockAlert: 24,
      },
    });
    expect(r3.statusCode).toBe(201);
    bunIngId = JSON.parse(r3.payload).ingredient.id;

    // Sauce: 1 KG = 1,000 G @ PKR 500/KG -> PKR 0.5000 / G
    const r4 = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Smoky Chipotle Sauce',
        category: 'Oils & Sauces',
        sku: 'ING-SAU-01',
        baseUnit: 'G',
        purchaseUnit: 'KG',
        conversionFactor: 1000,
        purchaseCost: 500,
        minStockAlert: 500,
      },
    });
    expect(r4.statusCode).toBe(201);
    sauceIngId = JSON.parse(r4.payload).ingredient.id;

    // Cooking Oil: 1 L = 1,000 ML @ PKR 333.33/L -> PKR 0.3333 / ML
    const r5 = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Refined Canola Oil',
        category: 'Oils & Sauces',
        sku: 'ING-OIL-01',
        baseUnit: 'ML',
        purchaseUnit: 'L',
        conversionFactor: 1000,
        purchaseCost: 333.3333,
        minStockAlert: 1000,
      },
    });
    expect(r5.statusCode).toBe(201);
    oilIngId = JSON.parse(r5.payload).ingredient.id;
  });

  it('Step 2: Inward wholesale purchase invoices creating FIFO batches in base units', async () => {
    const invRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        supplierId,
        invoiceNumber: `INV-WHOLESALE-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        items: [
          { ingredientId: chickenIngId, unit: 'G', purchaseUnit: 'G', quantity: 20000, unitPrice: 1.0 }, // 20,000 G @ 1 PKR/G
          { ingredientId: cheeseIngId, unit: 'G', purchaseUnit: 'G', quantity: 5000, unitPrice: 1.5 },   // 5,000 G @ 1.5 PKR/G
          { ingredientId: bunIngId, unit: 'PCS', purchaseUnit: 'PCS', quantity: 120, unitPrice: 25 },    // 120 PCS @ 25 PKR/PCS
          { ingredientId: sauceIngId, unit: 'G', purchaseUnit: 'G', quantity: 4000, unitPrice: 0.5 },    // 4,000 G @ 0.5 PKR/G
          { ingredientId: oilIngId, unit: 'ML', purchaseUnit: 'ML', quantity: 10000, unitPrice: 0.3333333 }, // 10,000 ML
        ],
      },
    });
    expect(invRes.statusCode).toBe(201);
    const invoiceId = JSON.parse(invRes.payload).purchase.id;

    // Receive the invoice to activate stock batches
    const recRes = await app.inject({
      method: 'POST',
      url: `/api/inventory/purchases/${invoiceId}/receive`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(recRes.statusCode).toBe(200);
  });

  it('Step 3: Create Menu Item "Chicken Burger" with Recipe and Direct Costs', async () => {
    // Selling price: PKR 500, Packaging: PKR 20, Additional: PKR 10
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId,
        name: 'Gourmet Chicken Burger',
        sku: 'BUR-CHK-01',
        basePrice: 500,
        station: 'KITCHEN',
        isAvailable: true,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    burgerProdId = JSON.parse(prodRes.payload).product.id;

    // Define recipe:
    // - Chicken: 150 G -> PKR 150
    // - Cheese: 20 G -> PKR 30
    // - Bun: 1 PCS -> PKR 25
    // - Sauce: 20 G -> PKR 10
    // - Oil: 15 ML -> PKR 5
    // Total ingredient cost = PKR 220
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId: burgerProdId,
        yieldCount: 1,
        ingredients: [
          { ingredientId: chickenIngId, quantity: 150, unit: 'G', enteredQuantity: 150, recipeUnit: 'G' },
          { ingredientId: cheeseIngId, quantity: 20, unit: 'G', enteredQuantity: 20, recipeUnit: 'G' },
          { ingredientId: bunIngId, quantity: 1, unit: 'PCS', enteredQuantity: 1, recipeUnit: 'PCS' },
          { ingredientId: sauceIngId, quantity: 20, unit: 'G', enteredQuantity: 20, recipeUnit: 'G' },
          { ingredientId: oilIngId, quantity: 15, unit: 'ML', enteredQuantity: 15, recipeUnit: 'ML' },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);
    const recipeData = JSON.parse(recipeRes.payload).recipe;
    expect(Math.round(recipeData.totalCost)).toBe(220);

    // Update packaging and additional direct costs: PKR 20 packaging, PKR 10 condiments
    const updateCostRes = await app.inject({
      method: 'PUT',
      url: `/api/costing/recipe/${burgerProdId}/direct-costs`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        packagingCost: 20,
        additionalCost: 10,
        targetFoodCostPercentage: 30,
      },
    });
    expect(updateCostRes.statusCode).toBe(200);
  });

  it('Step 4: Verify Menu Item Profitability API calculations and KPI Summary', async () => {
    const profRes = await app.inject({
      method: 'GET',
      url: '/api/costing/menu-profitability',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(profRes.statusCode).toBe(200);
    const body = JSON.parse(profRes.payload);

    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThan(0);

    const burger = body.items.find((i: any) => i.productId === burgerProdId);
    expect(burger).toBeDefined();
    expect(burger.sellingPrice).toBe(500);
    expect(Math.round(burger.ingredientCost)).toBe(220);
    expect(burger.packagingCost).toBe(20);
    expect(burger.additionalCost).toBe(10);
    expect(Math.round(burger.totalDirectCost)).toBe(250); // 220 + 20 + 10
    expect(Math.round(burger.grossProfit)).toBe(250); // 500 - 250
    expect(burger.foodCostPercentage).toBe(50); // 250 / 500 = 50%
    expect(burger.grossProfitMargin).toBe(50); // 250 / 500 = 50%

    // Summary KPIs
    expect(body.summary.totalMenuItems).toBeGreaterThan(0);
    expect(body.summary.avgFoodCostPercentage).toBeGreaterThan(0);
    expect(body.summary.avgGrossProfit).toBeGreaterThan(0);
    expect(body.summary.highestFoodCostItem).toBeDefined();
    expect(body.summary.mostProfitableItem).toBeDefined();
  });

  it('Step 5: Verify Recipe Costing Breakdown with Ingredient share % and live simulator recommendation', async () => {
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/costing/recipe/${burgerProdId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const item = JSON.parse(detailRes.payload).item;

    expect(item.ingredients.length).toBe(5);
    const chicken = item.ingredients.find((i: any) => i.ingredientId === chickenIngId);
    expect(chicken).toBeDefined();
    expect(chicken.lineCost).toBe(150);
    expect(chicken.costPercentage).toBeGreaterThan(60); // 150 / 220 = 68.2%

    // Recommended selling price to achieve target 30% food cost: 250 / 0.30 = PKR 833
    expect(item.recommendedSellingPrice).toBe(833);
  });

  it('Step 6: Place and complete customer order, then verify Theoretical vs Actual Food Cost Analysis', async () => {
    // Create an order for 2 Chicken Burgers (Theoretical: 300 G Chicken, 40 G Cheese, 2 PCS Bun, 40 G Sauce, 30 ML Oil)
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: OrderType.DINE_IN,
        customerName: 'Hamza Gourmet',
        tableNumber: 'T-10',
        items: [
          { productId: burgerProdId, quantity: 2, unitPrice: 500 },
        ],
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const order = JSON.parse(orderRes.payload).order;

    // Checkout and complete order
    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/checkout`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        payments: [{ method: 'CASH', amount: Number(order.grand_total) }],
      },
    });
    expect(checkoutRes.statusCode).toBe(200);

    // Record 50 G Chicken wastage (e.g. trimming waste)
    const wasteRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjustments',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        ingredientId: chickenIngId,
        movementType: 'WASTAGE',
        quantity: 50,
        reason: 'Kitchen prep trimming loss',
      },
    });
    expect(wasteRes.statusCode).toBe(201);

    // Call Theoretical vs Actual Food Cost API
    const theoRes = await app.inject({
      method: 'GET',
      url: `/api/costing/theoretical-vs-actual?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(theoRes.statusCode).toBe(200);
    const theoBody = JSON.parse(theoRes.payload);

    expect(theoBody.items.length).toBeGreaterThan(0);
    const theoChicken = theoBody.items.find((i: any) => i.ingredientId === chickenIngId);
    expect(theoChicken).toBeDefined();

    // 2 burgers x 150 G = 300 G theoretical
    expect(theoChicken.theoreticalQuantity).toBe(300);
    expect(theoChicken.theoreticalCost).toBe(300);

    // Actual = 300 G batch consumed + 50 G wastage = 350 G
    expect(theoChicken.batchConsumedQuantity).toBe(300);
    expect(theoChicken.wastageQuantity).toBe(50);
    expect(theoChicken.actualQuantity).toBe(350);
    expect(theoChicken.quantityVariance).toBe(50);
    expect(theoChicken.costVariance).toBe(50);
    expect(theoChicken.variancePercentage).toBeGreaterThan(10);
    expect(theoChicken.status).toBe('INVESTIGATE'); // > 8% variance flags for investigation
  });

  it('Step 7: Verify Food Cost Analysis trends, category profitability, and branch comparison', async () => {
    const analysisRes = await app.inject({
      method: 'GET',
      url: `/api/costing/food-cost-analysis?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(analysisRes.statusCode).toBe(200);
    const analysis = JSON.parse(analysisRes.payload);

    expect(analysis.overall.netSales).toBeGreaterThan(0);
    expect(analysis.overall.totalCogs).toBeGreaterThan(0);
    expect(analysis.overall.overallFoodCostPercent).toBeGreaterThan(0);
    expect(analysis.categoryBreakdown.length).toBeGreaterThan(0);
    expect(analysis.trends.length).toBeGreaterThan(0);
    expect(analysis.topProfitable.length).toBeGreaterThan(0);
    expect(analysis.branchComparison.length).toBeGreaterThan(0);
  });

  it('Step 8: Verify Ingredient Price History and Recalculate Recipes', async () => {
    const histRes = await app.inject({
      method: 'GET',
      url: `/api/costing/ingredient-price-history?ingredientId=${chickenIngId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(histRes.statusCode).toBe(200);
    const histList = JSON.parse(histRes.payload).ingredients;
    expect(histList.length).toBe(1);
    expect(histList[0].ingredientId).toBe(chickenIngId);
    expect(histList[0].history.length).toBeGreaterThan(0);
    expect(histList[0].recipesAffectedCount).toBe(1);

    // Trigger recipe recalculation
    const recalcRes = await app.inject({
      method: 'POST',
      url: '/api/costing/recalculate-recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(recalcRes.statusCode).toBe(200);
    expect(JSON.parse(recalcRes.payload).updatedRecipesCount).toBeGreaterThan(0);
  });
});
