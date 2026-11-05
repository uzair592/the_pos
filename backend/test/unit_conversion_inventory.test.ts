import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool, query } from '../src/db/connection.js';
import { StockUnit, OrderType, OrderStatus, formatDisplayStock, calculateBaseUnitCost } from '@pos/shared';

describe('Unit Conversion and Recipe-Based Inventory Deductions', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let supplierId: string;
  let chickenIngId: string;
  let oilIngId: string;
  let eggIngId: string;
  let burgerProdId: string;
  let bucketProdId: string;
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
        name: 'Crispy Crunch Grillhouse',
        ownerName: 'Chef Rashid',
        email: `rashid_${Date.now()}@crispycrunch.com`,
        initialAdminPassword: 'RashidPassword123!',
        phone: '+923001239876',
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
      payload: { email: tenantData.ownerUser.email, password: 'RashidPassword123!' },
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = JSON.parse(ownerLogin.payload).token;

    // 4. Create Supplier
    const supRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/suppliers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Punjab Agro Distributors',
        contactPerson: 'Arif Mehmood',
        phone: '+923005544332',
        email: 'arif@punjabagro.com',
        address: 'Wholesale Mandi Gate 2',
        taxNumber: 'NTN-887766',
      },
    });
    expect(supRes.statusCode).toBe(201);
    supplierId = JSON.parse(supRes.payload).supplier.id;

    // 5. Create Menu Category
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Burgers & Meals',
        color: '#FF5722',
        sortOrder: 1,
      },
    });
    expect(catRes.statusCode).toBe(201);
    categoryId = JSON.parse(catRes.payload).category.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Register raw ingredient with base unit G, purchase unit KG, and factor 1000', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Fresh Chicken Boneless',
        category: 'Meat & Poultry',
        sku: 'ING-CHK-BONELESS',
        baseUnit: 'G',
        purchaseUnit: 'KG',
        conversionFactor: 1000,
        purchaseCost: 1000,
        minStockAlert: 500,
        initialStock: 0,
        branchId,
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.payload);
    expect(data.ingredient.name).toBe('Fresh Chicken Boneless');
    expect(data.ingredient.base_unit).toBe('G');
    expect(data.ingredient.purchase_unit).toBe('KG');
    expect(Number(data.ingredient.conversion_factor)).toBe(1000);
    expect(Number(data.ingredient.purchase_cost)).toBe(1000);
    // Calculated base unit cost: 1000 / 1000 = 1 PKR per gram
    expect(Number(data.ingredient.cost_per_unit)).toBe(1);
    chickenIngId = data.ingredient.id;
  });

  it('2. Inward Purchase of 10 KG Chicken converts automatically to 10,000 G in FIFO inventory', async () => {
    // Create draft purchase invoice
    const invRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        supplierId,
        invoiceNumber: 'INV-CHK-1001',
        taxAmount: 0,
        paidAmount: 10000,
        notes: '10 KG Fresh Chicken batch',
        items: [
          {
            ingredientId: chickenIngId,
            unit: 'G',
            purchaseUnit: 'KG',
            conversionFactor: 1000,
            quantity: 10, // 10 KG
            unitPrice: 1000, // PKR 1,000 per KG
          },
        ],
      },
    });

    expect(invRes.statusCode).toBe(201);
    const invData = JSON.parse(invRes.payload);
    const purchaseId = invData.purchase.id;
    expect(Number(invData.purchase.total_amount)).toBe(10000);

    // Receive purchase invoice into branch stock
    const receiveRes = await app.inject({
      method: 'POST',
      url: `/api/inventory/purchases/${purchaseId}/receive`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { branchId },
    });
    expect(receiveRes.statusCode).toBe(200);

    // Verify FIFO Batch was created with 10,000 G (base unit)
    const batchesRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/batches?branchId=${branchId}&ingredientId=${chickenIngId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(batchesRes.statusCode).toBe(200);
    const batchesData = JSON.parse(batchesRes.payload);
    expect(batchesData.batches.length).toBeGreaterThan(0);
    const activeBatch = batchesData.batches.find((b: any) => b.ingredient_id === chickenIngId && b.status === 'ACTIVE');
    expect(Number(activeBatch.quantity_received)).toBe(10000);
    expect(Number(activeBatch.quantity_remaining)).toBe(10000);
    expect(Number(activeBatch.unit_cost)).toBe(1); // 1 PKR / G

    // Verify Branch Stock in base unit
    const ingRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients?branchId=${branchId}&search=Fresh Chicken`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ingRes.statusCode).toBe(200);
    const ingData = JSON.parse(ingRes.payload);
    const chicken = ingData.ingredients.find((i: any) => i.id === chickenIngId);
    expect(Number(chicken.current_stock)).toBe(10000);
    expect(chicken.display_stock).toBe('10.00 KG (10,000 G)');
  });

  it('3. Recipe for Chicken Burger (150 G chicken) auto-computes recipe cost and base consumption', async () => {
    // Create product
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Crispy Chicken Burger',
        categoryId,
        sku: 'BURGER-CHK-01',
        basePrice: 550,
        costPrice: 0,
        trackInventory: true,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    burgerProdId = JSON.parse(prodRes.payload).product.id;

    // Create Recipe: 150 G of chicken
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId: burgerProdId,
        yieldCount: 1,
        ingredients: [
          {
            ingredientId: chickenIngId,
            enteredQuantity: 150,
            recipeUnit: 'G',
            quantity: 150,
            unit: 'G',
          },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);
    const recipeData = JSON.parse(recipeRes.payload);
    // 150 G * 1 PKR/G = 150 PKR
    expect(Number(recipeData.recipe.totalCost)).toBe(150);

    // Verify product cost_price updated to 150 PKR in products list
    const checkProds = await app.inject({
      method: 'GET',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(checkProds.statusCode).toBe(200);
    const prod = JSON.parse(checkProds.payload).products.find((p: any) => p.id === burgerProdId);
    expect(Number(prod.cost_price)).toBe(150);
  });

  it('4. Recipe for Family Bucket defined in KG (1.5 KG) automatically converts to 1,500 G base', async () => {
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Family Chicken Bucket (10 Pcs)',
        categoryId,
        sku: 'BUCKET-FAM-01',
        basePrice: 2800,
        costPrice: 0,
        trackInventory: true,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    bucketProdId = JSON.parse(prodRes.payload).product.id;

    // Define recipe using KG: 1.5 KG entered -> should convert to 1500 G
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId: bucketProdId,
        yieldCount: 1,
        ingredients: [
          {
            ingredientId: chickenIngId,
            enteredQuantity: 1.5,
            recipeUnit: 'KG', // entered in KG!
            quantity: 1500, // base quantity
            unit: 'G',
          },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);
    const recipeData = JSON.parse(recipeRes.payload);
    // 1,500 G * 1 PKR/G = 1,500 PKR
    expect(Number(recipeData.recipe.totalCost)).toBe(1500);

    // Verify recipes list contains the bucket recipe with 1500 G
    const getRecipesRes = await app.inject({
      method: 'GET',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(getRecipesRes.statusCode).toBe(200);
    const bucketRecipe = JSON.parse(getRecipesRes.payload).recipes.find((r: any) => r.product_id === bucketProdId);
    expect(bucketRecipe).toBeDefined();
    const recipeIngredients = bucketRecipe.ingredients || bucketRecipe.items;
    expect(Number(recipeIngredients[0].quantity)).toBe(1500);
  });

  it('5. POS Order checkout for 2 Burgers accurately deducts 300 G from FIFO stock', async () => {
    // Initial stock: 10,000 G
    // Order 2 Burgers -> 2 * 150 G = 300 G
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: OrderType.TAKEAWAY,
        customerName: 'Table 4 Customer',
        orderNotes: 'Fast service',
        items: [
          {
            productId: burgerProdId,
            quantity: 2,
            unitPrice: 550,
            modifiers: [],
          },
        ],
      },
    });
    if (orderRes.statusCode !== 201) {
      console.log('ORDER ERROR:', orderRes.payload);
    }
    expect(orderRes.statusCode).toBe(201);
    const order = JSON.parse(orderRes.payload).order;

    // Pay and complete order via checkout with exact order.grand_total
    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/checkout`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        payments: [{ method: 'CASH', amount: Number(order.grand_total) }],
        changeGiven: 0,
      },
    });
    if (checkoutRes.statusCode !== 200) {
      console.log('CHECKOUT ERROR:', checkoutRes.payload);
    }
    expect(checkoutRes.statusCode).toBe(200);

    // Verify FIFO Batch deducted: 10,000 - 300 = 9,700 G
    const batchRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/batches?branchId=${branchId}&ingredientId=${chickenIngId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const batchData = JSON.parse(batchRes.payload);
    const activeBatch = batchData.batches.find((b: any) => b.ingredient_id === chickenIngId && b.status === 'ACTIVE');
    expect(Number(activeBatch.quantity_remaining)).toBe(9700);

    // Verify Branch Stock & Dual Display
    const ingRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/ingredients?branchId=${branchId}&search=Fresh Chicken`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const chicken = JSON.parse(ingRes.payload).ingredients.find((i: any) => i.id === chickenIngId);
    expect(Number(chicken.current_stock)).toBe(9700);
    expect(chicken.display_stock).toBe('9.70 KG (9,700 G)');
  });

  it('6. Cancelling / Refunding an order restores the exact deducted base stock (300 G)', async () => {
    // Create an order for 2 Burgers (300 G) and complete it
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        orderType: OrderType.TAKEAWAY,
        items: [
          {
            productId: burgerProdId,
            quantity: 2,
            unitPrice: 550,
          },
        ],
      },
    });
    const order = JSON.parse(orderRes.payload).order;

    // Checkout order -> stock becomes 9,700 - 300 = 9,400 G
    const chkRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/checkout`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { payments: [{ method: 'CASH', amount: Number(order.grand_total) }], changeGiven: 0 },
    });
    expect(chkRes.statusCode).toBe(200);

    const midStock = await query(
      'SELECT current_stock FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3',
      [tenantId, branchId, chickenIngId],
      { tenantId }
    );
    expect(Number(midStock.rows[0].current_stock)).toBe(9400);

    // Process Order Refund with restockStock: true -> Stock should reverse by 300 G back to 9,700 G
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/refund`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        orderId: order.id,
        paymentMethod: 'CASH',
        reason: 'Customer returned burger before consuming',
        restockStock: true,
      },
    });
    expect(refundRes.statusCode).toBe(200);

    const restoredStock = await query(
      'SELECT current_stock FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3',
      [tenantId, branchId, chickenIngId],
      { tenantId }
    );
    expect(Number(restoredStock.rows[0].current_stock)).toBe(9700);
  });

  it('7. Volume Dimension (Cooking Oil: Base ML, Purchase L) converts and deducts seamlessly', async () => {
    // 1. Register Cooking Oil: Base = ML, Purchase = L, Factor = 1000, Purchase Cost = 600 PKR/L
    const ingRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Dalda Premium Cooking Oil',
        category: 'Oils, Fats & Ghee',
        sku: 'ING-OIL-DALDA',
        baseUnit: 'ML',
        purchaseUnit: 'L',
        conversionFactor: 1000,
        purchaseCost: 600,
        minStockAlert: 1000,
        initialStock: 0,
        branchId,
      },
    });
    expect(ingRes.statusCode).toBe(201);
    oilIngId = JSON.parse(ingRes.payload).ingredient.id;

    // Base cost: 600 / 1000 = 0.60 PKR / ML
    expect(Number(JSON.parse(ingRes.payload).ingredient.cost_per_unit)).toBe(0.6);

    // 2. Inward Purchase: 5 L of Oil = 5,000 ML
    const invRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        supplierId,
        invoiceNumber: 'INV-OIL-5001',
        taxAmount: 0,
        paidAmount: 3000,
        items: [
          {
            ingredientId: oilIngId,
            unit: 'ML',
            purchaseUnit: 'L',
            conversionFactor: 1000,
            quantity: 5,
            unitPrice: 600,
          },
        ],
      },
    });
    const purchaseId = JSON.parse(invRes.payload).purchase.id;

    // Receive purchase
    await app.inject({
      method: 'POST',
      url: `/api/inventory/purchases/${purchaseId}/receive`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { branchId },
    });

    const checkStock = await query(
      'SELECT current_stock FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3',
      [tenantId, branchId, oilIngId],
      { tenantId }
    );
    expect(Number(checkStock.rows[0].current_stock)).toBe(5000); // 5,000 ML
  });

  it('8. Count / Custom Package Dimension (Farm Eggs: Base PCS, Purchase TRAY of 30) converts accurately', async () => {
    // 1. Register Eggs: Base = PCS, Purchase = TRAY, Factor = 30, Purchase Cost = 750 PKR/Tray
    const ingRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Farm Fresh Organic Eggs',
        category: 'Dairy & Cheese',
        sku: 'ING-EGGS-TRAY',
        baseUnit: 'PCS',
        purchaseUnit: 'TRAY',
        conversionFactor: 30,
        purchaseCost: 750,
        minStockAlert: 15,
        initialStock: 0,
        branchId,
      },
    });
    expect(ingRes.statusCode).toBe(201);
    eggIngId = JSON.parse(ingRes.payload).ingredient.id;

    // Base cost: 750 / 30 = 25 PKR per egg
    expect(Number(JSON.parse(ingRes.payload).ingredient.cost_per_unit)).toBe(25);

    // 2. Inward Purchase: 3 Trays = 90 Eggs
    const invRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        supplierId,
        invoiceNumber: 'INV-EGG-3001',
        taxAmount: 0,
        paidAmount: 2250,
        items: [
          {
            ingredientId: eggIngId,
            unit: 'PCS',
            purchaseUnit: 'TRAY',
            conversionFactor: 30,
            quantity: 3,
            unitPrice: 750,
          },
        ],
      },
    });
    const purchaseId = JSON.parse(invRes.payload).purchase.id;

    // Receive purchase
    await app.inject({
      method: 'POST',
      url: `/api/inventory/purchases/${purchaseId}/receive`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { branchId },
    });

    const checkStock = await query(
      'SELECT current_stock FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3',
      [tenantId, branchId, eggIngId],
      { tenantId }
    );
    expect(Number(checkStock.rows[0].current_stock)).toBe(90); // 90 PCS
  });
});
