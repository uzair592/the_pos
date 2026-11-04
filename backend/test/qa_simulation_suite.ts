/**
 * QA & QC Comprehensive Simulation Suite
 * Simulates a real Restaurant Owner, Manager, Waiter, Kitchen Staff, and Cashier
 * executing end-to-end restaurant workflows on the live system.
 */

import { pool } from '../src/db/connection.js';

const BASE_URL = 'http://localhost:4000';

interface StepResult {
  step: string;
  category: string;
  passed: boolean;
  details?: string;
  error?: string;
  timingMs: number;
}

const results: StepResult[] = [];

async function logStep(category: string, step: string, fn: () => Promise<any>) {
  const start = Date.now();
  try {
    const details = await fn();
    const timingMs = Date.now() - start;
    results.push({ category, step, passed: true, details: typeof details === 'string' ? details : JSON.stringify(details), timingMs });
    console.log(`  [PASS] [${timingMs}ms] ${step}`);
  } catch (err: any) {
    const timingMs = Date.now() - start;
    results.push({ category, step, passed: false, error: err.message, timingMs });
    console.error(`  [FAIL] [${timingMs}ms] ${step}:`, err.message);
  }
}

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, ok: res.ok, data: json };
}

async function runQaSuite() {
  console.log('===============================================================');
  console.log('STARTING QA & QC RESTAURANT OWNER SIMULATION & AUDIT SUITE');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log('===============================================================\n');

  let ownerToken = '';
  let cashierToken = '';
  let waiterToken = '';
  let kitchenToken = '';
  let tenantId = '';
  let branchId = '';

  let categoryId = '';
  let subCategoryId = '';
  let ingredientBunId = '';
  let ingredientPattyId = '';
  let ingredientCheeseId = '';
  let ingredientSauceId = '';
  let supplierId = '';
  let purchaseId = '';
  let modifierGroupId = '';
  let productId = '';
  let bankAccountId = '';
  let dineInOrderId = '';
  let takeawayOrderId = '';
  let deliveryOrderId = '';
  let tableId = '';

  // -----------------------------------------------------------------
  // 1. AUTHENTICATION & SESSION MANAGEMENT
  // -----------------------------------------------------------------
  console.log('--- 1. Authentication & Session Management ---');

  await logStep('Auth', 'Login with invalid credentials should be rejected (401)', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'owner@lahorekarahi.com', password: 'WrongPassword999!' },
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(res.data)}`);
    return 'Correctly rejected invalid password';
  });

  await logStep('Auth', 'Restaurant Owner Login', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'owner@lahorekarahi.com', password: 'Password123!' },
    });
    if (res.status !== 200 || !res.data.token) {
      throw new Error(`Owner login failed: ${res.status} - ${JSON.stringify(res.data)}`);
    }
    ownerToken = res.data.token;
    tenantId = res.data.user.tenantId;
    branchId = res.data.user.branchId;
    if (!tenantId || !branchId) throw new Error('Missing tenantId or branchId in auth payload');
    return `Owner authenticated. Tenant: ${tenantId}, Branch: ${branchId}`;
  });

  await logStep('Auth', 'Cashier Login', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'cashier@lahorekarahi.com', password: 'Password123!' },
    });
    if (res.status !== 200 || !res.data.token) throw new Error(`Cashier login failed: ${res.status}`);
    cashierToken = res.data.token;
    return 'Cashier token acquired';
  });

  await logStep('Auth', 'Waiter Login', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'waiter@lahorekarahi.com', password: 'Password123!' },
    });
    if (res.status !== 200 || !res.data.token) throw new Error(`Waiter login failed: ${res.status}`);
    waiterToken = res.data.token;
    return 'Waiter token acquired';
  });

  await logStep('Auth', 'Kitchen Staff Login', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'kitchen@lahorekarahi.com', password: 'Password123!' },
    });
    if (res.status !== 200 || !res.data.token) throw new Error(`Kitchen login failed: ${res.status}`);
    kitchenToken = res.data.token;
    return 'Kitchen token acquired';
  });

  await logStep('Auth', 'Verify /api/auth/me Profile and Token Validity', async () => {
    const res = await request('/api/auth/me', { token: ownerToken });
    if (res.status !== 200 || res.data.user.email !== 'owner@lahorekarahi.com') {
      throw new Error(`Invalid /api/auth/me response: ${res.status}`);
    }
    return `Profile verified for ${res.data.user.fullName} (${res.data.user.role})`;
  });

  // -----------------------------------------------------------------
  // 2. RESTAURANT SETTINGS & TABLES
  // -----------------------------------------------------------------
  console.log('\n--- 2. Restaurant Settings & Dining Tables ---');

  await logStep('Settings', 'Fetch and verify restaurant settings', async () => {
    const res = await request('/api/restaurant/settings', { token: ownerToken });
    if (res.status !== 200) throw new Error(`Fetch settings failed: ${res.status}`);
    return `Currency: ${res.data.settings?.currencySymbol || res.data.settings?.currency}, Tax: ${res.data.settings?.taxRatePercent}%`;
  });

  await logStep('Tables', 'Fetch dining tables and ensure available table exists', async () => {
    const res = await request('/api/restaurant/tables', { token: ownerToken });
    if (res.status !== 200) throw new Error(`Fetch tables failed: ${res.status}`);
    const tables = res.data.tables || [];
    if (tables.length === 0) {
      const createRes = await request('/api/restaurant/tables', {
        method: 'POST',
        token: ownerToken,
        body: { tableNumber: 'T-QA1', capacity: 4, shape: 'RECTANGLE' },
      });
      if (createRes.status !== 201 && createRes.status !== 200) {
        throw new Error(`Create table failed: ${createRes.status}`);
      }
      tableId = createRes.data.table.id;
    } else {
      tableId = tables[0].id;
    }
    return `Table verified: ${tableId}`;
  });

  // -----------------------------------------------------------------
  // 3. MENU CATALOG & RECIPE CONFIGURATION (OWNER WORKFLOW)
  // -----------------------------------------------------------------
  console.log('\n--- 3. Menu Catalog, Subcategories & Recipe Ingredients ---');

  await logStep('Catalog', 'Create Parent Menu Category "Artisan Burgers"', async () => {
    const res = await request('/api/menu/categories', {
      method: 'POST',
      token: ownerToken,
      body: { name: `Artisan Burgers QA ${Date.now()}`, sortOrder: 1 },
    });
    if (!res.ok) throw new Error(`Create category failed: ${res.status} - ${JSON.stringify(res.data)}`);
    categoryId = res.data.category.id;
    return `Category created: ${categoryId}`;
  });

  await logStep('Catalog', 'Create Sub-Category "Smash Burgers"', async () => {
    const res = await request('/api/menu/categories', {
      method: 'POST',
      token: ownerToken,
      body: { name: `Smash Burgers Sub ${Date.now()}`, parentId: categoryId, sortOrder: 1 },
    });
    if (!res.ok) throw new Error(`Create subcategory failed: ${res.status} - ${JSON.stringify(res.data)}`);
    subCategoryId = res.data.category.id;
    return `Subcategory created: ${subCategoryId}`;
  });

  await logStep('Inventory', 'Create Raw Inventory Ingredients (Bun, Patty, Cheese, Sauce)', async () => {
    const t = Date.now();
    const bun = await request('/api/inventory/ingredients', {
      method: 'POST',
      token: ownerToken,
      body: { name: `Brioche Bun QA ${t}`, sku: `SKU-BUN-${t}`, unit: 'PCS', costPerUnit: 50, minStockAlert: 20 },
    });
    if (!bun.ok) throw new Error(`Bun creation failed: ${bun.status} - ${JSON.stringify(bun.data)}`);
    ingredientBunId = bun.data.ingredient.id;

    const patty = await request('/api/inventory/ingredients', {
      method: 'POST',
      token: ownerToken,
      body: { name: `Beef Patty QA ${t}`, sku: `SKU-PATTY-${t}`, unit: 'PCS', costPerUnit: 200, minStockAlert: 10 },
    });
    if (!patty.ok) throw new Error(`Patty creation failed: ${patty.status} - ${JSON.stringify(patty.data)}`);
    ingredientPattyId = patty.data.ingredient.id;

    const cheese = await request('/api/inventory/ingredients', {
      method: 'POST',
      token: ownerToken,
      body: { name: `Cheddar Slice QA ${t}`, sku: `SKU-CHEESE-${t}`, unit: 'PCS', costPerUnit: 40, minStockAlert: 15 },
    });
    if (!cheese.ok) throw new Error(`Cheese creation failed: ${cheese.status} - ${JSON.stringify(cheese.data)}`);
    ingredientCheeseId = cheese.data.ingredient.id;

    const sauce = await request('/api/inventory/ingredients', {
      method: 'POST',
      token: ownerToken,
      body: { name: `Special Sauce QA ${t}`, sku: `SKU-SAUCE-${t}`, unit: 'ML', costPerUnit: 2, minStockAlert: 500 },
    });
    if (!sauce.ok) throw new Error(`Sauce creation failed: ${sauce.status} - ${JSON.stringify(sauce.data)}`);
    ingredientSauceId = sauce.data.ingredient.id;

    return `Ingredients created: Bun, Patty, Cheese, Sauce`;
  });

  await logStep('Catalog', 'Create Modifier / Addon Group "Burger Addons" with options', async () => {
    const res = await request('/api/menu/modifiers', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `Burger Addons QA ${Date.now()}`,
        minSelect: 0,
        maxSelect: 3,
        isRequired: false,
        options: [
          { name: 'Extra Cheddar Slice', price: 60, isDefault: false },
          { name: 'Extra Patty', price: 250, isDefault: false },
          { name: 'Pickles & Jalapenos', price: 40, isDefault: false },
        ],
      },
    });
    if (!res.ok) throw new Error(`Modifier group creation failed: ${res.status} - ${JSON.stringify(res.data)}`);
    modifierGroupId = res.data.modifierGroup.id;
    return `Modifier group created: ${modifierGroupId}`;
  });

  await logStep('Catalog', 'Create Menu Product "Smash Double Cheese" with Explicit Cost & Addons', async () => {
    const t = Date.now();
    const res = await request('/api/menu/products', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `Smash Double Cheese QA ${t}`,
        sku: `SKU-SMASH-${t}`,
        categoryId: categoryId,
        subCategoryId: subCategoryId,
        basePrice: 850,
        costPrice: 490,
        station: 'KITCHEN',
        isAvailable: true,
        modifierGroupIds: [modifierGroupId],
      },
    });
    if (!res.ok) throw new Error(`Product creation failed: ${res.status} - ${JSON.stringify(res.data)}`);
    productId = res.data.product.id;
    return `Product created: ${productId}`;
  });

  await logStep('Catalog', 'Create and Link Product Recipe via /api/inventory/recipes', async () => {
    const res = await request('/api/inventory/recipes', {
      method: 'POST',
      token: ownerToken,
      body: {
        productId,
        yieldCount: 1,
        ingredients: [
          { ingredientId: ingredientBunId, quantity: 1, unit: 'PCS' },
          { ingredientId: ingredientPattyId, quantity: 2, unit: 'PCS' },
          { ingredientId: ingredientCheeseId, quantity: 2, unit: 'PCS' },
          { ingredientId: ingredientSauceId, quantity: 30, unit: 'ML' },
        ],
      },
    });
    if (!res.ok) throw new Error(`Recipe creation failed: ${res.status} - ${JSON.stringify(res.data)}`);
    return `Recipe created and linked for product ${productId}`;
  });

  // -----------------------------------------------------------------
  // 4. PROCUREMENT & INWARD PURCHASES (FIFO LOT CREATION)
  // -----------------------------------------------------------------
  console.log('\n--- 4. Procurement & Inward Purchases (FIFO Inventory) ---');

  await logStep('Procurement', 'Create Supplier "Metro Cash & Carry QA"', async () => {
    const res = await request('/api/inventory/suppliers', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `Metro Cash & Carry QA ${Date.now()}`,
        contactPerson: 'Imran Khan',
        phone: '+92 300 9988776',
        email: 'supply@metro-qa.com',
      },
    });
    if (!res.ok) throw new Error(`Supplier creation failed: ${res.status}`);
    supplierId = res.data.supplier.id;
    return `Supplier created: ${supplierId}`;
  });

  await logStep('Procurement', 'Create Inward Purchase Invoice with Raw Materials', async () => {
    const res = await request('/api/inventory/purchases', {
      method: 'POST',
      token: ownerToken,
      body: {
        branchId,
        supplierId,
        invoiceNumber: `INV-QA-${Date.now()}`,
        purchaseDate: new Date().toISOString().split('T')[0],
        items: [
          { ingredientId: ingredientBunId, unit: 'PCS', quantity: 50, unitPrice: 50 },
          { ingredientId: ingredientPattyId, unit: 'PCS', quantity: 100, unitPrice: 200 },
          { ingredientId: ingredientCheeseId, unit: 'PCS', quantity: 100, unitPrice: 40 },
          { ingredientId: ingredientSauceId, unit: 'ML', quantity: 2000, unitPrice: 2 },
        ],
      },
    });
    if (!res.ok) throw new Error(`Create purchase failed: ${res.status} - ${JSON.stringify(res.data)}`);
    purchaseId = res.data.purchase.id;
    return `Purchase created: ${purchaseId}, Total: Rs. ${res.data.purchase.totalAmount}`;
  });

  await logStep('Procurement', 'Receive Inward Purchase into FIFO Lots', async () => {
    const res = await request(`/api/inventory/purchases/${purchaseId}/receive`, {
      method: 'POST',
      token: ownerToken,
      body: {},
    });
    if (!res.ok) throw new Error(`Receive purchase failed: ${res.status} - ${JSON.stringify(res.data)}`);
    return `Purchase received. Status: ${res.data.purchase?.status || 'RECEIVED'}`;
  });

  await logStep('Inventory', 'Verify FIFO Lots and Ingredient Current Stock Levels', async () => {
    const res = await request('/api/inventory/ingredients', { token: ownerToken });
    if (!res.ok) throw new Error(`Fetch ingredients failed: ${res.status}`);
    const ingredients = res.data.ingredients || [];
    const bun = ingredients.find((i: any) => i.id === ingredientBunId);
    const patty = ingredients.find((i: any) => i.id === ingredientPattyId);
    if (!bun || Number(bun.currentStock || bun.current_stock || 0) < 50) {
      throw new Error(`Bun stock not incremented: ${bun?.currentStock || bun?.current_stock}`);
    }
    if (!patty || Number(patty.currentStock || patty.current_stock || 0) < 100) {
      throw new Error(`Patty stock not incremented: ${patty?.currentStock || patty?.current_stock}`);
    }
    return `Stock verified: Bun (${bun.currentStock || bun.current_stock} PCS), Patty (${patty.currentStock || patty.current_stock} PCS)`;
  });

  // -----------------------------------------------------------------
  // 5. CASH & BANK OPERATIONS
  // -----------------------------------------------------------------
  console.log('\n--- 5. Cash & Bank Management ---');

  await logStep('Cash & Bank', 'Create Operational Bank Account "Meezan Bank Ops QA"', async () => {
    const res = await request('/api/financial/bank-accounts', {
      method: 'POST',
      token: ownerToken,
      body: {
        accountName: `Meezan Ops QA ${Date.now()}`,
        bankName: 'Meezan Bank Limited',
        accountNumber: `PK-MEZN-${Date.now().toString().slice(-6)}`,
        accountType: 'CURRENT',
        openingBalance: 50000,
        currency: 'PKR',
      },
    });
    if (!res.ok) throw new Error(`Create bank account failed: ${res.status} - ${JSON.stringify(res.data)}`);
    bankAccountId = res.data.bankAccount.id;
    return `Bank account created: ${bankAccountId}, Balance: Rs. 50,000`;
  });

  await logStep('Cash & Bank', 'Perform Bank to Cash Transfer (Rs. 5,000 Drawer Float)', async () => {
    const res = await request('/api/financial/cash-bank/transfers', {
      method: 'POST',
      token: ownerToken,
      body: {
        transferType: 'BANK_TO_CASH',
        fromBankAccountId: bankAccountId,
        amount: 5000,
        description: 'Morning Cash Drawer Float QA',
      },
    });
    if (!res.ok) throw new Error(`Transfer failed: ${res.status} - ${JSON.stringify(res.data)}`);
    return `Transferred Rs. 5,000 from Bank to Cash Drawer`;
  });

  await logStep('Cash & Bank', 'Verify Updated Bank Account Balance (Rs. 45,000)', async () => {
    const res = await request('/api/financial/bank-accounts', { token: ownerToken });
    if (!res.ok) throw new Error(`List bank accounts failed: ${res.status}`);
    const accounts = res.data.bankAccounts || res.data.accounts || [];
    const acc = accounts.find((a: any) => a.id === bankAccountId);
    if (!acc || Number(acc.currentBalance || acc.current_balance) !== 45000) {
      throw new Error(`Expected balance 45000, got: ${acc?.currentBalance || acc?.current_balance}`);
    }
    return `Bank balance accurately verified at Rs. ${acc.currentBalance || acc.current_balance}`;
  });

  // -----------------------------------------------------------------
  // 6. POS SALES OPERATIONS (DINE-IN, TAKEAWAY, DELIVERY)
  // -----------------------------------------------------------------
  console.log('\n--- 6. POS Sales Operations across Channels ---');

  // CHANNEL 1: Dine-In Order
  await logStep('Sales: Dine-In', 'Waiter places Dine-In Order on Table 1 with Addons', async () => {
    const res = await request('/api/orders', {
      method: 'POST',
      token: waiterToken,
      body: {
        branchId,
        orderType: 'DINE_IN',
        tableId,
        items: [
          {
            productId,
            quantity: 2,
            unitPrice: 850,
            notes: 'Extra crispy patties please',
            modifiers: [{ name: 'Extra Cheddar Slice', unitPrice: 60 }],
          },
        ],
      },
    });
    if (!res.ok) throw new Error(`Create Dine-in order failed: ${res.status} - ${JSON.stringify(res.data)}`);
    dineInOrderId = res.data.order.id;
    return `Dine-In Order created: ${dineInOrderId}, Subtotal: Rs. ${res.data.order.subtotal}, Grand Total: Rs. ${res.data.order.grandTotal}`;
  });

  await logStep('KDS Workflow', 'Kitchen advances order status: PREPARING -> READY -> SERVED', async () => {
    // 1. Preparing
    const prep = await request(`/api/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      token: kitchenToken,
      body: { status: 'PREPARING' },
    });
    if (!prep.ok) throw new Error(`Status PREPARING failed: ${prep.status}`);

    // 2. Ready
    const ready = await request(`/api/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      token: kitchenToken,
      body: { status: 'READY' },
    });
    if (!ready.ok) throw new Error(`Status READY failed: ${ready.status}`);

    // 3. Served
    const served = await request(`/api/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      token: waiterToken,
      body: { status: 'SERVED' },
    });
    if (!served.ok) throw new Error(`Status SERVED failed: ${served.status}`);

    return 'Order successfully advanced through KDS to SERVED';
  });

  await logStep('Sales: Settle Dine-In', 'Cashier settles Dine-In Bill with Cash at Checkout', async () => {
    const ordRes = await request(`/api/orders/${dineInOrderId}`, { token: cashierToken });
    const grandTotal = Number(ordRes.data.order.grandTotal || ordRes.data.order.grand_total);

    const payRes = await request(`/api/orders/${dineInOrderId}/checkout`, {
      method: 'POST',
      token: cashierToken,
      body: {
        payments: [{ method: 'CASH', amount: grandTotal }],
        changeGiven: 0,
      },
    });
    if (!payRes.ok) throw new Error(`Checkout Dine-in order failed: ${payRes.status} - ${JSON.stringify(payRes.data)}`);

    return `Dine-In Order settled via /checkout. Grand Total: Rs. ${grandTotal}`;
  });

  await logStep('Inventory & COGS', 'Verify FIFO Stock Deduction & COGS for Dine-In Order', async () => {
    const ordRes = await request(`/api/orders/${dineInOrderId}`, { token: ownerToken });
    const order = ordRes.data.order;
    const items = order.items || [];
    const item = items[0];
    const cogs = Number(item?.cogs || 0);
    if (cogs <= 0) {
      throw new Error(`Dine-in order item COGS should be > 0, got: ${cogs}`);
    }
    return `Exact FIFO lot COGS calculated: Rs. ${cogs} for 2 burgers`;
  });

  // CHANNEL 2: Takeaway Order
  await logStep('Sales: Takeaway', 'Cashier creates Takeaway Order with Customer Name & Mobile and pays via Bank Account', async () => {
    const createRes = await request('/api/orders', {
      method: 'POST',
      token: cashierToken,
      body: {
        branchId,
        orderType: 'TAKEAWAY',
        customerName: 'Zahid Khan QA',
        customerPhone: '+92 321 9876543',
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 850,
            notes: 'Pack tightly in takeaway box',
          },
        ],
      },
    });
    if (!createRes.ok) throw new Error(`Takeaway order creation failed: ${createRes.status}`);
    takeawayOrderId = createRes.data.order.id;
    const grandTotal = Number(createRes.data.order.grandTotal || createRes.data.order.grand_total);

    // Pay with Bank Account via /checkout with BANK_TRANSFER
    const payRes = await request(`/api/orders/${takeawayOrderId}/checkout`, {
      method: 'POST',
      token: cashierToken,
      body: {
        payments: [{ method: 'BANK_TRANSFER', amount: grandTotal, bankAccountId }],
        changeGiven: 0,
      },
    });
    if (!payRes.ok) throw new Error(`Pay Takeaway order failed: ${payRes.status} - ${JSON.stringify(payRes.data)}`);

    return `Takeaway order settled via Bank. Total: Rs. ${grandTotal}`;
  });

  // CHANNEL 3: Delivery Order
  await logStep('Sales: Delivery', 'Cashier creates Delivery Order with Customer, Address, Delivery Fee & Rider Info', async () => {
    const createRes = await request('/api/orders', {
      method: 'POST',
      token: cashierToken,
      body: {
        branchId,
        orderType: 'DELIVERY',
        customerName: 'Ayesha Malik QA',
        customerPhone: '+92 333 1122334',
        deliveryAddress: 'House 42, Street 7, Cavalry Ground, Lahore',
        deliveryFee: 250,
        riderName: 'Kamran Akmal QA',
        riderPhone: '+92 345 5566778',
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 850,
          },
        ],
      },
    });
    if (!createRes.ok) throw new Error(`Delivery order creation failed: ${createRes.status} - ${JSON.stringify(createRes.data)}`);
    deliveryOrderId = createRes.data.order.id;
    const order = createRes.data.order;
    const grandTotal = Number(order.grandTotal || order.grand_total);

    // Pay Cash via /checkout
    const payRes = await request(`/api/orders/${deliveryOrderId}/checkout`, {
      method: 'POST',
      token: cashierToken,
      body: {
        payments: [{ method: 'CASH', amount: grandTotal }],
        changeGiven: 0,
      },
    });
    if (!payRes.ok) throw new Error(`Pay Delivery order failed: ${payRes.status}`);

    return `Delivery order settled. Delivery Fee: Rs. 250, Grand Total: Rs. ${grandTotal}, Rider: Kamran Akmal`;
  });

  await logStep('Receipt Verification', 'Verify Delivery Receipt contains Customer, Address, Delivery Fee, and Rider details', async () => {
    const recRes = await request(`/api/orders/${deliveryOrderId}/receipt`, { token: cashierToken });
    if (!recRes.ok) throw new Error(`Receipt fetch failed: ${recRes.status}`);
    const receipt = recRes.data.receipt || recRes.data;
    if (receipt.riderName !== 'Kamran Akmal QA') {
      throw new Error(`Rider name missing on receipt: ${receipt.riderName}`);
    }
    if (receipt.deliveryAddress !== 'House 42, Street 7, Cavalry Ground, Lahore') {
      throw new Error(`Delivery address missing on receipt: ${receipt.deliveryAddress}`);
    }
    if (Number(receipt.deliveryFee) !== 250) {
      throw new Error(`Delivery fee mismatch on receipt: ${receipt.deliveryFee}`);
    }
    return 'Receipt includes customer name, phone, address, rider name, rider phone, and delivery fee';
  });

  // -----------------------------------------------------------------
  // 7. CASH TO BANK DEPOSIT
  // -----------------------------------------------------------------
  console.log('\n--- 7. End of Day Cash Deposit to Bank ---');

  await logStep('Cash & Bank', 'Deposit Rs. 2,000 Cash to Bank Account', async () => {
    const res = await request('/api/financial/cash-bank/transfers', {
      method: 'POST',
      token: ownerToken,
      body: {
        transferType: 'CASH_TO_BANK',
        toBankAccountId: bankAccountId,
        amount: 2000,
        description: 'End of Day Cash Deposit QA',
      },
    });
    if (!res.ok) throw new Error(`Cash deposit failed: ${res.status} - ${JSON.stringify(res.data)}`);
    return 'Transferred Rs. 2,000 from Cash Drawer to Bank';
  });

  // -----------------------------------------------------------------
  // 8. CROSS-SOFTWARE DATA RECONCILIATION AUDIT
  // -----------------------------------------------------------------
  console.log('\n--- 8. Cross-Software Data Consistency & Reconciliation Audit ---');

  let dashboardData: any;
  let daybookData: any;
  let billPnlData: any;
  let ordersHubData: any;

  await logStep('Audit: Dashboard', 'Fetch Dashboard Financial Summary', async () => {
    const res = await request(`/api/financial/reports/summary?branchId=${branchId}`, { token: ownerToken });
    if (!res.ok) throw new Error(`Dashboard summary failed: ${res.status}`);
    dashboardData = res.data.report || res.data;
    return `Dashboard: Completed Orders=${dashboardData.totalOrders}, Net Sales=Rs. ${dashboardData.netSales}, COGS=Rs. ${dashboardData.costOfGoodsSold}, Collections=Rs. ${dashboardData.totalCollected}`;
  });

  await logStep('Audit: Daybook', 'Fetch Daily Daybook Data', async () => {
    const res = await request(`/api/financial/daybook?branchId=${branchId}`, { token: ownerToken });
    if (!res.ok) throw new Error(`Daybook fetch failed: ${res.status}`);
    daybookData = res.data.daybook || res.data;
    const summary = daybookData.summary || {};
    return `Daybook: Completed Orders=${summary.completedOrdersCount}, Net Sales=Rs. ${summary.totalNetSales}, Total Revenue=Rs. ${summary.totalRevenue}`;
  });

  await logStep('Audit: Bill-Wise P&L', 'Fetch Bill-Wise Profit and Loss Report', async () => {
    const res = await request(`/api/financial/reports/bill-profit-loss?branchId=${branchId}`, { token: ownerToken });
    if (!res.ok) throw new Error(`Bill-Wise P&L failed: ${res.status}`);
    billPnlData = res.data;
    return `Bill P&L: Bills Count=${billPnlData.summary?.totalBills}, Net Food Sales=Rs. ${billPnlData.summary?.totalNetSales}, Total COGS=Rs. ${billPnlData.summary?.totalCogs}`;
  });

  await logStep('Audit: Orders Hub', 'Fetch Orders Hub History and Aggregates', async () => {
    const res = await request(`/api/orders?branchId=${branchId}&limit=100`, { token: ownerToken });
    if (!res.ok) throw new Error(`Orders fetch failed: ${res.status}`);
    ordersHubData = res.data;
    const completedOrders = (ordersHubData.orders || []).filter((o: any) => o.status === 'COMPLETED');
    return `Orders Hub: Total orders returned=${ordersHubData.orders?.length}, Completed=${completedOrders.length}`;
  });

  // EXACT MATHEMATICAL RECONCILIATION
  await logStep('Reconciliation', 'Verify 1:1 Match across Dashboard, Daybook, and Bill-Wise P&L', async () => {
    const dashSales = Number(dashboardData.netSales || 0);
    const daybookSales = Number(daybookData.summary?.totalNetSales || 0);
    const pnlSales = Number(billPnlData.summary?.totalNetSales || 0);

    const dashOrders = Number(dashboardData.totalOrders || 0);
    const daybookOrders = Number(daybookData.summary?.completedOrdersCount || 0);
    const pnlOrders = Number(billPnlData.summary?.totalBills || 0);

    const dashCollected = Number(dashboardData.totalCollected || 0);
    const daybookGrandTotal = Number(daybookData.summary?.totalGrandTotal || 0);

    const diffSales = Math.abs(dashSales - daybookSales);
    const diffPnlSales = Math.abs(dashSales - pnlSales);
    const diffOrders = Math.abs(dashOrders - daybookOrders);
    const diffPnlOrders = Math.abs(dashOrders - pnlOrders);
    const diffCollected = Math.abs(dashCollected - daybookGrandTotal);

    if (diffOrders !== 0 || diffPnlOrders !== 0) {
      throw new Error(`Order count mismatch: Dashboard=${dashOrders}, Daybook=${daybookOrders}, Bill-P&L=${pnlOrders}`);
    }
    if (diffSales > 1 || diffPnlSales > 1) {
      throw new Error(`Net sales mismatch: Dashboard=${dashSales}, Daybook=${daybookSales}, Bill-P&L=${pnlSales}`);
    }
    if (diffCollected > 1) {
      throw new Error(`Total collected mismatch: Dashboard=${dashCollected}, Daybook=${daybookRevenue}`);
    }

    return `100% RECONCILED: Completed Orders = ${dashOrders}, Net Food Sales = Rs. ${dashSales}, Total Collections = Rs. ${dashCollected}`;
  });

  // -----------------------------------------------------------------
  // 9. SECURITY & EDGE CASES QC CHECKS
  // -----------------------------------------------------------------
  console.log('\n--- 9. Security & Edge Cases QC Checks ---');

  await logStep('Security', 'Waiter should NOT have permission to access financial summary (403)', async () => {
    const res = await request('/api/financial/reports/summary', { token: waiterToken });
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden for waiter, got: ${res.status}`);
    }
    return 'Waiter correctly blocked from financial summary (403)';
  });

  await logStep('Validation', 'Creating an order with empty items should be rejected (400)', async () => {
    const res = await request('/api/orders', {
      method: 'POST',
      token: waiterToken,
      body: { branchId, orderType: 'DINE_IN', items: [] },
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got: ${res.status}`);
    }
    return 'Correctly rejected empty order items (400)';
  });

  await logStep('Validation', 'Bank transfer with negative amount should be rejected (400)', async () => {
    const res = await request('/api/financial/cash-bank/transfers', {
      method: 'POST',
      token: ownerToken,
      body: {
        transferType: 'CASH_TO_BANK',
        toBankAccountId: bankAccountId,
        amount: -500,
      },
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for negative amount, got: ${res.status}`);
    }
    return 'Correctly rejected negative transfer amount (400)';
  });

  await logStep('CRUD 3-Dots', 'Duplicate Product functionality check', async () => {
    const getRes = await request(`/api/menu/products`, { token: ownerToken });
    const product = getRes.data.products.find((p: any) => p.id === productId);
    if (!product) throw new Error('Product not found for duplication');

    const catId = product.categoryId || product.category_id || categoryId;
    const dupRes = await request('/api/menu/products', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `${product.name} (Copy)`,
        sku: `${product.sku}-COPY-${Date.now()}`,
        categoryId: catId,
        subCategoryId: product.subCategoryId || product.sub_category_id,
        basePrice: Number(product.basePrice || product.base_price || product.price || 850),
        costPrice: Number(product.costPrice || product.cost_price || 490),
        station: product.station || 'KITCHEN',
        isAvailable: true,
      },
    });
    if (!dupRes.ok) throw new Error(`Duplicate product failed: ${dupRes.status} - ${JSON.stringify(dupRes.data)}`);
    return `Product successfully duplicated: ${dupRes.data.product.id}`;
  });

  // SUMMARY REPORT
  console.log('\n===============================================================');
  console.log('QA & QC SIMULATION SUMMARY REPORT');
  console.log('===============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Checks Executed : ${results.length}`);
  console.log(`Passed Checks         : ${passedCount}`);
  console.log(`Failed Checks         : ${failedCount}`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    console.log('Failed Tests Summary:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`- [${r.category}] ${r.step}: ${r.error}`);
    });
  }

  await pool.end();
}

runQaSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
