import { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import {
  CreateOrderSchema,
  CompleteOrderCheckoutSchema,
  CancelOrderSchema,
  ProcessRefundSchema,
  Permission,
  OrderStatus,
  TableStatus,
} from '@pos/shared';
import { createOrder, completeOrderCheckout, processOrderRefund } from '../services/orderService.js';
import { deductInventoryForOrder } from '../services/inventoryService.js';
import { emitSyncEvent } from '../services/syncService.js';
import { logAuditEvent } from '../services/auditService.js';

export async function orderRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  /**
   * Create POS Order
   */
  fastify.post('/api/orders', {
    preHandler: [requirePermission(Permission.ORDERS_CREATE)],
  }, async (req, reply) => {
    const payload = { ...((req.body as any) || {}), branchId: (req.body as any)?.branchId || req.user?.branchId };
    const parsed = CreateOrderSchema.safeParse(payload);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const tenantId = req.user!.tenantId!;
    const {
      branchId,
      orderType,
      tableId,
      coverCount,
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryFee,
      riderName,
      riderPhone,
      billDiscountPercent,
      billDiscountAmount,
      waiterId,
      shiftId,
      orderNotes,
      items,
      idempotencyKey,
    } = parsed.data;

    const result = await createOrder({
      tenantId,
      branchId,
      cashierId: req.user!.id,
      cashierName: req.user!.fullName,
      orderType,
      tableId,
      coverCount,
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryFee,
      riderName,
      riderPhone,
      billDiscountPercent,
      billDiscountAmount,
      waiterId,
      shiftId,
      orderNotes,
      idempotencyKey,
      items,
    });

    // Multi-device sync event
    if (result && result.order) {
      await emitSyncEvent(query, {
        tenantId,
        branchId,
        eventType: 'ORDER_CREATED',
        entityId: result.order.id,
        payload: {
          orderNumber: result.order.order_number,
          orderType,
          tableId,
          status: result.order.status,
        },
      });
    }

    return reply.status(201).send(result);
  });

  /**
   * Dedicated Live Active Orders Endpoint (Operations Hub)
   */
  fastify.get('/api/orders/active', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId } = req.query as { branchId?: string };

    let sql = `
      SELECT o.*,
             EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 as elapsed_minutes,
             b.name as branch_name
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      WHERE o.tenant_id = $1
        AND o.status IN ('PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'OUT_FOR_DELIVERY', 'ON_HOLD')
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND o.branch_id = $${params.length}`;
    }

    sql += ` ORDER BY o.created_at ASC`;

    const { rows: orders } = await query(sql, params, { tenantId });

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const { rows: items } = await query(
        `SELECT * FROM order_items WHERE order_id = ANY($1) AND tenant_id = $2 ORDER BY id ASC`,
        [orderIds, tenantId],
        { tenantId }
      );

      const itemsByOrder: Record<string, any[]> = {};
      for (const item of items) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      }

      for (const ord of orders) {
        ord.items = itemsByOrder[ord.id] || [];
      }
    }

    return reply.send({ orders });
  });

  /**
   * Filtered & Paginated All Orders History
   */
  fastify.get('/api/orders', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const {
      branchId,
      status,
      orderType,
      startDate,
      endDate,
      search,
      page = '1',
      limit = '20',
    } = req.query as {
      branchId?: string;
      status?: string;
      orderType?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = `WHERE o.tenant_id = $1`;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      whereClause += ` AND o.branch_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      whereClause += ` AND o.status = $${params.length}`;
    }
    if (orderType) {
      params.push(orderType);
      whereClause += ` AND o.order_type = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      whereClause += ` AND o.created_at >= $${params.length}::timestamptz`;
    }
    if (endDate) {
      params.push(endDate);
      whereClause += ` AND o.created_at <= $${params.length}::timestamptz`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.customer_phone ILIKE $${params.length} OR o.table_number ILIKE $${params.length})`;
    }

    // Total Count and Period Financial Aggregates
    const countRes = await query(
      `SELECT COUNT(*)::int as total,
              COALESCE(SUM(o.grand_total), 0)::numeric as total_amount,
              COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.grand_total ELSE 0 END), 0)::numeric as total_completed_amount,
              COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END)::int as completed_count,
              COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END)::int as cancelled_count
       FROM orders o ${whereClause}`,
      params,
      { tenantId }
    );
    const total = countRes.rows[0]?.total || 0;

    // Fetch Orders
    let dataSql = `
      SELECT o.*,
             b.name as branch_name,
             (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count,
             (SELECT COALESCE(SUM(cogs), 0)::numeric FROM order_items WHERE order_id = o.id) as total_cogs
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataParams = [...params, limitNum, offset];

    const { rows: orders } = await query(dataSql, dataParams, { tenantId });

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const { rows: items } = await query(
        `SELECT * FROM order_items WHERE order_id = ANY($1) AND tenant_id = $2 ORDER BY id ASC`,
        [orderIds, tenantId],
        { tenantId }
      );

      const itemsByOrder: Record<string, any[]> = {};
      for (const item of items) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      }

      for (const ord of orders) {
        ord.items = itemsByOrder[ord.id] || [];
      }
    }

    return reply.send({
      orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      summary: {
        totalOrders: total,
        totalAmount: Number(countRes.rows[0]?.total_amount || 0),
        totalCompletedAmount: Number(countRes.rows[0]?.total_completed_amount || 0),
        completedCount: Number(countRes.rows[0]?.completed_count || 0),
        cancelledCount: Number(countRes.rows[0]?.cancelled_count || 0),
      },
    });
  });

  /**
   * Fast Order Status Transition (Active Orders Action)
   */
  fastify.patch('/api/orders/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { status, cancelReason } = req.body as { status: OrderStatus; cancelReason?: string };

    if (!status) {
      return reply.status(400).send({ error: 'Status is required' });
    }

    const { rows: orderRows } = await query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    if (orderRows.length === 0) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const order = orderRows[0];

    // Status transition updates
    const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [status];
    let vIdx = 2;

    if (status === OrderStatus.COMPLETED) {
      updates.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (status === OrderStatus.CANCELLED) {
      updates.push(`cancel_reason = $${vIdx++}`);
      values.push(cancelReason || 'Cancelled by staff');
      updates.push(`cancelled_by_user_id = $${vIdx++}`);
      values.push(req.user!.id);
    }

    values.push(id, tenantId);
    await query(
      `
      UPDATE orders
      SET ${updates.join(', ')}
      WHERE id = $${vIdx++} AND tenant_id = $${vIdx++}
      `,
      values,
      { tenantId }
    );

    // If completed or cancelled, handle table freeing & inventory deduction
    if (status === OrderStatus.COMPLETED) {
      if (order.table_id) {
        await query(
          'UPDATE restaurant_tables SET status = $1, current_order_id = NULL WHERE id = $2 AND tenant_id = $3',
          [TableStatus.AVAILABLE, order.table_id, tenantId],
          { tenantId }
        );
      }

      // Deduct FIFO inventory if not already deducted
      await withTransaction(async (client) => {
        await deductInventoryForOrder(client, tenantId, order.branch_id, id, req.user!.id);
      }, { tenantId });
    } else if (status === OrderStatus.CANCELLED) {
      if (order.table_id) {
        await query(
          'UPDATE restaurant_tables SET status = $1, current_order_id = NULL WHERE id = $2 AND tenant_id = $3',
          [TableStatus.AVAILABLE, order.table_id, tenantId],
          { tenantId }
        );
      }
      await query(
        'UPDATE kitchen_tickets SET status = $1 WHERE order_id = $2 AND tenant_id = $3',
        [OrderStatus.CANCELLED, id, tenantId],
        { tenantId }
      );
    }

    // Emit real-time multi-device sync event
    await emitSyncEvent(query, {
      tenantId,
      branchId: order.branch_id,
      eventType: 'ORDER_STATUS_CHANGED',
      entityId: id,
      payload: {
        orderId: id,
        orderNumber: order.order_number,
        newStatus: status,
        oldStatus: order.status,
      },
    });

    await logAuditEvent({
      tenantId,
      branchId: order.branch_id,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ORDER_STATUS_CHANGED',
      resourceType: 'ORDER',
      resourceId: id,
      metadata: { orderNumber: order.order_number, oldStatus: order.status, newStatus: status },
    });

    return reply.send({
      message: `Order status updated to ${status}`,
      orderId: id,
      status,
    });
  });

  /**
   * Get Order Details
   */
  /**
   * Table Transfer (Move active order from Table A to Table B)
   */
  fastify.post('/api/orders/:id/transfer-table', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { newTableId } = req.body as { newTableId: string };

    if (!newTableId) {
      return reply.status(400).send({ error: 'newTableId is required' });
    }

    try {
      const result = await withTransaction(async (client) => {
        // 1. Get order
        const { rows: oRows } = await client.query(
          'SELECT id, table_id, order_number, branch_id FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [id, tenantId]
        );
        if (oRows.length === 0) throw new Error('Order not found');
        const order = oRows[0];
        const oldTableId = order.table_id;

        // 2. Check new table
        const { rows: tRows } = await client.query(
          'SELECT id, table_number, status FROM restaurant_tables WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [newTableId, tenantId]
        );
        if (tRows.length === 0) throw new Error('New table not found');
        const newTable = tRows[0];

        // 3. Update order table_id
        await client.query(
          'UPDATE orders SET table_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newTableId, id]
        );

        // 4. Update new table status to OCCUPIED and current_order_id
        await client.query(
          "UPDATE restaurant_tables SET status = 'OCCUPIED', current_order_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [id, newTableId]
        );

        // 5. If oldTableId, free it if no other active orders on it
        if (oldTableId && oldTableId !== newTableId) {
          const { rows: activeOther } = await client.query(
            "SELECT id FROM orders WHERE table_id = $1 AND id != $2 AND status NOT IN ('COMPLETED', 'CANCELLED')",
            [oldTableId, id]
          );
          if (activeOther.length === 0) {
            await client.query(
              "UPDATE restaurant_tables SET status = 'AVAILABLE', current_order_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
              [oldTableId]
            );
          }
        }

        return {
          orderId: id,
          orderNumber: order.order_number,
          branchId: order.branch_id,
          oldTableId,
          newTableId,
          newTableNumber: newTable.table_number,
        };
      }, { tenantId });

      await emitSyncEvent(query, {
        tenantId,
        branchId: result.branchId,
        eventType: 'TABLE_STATUS_CHANGED',
        entityId: newTableId,
        payload: result,
      });

      return reply.send({
        message: `Order #${result.orderNumber} successfully moved to Table ${result.newTableNumber}`,
        transfer: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to transfer table' });
    }
  });

  fastify.get('/api/orders/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    // UUID validation check to prevent database 500 error on malformed URL parameters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return reply.status(404).send({ error: 'Order not found (invalid order ID)' });
    }

    const { rows: orderRows } = await query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    if (orderRows.length === 0) {
      return reply.status(404).send({ error: 'Order not found' });
    }
    const order = orderRows[0];

    const { rows: items } = await query(
      'SELECT * FROM order_items WHERE order_id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );
    order.items = items;

    const { rows: payments } = await query(
      'SELECT * FROM order_payments WHERE order_id = $1 AND tenant_id = $2 ORDER BY paid_at ASC',
      [id, tenantId],
      { tenantId }
    );
    order.payments = payments;

    const { rows: consumptions } = await query(
      `
      SELECT c.*, b.received_at as batch_date, i.name as ingredient_name, i.unit as ingredient_unit
      FROM order_item_batch_consumptions c
      LEFT JOIN inventory_batches b ON b.id = c.batch_id
      LEFT JOIN ingredients i ON i.id = c.ingredient_id
      WHERE (c.reference_id = $1 OR c.order_id = $1) AND c.tenant_id = $2
      ORDER BY c.created_at ASC
      `,
      [id, tenantId],
      { tenantId }
    );
    order.batchConsumptions = consumptions;
    order.totalCogs = items.reduce((sum, item) => sum + (Number(item.cogs) || 0), 0);
    order.grossProfit = Number(order.grand_total) - order.totalCogs;

    return reply.send({ order });
  });

  /**
   * Checkout & Process Payments
   */
  fastify.post('/api/orders/:id/checkout', {
    preHandler: [requirePermission(Permission.ORDERS_CREATE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const parsed = CompleteOrderCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { payments, changeGiven, idempotencyKey } = parsed.data;

    try {
      const result = await completeOrderCheckout({
        tenantId,
        orderId: id,
        userId: req.user!.id,
        payments,
        changeGiven,
        idempotencyKey,
      });

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Cancel Order
   */
  fastify.post('/api/orders/:id/cancel', {
    preHandler: [requirePermission(Permission.ORDERS_CANCEL)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const parsed = CancelOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { reason } = parsed.data;

    const { rows: orderRows } = await query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    if (orderRows.length === 0) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const order = orderRows[0];
    if (order.status === OrderStatus.COMPLETED) {
      return reply.status(400).send({ error: 'Cannot cancel a completed order. Use refund instead.' });
    }

    // Cancel order and free table
    await query(
      `
      UPDATE orders
      SET status = $1, cancel_reason = $2, cancelled_by_user_id = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5
      `,
      [OrderStatus.CANCELLED, reason, req.user!.id, id, tenantId],
      { tenantId }
    );

    if (order.table_id) {
      await query(
        'UPDATE restaurant_tables SET status = $1, current_order_id = NULL WHERE id = $2 AND tenant_id = $3',
        [TableStatus.AVAILABLE, order.table_id, tenantId],
        { tenantId }
      );
    }

    // Cancel associated KOTs
    await query(
      'UPDATE kitchen_tickets SET status = $1 WHERE order_id = $2 AND tenant_id = $3',
      [OrderStatus.CANCELLED, id, tenantId],
      { tenantId }
    );

    await logAuditEvent({
      tenantId,
      branchId: order.branch_id,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ORDER_CANCELLED',
      resourceType: 'ORDER',
      resourceId: id,
      metadata: { orderNumber: order.order_number, reason },
    });

    return reply.send({ message: 'Order cancelled successfully' });
  });

  /**
   * Process Refund
   */
  fastify.post('/api/orders/:id/refund', {
    preHandler: [requirePermission(Permission.ORDERS_REFUND)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const parsed = ProcessRefundSchema.safeParse({ ...req.body as any, orderId: id });
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { paymentMethod, reason, restockStock, itemIds } = parsed.data;

    try {
      const result = await processOrderRefund({
        tenantId,
        orderId: id,
        userId: req.user!.id,
        userName: req.user!.fullName,
        paymentMethod,
        reason,
        restockStock,
        itemIds,
      });

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Delete Order (Admin / Manager)
   */
  fastify.delete('/api/orders/:id', {
    preHandler: [requirePermission(Permission.ORDERS_CANCEL)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows: orderRows } = await query(
      'SELECT id, order_number, table_id FROM orders WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );
    if (orderRows.length === 0) return reply.status(404).send({ error: 'Order not found' });
    const order = orderRows[0];

    // Free table if assigned
    if (order.table_id) {
      await query(
        'UPDATE restaurant_tables SET status = $1, current_order_id = NULL WHERE id = $2 AND tenant_id = $3',
        [TableStatus.AVAILABLE, order.table_id, tenantId],
        { tenantId }
      );
    }

    // Delete associated records with foreign keys
    await query('DELETE FROM order_refunds WHERE order_id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    await query('DELETE FROM kitchen_tickets WHERE order_id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    await query('DELETE FROM orders WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });

    await logAuditEvent({
      tenantId,
      branchId: req.user!.branchId,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ORDER_DELETED',
      resourceType: 'ORDER',
      resourceId: id,
      metadata: { orderNumber: order.order_number },
    });

    return reply.send({ message: `Order #${order.order_number} deleted successfully` });
  });

  /**
   * Printable Receipt Payload
   */
  fastify.get('/api/orders/:id/receipt', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    // 1. Order details
    const { rows: orderRows } = await query(
      `
      SELECT o.*, b.name as branch_name, b.phone as branch_phone, b.address as branch_address, b.city as branch_city,
             t.name as restaurant_name, t.logo_url as restaurant_logo,
             rs.receipt_settings, rs.currency_symbol, rs.tax_registration_number
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      JOIN tenants t ON t.id = o.tenant_id
      LEFT JOIN restaurant_settings rs ON rs.tenant_id = o.tenant_id
      WHERE o.id = $1 AND o.tenant_id = $2
      `,
      [id, tenantId],
      { tenantId }
    );

    if (orderRows.length === 0) return reply.status(404).send({ error: 'Order not found' });
    const order = orderRows[0];

    const { rows: items } = await query(
      'SELECT * FROM order_items WHERE order_id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    const { rows: payments } = await query(
      'SELECT * FROM order_payments WHERE order_id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    return reply.send({
      receipt: {
        restaurantName: order.restaurant_name,
        restaurantLogo: order.restaurant_logo,
        branchName: order.branch_name,
        branchPhone: order.branch_phone,
        branchAddress: `${order.branch_address}, ${order.branch_city}`,
        taxRegistrationNumber: order.tax_registration_number,
        orderNumber: order.order_number,
        orderType: order.order_type,
        tableNumber: order.table_number,
        floorName: order.floor_name,
        coverCount: order.cover_count,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address,
        riderName: order.rider_name,
        riderPhone: order.rider_phone,
        cashierName: order.cashier_name,
        serverName: order.waiter_name || order.cashier_name,
        orderNotes: order.order_notes,
        date: order.created_at,
        currencySymbol: order.currency_symbol || 'Rs.',
        items: items.map((i) => ({
          id: i.id,
          productName: i.product_name,
          variantName: i.variant_name,
          station: i.station,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          totalPrice: Number(i.total_price),
          itemDiscount: Number(i.item_discount) || 0,
          modifiers: i.modifiers,
          notes: i.notes,
        })),
        subtotal: Number(order.subtotal),
        discount: Number(order.total_discount),
        billDiscountPercent: Number(order.bill_discount_percent) || 0,
        billDiscountAmount: Number(order.bill_discount_amount) || 0,
        itemDiscountsTotal: Number(order.item_discounts_total) || 0,
        taxPercent: Number(order.tax_percent),
        taxAmount: Number(order.tax_amount),
        serviceChargeAmount: Number(order.service_charge_amount),
        deliveryFee: Number(order.delivery_fee),
        grandTotal: Number(order.grand_total),
        paidAmount: Number(order.paid_amount),
        changeGiven: Number(order.change_given),
        balanceDue: Number(order.balance_due),
        payments: payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
        })),
        receiptSettings: order.receipt_settings,
      },
    });
  });
}
