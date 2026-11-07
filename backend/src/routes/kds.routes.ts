import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission, requireEntitlement } from '../middleware/auth.js';
import { emitSyncEvent } from '../services/syncService.js';
import {
  UpdateKOTStatusSchema,
  Permission,
  FeatureKey,
  PrepStatus,
  OrderStatus,
} from '@pos/shared';

export async function kdsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);
  fastify.addHook('preHandler', requireEntitlement(FeatureKey.KDS));

  /**
   * List Active Kitchen Order Tickets
   */
  fastify.get('/api/kds/tickets', {
    preHandler: [requirePermission(Permission.KDS_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, station, status, sort = 'DESC', dateFilter = 'ALL', search } = req.query as {
      branchId?: string;
      station?: string;
      status?: string;
      sort?: string;
      dateFilter?: string;
      search?: string;
    };

    let sql = `
      SELECT kt.*, b.name as branch_name, b.code as branch_code,
             o.payment_status, o.customer_name, o.customer_phone, o.delivery_address,
             o.grand_total, o.paid_amount, o.order_number as live_order_number
      FROM kitchen_tickets kt
      LEFT JOIN branches b ON b.id = kt.branch_id
      LEFT JOIN orders o ON o.id = kt.order_id
      WHERE kt.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId && branchId !== 'ALL') {
      params.push(branchId);
      sql += ' AND kt.branch_id = $' + params.length;
    }
    if (station && station !== 'ALL') {
      params.push(station);
      sql += ' AND kt.station = $' + params.length;
    }
    if (status === 'ACTIVE') {
      sql += " AND kt.status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY')";
    } else if (status === 'SERVED') {
      sql += " AND kt.status = 'SERVED'";
    } else if (status && status !== 'ALL') {
      params.push(status);
      sql += ' AND kt.status = $' + params.length;
    } else if (!status) {
      // By default show active tickets
      sql += " AND kt.status NOT IN ('COMPLETED', 'CANCELLED')";
    }

    // Only restrict to CURRENT_DATE if viewing served/historical tickets or not active,
    // active kitchen tickets must NEVER be hidden while in-flight
    if (dateFilter === 'TODAY' && status !== 'ACTIVE') {
      sql += ' AND kt.created_at >= CURRENT_DATE';
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (kt.kot_number ILIKE $${params.length} OR kt.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR kt.table_number ILIKE $${params.length})`;
    }

    const sortDirection = sort === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY kt.created_at ${sortDirection}`;

    const { rows: tickets } = await query(sql, params, { tenantId });

    // Fetch items for each ticket
    for (const t of tickets) {
      const { rows: items } = await query(
        'SELECT * FROM kitchen_ticket_items WHERE kot_id = $1 AND tenant_id = $2',
        [t.id, tenantId],
        { tenantId }
      );
      t.items = items;
    }

    return reply.send({ tickets });
  });

  /**
   * Update KOT Status (Pending -> Accepted -> Preparing -> Ready -> Completed)
   */
  fastify.put('/api/kds/tickets/:id/status', {
    preHandler: [requirePermission(Permission.KDS_UPDATE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const parsed = UpdateKOTStatusSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const { status } = parsed.data;

    let timestampColumn = '';
    if (status === PrepStatus.ACCEPTED) timestampColumn = ', accepted_at = CURRENT_TIMESTAMP';
    else if (status === PrepStatus.PREPARING) timestampColumn = ', preparing_at = CURRENT_TIMESTAMP';
    else if (status === PrepStatus.READY) timestampColumn = ', ready_at = CURRENT_TIMESTAMP';
    else if (status === PrepStatus.SERVED) timestampColumn = ', completed_at = CURRENT_TIMESTAMP';

    const { rows } = await query(
      `
      UPDATE kitchen_tickets
      SET status = $1 ${timestampColumn}
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [status, id, tenantId],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Ticket not found' });
    const ticket = rows[0];

    // Update all ticket items status to match
    await query(
      'UPDATE kitchen_ticket_items SET status = $1 WHERE kot_id = $2 AND tenant_id = $3',
      [status, id, tenantId],
      { tenantId }
    );

    // Synchronize parent order status if linked
    if (ticket.order_id) {
      let orderNextStatus: string | null = null;
      if (status === PrepStatus.SERVED) {
        orderNextStatus = 'SERVED';
      } else if (status === PrepStatus.READY) {
        orderNextStatus = 'READY';
      } else if (status === PrepStatus.PREPARING) {
        orderNextStatus = 'PREPARING';
      } else if (status === PrepStatus.ACCEPTED) {
        orderNextStatus = 'ACCEPTED';
      }

      if (orderNextStatus) {
        await query(
          'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 AND status != \'COMPLETED\'',
          [orderNextStatus, ticket.order_id, tenantId],
          { tenantId }
        );
      }

      // Real-time multi-device sync notification
      await emitSyncEvent(query, {
        tenantId,
        branchId: ticket.branch_id,
        eventType: 'ORDER_STATUS_CHANGED',
        entityId: ticket.order_id,
        payload: {
          orderId: ticket.order_id,
          orderNumber: ticket.order_number,
          tableNumber: ticket.table_number,
          status: orderNextStatus || status,
          kotStatus: status,
        },
      });
    }

    return reply.send({ ticket: rows[0] });
  });

  /**
   * Update individual ticket item status
   */
  fastify.put('/api/kds/items/:itemId/status', {
    preHandler: [requirePermission(Permission.KDS_UPDATE)],
  }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string };
    const tenantId = req.user!.tenantId!;

    const parsed = UpdateKOTStatusSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const { status } = parsed.data;

    const { rows } = await query(
      `
      UPDATE kitchen_ticket_items
      SET status = $1
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [status, itemId, tenantId],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Ticket item not found' });
    return reply.send({ item: rows[0] });
  });

  /**
   * Clear Stale / Completed Tickets (> 24 hours) from active cooking board
   */
  fastify.post('/api/kds/tickets/clear-stale', {
    preHandler: [requirePermission(Permission.KDS_UPDATE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, hours = 24 } = (req.body as { branchId?: string; hours?: number }) || {};

    let sql = `
      UPDATE kitchen_tickets
      SET status = 'SERVED', completed_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1
        AND status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY')
        AND created_at < NOW() - (INTERVAL '1 hour' * $2)
    `;
    const params: any[] = [tenantId, Math.max(1, Number(hours) || 24)];
    if (branchId && branchId !== 'ALL') {
      params.push(branchId);
      sql += ` AND branch_id = $${params.length}`;
    }

    const res = await query(sql, params, { tenantId });
    return reply.send({ success: true, clearedCount: res.rowCount || 0 });
  });
}
