import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import {
  OpenShiftSchema,
  CashMovementSchema,
  CloseShiftSchema,
  CreateExpenseSchema,
  UpdateExpenseSchema,
  Permission,
  ShiftStatus,
  CreateBankAccountSchema,
  UpdateBankAccountSchema,
  CreateCashBankTransferSchema,
} from '@pos/shared';
import { logAuditEvent } from '../services/auditService.js';
import {
  openShift,
  recordCashMovement,
  closeShift,
  generateFinancialSummary,
  getDaybookData,
} from '../services/financialService.js';
import {
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  deleteCashBankTransfer,
  getCashBankSummary,
  getCashBankTransfers,
  createCashBankTransfer,
  getCashBankLedger,
} from '../services/cashBankService.js';

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
    const { branchId, categoryId, search, startDate, endDate, limit = 100 } = req.query as {
      branchId?: string;
      categoryId?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    };

    let sql = `
      SELECT e.*, 
             ec.name as category_name, 
             b.name as branch_name, 
             u.full_name as recorded_by_name,
             ba.bank_name,
             ba.account_name as bank_account_name
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      JOIN branches b ON b.id = e.branch_id
      LEFT JOIN users u ON u.id = e.recorded_by_user_id
      LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
      WHERE e.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND e.branch_id = $${params.length}`;
    }
    if (categoryId) {
      params.push(categoryId);
      sql += ` AND e.category_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND e.expense_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND e.expense_date <= $${params.length}`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(COALESCE(e.title, '')) LIKE $${params.length} OR LOWER(COALESCE(e.description, '')) LIKE $${params.length} OR LOWER(COALESCE(e.paid_to, '')) LIKE $${params.length} OR LOWER(ec.name) LIKE $${params.length})`;
    }

    sql += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit) || 100);

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ expenses: rows });
  });

  fastify.post('/api/financial/expenses', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateExpenseSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    let { branchId, categoryId, title, amount, paymentMethod, description, notes, paidTo, expenseDate, bankAccountId } = parsed.data as any;

    if (!branchId) {
      branchId = req.user!.branchId;
      if (!branchId) {
        const { rows: bRows } = await query(
          'SELECT id FROM branches WHERE tenant_id = $1 ORDER BY is_main_branch DESC, created_at ASC LIMIT 1',
          [tenantId],
          { tenantId }
        );
        branchId = bRows[0]?.id;
      }
    }

    const effectiveTitle = (title || description || 'Expense').trim();
    const effectiveDesc = (description || title || notes || '').trim();

    const { rows } = await query(
      `
      INSERT INTO expenses (
        tenant_id, branch_id, category_id, title, amount, payment_method, 
        description, notes, paid_to, recorded_by_user_id, expense_date, bank_account_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_DATE), $12)
      RETURNING *
      `,
      [
        tenantId,
        branchId,
        categoryId,
        effectiveTitle,
        amount,
        paymentMethod,
        effectiveDesc,
        notes || null,
        paidTo || null,
        req.user!.id,
        expenseDate || null,
        bankAccountId || null,
      ],
      { tenantId }
    );

    const createdExpense = rows[0];

    // If paid via bank, deduct from bank account balance
    if (bankAccountId && paymentMethod !== 'CASH') {
      await query(
        `UPDATE bank_accounts SET current_balance = current_balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
        [amount, bankAccountId, tenantId],
        { tenantId }
      );
    }

    await logAuditEvent({
      tenantId,
      branchId,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'EXPENSE_RECORDED',
      resourceType: 'EXPENSE',
      resourceId: createdExpense.id,
      metadata: {
        title: effectiveTitle,
        amount,
        paymentMethod,
        paidTo: paidTo || null,
        bankAccountId: bankAccountId || null,
      },
      ipAddress: req.ip,
    });

    return reply.status(201).send({ expense: createdExpense });
  });

  fastify.put('/api/financial/expenses/:id', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateExpenseSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { rows: existingRows } = await query(
      'SELECT * FROM expenses WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    if (existingRows.length === 0) {
      return reply.status(404).send({ error: 'Expense record not found' });
    }

    const old = existingRows[0];
    const data = parsed.data;

    const newBranchId = data.branchId || old.branch_id;
    const newCategoryId = data.categoryId || old.category_id;
    const newTitle = data.title !== undefined ? data.title : old.title;
    const newAmount = data.amount !== undefined ? data.amount : Number(old.amount);
    const newPaymentMethod = data.paymentMethod || old.payment_method;
    const newBankAccountId = data.bankAccountId !== undefined ? data.bankAccountId : old.bank_account_id;
    const newPaidTo = data.paidTo !== undefined ? data.paidTo : old.paid_to;
    const newDesc = data.description !== undefined ? data.description : (newTitle || old.description);
    const newNotes = data.notes !== undefined ? data.notes : old.notes;
    const newDate = data.expenseDate || old.expense_date;

    // Handle bank balance reversal and re-deduction if bank accounts or amounts changed
    if (old.bank_account_id && old.payment_method !== 'CASH') {
      await query(
        `UPDATE bank_accounts SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
        [Number(old.amount), old.bank_account_id, tenantId],
        { tenantId }
      );
    }
    if (newBankAccountId && newPaymentMethod !== 'CASH') {
      await query(
        `UPDATE bank_accounts SET current_balance = current_balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
        [newAmount, newBankAccountId, tenantId],
        { tenantId }
      );
    }

    const { rows: updatedRows } = await query(
      `
      UPDATE expenses
      SET branch_id = $1,
          category_id = $2,
          title = $3,
          amount = $4,
          payment_method = $5,
          bank_account_id = $6,
          paid_to = $7,
          description = $8,
          notes = $9,
          expense_date = $10
      WHERE id = $11 AND tenant_id = $12
      RETURNING *
      `,
      [
        newBranchId,
        newCategoryId,
        newTitle,
        newAmount,
        newPaymentMethod,
        newBankAccountId,
        newPaidTo,
        newDesc,
        newNotes,
        newDate,
        id,
        tenantId,
      ],
      { tenantId }
    );

    await logAuditEvent({
      tenantId,
      branchId: newBranchId,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'EXPENSE_UPDATED',
      resourceType: 'EXPENSE',
      resourceId: id,
      metadata: {
        oldAmount: Number(old.amount),
        newAmount,
        oldTitle: old.title,
        newTitle,
      },
      ipAddress: req.ip,
    });

    return reply.send({ expense: updatedRows[0] });
  });

  fastify.delete('/api/financial/expenses/:id', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows } = await query(
      'SELECT * FROM expenses WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Expense record not found' });
    }

    const exp = rows[0];

    // If paid via bank, refund/restore balance
    if (exp.bank_account_id && exp.payment_method !== 'CASH') {
      await query(
        `UPDATE bank_accounts SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
        [Number(exp.amount), exp.bank_account_id, tenantId],
        { tenantId }
      );
    }

    await query('DELETE FROM expenses WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });

    await logAuditEvent({
      tenantId,
      branchId: exp.branch_id,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'EXPENSE_DELETED',
      resourceType: 'EXPENSE',
      resourceId: id,
      metadata: {
        amount: Number(exp.amount),
        title: exp.title || exp.description,
      },
      ipAddress: req.ip,
    });

    return reply.send({ success: true, message: 'Expense deleted successfully' });
  });

  fastify.get('/api/financial/expenses/categories', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    
    // Core categories requested by restaurant management
    const coreDefaults = [
      { name: 'Staff Salaries', description: 'Monthly salaries, wages, and staff advances' },
      { name: 'Restaurant Rent', description: 'Store, kitchen, or building lease and rent' },
      { name: 'Electricity & Gas Bills', description: 'WAPDA/KESC electricity, Sui Gas bills' },
      { name: 'Water Bills', description: 'Water tanker, supply, and sewerage charges' },
      { name: 'Crockery & Kitchen Equipment', description: 'Plates, utensils, pans, glasses, cutlery' },
      { name: 'Repairs & Maintenance', description: 'Equipment servicing, AC maintenance, plumbing, electrical' },
      { name: 'Cleaning Supplies', description: 'Detergents, dishwashing, mop, sanitizers, trash bags' },
      { name: 'Transportation & Fuel', description: 'Delivery bike petrol, staff conveyance, logistics' },
      { name: 'Miscellaneous Expenses', description: 'Petty cash, office stationery, unexpected overheads' },
    ];

    for (const d of coreDefaults) {
      await query(
        `
        INSERT INTO expense_categories (tenant_id, name, description)
        SELECT $1::uuid, $2::varchar, $3::text
        WHERE NOT EXISTS (
          SELECT 1 FROM expense_categories WHERE tenant_id = $1::uuid AND LOWER(name) = LOWER($2::varchar)
        )
        `,
        [tenantId, d.name, d.description],
        { tenantId }
      );
    }

    const { rows } = await query(
      'SELECT * FROM expense_categories WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId],
      { tenantId }
    );

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
    const { branchId, startDate, endDate, sortBy } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
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

    const orderClause = sortBy === 'sales'
      ? 'ORDER BY total_sales DESC, total_quantity DESC'
      : 'ORDER BY total_quantity DESC, total_sales DESC';

    sql += ` GROUP BY oi.product_id, oi.product_name ${orderClause}`;

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
   * Dedicated Sub-Reports: Monthly Profit & Loss Report
   * Aggregates completed orders, net sales, FIFO COGS, gross profit, expenses, and net profit per month
   */
  fastify.get('/api/financial/reports/monthly-profit-loss', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // 1. Monthly sales and FIFO COGS
    let salesSql = `
      SELECT
        TO_CHAR(o.created_at, 'YYYY-MM') as month_key,
        TO_CHAR(o.created_at, 'Month YYYY') as month_label,
        COUNT(o.id)::int as order_count,
        COALESCE(SUM(o.subtotal - o.total_discount), 0)::numeric as net_sales,
        COALESCE(SUM(o.grand_total), 0)::numeric as grand_total,
        COALESCE(SUM(cogs_sub.total_cogs), 0)::numeric as fifo_cogs,
        (COALESCE(SUM(o.subtotal - o.total_discount), 0) - COALESCE(SUM(cogs_sub.total_cogs), 0))::numeric as gross_profit,
        CASE
          WHEN SUM(o.subtotal - o.total_discount) > 0
          THEN ROUND(((SUM(o.subtotal - o.total_discount) - COALESCE(SUM(cogs_sub.total_cogs), 0)) / SUM(o.subtotal - o.total_discount) * 100)::numeric, 1)
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
    const salesParams: any[] = [tenantId, start, end];
    if (branchId) {
      salesParams.push(branchId);
      salesSql += ` AND o.branch_id = $${salesParams.length}`;
    }
    salesSql += ` GROUP BY TO_CHAR(o.created_at, 'YYYY-MM'), TO_CHAR(o.created_at, 'Month YYYY') ORDER BY month_key DESC`;

    const { rows: salesRows } = await query(salesSql, salesParams, { tenantId });

    // 2. Monthly operating expenses
    let expSql = `
      SELECT
        TO_CHAR(e.expense_date, 'YYYY-MM') as month_key,
        COALESCE(SUM(e.amount), 0)::numeric as total_expenses
      FROM expenses e
      WHERE e.tenant_id = $1
        AND e.expense_date >= $2::date AND e.expense_date <= $3::date
    `;
    const expParams: any[] = [tenantId, start.slice(0, 10), end.slice(0, 10)];
    if (branchId) {
      expParams.push(branchId);
      expSql += ` AND e.branch_id = $${expParams.length}`;
    }
    expSql += ` GROUP BY TO_CHAR(e.expense_date, 'YYYY-MM')`;

    const { rows: expRows } = await query(expSql, expParams, { tenantId });
    const expMap = new Map<string, number>();
    for (const er of expRows) {
      expMap.set(er.month_key, Number(er.total_expenses || 0));
    }

    const monthSet = new Set<string>();
    salesRows.forEach((r: any) => monthSet.add(r.month_key));
    expRows.forEach((r: any) => monthSet.add(r.month_key));

    const sortedMonths = Array.from(monthSet).sort().reverse();
    const monthlyProfit = sortedMonths.map((mKey) => {
      const s = salesRows.find((r: any) => r.month_key === mKey);
      const netSales = s ? Number(s.net_sales || 0) : 0;
      const grandTotal = s ? Number(s.grand_total || 0) : 0;
      const fifoCogs = s ? Number(s.fifo_cogs || 0) : 0;
      const grossProfit = s ? Number(s.gross_profit || 0) : 0;
      const grossMarginPercent = s ? Number(s.gross_margin_percent || 0) : 0;
      const orderCount = s ? Number(s.order_count || 0) : 0;
      const totalExpenses = expMap.get(mKey) || 0;
      const netProfit = grossProfit - totalExpenses;
      const netMarginPercent = netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(1)) : 0;

      const [year, month] = mKey.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, 1);
      const monthLabel = s?.month_label?.trim() || dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      return {
        month_key: mKey,
        month_label: monthLabel,
        order_count: orderCount,
        net_sales: netSales,
        grand_total: grandTotal,
        fifo_cogs: fifoCogs,
        gross_profit: grossProfit,
        gross_margin_percent: grossMarginPercent,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        net_margin_percent: netMarginPercent,
      };
    });

    return reply.send({ monthlyProfit });
  });

    /**
   * Dedicated Sub-Reports: Bill-Wise Profit and Loss Report
   * Exact order-by-order financial reconciliation: Net Sales, FIFO COGS, Gross Profit, and Margin %
   */
  fastify.get('/api/financial/reports/bill-profit-loss', {
    preHandler: [requirePermission(Permission.REPORTS_SALES)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate, orderType, search } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      orderType?: string;
      search?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        o.id,
        o.order_number,
        o.created_at,
        o.order_type,
        o.status,
        o.payment_status,
        o.customer_name,
        o.customer_phone,
        o.rider_name,
        o.rider_phone,
        o.table_number,
        b.name as branch_name,
        o.cashier_name,
        COALESCE(o.subtotal, 0)::numeric as subtotal,
        COALESCE(o.total_discount, 0)::numeric as total_discount,
        (COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0))::numeric as net_sales,
        COALESCE(o.delivery_fee, 0)::numeric as delivery_fee,
        COALESCE(o.tax_amount, 0)::numeric as tax_amount,
        COALESCE(o.service_charge_amount, 0)::numeric as service_charge_amount,
        COALESCE(o.grand_total, 0)::numeric as grand_total,
        COALESCE(cogs_sub.total_cogs, 0)::numeric as fifo_cogs,
        ((COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) - COALESCE(cogs_sub.total_cogs, 0))::numeric as gross_profit,
        CASE
          WHEN (COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) > 0
          THEN (((COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) - COALESCE(cogs_sub.total_cogs, 0)) / (COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) * 100)::numeric(5,2)
          ELSE 0
        END as gross_margin_percent,
        COALESCE((SELECT STRING_AGG(DISTINCT method, ', ') FROM order_payments WHERE order_id = o.id), 'UNPAID') as payment_methods,
        (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(COALESCE(cogs, cost_price * quantity, 0)), 0) as total_cogs
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

    if (orderType && orderType !== 'ALL') {
      params.push(orderType);
      sql += ` AND o.order_type = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.customer_phone ILIKE $${params.length})`;
    }

    sql += ` ORDER BY o.created_at DESC`;

    const { rows: billRows } = await query(sql, params, { tenantId });

    // Fetch items for all matched bills
    const orderIds = billRows.map((r: any) => r.id);
    const itemsByOrderId: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const { rows: itemRows } = await query(
        `
        SELECT
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.product_name,
          oi.variant_name,
          oi.quantity,
          oi.unit_price,
          oi.total_price,
          COALESCE(oi.cogs, oi.cost_price * oi.quantity, 0)::numeric as cogs,
          (oi.total_price - COALESCE(oi.cogs, oi.cost_price * oi.quantity, 0))::numeric as gross_profit,
          CASE
            WHEN oi.total_price > 0
            THEN ((oi.total_price - COALESCE(oi.cogs, oi.cost_price * oi.quantity, 0)) / oi.total_price * 100)::numeric(5,2)
            ELSE 0
          END as gross_margin_percent,
          oi.modifiers
        FROM order_items oi
        WHERE oi.order_id = ANY($1) AND oi.tenant_id = $2
        ORDER BY oi.id ASC
        `,
        [orderIds, tenantId],
        { tenantId }
      );

      for (const item of itemRows) {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          variantName: item.variant_name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          totalPrice: Number(item.total_price),
          cogs: Number(item.cogs),
          grossProfit: Number(item.gross_profit),
          grossMarginPercent: Number(item.gross_margin_percent),
          modifiers: item.modifiers,
        });
      }
    }

    // Format bills with items
    const bills = billRows.map((b: any) => ({
      id: b.id,
      orderNumber: b.order_number,
      createdAt: b.created_at,
      orderType: b.order_type,
      status: b.status,
      paymentStatus: b.payment_status,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      riderName: b.rider_name,
      riderPhone: b.rider_phone,
      tableNumber: b.table_number,
      branchName: b.branch_name,
      cashierName: b.cashier_name,
      subtotal: Number(b.subtotal),
      totalDiscount: Number(b.total_discount),
      netSales: Number(b.net_sales),
      deliveryFee: Number(b.delivery_fee),
      taxAmount: Number(b.tax_amount),
      serviceChargeAmount: Number(b.service_charge_amount),
      grandTotal: Number(b.grand_total),
      fifoCogs: Number(b.fifo_cogs),
      grossProfit: Number(b.gross_profit),
      grossMarginPercent: Number(b.gross_margin_percent),
      paymentMethods: b.payment_methods,
      itemCount: Number(b.item_count),
      items: itemsByOrderId[b.id] || [],
    }));

    // Aggregate summary statistics
    const totalBills = bills.length;
    const totalNetSales = bills.reduce((acc: number, b: any) => acc + b.netSales, 0);
    const totalGrandTotal = bills.reduce((acc: number, b: any) => acc + b.grandTotal, 0);
    const totalCogs = bills.reduce((acc: number, b: any) => acc + b.fifoCogs, 0);
    const totalGrossProfit = bills.reduce((acc: number, b: any) => acc + b.grossProfit, 0);
    const averageProfitPerBill = totalBills > 0 ? Number((totalGrossProfit / totalBills).toFixed(2)) : 0;
    const averageMarginPercent = totalNetSales > 0 ? Number(((totalGrossProfit / totalNetSales) * 100).toFixed(2)) : 0;
    const profitableBillsCount = bills.filter((b: any) => b.grossProfit >= 0).length;
    const lossBillsCount = bills.filter((b: any) => b.grossProfit < 0).length;

    return reply.send({
      summary: {
        totalBills,
        totalNetSales,
        totalGrandTotal,
        totalCogs,
        totalGrossProfit,
        averageProfitPerBill,
        averageMarginPercent,
        profitableBillsCount,
        lossBillsCount,
      },
      bills,
      startDate: start,
      endDate: end,
    });
  });

  /**
   * Export Bill-Wise Profit and Loss Report to CSV
   */
  fastify.get('/api/financial/reports/bill-profit-loss/export', {
    preHandler: [requirePermission(Permission.REPORTS_SALES)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate, orderType } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      orderType?: string;
    };

    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let sql = `
      SELECT
        o.order_number,
        o.created_at,
        o.order_type,
        o.customer_name,
        o.customer_phone,
        b.name as branch_name,
        COALESCE(o.subtotal, 0)::numeric as subtotal,
        COALESCE(o.total_discount, 0)::numeric as total_discount,
        (COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0))::numeric as net_sales,
        COALESCE(o.tax_amount, 0)::numeric as tax_amount,
        COALESCE(o.delivery_fee, 0)::numeric as delivery_fee,
        COALESCE(o.grand_total, 0)::numeric as grand_total,
        COALESCE(cogs_sub.total_cogs, 0)::numeric as fifo_cogs,
        ((COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) - COALESCE(cogs_sub.total_cogs, 0))::numeric as gross_profit,
        CASE
          WHEN (COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) > 0
          THEN (((COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) - COALESCE(cogs_sub.total_cogs, 0)) / (COALESCE(o.subtotal, 0) - COALESCE(o.total_discount, 0)) * 100)::numeric(5,2)
          ELSE 0
        END as gross_margin_percent,
        COALESCE((SELECT STRING_AGG(DISTINCT method, ', ') FROM order_payments WHERE order_id = o.id), 'UNPAID') as payment_methods,
        (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(COALESCE(cogs, cost_price * quantity, 0)), 0) as total_cogs
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

    if (orderType && orderType !== 'ALL') {
      params.push(orderType);
      sql += ` AND o.order_type = $${params.length}`;
    }

    sql += ` ORDER BY o.created_at DESC`;

    const { rows } = await query(sql, params, { tenantId });

    let csv = 'Order Number,Date,Time,Channel,Branch,Customer Name,Customer Phone,Items Count,Subtotal,Discount,Net Sales,FIFO COGS,Gross Profit,Gross Margin %,Tax,Delivery Fee,Grand Total,Payment Methods\n';

    for (const r of rows) {
      const dt = new Date(r.created_at);
      const dateStr = dt.toISOString().split('T')[0];
      const timeStr = dt.toTimeString().split(' ')[0];
      const line = [
        `"${r.order_number}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${r.order_type}"`,
        `"${(r.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
        `"${r.customer_phone || ''}"`,
        r.item_count,
        Number(r.subtotal).toFixed(2),
        Number(r.total_discount).toFixed(2),
        Number(r.net_sales).toFixed(2),
        Number(r.fifo_cogs).toFixed(2),
        Number(r.gross_profit).toFixed(2),
        `${Number(r.gross_margin_percent).toFixed(2)}%`,
        Number(r.tax_amount).toFixed(2),
        Number(r.delivery_fee).toFixed(2),
        Number(r.grand_total).toFixed(2),
        `"${r.payment_methods || 'CASH'}"`,
      ].join(',');
      csv += line + '\n';
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="bill_wise_profit_loss_${start.substring(0, 10)}_${end.substring(0, 10)}.csv"`);
    return reply.send(csv);
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
          AND o.status IN ('PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'ON_HOLD')
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

  /**
   * Daily Daybook: Comprehensive Operations & Financial Ledger
   */
  fastify.get('/api/financial/daybook', {
    preHandler: [requirePermission(Permission.REPORTS_SALES)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, date } = req.query as { branchId?: string; date?: string };

    const daybook = await getDaybookData({
      tenantId,
      branchId: branchId || null,
      date: date || undefined,
    });

    return reply.send({ daybook });
  });

  // =========================================================================
  // CASH & BANK MANAGEMENT ENDPOINTS
  // =========================================================================

  /**
   * List all Bank Accounts for Tenant
   */
  fastify.get('/api/financial/bank-accounts', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const accounts = await getBankAccounts(tenantId);
    return reply.send({ bankAccounts: accounts, accounts });
  });

  /**
   * Create New Bank Account
   */
  fastify.post('/api/financial/bank-accounts', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateBankAccountSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const account = await createBankAccount({
      tenantId,
      ...parsed.data,
    });
    return reply.status(201).send({ bankAccount: account, account });
  });

  /**
   * Update Bank Account
   */
  fastify.put('/api/financial/bank-accounts/:id', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateBankAccountSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const account = await updateBankAccount({
      tenantId,
      id,
      ...parsed.data,
    });
    return reply.send({ bankAccount: account, account });
  });

  /**
   * Delete Bank Account
   */
  fastify.delete('/api/financial/bank-accounts/:id', {
    preHandler: [requirePermission(Permission.EXPENSES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    try {
      const result = await deleteBankAccount(tenantId, id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Cash and Bank Financial Summary
   */
  fastify.get('/api/financial/cash-bank/summary', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { date } = req.query as { date?: string };
    const summary = await getCashBankSummary(tenantId, date);
    return reply.send({ summary });
  });

  /**
   * Cash and Bank Transfers Log
   */
  fastify.get('/api/financial/cash-bank/transfers', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate, transferType } = req.query as { startDate?: string; endDate?: string; transferType?: string };
    const transfers = await getCashBankTransfers(tenantId, { startDate, endDate, transferType });
    return reply.send({ transfers });
  });

  /**
   * Execute Cash ⇄ Bank Transfer
   */
  fastify.post('/api/financial/cash-bank/transfers', {
    preHandler: [requirePermission(Permission.CASH_ADJUST)],
  }, async (req, reply) => {
    const parsed = CreateCashBankTransferSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    try {
      const transfer = await createCashBankTransfer({
        tenantId,
        ...parsed.data,
        transferType: parsed.data.transferType as any,
        userId: req.user!.id,
      });
      return reply.status(201).send({ transfer });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Reverse and Delete Fund Transfer Voucher
   */
  fastify.delete('/api/financial/cash-bank/transfers/:id', {
    preHandler: [requirePermission(Permission.CASH_ADJUST)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    try {
      const result = await deleteCashBankTransfer(tenantId, id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Unified Cash & Bank Ledger Statement
   */
  fastify.get('/api/financial/cash-bank/ledger', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { accountId, startDate, endDate } = req.query as { accountId?: string; startDate?: string; endDate?: string };
    const ledger = await getCashBankLedger(tenantId, { accountId, startDate, endDate });
    return reply.send({ ledger });
  });

}