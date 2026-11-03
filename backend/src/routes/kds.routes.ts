import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission, requireEntitlement } from '../middleware/auth.js';
import {
  UpdateKOTStatusSchema,
  Permission,
  FeatureKey,
  PrepStatus,
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
    const { branchId, station, status } = req.query as {
      branchId?: string;
      station?: string;
      status?: string;
    };

    let sql = `
      SELECT kt.*
      FROM kitchen_tickets kt
      WHERE kt.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND kt.branch_id = $${params.length}`;
    }
    if (station && station !== 'ALL') {
      params.push(station);
      sql += ` AND kt.station = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND kt.status = $${params.length}`;
    } else {
      // By default show active tickets
      sql += ` AND kt.status NOT IN ('COMPLETED', 'CANCELLED')`;
    }

    sql += ' ORDER BY kt.created_at ASC';

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

    // Update all ticket items status to match
    await query(
      'UPDATE kitchen_ticket_items SET status = $1 WHERE kot_id = $2 AND tenant_id = $3',
      [status, id, tenantId],
      { tenantId }
    );

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
}
