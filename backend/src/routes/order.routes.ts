import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
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
    const parsed = CreateOrderSchema.safeParse(req.body);
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
      billDiscountPercent,
      billDiscountAmount,
      waiterId,
      shiftId,
      orderNotes,
      idempotencyKey,
      items,
    });

    return reply.status(201).send(result);
  });

  /**
   * List Orders
   */
  fastify.get('/api/orders', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, status, date, limit = 50, offset = 0 } = req.query as {
      branchId?: string;
      status?: string;
      date?: string;
      limit?: number;
      offset?: number;
    };

    let sql = `
      SELECT o.*,
             (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      WHERE o.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND o.branch_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND o.status = $${params.length}`;
    }
    if (date) {
      params.push(date);
      sql += ` AND DATE(o.created_at) = $${params.length}`;
    }

    sql += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ orders: rows });
  });

  /**
   * Get Order Details
   */
  fastify.get('/api/orders/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

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
        cashierName: order.cashier_name,
        date: order.created_at,
        currencySymbol: order.currency_symbol || 'Rs.',
        items: items.map((i) => ({
          productName: i.product_name,
          variantName: i.variant_name,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          totalPrice: Number(i.total_price),
          modifiers: i.modifiers,
        })),
        subtotal: Number(order.subtotal),
        discount: Number(order.total_discount),
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
