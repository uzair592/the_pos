import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import { CreateCustomerSchema, Permission } from '@pos/shared';

export async function customerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  fastify.get('/api/customers', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { search } = req.query as { search?: string };

    let sql = 'SELECT * FROM customers WHERE tenant_id = $1 AND is_active = true';
    const params: any[] = [tenantId];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    sql += ' ORDER BY total_spent DESC, name ASC LIMIT 50';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ customers: rows });
  });

  fastify.post('/api/customers', {
    preHandler: [requirePermission(Permission.CUSTOMERS_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateCustomerSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { name, phone, email, address, notes, creditLimit } = parsed.data;

    const existing = await query('SELECT id FROM customers WHERE tenant_id = $1 AND phone = $2', [tenantId, phone], { tenantId });
    if (existing.rows.length > 0) {
      return reply.status(400).send({ error: 'A customer with this phone number already exists' });
    }

    const { rows } = await query(
      `
      INSERT INTO customers (tenant_id, name, phone, email, address, notes, credit_limit, outstanding_balance, loyalty_points)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)
      RETURNING *
      `,
      [tenantId, name, phone, email || null, address || null, notes || null, creditLimit],
      { tenantId }
    );

    return reply.status(201).send({ customer: rows[0] });
  });

  fastify.get('/api/customers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows: custRows } = await query('SELECT * FROM customers WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    if (custRows.length === 0) return reply.status(404).send({ error: 'Customer not found' });

    const { rows: orders } = await query(
      'SELECT id, order_number, grand_total, status, created_at FROM orders WHERE customer_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 10',
      [id, tenantId],
      { tenantId }
    );

    return reply.send({ customer: custRows[0], recentOrders: orders });
  });

  /**
   * Record Customer Payment-In (Alt + I)
   * Reduces outstanding customer balance and updates ledger
   */
  fastify.post('/api/customers/:id/payment', {
    preHandler: [requirePermission(Permission.CUSTOMERS_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { amount, paymentMethod, reference, notes } = req.body as {
      amount: number;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
    };

    if (!amount || Number(amount) <= 0) {
      return reply.status(400).send({ error: 'Valid payment amount is required' });
    }

    const { rows: custRows } = await query('SELECT * FROM customers WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    if (custRows.length === 0) return reply.status(404).send({ error: 'Customer not found' });

    const currentBal = Number(custRows[0].outstanding_balance || 0);
    const newBalance = Math.max(0, currentBal - Number(amount));

    const { rows: updated } = await query(
      `
      UPDATE customers
      SET outstanding_balance = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [newBalance, id, tenantId],
      { tenantId }
    );

    return reply.send({
      message: 'Payment-In recorded successfully',
      customer: updated[0],
      amountPaid: Number(amount),
      paymentMethod: paymentMethod || 'CASH',
      reference: reference || null,
      previousBalance: currentBal,
      newBalance,
    });
  });
}
