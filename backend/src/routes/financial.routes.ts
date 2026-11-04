import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import {
  OpenShiftSchema,
  CashMovementSchema,
  CloseShiftSchema,
  CreateExpenseSchema,
  Permission,
  ShiftStatus,
} from '@pos/shared';
import {
  openShift,
  recordCashMovement,
  closeShift,
  generateFinancialSummary,
} from '../services/financialService.js';

export async function financialRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  /**
   * Current Shift for Cashier
   */
  fastify.get('/api/financial/shifts/current', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const cashierId = req.user!.id;

    const { rows } = await query(
      `
      SELECT s.*, b.name as branch_name,
             (SELECT COUNT(*)::int FROM orders WHERE shift_id = s.id AND status = 'COMPLETED') as order_count
      FROM register_shifts s
      JOIN branches b ON b.id = s.branch_id
      WHERE s.tenant_id = $1 AND s.cashier_id = $2 AND s.status = 'OPEN'
      LIMIT 1
      `,
      [tenantId, cashierId],
      { tenantId }
    );

    return reply.send({ shift: rows[0] || null });
  });

  /**
   * Open Shift
   */
  fastify.post('/api/financial/shifts/open', {
    preHandler: [requirePermission(Permission.SHIFTS_OPEN)],
  }, async (req, reply) => {
    const payload = { ...((req.body as any) || {}), branchId: (req.body as any)?.branchId || req.user?.branchId };
    const parsed = OpenShiftSchema.safeParse(payload);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, registerName, openingCash } = parsed.data;

    const result = await openShift({
      tenantId,
      branchId,
      cashierId: req.user!.id,
      cashierName: req.user!.fullName,
      registerName,
      openingCash,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message, shiftId: result.shiftId });
    }

    return reply.status(201).send(result);
  });

  /**
   * Cash Movement (Cash In / Cash Out)
   */
  fastify.post('/api/financial/shifts/cash-movement', {
    preHandler: [requirePermission(Permission.CASH_ADJUST)],
  }, async (req, reply) => {
    const parsed = CashMovementSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const branchId = req.user!.branchId!;
    const { shiftId, movementType, amount, reason } = parsed.data;

    const movement = await recordCashMovement({
      tenantId,
      branchId,
      shiftId,
      userId: req.user!.id,
      movementType,
      amount,
      reason,
    });

    return reply.status(201).send({ movement });
  });

  /**
   * Close Shift
   */
  fastify.post('/api/financial/shifts/close', {
    preHandler: [requirePermission(Permission.SHIFTS_CLOSE)],
  }, async (req, reply) => {
    const parsed = CloseShiftSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const { shiftId } = req.query as { shiftId: string };
    if (!shiftId) return reply.status(400).send({ error: 'Missing shiftId query parameter' });

    const tenantId = req.user!.tenantId!;
    const { actualCash, closingNotes } = parsed.data;

    try {
      const result = await closeShift({
        tenantId,
        shiftId,
        userId: req.user!.id,
        actualCash,
        closingNotes,
      });

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * List Past Shifts
   */
  fastify.get('/api/financial/shifts', {
    preHandler: [requirePermission(Permission.SHIFTS_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, limit = 50 } = req.query as { branchId?: string; limit?: number };

    let sql = `
      SELECT s.*, u.full_name as cashier_name, b.name as branch_name
      FROM register_shifts s
      JOIN users u ON u.id = s.cashier_id
      JOIN branches b ON b.id = s.branch_id
      WHERE s.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    if (branchId) {
      params.push(branchId);
      sql += ` AND s.branch_id = $${params.length}`;
    }
    sql += ` ORDER BY s.opened_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ shifts: rows });
  });

  /**
   * Expenses Management
   */
  fastify.get('/api/financial/expenses', {
    preHandler: [requirePermission(Permission.EXPENSES_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    let sql = `
      SELECT e.*, ec.name as category_name, b.name as branch_name, u.full_name as recorded_by_name
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      JOIN branches b ON b.id = e.branch_id
      LEFT JOIN users u ON u.id = e.recorded_by_user_id
      WHERE e.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND e.branch_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND e.expense_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND e.expense_date <= $${params.length}`;
    }

    sql += ' ORDER BY e.expense_date DESC, e.created_at DESC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ expenses: rows });
  });

  fastify.post('/api/financial/expenses', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateExpenseSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, categoryId, amount, paymentMethod, description, expenseDate } = parsed.data;

    const { rows } = await query(
      `
      INSERT INTO expenses (tenant_id, branch_id, category_id, amount, payment_method, description, recorded_by_user_id, expense_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE))
      RETURNING *
      `,
      [tenantId, branchId, categoryId, amount, paymentMethod, description, req.user!.id, expenseDate || null],
      { tenantId }
    );

    return reply.status(201).send({ expense: rows[0] });
  });

  fastify.get('/api/financial/expenses/categories', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query('SELECT * FROM expense_categories WHERE tenant_id = $1 ORDER BY name ASC', [tenantId], { tenantId });
    return reply.send({ categories: rows });
  });

  fastify.post('/api/financial/expenses/categories', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const { name, description } = req.body as { name: string; description?: string };
    if (!name) return reply.status(400).send({ error: 'Name is required' });

    const tenantId = req.user!.tenantId!;
    const { rows } = await query(
      'INSERT INTO expense_categories (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [tenantId, name, description || null],
      { tenantId }
    );
    return reply.status(201).send({ category: rows[0] });
  });

  /**
   * Reports: Summary (Net Sales, COGS, Gross Profit, Operating Profit)
   */
  fastify.get('/api/financial/reports/summary', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    const summary = await generateFinancialSummary({
      tenantId,
      branchId: branchId || null,
      startDate: start,
      endDate: end,
    });

    return reply.send({ report: summary });
  });

  /**
   * Reports: Sales by Product
   */
  fastify.get('/api/financial/reports/sales-by-product', {
    preHandler: [requirePermission(Permission.REPORTS_SALES)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        oi.product_id,
        oi.product_name,
        SUM(oi.quantity)::int as total_quantity,
        SUM(oi.total_price)::numeric as total_sales,
        SUM(oi.quantity * oi.cost_price)::numeric as total_cost,
        (SUM(oi.total_price) - SUM(oi.quantity * oi.cost_price))::numeric as gross_profit
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.tenant_id = $1 AND o.status = 'COMPLETED'
        AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
    `;
    const params: any[] = [tenantId, start, end];
    if (branchId) {
      params.push(branchId);
      sql += ` AND o.branch_id = $${params.length}`;
    }
    sql += ` GROUP BY oi.product_id, oi.product_name ORDER BY total_sales DESC`;

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ products: rows });
  });

  /**
   * Reports: Sales by Category
   */
  fastify.get('/api/financial/reports/sales-by-category', {
    preHandler: [requirePermission(Permission.REPORTS_SALES)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        c.id as category_id,
        c.name as category_name,
        SUM(oi.quantity)::int as total_quantity,
        SUM(oi.total_price)::numeric as total_sales
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE oi.tenant_id = $1 AND o.status = 'COMPLETED'
        AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
    `;
    const params: any[] = [tenantId, start, end];
    if (branchId) {
      params.push(branchId);
      sql += ` AND o.branch_id = $${params.length}`;
    }
    sql += ` GROUP BY c.id, c.name ORDER BY total_sales DESC`;

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ categories: rows });
  });

  /**
   * Export Report to CSV
   */
  fastify.get('/api/financial/reports/export', {
    preHandler: [requirePermission(Permission.REPORTS_EXPORT)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    const { rows } = await query(
      `
      SELECT
        o.order_number,
        o.created_at,
        o.order_type,
        o.subtotal,
        o.total_discount,
        o.tax_amount,
        o.service_charge_amount,
        o.grand_total,
        o.cashier_name,
        b.name as branch_name
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
        AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
      ORDER BY o.created_at DESC
      `,
      [tenantId, start, end],
      { tenantId }
    );

    // Generate CSV string
    const headers = ['Order Number', 'Date', 'Type', 'Subtotal', 'Discount', 'Tax', 'Service Charge', 'Grand Total', 'Cashier', 'Branch'];
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      csvRows.push([
        r.order_number,
        `"${new Date(r.created_at).toISOString()}"`,
        r.order_type,
        r.subtotal,
        r.total_discount,
        r.tax_amount,
        r.service_charge_amount,
        r.grand_total,
        `"${r.cashier_name || ''}"`,
        `"${r.branch_name || ''}"`,
      ].join(','));
    }

    const csvData = csvRows.join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=sales-report-${start.split('T')[0]}.csv`);
    return reply.send(csvData);
  });

  /**
   * Dedicated Sub-Reports: Sales Detailed Report
   */
  fastify.get('/api/financial/reports/sales-detailed', {
    preHandler: [requirePermission(Permission.REPORTS_SALES)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        o.id, o.order_number, o.created_at, o.order_type, o.subtotal, o.total_discount,
        o.tax_amount, o.service_charge_amount, o.grand_total, o.cashier_name, o.customer_name,
        b.name as branch_name,
        (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count,
        (SELECT STRING_AGG(DISTINCT method, ', ') FROM order_payments WHERE order_id = o.id) as payment_methods
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
        AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
    `;
    const params: any[] = [tenantId, start, end];
    if (branchId) {
      params.push(branchId);
      sql += ` AND o.branch_id = $${params.length}`;
    }
    sql += ` ORDER BY o.created_at DESC`;

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ sales: rows });
  });

  /**
   * Dedicated Sub-Reports: Purchases Report
   */
  fastify.get('/api/financial/reports/purchases', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        pi.id, pi.invoice_number, pi.created_at, pi.received_at, pi.status,
        pi.subtotal, pi.tax_amount, pi.total_amount, pi.paid_amount, pi.balance_payable,
        s.name as supplier_name, b.name as branch_name,
        (SELECT COUNT(*)::int FROM purchase_items WHERE purchase_id = pi.id) as item_count
      FROM purchase_invoices pi
      JOIN suppliers s ON s.id = pi.supplier_id
      JOIN branches b ON b.id = pi.branch_id
      WHERE pi.tenant_id = $1
        AND pi.created_at >= $2::timestamptz AND pi.created_at <= $3::timestamptz
    `;
    const params: any[] = [tenantId, start, end];
    if (branchId) {
      params.push(branchId);
      sql += ` AND pi.branch_id = $${params.length}`;
    }
    sql += ` ORDER BY pi.created_at DESC`;

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ purchases: rows });
  });

  /**
   * Dedicated Sub-Reports: Expenses Detailed Report
   */
  fastify.get('/api/financial/reports/expenses-detailed', {
    preHandler: [requirePermission(Permission.EXPENSES_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        e.id, e.expense_date, e.amount, e.payment_method, e.description, e.created_at,
        ec.name as category_name, b.name as branch_name, u.full_name as recorded_by_name
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      JOIN branches b ON b.id = e.branch_id
      JOIN users u ON u.id = e.recorded_by_user_id
      WHERE e.tenant_id = $1
        AND e.expense_date >= $2::date AND e.expense_date <= $3::date
    `;
    const params: any[] = [tenantId, start.split('T')[0], end.split('T')[0]];
    if (branchId) {
      params.push(branchId);
      sql += ` AND e.branch_id = $${params.length}`;
    }
    sql += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ expenses: rows });
  });

  /**
   * Dedicated Sub-Reports: Daily Gross Profit & FIFO COGS Report
   */
  fastify.get('/api/financial/reports/gross-profit-report', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        DATE(o.created_at) as report_date,
        COUNT(o.id)::int as order_count,
        COALESCE(SUM(o.subtotal - o.total_discount), 0)::numeric as net_sales,
        COALESCE(SUM(o.grand_total), 0)::numeric as grand_total,
        COALESCE(SUM(cogs_sub.total_cogs), 0)::numeric as fifo_cogs,
        (COALESCE(SUM(o.subtotal - o.total_discount), 0) - COALESCE(SUM(cogs_sub.total_cogs), 0))::numeric as gross_profit,
        CASE
          WHEN SUM(o.subtotal - o.total_discount) > 0
          THEN ((SUM(o.subtotal - o.total_discount) - COALESCE(SUM(cogs_sub.total_cogs), 0)) / SUM(o.subtotal - o.total_discount) * 100)::numeric(5,2)
          ELSE 0
        END as gross_margin_percent
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(cogs), 0) as total_cogs
        FROM order_items
        WHERE order_id = o.id
      ) cogs_sub ON true
      WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
        AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
    `;
    const params: any[] = [tenantId, start, end];
    if (branchId) {
      params.push(branchId);
      sql += ` AND o.branch_id = $${params.length}`;
    }
    sql += ` GROUP BY DATE(o.created_at) ORDER BY report_date DESC`;

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ dailyProfit: rows });
  });

  /**
   * Head Office Consolidated Organization Summary
   * Compares all branches under the tenant and provides consolidated totals
   */
  fastify.get('/api/financial/reports/head-office-summary', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    // 1. Per-Branch Performance Metrics (Gulberg, DHA, etc.)
    const { rows: branchRows } = await query(
      `
      SELECT
        b.id as branch_id,
        b.name as branch_name,
        b.code as branch_code,
        b.is_main_branch,
        b.city,
        COALESCE(orders_data.total_orders, 0)::int as total_orders,
        COALESCE(orders_data.net_sales, 0)::numeric as net_sales,
        COALESCE(orders_data.fifo_cogs, 0)::numeric as fifo_cogs,
        (COALESCE(orders_data.net_sales, 0) - COALESCE(orders_data.fifo_cogs, 0))::numeric as gross_profit,
        CASE
          WHEN COALESCE(orders_data.net_sales, 0) > 0
          THEN ROUND(((COALESCE(orders_data.net_sales, 0) - COALESCE(orders_data.fifo_cogs, 0)) / orders_data.net_sales * 100)::numeric, 1)
          ELSE 0
        END as gross_margin_percent,
        COALESCE(exp_data.total_expenses, 0)::numeric as total_expenses,
        (COALESCE(orders_data.net_sales, 0) - COALESCE(orders_data.fifo_cogs, 0) - COALESCE(exp_data.total_expenses, 0))::numeric as net_profit,
        COALESCE(stock_data.inventory_valuation, 0)::numeric as inventory_valuation,
        COALESCE(active_data.active_orders_count, 0)::int as active_orders_count,
        COALESCE(active_data.served_unpaid_count, 0)::int as served_unpaid_count,
        COALESCE(active_data.unpaid_orders_amount, 0)::numeric as unpaid_orders_amount,
        COALESCE(tbl_data.active_tables, 0)::int as active_tables,
        COALESCE(tbl_data.occupied_tables, 0)::int as occupied_tables,
        COALESCE(dev_data.active_devices, 0)::int as active_devices
      FROM branches b
      LEFT JOIN LATERAL (
        SELECT
          COUNT(o.id) as total_orders,
          SUM(o.subtotal - o.total_discount) as net_sales,
          SUM(cogs_sub.total_cogs) as fifo_cogs
        FROM orders o
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(cogs), 0) as total_cogs
          FROM order_items
          WHERE order_id = o.id
        ) cogs_sub ON true
        WHERE o.tenant_id = $1 AND o.branch_id = b.id AND o.status = 'COMPLETED'
          AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
      ) orders_data ON true
      LEFT JOIN LATERAL (
        SELECT SUM(e.amount) as total_expenses
        FROM expenses e
        WHERE e.tenant_id = $1 AND e.branch_id = b.id
          AND e.expense_date >= $2::date AND e.expense_date <= $3::date
      ) exp_data ON true
      LEFT JOIN LATERAL (
        SELECT SUM(bs.current_stock * bs.cost_per_unit) as inventory_valuation
        FROM branch_stocks bs
        WHERE bs.tenant_id = $1 AND bs.branch_id = b.id
      ) stock_data ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(rt.id) as active_tables,
          COUNT(rt.id) FILTER (WHERE rt.status = 'OCCUPIED') as occupied_tables
        FROM restaurant_tables rt
        WHERE rt.tenant_id = $1 AND rt.branch_id = b.id AND rt.is_active = true
      ) tbl_data ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(rd.id) as active_devices
        FROM registered_devices rd
        WHERE rd.tenant_id = $1 AND rd.branch_id = b.id AND rd.is_active = true
      ) dev_data ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(o.id) as active_orders_count,
          COUNT(o.id) FILTER (WHERE o.status = 'SERVED') as served_unpaid_count,
          COALESCE(SUM(o.grand_total), 0) as unpaid_orders_amount
        FROM orders o
        WHERE o.tenant_id = $1 AND o.branch_id = b.id
          AND o.status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'ON_HOLD')
      ) active_data ON true
      WHERE b.tenant_id = $1 AND b.is_active = true
      ORDER BY b.is_main_branch DESC, b.name ASC
      `,
      [tenantId, start, end],
      { tenantId }
    );

    // 2. Global Consolidated Totals
    const consolidated = {
      totalBranches: branchRows.length,
      totalOrders: branchRows.reduce((acc: number, r: any) => acc + Number(r.total_orders || 0), 0),
      netSales: branchRows.reduce((acc: number, r: any) => acc + Number(r.net_sales || 0), 0),
      fifoCogs: branchRows.reduce((acc: number, r: any) => acc + Number(r.fifo_cogs || 0), 0),
      grossProfit: branchRows.reduce((acc: number, r: any) => acc + Number(r.gross_profit || 0), 0),
      totalExpenses: branchRows.reduce((acc: number, r: any) => acc + Number(r.total_expenses || 0), 0),
      netProfit: branchRows.reduce((acc: number, r: any) => acc + Number(r.net_profit || 0), 0),
      inventoryValuation: branchRows.reduce((acc: number, r: any) => acc + Number(r.inventory_valuation || 0), 0),
      activeOrdersCount: branchRows.reduce((acc: number, r: any) => acc + Number(r.active_orders_count || 0), 0),
      unpaidOrdersAmount: branchRows.reduce((acc: number, r: any) => acc + Number(r.unpaid_orders_amount || 0), 0),
      servedUnpaidCount: branchRows.reduce((acc: number, r: any) => acc + Number(r.served_unpaid_count || 0), 0),
      activeTables: branchRows.reduce((acc: number, r: any) => acc + Number(r.active_tables || 0), 0),
      occupiedTables: branchRows.reduce((acc: number, r: any) => acc + Number(r.occupied_tables || 0), 0),
      activeDevices: branchRows.reduce((acc: number, r: any) => acc + Number(r.active_devices || 0), 0),
    };

    // 3. Top Products Across All Branches
    const { rows: topProducts } = await query(
      `
      SELECT
        oi.product_id as id,
        oi.product_name as name,
        COALESCE(c.name, 'General') as category,
        SUM(oi.quantity)::int as total_quantity_sold,
        SUM(oi.total_price)::numeric as total_revenue,
        COALESCE(SUM(oi.cogs), 0)::numeric as total_cogs,
        (SUM(oi.total_price) - COALESCE(SUM(oi.cogs), 0))::numeric as product_gross_profit
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
        AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
      GROUP BY oi.product_id, oi.product_name, c.name
      ORDER BY total_revenue DESC
      LIMIT 6
      `,
      [tenantId, start, end],
      { tenantId }
    );

    return reply.send({
      period: { start, end },
      consolidated,
      branches: branchRows,
      topProducts,
    });
  });
}
