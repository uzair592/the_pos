import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { pool, query, withTransaction } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { seedDemoRestaurant } from '../src/db/seed_demo_restaurant.js';
import { getConcurrentDeviceSummary, revokeDeviceSession } from '../src/services/deviceService.js';
import { SystemRole, Permission, OrderType } from '@pos/shared';

describe('Online-Only SaaS POS Architecture, Multi-Device Access & Concurrent Session Limits', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let cashierToken: string;
  let waiterToken: string;
  let kitchenToken: string;
  let managerToken: string;

  let tenantId: string;
  let branchId: string;
  let secondBranchId: string;
  let secondTenantId: string;
  let secondTenantOwnerToken: string;

  let testTableId: string;
  let testCategoryId: string;
  let testProductId: string;
  let testIngredientId: string;
  let testSupplierId: string;
  let createdOrderId: string;

  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();
    await seedDemoRestaurant();
    app = buildApp();
    await app.ready();

    // 1. Authenticate Restaurant Owner
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'owner@lahorekarahi.com',
        password: 'Password123!',
        deviceFingerprint: 'dev-owner-desktop-1',
        deviceName: 'Manager Computer',
      },
    });
    expect(ownerLogin.statusCode).toBe(200);
    const ownerData = ownerLogin.json();
    ownerToken = ownerData.token;
    tenantId = ownerData.user.tenantId;
    branchId = ownerData.user.branchId;

    // Fetch branches
    const { rows: branchRows } = await query(
      'SELECT id FROM branches WHERE tenant_id = $1 ORDER BY created_at ASC',
      [tenantId],
      { tenantId }
    );
    branchId = branchRows[0]?.id;
    if (branchRows.length > 1) {
      secondBranchId = branchRows[1].id;
    } else {
      const { rows: newB } = await query(
        `INSERT INTO branches (tenant_id, name, code, phone, address, city, is_main_branch, is_active)
         VALUES ($1, 'DHA Phase 6 Branch', 'DHA6', '03001234567', 'DHA Phase 6, Lahore', 'Lahore', false, true) RETURNING id`,
        [tenantId],
        { tenantId }
      );
      secondBranchId = newB[0].id;
    }

    // 2. Set max concurrent devices to 4 for this tenant
    await query(
      'UPDATE tenants SET max_concurrent_devices = 4 WHERE id = $1',
      [tenantId],
      { tenantId }
    );

    // Clean up active device sessions for this test tenant to start fresh
    await query(
      "DELETE FROM active_device_sessions WHERE tenant_id = $1",
      [tenantId],
      { tenantId }
    );

    // 3. Create a second isolated tenant for Tenant Isolation tests
    const secondTenantRes = await query(
      `INSERT INTO tenants (name, legal_name, owner_name, email, phone, currency, business_type, is_active, is_onboarded)
       VALUES ('Karachi Biryani Express', 'KB Express Ltd', 'Karachi Owner', 'owner@kbiryani.com', '03001112233', 'PKR', 'FINE_DINING', true, true)
       RETURNING id`,
      [],
      { isSuperAdmin: true }
    );
    secondTenantId = secondTenantRes.rows[0].id;

    const secondBranchRes = await query(
      `INSERT INTO branches (tenant_id, name, code, phone, address, city, is_main_branch, is_active)
       VALUES ($1, 'Clifton Main', 'CLIFTON', '03009988776', 'Clifton Block 2, Karachi', 'Karachi', true, true)
       RETURNING id`,
      [secondTenantId],
      { isSuperAdmin: true }
    );
    const secondBranch = secondBranchRes.rows[0].id;

    const secondHash = await bcrypt.hash('Password123!', 10);
    await query(
      `INSERT INTO users (tenant_id, branch_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, 'owner@kbiryani.com', $3, 'Karachi Owner', 'RESTAURANT_OWNER', true)`,
      [secondTenantId, secondBranch, secondHash],
      { isSuperAdmin: true }
    );

    const secondLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'owner@kbiryani.com',
        password: 'Password123!',
        deviceFingerprint: 'dev-second-tenant-pc',
        deviceName: 'KB Terminal 1',
      },
    });
    expect(secondLogin.statusCode).toBe(200);
    secondTenantOwnerToken = secondLogin.json().token;

    // 4. Seed operational entities in Lahore Karahi via REST API
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Online SaaS Specials' },
    });
    expect(catRes.statusCode).toBe(201);
    testCategoryId = catRes.json().category.id;

    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Cloud Burger Deluxe',
        sku: `CBD-${Date.now()}`,
        categoryId: testCategoryId,
        basePrice: 650,
        costPrice: 320,
        station: 'KITCHEN',
        isAvailable: true,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    testProductId = prodRes.json().product.id;

    const ingRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/ingredients',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Fresh Cloud Bun',
        sku: `ING-BUN-${Date.now()}`,
        category: 'BAKERY',
        baseUnit: 'PIECE',
        purchaseUnit: 'PIECE',
        conversionFactor: 1,
        costPerUnit: 30,
        currentStock: 50,
        minimumStock: 10,
      },
    });
    expect(ingRes.statusCode).toBe(201);
    testIngredientId = ingRes.json().ingredient.id;

    const { rows: floorRows } = await query(
      `INSERT INTO floors (tenant_id, branch_id, name, sort_order)
       VALUES ($1, $2, 'Main Dining Hall', 1) RETURNING id`,
      [tenantId, branchId],
      { tenantId }
    );
    const floorId = floorRows[0].id;

    const tblRes = await app.inject({
      method: 'POST',
      url: '/api/restaurant/tables',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        floorId,
        tableNumber: `ONLINE-${Date.now()}`,
        capacity: 4,
        shape: 'RECTANGLE',
      },
    });
    if (tblRes.statusCode !== 201) console.log('TBL ERROR:', tblRes.json());
    expect(tblRes.statusCode).toBe(201);
    testTableId = tblRes.json().table.id;

    const supRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/suppliers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Online Test Supplier Co',
        contactPerson: 'Supplier Rep',
        phone: '03009998877',
      },
    });
    expect(supRes.statusCode).toBe(201);
    testSupplierId = supRes.json().supplier.id;
  });

  afterAll(async () => {
    if (secondTenantId) {
      await withTransaction(async (client) => {
        await client.query('DELETE FROM tenants WHERE id = $1', [secondTenantId]);
      }, { isSuperAdmin: true }).catch(() => {});
    }
    await app.close();
  });

  // =========================================================================
  // 1. ONLINE AUTHENTICATION & SESSION MANAGEMENT
  // =========================================================================
  describe('1. Online Authentication & Session Lifecycle', () => {
    it('rejects login with invalid credentials with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'IncorrectPassword999!',
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toMatch(/Invalid email or password/i);
    });

    it('blocks access to protected endpoints without authentication token (401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders',
      });
      expect(res.statusCode).toBe(401);
    });

    it('enforces RBAC permissions: Waiter cannot access financial reports (403)', async () => {
      const waiterLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'waiter@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'dev-waiter-tablet-rbac',
          deviceName: 'Waiter Tablet',
        },
      });
      expect(waiterLogin.statusCode).toBe(200);
      waiterToken = waiterLogin.json().token;

      const res = await app.inject({
        method: 'GET',
        url: '/api/financial/reports/summary',
        headers: { Authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('strictly isolates tenant data: Tenant A user cannot view Tenant B menu or orders', async () => {
      // Second tenant owner attempts to query first tenant's product
      const res = await app.inject({
        method: 'GET',
        url: `/api/menu/products/${testProductId}`,
        headers: { Authorization: `Bearer ${secondTenantOwnerToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('logs out and marks active device session as OFFLINE', async () => {
      // Connect cashier
      const cashierLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'cashier@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'dev-cashier-pos-1',
          deviceName: 'POS Terminal 1',
        },
      });
      expect(cashierLogin.statusCode).toBe(200);
      const cashierData = cashierLogin.json();
      cashierToken = cashierData.token;
      const sessionId = cashierData.sessionId;

      // Verify session is ONLINE
      const { rows: before } = await query(
        'SELECT status FROM active_device_sessions WHERE id = $1',
        [sessionId],
        { tenantId }
      );
      expect(before[0].status).toBe('ONLINE');

      // Cashier logs out
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { Authorization: `Bearer ${cashierToken}` },
        payload: { sessionId, deviceFingerprint: 'dev-cashier-pos-1' },
      });
      expect(logoutRes.statusCode).toBe(200);

      // Verify session is now OFFLINE in central PostgreSQL
      const { rows: after } = await query(
        'SELECT status FROM active_device_sessions WHERE id = $1',
        [sessionId],
        { tenantId }
      );
      expect(after[0].status).toBe('OFFLINE');
    });
  });

  // =========================================================================
  // 2. CONCURRENT DEVICE SESSION LIMITS
  // =========================================================================
  describe('2. Concurrent Device Session Limits (Max 4 Configured)', () => {
    beforeAll(async () => {
      await query('DELETE FROM active_device_sessions WHERE tenant_id = $1', [tenantId], { tenantId });
    });

    it('connects 4 concurrent devices and reports 4/4 connected sessions', async () => {
      // Connect Device 1 (POS Terminal 1)
      const d1 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'fp-device-1-pos1',
          deviceName: 'Desktop Computer 1 (POS)',
        },
      });
      expect(d1.statusCode).toBe(200);

      // Connect Device 2 (POS Terminal 2)
      const d2 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'fp-device-2-pos2',
          deviceName: 'Desktop Computer 2 (POS)',
        },
      });
      expect(d2.statusCode).toBe(200);

      // Connect Device 3 (Waiter Tablet)
      const d3 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'fp-device-3-tablet',
          deviceName: 'Waiter Tablet',
        },
      });
      expect(d3.statusCode).toBe(200);

      // Connect Device 4 (Kitchen Display Screen)
      const d4 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'fp-device-4-kds',
          deviceName: 'Kitchen Display Screen',
        },
      });
      expect(d4.statusCode).toBe(200);

      // Verify summary shows 4/4 Connected
      const summary = await getConcurrentDeviceSummary(tenantId);
      expect(summary.connectedCount).toBe(4);
      expect(summary.maxConcurrentLimit).toBe(4);
      expect(summary.isLimitReached).toBe(true);
      expect(summary.statusBadge).toBe('4 / 4 Devices Connected');
    });

    it('rejects 5th device attempt with 403 CONCURRENT_LIMIT_REACHED', async () => {
      const d5 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'fp-device-5-laptop',
          deviceName: 'Manager Laptop',
        },
      });

      expect(d5.statusCode).toBe(403);
      const errData = d5.json();
      expect(errData.code).toBe('CONCURRENT_LIMIT_REACHED');
      expect(errData.connectedCount).toBe(4);
      expect(errData.maxLimit).toBe(4);
      expect(errData.error).toMatch(/maximum concurrent device limit has been reached/i);
    });

    it('allows browser refresh / re-login from an already active device without consuming an extra slot', async () => {
      // Re-login Device 2 (browser refresh)
      const d2Refresh = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'fp-device-2-pos2',
          deviceName: 'Desktop Computer 2 (POS)',
        },
      });

      expect(d2Refresh.statusCode).toBe(200);
      const summary = await getConcurrentDeviceSummary(tenantId);
      expect(summary.connectedCount).toBe(4); // Stays at 4, doesn't increment!
    });

    it('logs out Device 1, freeing a session, allowing Device 5 to log in successfully', async () => {
      // 1. Device 1 logs out
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: { deviceFingerprint: 'fp-device-1-pos1' },
      });
      expect(logoutRes.statusCode).toBe(200);

      // Verify count drops to 3/4
      const summaryBefore = await getConcurrentDeviceSummary(tenantId);
      expect(summaryBefore.connectedCount).toBe(3);
      expect(summaryBefore.isLimitReached).toBe(false);

      // 2. Now Device 5 attempts login again -> SUCCESS!
      const d5 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'owner@lahorekarahi.com',
          password: 'Password123!',
          deviceFingerprint: 'fp-device-5-laptop',
          deviceName: 'Manager Laptop',
        },
      });

      expect(d5.statusCode).toBe(200);
      const summaryAfter = await getConcurrentDeviceSummary(tenantId);
      expect(summaryAfter.connectedCount).toBe(4);
      expect(summaryAfter.isLimitReached).toBe(true);
    });

    it('supports 1-click session revocation to force-logout an idle device', async () => {
      const summary = await getConcurrentDeviceSummary(tenantId);
      const sessionToRevoke = summary.activeSessions[0];
      expect(sessionToRevoke).toBeDefined();

      // Revoke session
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/api/auth/revoke-session',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: { sessionId: sessionToRevoke.id },
      });
      expect(revokeRes.statusCode).toBe(200);

      // Verify slot freed
      const updatedSummary = await getConcurrentDeviceSummary(tenantId);
      expect(updatedSummary.connectedCount).toBe(3);
      expect(updatedSummary.isLimitReached).toBe(false);
    });
  });

  // =========================================================================
  // 3. MULTI-DEVICE ONLINE WORKFLOW & REAL-TIME SYNCHRONIZATION
  // =========================================================================
  describe('3. Multi-Device Real-Time Online Workflow', () => {
    it('POS Terminal creates order -> appears on Manager Dashboard, Orders Hub and KDS via sync_events', async () => {
      const orderPayload = {
        branchId,
        orderType: OrderType.DINE_IN,
        tableId: testTableId,
        customerName: 'Ahmad Khan',
        customerPhone: '03001234567',
        idempotencyKey: `online-order-${Date.now()}`,
        items: [
          {
            productId: testProductId,
            quantity: 2,
            unitPrice: 650,
            notes: 'Extra crispy',
          },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: orderPayload,
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.order).toBeDefined();
      createdOrderId = data.order.id;

      // 1. Verify visible on Orders Hub
      const ordersRes = await app.inject({
        method: 'GET',
        url: `/api/orders?branchId=${branchId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(ordersRes.statusCode).toBe(200);
      const orderInList = ordersRes.json().orders.find((o: any) => o.id === createdOrderId);
      expect(orderInList).toBeDefined();
      expect(orderInList.customer_name).toBe('Ahmad Khan');

      // 2. Verify sync_events table has broadcasted the ORDER_CREATED event for multi-device clients
      const syncRes = await app.inject({
        method: 'GET',
        url: `/api/sync/events?branchId=${branchId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(syncRes.statusCode).toBe(200);
      const events = syncRes.json().events || [];
      const orderEvent = events.find((e: any) => e.entity_id === createdOrderId);
      expect(orderEvent).toBeDefined();
      expect(orderEvent.event_type).toBe('ORDER_CREATED');

      // 3. Verify KOT appears in Kitchen Display (KDS)
      const kdsRes = await app.inject({
        method: 'GET',
        url: `/api/kds/tickets?branchId=${branchId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(kdsRes.statusCode).toBe(200);
      const tickets = kdsRes.json().tickets || [];
      const kotTicket = tickets.find((t: any) => t.order_id === createdOrderId);
      expect(kotTicket).toBeDefined();
      expect(kotTicket.status).toBe('PENDING');
    });

    it('Kitchen staff updates KDS status -> synchronized across connected devices', async () => {
      // Fetch KOT ticket for the order
      const kdsRes = await app.inject({
        method: 'GET',
        url: `/api/kds/tickets?branchId=${branchId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const ticket = kdsRes.json().tickets.find((t: any) => t.order_id === createdOrderId);
      expect(ticket).toBeDefined();

      // Kitchen advances status: PENDING -> PREPARING
      const prepRes = await app.inject({
        method: 'PUT',
        url: `/api/kds/tickets/${ticket.id}/status`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: { status: 'PREPARING' },
      });
      expect(prepRes.statusCode).toBe(200);

      // Verify order status on central server is PREPARING
      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/orders/${createdOrderId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.json().order.status).toBe('PREPARING');

      // Kitchen marks READY -> SERVED
      await app.inject({
        method: 'PUT',
        url: `/api/kds/tickets/${ticket.id}/status`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: { status: 'SERVED' },
      });

      const servedCheck = await app.inject({
        method: 'GET',
        url: `/api/orders/${createdOrderId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(servedCheck.json().order.status).toBe('SERVED');
    });

    it('Updating inventory via inward purchase updates stock in PostgreSQL and across devices', async () => {
      const initialStockRes = await app.inject({
        method: 'GET',
        url: `/api/inventory/ingredients?branchId=${branchId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const initialItem = initialStockRes.json().ingredients.find((i: any) => i.id === testIngredientId);
      const initialStock = Number(initialItem.current_stock);

      // Submit inward purchase of 100 buns with receiveNow: true
      const purchaseRes = await app.inject({
        method: 'POST',
        url: '/api/inventory/purchases',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          supplierId: testSupplierId,
          invoiceNumber: `INV-PUR-${Date.now()}`,
          receiveNow: true,
          items: [
            {
              ingredientId: testIngredientId,
              unit: 'PIECE',
              purchaseUnit: 'PIECE',
              conversionFactor: 1,
              quantity: 100,
              unitPrice: 35,
            },
          ],
        },
      });
      expect(purchaseRes.statusCode).toBe(201);

      // Verify stock in database and API
      const updatedStockRes = await app.inject({
        method: 'GET',
        url: `/api/inventory/ingredients?branchId=${branchId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const updatedItem = updatedStockRes.json().ingredients.find((i: any) => i.id === testIngredientId);
      expect(Number(updatedItem.current_stock)).toBe(initialStock + 100);
    });

    it('Changing menu availability is reflected across POS terminals', async () => {
      // Toggle product unavailable
      const toggleRes = await app.inject({
        method: 'PUT',
        url: `/api/menu/products/${testProductId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: { isAvailable: false },
      });
      expect(toggleRes.statusCode).toBe(200);

      // Verify POS catalog reflects unavailable
      const catalogRes = await app.inject({
        method: 'GET',
        url: '/api/menu/products',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const prod = catalogRes.json().products.find((p: any) => p.id === testProductId);
      expect(prod.is_available).toBe(false);

      // Restore availability
      await app.inject({
        method: 'PUT',
        url: `/api/menu/products/${testProductId}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: { isAvailable: true },
      });
    });
  });

  // =========================================================================
  // 4. API RELIABILITY, IDEMPOTENCY & TRANSACTION INTEGRITY
  // =========================================================================
  describe('4. Server Reliability, Idempotency & ACID Integrity', () => {
    it('idempotency key prevents duplicate orders on retried submissions', async () => {
      const fixedKey = `idem-test-key-${Date.now()}`;
      const payload = {
        branchId,
        orderType: OrderType.TAKEAWAY,
        customerName: 'Idempotency Tester',
        idempotencyKey: fixedKey,
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 650,
          },
        ],
      };

      // First submission
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload,
      });
      expect(res1.statusCode).toBe(201);
      const order1Id = res1.json().order.id;

      // Second submission with exact same idempotencyKey (network retry simulation)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload,
      });
      expect(res2.statusCode).toBe(200);
      const order2Id = res2.json().order.id;

      // Must be the exact same order, NOT a duplicate order
      expect(order2Id).toBe(order1Id);

      // Confirm only 1 order exists with this idempotency key in DB
      const { rows } = await query(
        'SELECT COUNT(*)::int as count FROM orders WHERE idempotency_key = $1',
        [fixedKey],
        { tenantId }
      );
      expect(rows[0].count).toBe(1);
    });

    it('rolls back database transaction cleanly when order creation encounters invalid items (ACID)', async () => {
      const { rows: countBefore } = await query(
        'SELECT COUNT(*)::int as count FROM orders WHERE tenant_id = $1',
        [tenantId],
        { tenantId }
      );

      // Attempt order with non-existent product ID
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          orderType: OrderType.TAKEAWAY,
          items: [
            {
              productId: '00000000-0000-0000-0000-000000000000',
              quantity: 1,
              unitPrice: 500,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);

      // Verify no phantom records left in database
      const { rows: countAfter } = await query(
        'SELECT COUNT(*)::int as count FROM orders WHERE tenant_id = $1',
        [tenantId],
        { tenantId }
      );
      expect(countAfter[0].count).toBe(countBefore[0].count);
    });

    it('cashier completes order checkout -> verifies payment saved and table released in central database', async () => {
      // Query order grand total
      const { rows: ordRows } = await query(
        'SELECT grand_total FROM orders WHERE id = $1',
        [createdOrderId],
        { tenantId }
      );
      const totalToPay = Math.ceil(Number(ordRows[0].grand_total));

      // Settle the served order from earlier test
      const checkoutRes = await app.inject({
        method: 'POST',
        url: `/api/orders/${createdOrderId}/checkout`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: {
          payments: [
            {
              method: 'CASH',
              amount: totalToPay,
            },
          ],
          changeGiven: 0,
        },
      });

      expect(checkoutRes.statusCode).toBe(200);

      // Direct DB verification
      const { rows: orderRows } = await query(
        'SELECT payment_status, status FROM orders WHERE id = $1',
        [createdOrderId],
        { tenantId }
      );
      expect(orderRows[0].payment_status).toBe('PAID');

      // Table must be released back to AVAILABLE
      const { rows: tableRows } = await query(
        'SELECT status FROM restaurant_tables WHERE id = $1',
        [testTableId],
        { tenantId }
      );
      expect(tableRows[0].status).toBe('AVAILABLE');
    });
  });
});
