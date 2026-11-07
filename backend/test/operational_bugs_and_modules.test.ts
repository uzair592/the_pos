import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { pool, query } from '../src/db/connection.js';
import { StockUnit, OrderType, OrderStatus } from '@pos/shared';

describe('Operational Bugs, Inventory Inward Purchases, Tables, Reservations & Waitlist', () => {
  let app: any;
  let superAdminToken: string;
  let ownerToken: string;
  let tenantId: string;
  let branchId: string;
  let supplierId: string;
  let flourIngId: string;
  let floorId: string;
  let tableId1: string;
  let tableId2: string;
  let categoryId: string;
  let pizzaProdId: string;

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
        name: 'Royal Heritage Dine',
        ownerName: 'Malik Sultan',
        email: `sultan_${Date.now()}@royalheritage.com`,
        initialAdminPassword: 'SultanPassword123!',
        phone: '+923009988776',
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
      payload: { email: tenantData.ownerUser.email, password: 'SultanPassword123!' },
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = JSON.parse(ownerLogin.payload).token;

    // 4. Create Supplier
    const supRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/suppliers',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Capital Grain & Flour Mills',
        contactPerson: 'Zubair Khan',
        phone: '+923112233445',
        email: 'zubair@capitalgrains.com',
        address: 'Sector I-9 Industrial Area',
        taxNumber: 'STRN-55443322',
      },
    });
    expect(supRes.statusCode).toBe(201);
    supplierId = JSON.parse(supRes.payload).supplier.id;

    // 5. Create Menu Category & Product
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/menu/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Woodfire Pizzas',
        color: '#E65100',
      },
    });
    expect(catRes.statusCode).toBe(201);
    categoryId = JSON.parse(catRes.payload).category.id;

    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/menu/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        categoryId,
        name: 'Royal Margherita',
        basePrice: 1200,
        sku: 'PIZZA-MARG-01',
        prepStation: 'KITCHEN',
      },
    });
    expect(prodRes.statusCode).toBe(201);
    pizzaProdId = JSON.parse(prodRes.payload).product.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // =========================================================================
  // PART 2: Inward Purchases Immediate Stock Posting & FIFO Lots
  // =========================================================================
  describe('Inward Purchases & Stock Posting', () => {
    it('creates an ingredient with purchase conversion factor', async () => {
      const ingRes = await app.inject({
        method: 'POST',
        url: '/api/inventory/ingredients',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          name: 'Special Pizza Flour',
          sku: 'ING-FLOUR-01',
          unit: StockUnit.G,
          purchaseUnit: StockUnit.KG,
          conversionFactor: 1000,
          purchaseCost: 200, // PKR 200 per KG -> PKR 0.20 per Gram
          costPerUnit: 0.2,
          minStockAlert: 2000, // 2000 grams
        },
      });
      expect(ingRes.statusCode).toBe(201);
      flourIngId = JSON.parse(ingRes.payload).ingredient.id;
    });

    it('submits purchase invoice with receiveNow=true and immediately updates stock & FIFO lots', async () => {
      const purchaseRes = await app.inject({
        method: 'POST',
        url: '/api/inventory/purchases',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          supplierId,
          branchId,
          invoiceNumber: `INV-MILL-${Date.now()}`,
          receiveNow: true,
          items: [
            {
              ingredientId: flourIngId,
              unit: StockUnit.KG,
              quantity: 25, // 25 KG
              unitPrice: 200, // PKR 200 per KG
            },
          ],
        },
      });
      expect(purchaseRes.statusCode).toBe(201);
      const purchaseData = JSON.parse(purchaseRes.payload);
      expect(purchaseData.purchase.status).toBe('RECEIVED');

      // Check branch stock: exact entered quantity preserved (25 KG)
      const stockRes = await app.inject({
        method: 'GET',
        url: `/api/inventory/ingredients?branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(stockRes.statusCode).toBe(200);
      const ingredients = JSON.parse(stockRes.payload).ingredients;
      const flour = ingredients.find((i: any) => i.id === flourIngId);
      expect(Number(flour.current_stock)).toBe(25);

      // Check FIFO lot was created with exact quantity and price
      const batchesRes = await app.inject({
        method: 'GET',
        url: `/api/inventory/batches?ingredientId=${flourIngId}&branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(batchesRes.statusCode).toBe(200);
      const batches = JSON.parse(batchesRes.payload).batches;
      expect(batches.length).toBeGreaterThanOrEqual(1);
      expect(Number(batches[0].quantity_received)).toBe(25);
      expect(Number(batches[0].unit_cost)).toBe(200);
    });

    it('reconciles historical purchases without duplicate stock addition', async () => {
      const reconcileRes = await app.inject({
        method: 'POST',
        url: '/api/inventory/purchases/reconcile',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { branchId },
      });
      expect(reconcileRes.statusCode).toBe(200);
      const reconcileData = JSON.parse(reconcileRes.payload);
      expect(reconcileData.reconciledCount).toBe(0);

      // Verify stock remains exactly 25
      const checkStock = await app.inject({
        method: 'GET',
        url: `/api/inventory/ingredients?branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const ingredients = JSON.parse(checkStock.payload).ingredients;
      const flour = ingredients.find((i: any) => i.id === flourIngId);
      expect(Number(flour.current_stock)).toBe(25);
    });
  });

  // =========================================================================
  // PART 4: Floor & Table Management (CRUD, shapes, coordinates, waiters)
  // =========================================================================
  describe('Floors and Tables Management', () => {
    it('creates a restaurant dining floor', async () => {
      const floorRes = await app.inject({
        method: 'POST',
        url: '/api/restaurant/floors',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          name: 'Courtyard Terrace',
          floorPlanData: { description: 'Open air terrace seating' },
        },
      });
      expect(floorRes.statusCode).toBe(201);
      floorId = JSON.parse(floorRes.payload).floor.id;
      expect(floorId).toBeDefined();
    });

    it('creates tables with shape, coordinates, capacity, and assigned waiter', async () => {
      // Table 1: Round table for 4 guests
      const tableRes1 = await app.inject({
        method: 'POST',
        url: '/api/restaurant/tables',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          floorId,
          tableNumber: 'T-101',
          capacity: 4,
          shape: 'ROUND',
          posX: 120,
          posY: 80,
          assignedWaiterName: 'Ali Haider',
        },
      });
      expect(tableRes1.statusCode).toBe(201);
      tableId1 = JSON.parse(tableRes1.payload).table.id;

      // Table 2: Rectangle table for 8 guests
      const tableRes2 = await app.inject({
        method: 'POST',
        url: '/api/restaurant/tables',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          floorId,
          tableNumber: 'T-102',
          capacity: 8,
          shape: 'RECTANGLE',
          posX: 300,
          posY: 150,
          assignedWaiterName: 'Kamran Shah',
        },
      });
      expect(tableRes2.statusCode).toBe(201);
      tableId2 = JSON.parse(tableRes2.payload).table.id;

      // Table 3: Create table with floorName directly (auto-creates floor if not present)
      const tableRes3 = await app.inject({
        method: 'POST',
        url: '/api/restaurant/tables',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          floorName: 'Family Section Hall',
          tableNumber: 'T-103',
          capacity: 6,
        },
      });
      expect(tableRes3.statusCode).toBe(201);
      const t3Data = JSON.parse(tableRes3.payload).table;
      expect(t3Data.floor_id).toBeDefined();

      // Verify Family Section Hall was created
      const fCheck = await app.inject({
        method: 'GET',
        url: `/api/restaurant/floors?branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const floorsList = JSON.parse(fCheck.payload).floors;
      expect(floorsList.find((f: any) => f.name === 'Family Section Hall')).toBeDefined();
    });

    it('updates table layout coordinates via batch layout API', async () => {
      const layoutRes = await app.inject({
        method: 'PUT',
        url: '/api/restaurant/tables/layout',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          tables: [
            { id: tableId1, posX: 140, posY: 95 },
            { id: tableId2, posX: 320, posY: 175 },
          ],
        },
      });
      expect(layoutRes.statusCode).toBe(200);

      const tablesRes = await app.inject({
        method: 'GET',
        url: `/api/restaurant/tables?floorId=${floorId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(tablesRes.statusCode).toBe(200);
      const tables = JSON.parse(tablesRes.payload).tables;
      const t1 = tables.find((t: any) => t.id === tableId1);
      expect(t1.pos_x).toBe(140);
      expect(t1.pos_y).toBe(95);
    });
  });

  // =========================================================================
  // PART 5: Reservations & Waitlist (Conflict checks, queueing & seating)
  // =========================================================================
  describe('Reservations and Waitlist', () => {
    let reservationId: string;
    let waitlistId: string;
    const todayDate = new Date().toISOString().split('T')[0];

    it('books a reservation for today', async () => {
      const resRes = await app.inject({
        method: 'POST',
        url: '/api/reservations',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          customerName: 'Barrister Daniyal',
          customerPhone: '+923004455667',
          customerEmail: 'daniyal@lawchambers.pk',
          guestCount: 4,
          reservationDate: todayDate,
          reservationTime: '20:00',
          durationMinutes: 90,
          tableId: tableId1,
          specialRequests: 'Corner table near fountain',
        },
      });
      expect(resRes.statusCode).toBe(201);
      reservationId = JSON.parse(resRes.payload).reservation.id;
      expect(reservationId).toBeDefined();
    });

    it('prevents double-booking collision for overlapping reservation window', async () => {
      const conflictRes = await app.inject({
        method: 'POST',
        url: '/api/reservations',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          customerName: 'Zainab Qureshi',
          customerPhone: '+923219988771',
          guestCount: 3,
          reservationDate: todayDate,
          reservationTime: '20:30', // Overlaps with 20:00 + 90m (until 21:30)
          durationMinutes: 60,
          tableId: tableId1,
        },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(JSON.parse(conflictRes.payload).error).toMatch(/already reserved/i);
    });

    it('seats reservation customer and sets table occupancy to OCCUPIED', async () => {
      const seatRes = await app.inject({
        method: 'POST',
        url: `/api/reservations/${reservationId}/seat`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { tableId: tableId1 },
      });
      expect(seatRes.statusCode).toBe(200);
      const resData = JSON.parse(seatRes.payload);
      expect(resData.reservation.status).toBe('SEATED');

      // Check table status
      const tableCheck = await query('SELECT status FROM restaurant_tables WHERE id = $1', [tableId1], { tenantId });
      expect(tableCheck.rows[0].status).toBe('OCCUPIED');
    });

    it('adds customer to live waitlist with auto queue numbering', async () => {
      const wlRes = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          customerName: 'Hamza Farooq',
          customerPhone: '+923335566778',
          guestCount: 6,
          notes: 'Family with kids',
        },
      });
      expect(wlRes.statusCode).toBe(201);
      const wlData = JSON.parse(wlRes.payload);
      waitlistId = wlData.entry.id;
      expect(wlData.entry.queue_number).toBeGreaterThanOrEqual(1);
      expect(wlData.entry.status).toBe('WAITING');
    });

    it('notifies customer and seats waitlist party at Table 2', async () => {
      // Notify
      const notifyRes = await app.inject({
        method: 'POST',
        url: `/api/waitlist/${waitlistId}/notify`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(notifyRes.statusCode).toBe(200);
      expect(JSON.parse(notifyRes.payload).entry.status).toBe('NOTIFIED');

      // Seat at Table 2
      const seatWlRes = await app.inject({
        method: 'POST',
        url: `/api/waitlist/${waitlistId}/seat`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { tableId: tableId2 },
      });
      expect(seatWlRes.statusCode).toBe(200);
      expect(JSON.parse(seatWlRes.payload).entry.status).toBe('SEATED');

      // Verify Table 2 is now OCCUPIED
      const t2Check = await query('SELECT status FROM restaurant_tables WHERE id = $1', [tableId2], { tenantId });
      expect(t2Check.rows[0].status).toBe('OCCUPIED');
    });
  });

  // =========================================================================
  // PART 1 & 7: Order & KDS Ticket Status Sync & Sidebar Badges
  // =========================================================================
  describe('Order Status, KDS Sync and Sidebar Badges', () => {
    let testOrderId: string;
    let kdsTicketId: string;
    let orderGrandTotal: number;

    it('creates an order, generates KDS ticket, and appears in /api/orders/active with kitchen_status', async () => {
      const orderRes = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          branchId,
          orderType: OrderType.DINE_IN,
          tableId: tableId1,
          items: [
            {
              productId: pizzaProdId,
              quantity: 2,
              unitPrice: 1200,
              subtotal: 2400,
              prepStation: 'KITCHEN',
            },
          ],
          subtotal: 2400,
          taxAmount: 0,
          discountAmount: 0,
          grandTotal: 2400,
        },
      });
      expect(orderRes.statusCode).toBe(201);
      const orderData = JSON.parse(orderRes.payload).order;
      testOrderId = orderData.id;
      orderGrandTotal = Number(orderData.grand_total);

      // Active orders check
      const activeRes = await app.inject({
        method: 'GET',
        url: `/api/orders/active?branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(activeRes.statusCode).toBe(200);
      const activeOrders = JSON.parse(activeRes.payload).orders;
      const matchedOrder = activeOrders.find((o: any) => o.id === testOrderId);
      expect(matchedOrder).toBeDefined();
      expect(matchedOrder.kitchen_status).toBeDefined();
    });

    it('tracks KDS ticket status transitions and synchronizes to order settlement', async () => {
      // Find KDS ticket
      const kdsRes = await app.inject({
        method: 'GET',
        url: `/api/kds/tickets?branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(kdsRes.statusCode).toBe(200);
      const tickets = JSON.parse(kdsRes.payload).tickets;
      const ticket = tickets.find((t: any) => t.order_id === testOrderId);
      expect(ticket).toBeDefined();
      kdsTicketId = ticket.id;

      // Transition ticket: PENDING -> ACCEPTED -> PREPARING
      const prepRes = await app.inject({
        method: 'PUT',
        url: `/api/kds/tickets/${kdsTicketId}/status`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { status: 'PREPARING' },
      });
      expect(prepRes.statusCode).toBe(200);

      // Verify active order reflects updated kitchen status
      const activeCheck = await app.inject({
        method: 'GET',
        url: `/api/orders/active?branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const orderInFlight = JSON.parse(activeCheck.payload).orders.find((o: any) => o.id === testOrderId);
      expect(orderInFlight.kitchen_status).toBe('PREPARING');

      // Settle payment via checkout -> transitions order to COMPLETED
      const payRes = await app.inject({
        method: 'POST',
        url: `/api/orders/${testOrderId}/checkout`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          payments: [
            {
              method: 'CASH',
              amount: orderGrandTotal,
            },
          ],
          changeGiven: 0,
        },
      });
      if (payRes.statusCode !== 200) {
        console.log('PAY ERROR:', payRes.payload);
      }
      expect(payRes.statusCode).toBe(200);
      expect(JSON.parse(payRes.payload).order.status).toBe(OrderStatus.COMPLETED);

      // Verify kitchen ticket was synchronized to SERVED
      const finalKtCheck = await query('SELECT status FROM kitchen_tickets WHERE id = $1', [kdsTicketId], { tenantId });
      expect(finalKtCheck.rows[0].status).toBe('SERVED');
    });

    it('returns live notification badges from /api/restaurant/sidebar-badges', async () => {
      const badgeRes = await app.inject({
        method: 'GET',
        url: `/api/restaurant/sidebar-badges?branchId=${branchId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(badgeRes.statusCode).toBe(200);
      const data = JSON.parse(badgeRes.payload);
      expect(data.badges).toBeDefined();
      expect(typeof data.badges.activeOrders).toBe('number');
      expect(typeof data.badges.pendingKitchen).toBe('number');
      expect(typeof data.badges.lowStock).toBe('number');
      expect(typeof data.badges.pendingReservations).toBe('number');
      expect(typeof data.badges.waitlistCount).toBe('number');
    });
  });
});
