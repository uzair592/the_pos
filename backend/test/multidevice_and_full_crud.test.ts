import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool, query } from '../src/db/connection.js';
import { OrderType, PaymentMethod, PrepStatus, PrepStation, StockUnit, SystemRole, TableStatus } from '@pos/shared';

describe('Multi-Device Real-Time Order & KDS Flow and Complete CRUD Verification', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let waiterToken: string;
  let kitchenToken: string;
  let cashierToken: string;

  let tenantId: string;
  let branchId: string;
  let floorId: string;
  let tableId: string;

  // Menu entities
  let parentCategoryId: string;
  let subCategoryId: string;
  let modifierGroupId: string;
  let productId: string;
  let doubleVariantId: string;
  let ingredientId: string;
  let supplierId: string;

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
        name: 'Multi-Device Test Palace',
        ownerName: 'Malik Sultan',
        email: `sultan_${Date.now()}@multidevicetest.com`,
        initialAdminPassword: 'SultanPassword123!',
        phone: '+923009988776',
        planId: (await query('SELECT id FROM subscription_plans WHERE code = $1', ['GROWTH'])).rows[0].id,
      },
    });
    expect(createTenantRes.statusCode).toBe(201);
    const tenantPayload = JSON.parse(createTenantRes.payload);
    tenantId = tenantPayload.tenant.id;
    branchId = tenantPayload.branchId;

    // 3. Login as Owner
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: tenantPayload.ownerUser.email, password: 'SultanPassword123!' },
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = JSON.parse(ownerLogin.payload).token;

    // 4. Onboard Restaurant
    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/onboarding',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        legalName: 'Multi-Device Test Palace Pvt Ltd',
        phone: '+923009988776',
        address: 'Main Boulevard, Gulberg III',
        city: 'Lahore',
        currency: 'PKR',
        currencySymbol: 'Rs.',
        timeZone: 'Asia/Karachi',
        taxRatePercent: 16.0,
        taxRegistrationNumber: 'STRN-1234567-8',
        isTaxInclusive: false,
        serviceChargePercent: 5.0,
        initialBranchName: 'Gulberg Flagship Branch',
        receiptSettings: {
          defaultTemplate: 'STANDARD_80MM',
          paperWidth: '80mm',
          headerText: 'Welcome to Sultan Palace',
          footerText: 'Thank you for your visit!',
          bilingualUrduEnglish: true,
          showQrCode: true,
        },
      },
    });
    expect(onboardRes.statusCode).toBe(200);

    // 5. Create Staff Accounts (Waiter, Kitchen, Cashier)
    const createWaiter = await app.inject({
      method: 'POST',
      url: '/api/restaurant/users',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        email: `waiter_${Date.now()}@multidevice.com`,
        password: 'WaiterPassword123!',
        fullName: 'Hamza Waiter',
        role: SystemRole.WAITER,
      },
    });
    expect(createWaiter.statusCode).toBe(201);
    const waiterEmail = JSON.parse(createWaiter.payload).user.email;

    const createKitchen = await app.inject({
      method: 'POST',
      url: '/api/restaurant/users',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        email: `kitchen_${Date.now()}@multidevice.com`,
        password: 'KitchenPassword123!',
        fullName: 'Chef Akram',
        role: SystemRole.KITCHEN_STAFF,
      },
    });
    expect(createKitchen.statusCode).toBe(201);
    const kitchenEmail = JSON.parse(createKitchen.payload).user.email;

    const createCashier = await app.inject({
      method: 'POST',
      url: '/api/restaurant/users',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        email: `cashier_${Date.now()}@multidevice.com`,
        password: 'CashierPassword123!',
        fullName: 'Bilal Cashier',
        role: SystemRole.CASHIER,
      },
    });
    expect(createCashier.statusCode).toBe(201);
    const cashierEmail = JSON.parse(createCashier.payload).user.email;

    // 6. Login as each staff member
    const waiterAuth = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: waiterEmail, password: 'WaiterPassword123!' },
    });
    expect(waiterAuth.statusCode).toBe(200);
    waiterToken = JSON.parse(waiterAuth.payload).token;

    const kitchenAuth = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: kitchenEmail, password: 'KitchenPassword123!' },
    });
    expect(kitchenAuth.statusCode).toBe(200);
    kitchenToken = JSON.parse(kitchenAuth.payload).token;

    const cashierAuth = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: cashierEmail, password: 'CashierPassword123!' },
    });
    expect(cashierAuth.statusCode).toBe(200);
    cashierToken = JSON.parse(cashierAuth.payload).token;

    // 7. Setup Floor & Table
    const floorRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/floors',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { branchId, name: 'Ground Main Hall', level: 1 },
    });
    expect(floorRes.statusCode).toBe(201);
    floorId = JSON.parse(floorRes.payload).floor.id;

    const tableRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/tables',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { floorId, branchId, tableNumber: 'T-10', capacity: 4 },
    });
    expect(tableRes.statusCode).toBe(201);
    tableId = JSON.parse(tableRes.payload).table.id;
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  // =========================================================================
  // TEST SUITE 1: FULL CRUD OPERATIONS
  // =========================================================================

  it('CRUD 1: Main Category and Sub-Category hierarchical creation & listing', async () => {
    // 1. Create Parent Main Category
    const mainCatRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Burgers & Sandwiches',
        nameUrdu: 'برگر اور سینڈوچ',
        sortOrder: 1,
      },
    });
    expect(mainCatRes.statusCode).toBe(201);
    parentCategoryId = JSON.parse(mainCatRes.payload).category.id;

    // 2. Create Child Sub-Category
    const subCatRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        parentId: parentCategoryId,
        name: 'Smash Gourmet Burgers',
        nameUrdu: 'سمیش گورمے برگر',
        sortOrder: 2,
      },
    });
    expect(subCatRes.statusCode).toBe(201);
    subCategoryId = JSON.parse(subCatRes.payload).category.id;

    // 3. List Categories and verify parent_id and parent_name linkage
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const cats = JSON.parse(listRes.payload).categories;
    const foundSub = cats.find((c: any) => c.id === subCategoryId);
    expect(foundSub).toBeDefined();
    expect(foundSub.parent_id).toBe(parentCategoryId);
    expect(foundSub.parent_name).toBe('Burgers & Sandwiches');

    // 4. Update Sub-Category
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/menu/categories/${subCategoryId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Artisan Smash Burgers',
        sortOrder: 5,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.payload).category.name).toBe('Artisan Smash Burgers');
  });

  it('CRUD 2: Addon / Modifier Groups creation, options, and update', async () => {
    // 1. Create Modifier Group with multiple options and prices
    const createModRes = await app.inject({
      method: 'POST',
      url: '/api/menu/modifiers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Extra Sauces & Upgrades',
        nameUrdu: 'اضافی ساس اور اپ گریڈ',
        minSelect: 0,
        maxSelect: 4,
        isRequired: false,
        options: [
          { name: 'Extra Garlic Mayo Sauce', price: 70, isDefault: false },
          { name: 'Cheddar Cheese Slice', price: 80, isDefault: false },
          { name: 'Fried Farm Egg', price: 60, isDefault: false },
        ],
      },
    });
    expect(createModRes.statusCode).toBe(201);
    const modGroup = JSON.parse(createModRes.payload).modifierGroup;
    modifierGroupId = modGroup.id;
    expect(modGroup.name).toBe('Extra Sauces & Upgrades');

    // 2. Fetch Modifier Groups
    const getModsRes = await app.inject({
      method: 'GET',
      url: '/api/menu/modifiers',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(getModsRes.statusCode).toBe(200);
    const groups = JSON.parse(getModsRes.payload).modifierGroups;
    expect(groups.some((g: any) => g.id === modifierGroupId)).toBe(true);

    // 3. Update Modifier Group
    const updateModRes = await app.inject({
      method: 'PUT',
      url: `/api/menu/modifiers/${modifierGroupId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Premium Sauces & Dips',
        maxSelect: 5,
        options: [
          { name: 'Extra Garlic Mayo Sauce', price: 75, isDefault: false },
          { name: 'Cheddar Cheese Slice', price: 85, isDefault: false },
          { name: 'Truffle Mayo Dip', price: 120, isDefault: false },
        ],
      },
    });
    expect(updateModRes.statusCode).toBe(200);
    expect(JSON.parse(updateModRes.payload).modifierGroup.name).toBe('Premium Sauces & Dips');
  });

  it('CRUD 3: Inward Purchases, Supplier registration, and FIFO Inventory Batches', async () => {
    // 1. Create Raw Ingredient with correct schema (name, sku, unit, costPerUnit)
    const ingRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Ground Beef Chuck',
        sku: `ING-BEEF-${Date.now()}`,
        unit: StockUnit.KG,
        costPerUnit: 1200,
        minStockAlert: 5,
      },
    });
    expect(ingRes.statusCode).toBe(201);
    ingredientId = JSON.parse(ingRes.payload).ingredient.id;

    // 2. Register Supplier
    const supRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/suppliers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Lahore Prime Meat Supplies',
        contactPerson: 'Tariq Butt',
        phone: '+923001239988',
        email: 'tariq@primemeat.com',
      },
    });
    expect(supRes.statusCode).toBe(201);
    supplierId = JSON.parse(supRes.payload).supplier.id;

    // 3. Create Draft Purchase Invoice
    const poRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/purchases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        supplierId,
        invoiceNumber: `INV-TEST-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        items: [
          {
            ingredientId,
            unit: StockUnit.KG,
            quantity: 20, // 20 KG
            unitPrice: 1100, // Rs. 1,100 per KG
          },
        ],
      },
    });
    expect(poRes.statusCode).toBe(201);
    const purchaseId = JSON.parse(poRes.payload).purchase.id;

    // 4. Approve and Receive Purchase Invoice into FIFO lots
    const receiveRes = await app.inject({
      method: 'POST',
      url: `/api/inventory/purchases/${purchaseId}/receive`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(receiveRes.statusCode).toBe(200);

    // Verify stock and FIFO lot created
    const ingsRes = await app.inject({
      method: 'GET',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ingsRes.statusCode).toBe(200);

    const batchesRes = await app.inject({
      method: 'GET',
      url: '/api/inventory/batches',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(batchesRes.statusCode).toBe(200);
    const lots = JSON.parse(batchesRes.payload).batches.filter((b: any) => b.ingredient_id === ingredientId);
    expect(lots.length).toBeGreaterThan(0);
    expect(Number(lots[0].quantity_remaining)).toBe(20);
    expect(Number(lots[0].unit_cost)).toBe(1100);
  });

  it('CRUD 4: Menu Product creation with subcategory, variants, attached modifier groups and recipe', async () => {
    // 1. Create Product
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Double Smash Beef Burger',
        nameUrdu: 'ڈبل سمیش بیف برگر',
        categoryId: subCategoryId,
        sku: `SBN-${Date.now()}`,
        basePrice: 850,
        costPrice: 400,
        station: PrepStation.KITCHEN,
        trackInventory: true,
        modifierGroupIds: [modifierGroupId],
        variants: [
          { name: 'Single Patty', price: 750, isDefault: false },
          { name: 'Double Patty', price: 950, isDefault: true },
        ],
      },
    });
    expect(prodRes.statusCode).toBe(201);
    productId = JSON.parse(prodRes.payload).product.id;

    // 2. Attach Recipe linking Ground Beef Chuck to Double Smash Burger
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/recipes',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        productId,
        yieldCount: 1,
        ingredients: [
          {
            ingredientId,
            quantity: 0.25, // 250 grams per burger
            unit: StockUnit.KG,
          },
        ],
      },
    });
    expect(recipeRes.statusCode).toBe(201);

    // 3. Fetch products and verify attached variants and modifier groups
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const prod = JSON.parse(listRes.payload).products.find((p: any) => p.id === productId);
    expect(prod).toBeDefined();
    expect(prod.variants.length).toBe(2);
    const defVariant = prod.variants.find((v: any) => v.name === 'Double Patty');
    expect(defVariant).toBeDefined();
    doubleVariantId = defVariant.id;
    expect(prod.modifierGroups.length).toBe(1);
    expect(prod.modifierGroups[0].id).toBe(modifierGroupId);
  });

  // =========================================================================
  // TEST SUITE 2: MULTI-DEVICE REAL-TIME FLOW (WAITER -> KDS -> CASHIER CHECKOUT)
  // =========================================================================

  let placedOrderId: string;
  let kitchenTicketId: string;

  it('Multi-Device Step 1 (Waiter Tablet): Waiter places order with addons, table, and cooking notes', async () => {
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${waiterToken}` },
      payload: {
        branchId,
        orderType: OrderType.DINE_IN,
        tableId,
        customerName: 'Sheikh Zafar',
        customerPhone: '+923005551234',
        orderNotes: 'VIP Dining Table - Serve fresh & hot',
        items: [
          {
            productId,
            variantId: doubleVariantId,
            quantity: 2,
            unitPrice: 950,
            notes: 'Extra crispy patties, no raw onions',
            modifiers: [
              { name: 'Extra Garlic Mayo Sauce', unitPrice: 75 },
              { name: 'Cheddar Cheese Slice', unitPrice: 85 },
            ],
          },
        ],
      },
    });

    expect(orderRes.statusCode).toBe(201);
    const order = JSON.parse(orderRes.payload).order;
    placedOrderId = order.id;

    expect(order.order_number).toBeDefined();
    expect(order.status).toBe('CONFIRMED');
    expect(order.payment_status).toBe('PENDING');

    // Expected price:
    // Subtotal: 2x (950 + 75 + 85 = 1110) = 2220
    // Tax (16%): 2220 * 0.16 = 355.20
    // Service Charge (5%): 2220 * 0.05 = 111.00
    // Grand Total: 2220 + 355.20 + 111 = 2686.20
    expect(Number(order.grand_total)).toBeGreaterThan(2500);

    // Verify Table status updated to OCCUPIED
    const tableCheck = await query('SELECT status, current_order_id FROM restaurant_tables WHERE id = $1', [tableId], { tenantId });
    expect(tableCheck.rows[0].status).toBe(TableStatus.OCCUPIED);
    expect(tableCheck.rows[0].current_order_id).toBe(placedOrderId);

    // Verify sync_events has ORDER_CREATED
    const syncRes = await app.inject({
      method: 'GET',
      url: '/api/sync/events',
      headers: { authorization: `Bearer ${waiterToken}` },
    });
    expect(syncRes.statusCode).toBe(200);
    const events = JSON.parse(syncRes.payload).events;
    const createEvt = events.find((e: any) => (e.event_type === 'ORDER_CREATED' || e.eventType === 'ORDER_CREATED') && (e.entity_id === placedOrderId || e.entityId === placedOrderId));
    expect(createEvt).toBeDefined();
  });

  it('Multi-Device Step 2 (Kitchen Display System): Kitchen receives ticket with addons summary and updates status', async () => {
    // 1. Kitchen Staff queries KDS tickets
    const kdsRes = await app.inject({
      method: 'GET',
      url: '/api/kds/tickets?status=ACTIVE',
      headers: { authorization: `Bearer ${kitchenToken}` },
    });

    expect(kdsRes.statusCode).toBe(200);
    const tickets = JSON.parse(kdsRes.payload).tickets;
    const ticket = tickets.find((t: any) => t.order_id === placedOrderId);

    expect(ticket).toBeDefined();
    kitchenTicketId = ticket.id;
    expect(ticket.status).toBe(PrepStatus.PENDING);
    expect(ticket.table_number).toBe('T-10');
    expect(ticket.notes).toBe('VIP Dining Table - Serve fresh & hot');

    // Verify item addons and cooking instruction
    expect(ticket.items.length).toBe(1);
    const item = ticket.items[0];
    expect(item.product_name).toBe('Double Smash Beef Burger');
    expect(item.quantity).toBe(2);
    expect(item.modifiers_summary).toContain('Extra Garlic Mayo Sauce');
    expect(item.modifiers_summary).toContain('Cheddar Cheese Slice');
    expect(item.notes).toBe('Extra crispy patties, no raw onions');

    // 2. Kitchen accepts ticket (PENDING -> ACCEPTED)
    const acceptRes = await app.inject({
      method: 'PUT',
      url: `/api/kds/tickets/${kitchenTicketId}/status`,
      headers: { authorization: `Bearer ${kitchenToken}` },
      payload: { status: PrepStatus.ACCEPTED },
    });
    expect(acceptRes.statusCode).toBe(200);

    // 3. Kitchen starts preparing (ACCEPTED -> PREPARING)
    const prepRes = await app.inject({
      method: 'PUT',
      url: `/api/kds/tickets/${kitchenTicketId}/status`,
      headers: { authorization: `Bearer ${kitchenToken}` },
      payload: { status: PrepStatus.PREPARING },
    });
    expect(prepRes.statusCode).toBe(200);

    // 4. Kitchen marks food ready (PREPARING -> READY)
    const readyRes = await app.inject({
      method: 'PUT',
      url: `/api/kds/tickets/${kitchenTicketId}/status`,
      headers: { authorization: `Bearer ${kitchenToken}` },
      payload: { status: PrepStatus.READY },
    });
    expect(readyRes.statusCode).toBe(200);

    // 5. Waiter/Kitchen serves food to table (READY -> SERVED)
    const servedRes = await app.inject({
      method: 'PUT',
      url: `/api/kds/tickets/${kitchenTicketId}/status`,
      headers: { authorization: `Bearer ${kitchenToken}` },
      payload: { status: PrepStatus.SERVED },
    });
    expect(servedRes.statusCode).toBe(200);
    expect(JSON.parse(servedRes.payload).ticket.status).toBe(PrepStatus.SERVED);

    // Verify parent order updated to SERVED
    const orderCheck = await query('SELECT status FROM orders WHERE id = $1', [placedOrderId], { tenantId });
    expect(orderCheck.rows[0].status).toBe('SERVED');

    // Verify sync event ORDER_STATUS_CHANGED emitted with status SERVED
    const syncRes = await app.inject({
      method: 'GET',
      url: '/api/sync/events',
      headers: { authorization: `Bearer ${kitchenToken}` },
    });
    const events = JSON.parse(syncRes.payload).events;
    const servedEvt = events.find(
      (e: any) => (e.event_type === 'ORDER_STATUS_CHANGED' || e.eventType === 'ORDER_STATUS_CHANGED') &&
                  (e.payload?.status === 'SERVED' || e.payload?.kotStatus === 'SERVED' ||
                   (typeof e.payload === 'string' && JSON.parse(e.payload)?.status === 'SERVED'))
    );
    expect(servedEvt).toBeDefined();
    expect(servedEvt.payload.tableNumber).toBe('T-10');
  });

  it('Multi-Device Step 3 (POS Cashier Register): Cashier sees Served Unpaid Order, collects payment and prints bill', async () => {
    // 1. Open shift for Cashier if not already open
    const openShiftRes = await app.inject({
      method: 'POST',
      url: '/api/financial/shifts/open',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: { branchId, registerName: 'Cashier Terminal 1', openingCash: 10000 },
    });
    expect([200, 201]).toContain(openShiftRes.statusCode);

    // 2. Cashier checks Active Unpaid Orders drawer
    const activeOrdersRes = await app.inject({
      method: 'GET',
      url: '/api/orders/active',
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    expect(activeOrdersRes.statusCode).toBe(200);
    const activeOrders = JSON.parse(activeOrdersRes.payload).orders;
    const servedOrder = activeOrders.find((o: any) => o.id === placedOrderId);

    expect(servedOrder).toBeDefined();
    expect(servedOrder.status).toBe('SERVED');
    expect(servedOrder.payment_status).toBe('PENDING');
    const grandTotal = Number(servedOrder.grand_total);

    // 3. Cashier takes payment at POS register
    const checkoutRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${placedOrderId}/checkout`,
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        payments: [{ method: PaymentMethod.CASH, amount: grandTotal }],
        changeGiven: 0,
      },
    });
    expect(checkoutRes.statusCode).toBe(200);

    // 4. Verify Order is now COMPLETED and PAID
    const finishedOrder = await query('SELECT status, payment_status, paid_amount FROM orders WHERE id = $1', [placedOrderId], { tenantId });
    expect(finishedOrder.rows[0].status).toBe('COMPLETED');
    expect(finishedOrder.rows[0].payment_status).toBe('PAID');
    expect(Number(finishedOrder.rows[0].paid_amount)).toBe(grandTotal);

    // 5. Verify Table status is released back to AVAILABLE
    const tableReleased = await query('SELECT status, current_order_id FROM restaurant_tables WHERE id = $1', [tableId], { tenantId });
    expect(tableReleased.rows[0].status).toBe(TableStatus.AVAILABLE);
    expect(tableReleased.rows[0].current_order_id).toBeNull();

    // 6. Verify FIFO stock deduction:
    // Recipe requires 0.25 KG beef * 2 burgers = 0.5 KG
    // Starting stock was 20 KG -> Remaining must be 19.5 KG
    const stockCheck = await query('SELECT current_stock FROM branch_stocks WHERE ingredient_id = $1 AND branch_id = $2', [ingredientId, branchId], { tenantId });
    expect(Number(stockCheck.rows[0].current_stock)).toBe(19.5);

    const lotCheck = await query('SELECT quantity_remaining FROM inventory_batches WHERE ingredient_id = $1', [ingredientId], { tenantId });
    expect(Number(lotCheck.rows[0].quantity_remaining)).toBe(19.5);

    // 7. Verify Receipt payload for all 5 templates
    const receiptRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${placedOrderId}/receipt`,
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    expect(receiptRes.statusCode).toBe(200);
    const receipt = JSON.parse(receiptRes.payload).receipt;

    expect(receipt.restaurantName).toBe('Multi-Device Test Palace');
    expect(receipt.branchName).toBe('Gulberg Flagship Branch');
    expect(receipt.taxRegistrationNumber).toBe('STRN-1234567-8');
    expect(receipt.tableNumber).toBe('T-10');
    expect(receipt.customerName).toBe('Sheikh Zafar');
    expect(receipt.items.length).toBe(1);
    expect(receipt.items[0].productName).toBe('Double Smash Beef Burger');
    expect(receipt.items[0].quantity).toBe(2);
    expect(receipt.items[0].modifiers).toBeDefined();
    expect(Number(receipt.grandTotal)).toBe(grandTotal);
  });
});
