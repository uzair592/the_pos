import { query, withTransaction } from '../db/connection.js';
import {
  ShiftStatus,
  CashMovementType,
  PaymentMethod,
  OrderStatus,
  StockMovementType,
  FinancialSummaryReport,
} from '@pos/shared';

export interface OpenShiftParams {
  tenantId: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  registerName: string;
  openingCash: number;
}

export async function openShift(params: OpenShiftParams) {
  const { tenantId, branchId, cashierId, registerName, openingCash } = params;

  // Check if cashier already has an open shift in this branch
  const { rows: existing } = await query(
    'SELECT id FROM register_shifts WHERE tenant_id = $1 AND cashier_id = $2 AND status = $3 LIMIT 1',
    [tenantId, cashierId, ShiftStatus.OPEN],
    { tenantId }
  );

  if (existing.length > 0) {
    return { success: false, shiftId: existing[0].id, message: 'Cashier already has an active open shift' };
  }

  const { rows } = await query(
    `
    INSERT INTO register_shifts (
      tenant_id, branch_id, register_name, cashier_id, status,
      opening_cash, expected_cash, opened_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $6, CURRENT_TIMESTAMP)
    RETURNING *
    `,
    [tenantId, branchId, registerName, cashierId, ShiftStatus.OPEN, openingCash],
    { tenantId }
  );

  return { success: true, shift: rows[0] };
}

export interface RecordCashMovementParams {
  tenantId: string;
  branchId: string;
  shiftId: string;
  userId: string;
  movementType: CashMovementType;
  amount: number;
  reason: string;
}

export async function recordCashMovement(params: RecordCashMovementParams) {
  return await withTransaction(async (client) => {
    const { tenantId, branchId, shiftId, userId, movementType, amount, reason } = params;

    // Insert movement
    const moveRes = await client.query(
      `
      INSERT INTO cash_movements (tenant_id, branch_id, shift_id, movement_type, amount, reason, recorded_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [tenantId, branchId, shiftId, movementType, amount, reason, userId]
    );

    // Update shift expected cash
    if (movementType === CashMovementType.CASH_IN) {
      await client.query(
        'UPDATE register_shifts SET total_cash_in = total_cash_in + $1, expected_cash = expected_cash + $1 WHERE id = $2 AND tenant_id = $3',
        [amount, shiftId, tenantId]
      );
    } else {
      await client.query(
        'UPDATE register_shifts SET total_cash_out = total_cash_out + $1, expected_cash = expected_cash - $1 WHERE id = $2 AND tenant_id = $3',
        [amount, shiftId, tenantId]
      );
    }

    return moveRes.rows[0];
  }, { tenantId: params.tenantId });
}

export interface CloseShiftParams {
  tenantId: string;
  shiftId: string;
  userId: string;
  actualCash: number;
  closingNotes?: string;
}

export async function closeShift(params: CloseShiftParams) {
  return await withTransaction(async (client) => {
    const { tenantId, shiftId, actualCash, closingNotes } = params;

    const shiftRes = await client.query(
      'SELECT * FROM register_shifts WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [shiftId, tenantId]
    );

    if (shiftRes.rows.length === 0) {
      throw new Error('Shift not found');
    }

    const shift = shiftRes.rows[0];
    if (shift.status === ShiftStatus.CLOSED) {
      return { success: false, message: 'Shift is already closed', shift };
    }

    const expectedCash = Number(shift.opening_cash) +
      Number(shift.total_cash_sales) -
      Number(shift.total_cash_refunds) +
      Number(shift.total_cash_in) -
      Number(shift.total_cash_out);

    const cashVariance = actualCash - expectedCash;

    const updateRes = await client.query(
      `
      UPDATE register_shifts
      SET status = $1, actual_cash = $2, expected_cash = $3, cash_variance = $4,
          closing_notes = $5, closed_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND tenant_id = $7
      RETURNING *
      `,
      [ShiftStatus.CLOSED, actualCash, expectedCash, cashVariance, closingNotes || null, shiftId, tenantId]
    );

    return { success: true, shift: updateRes.rows[0] };
  }, { tenantId: params.tenantId });
}

export interface FinancialReportFilters {
  tenantId: string;
  branchId?: string | null;
  startDate: string;
  endDate: string;
}

export async function generateFinancialSummary(filters: FinancialReportFilters): Promise<FinancialSummaryReport> {
  const { tenantId, branchId, startDate, endDate } = filters;

  // 1. Orders aggregation
  let orderQuery = `
    SELECT
      COUNT(*)::int as total_orders,
      COALESCE(SUM(subtotal), 0)::numeric as gross_sales,
      COALESCE(SUM(total_discount), 0)::numeric as discounts,
      COALESCE(SUM(tax_amount), 0)::numeric as tax_collected,
      COALESCE(SUM(service_charge_amount), 0)::numeric as service_charges,
      COALESCE(SUM(delivery_fee), 0)::numeric as delivery_fees,
      COALESCE(SUM(grand_total), 0)::numeric as grand_total_sum
    FROM orders
    WHERE tenant_id = $1 AND status = 'COMPLETED'
      AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz
  `;
  const orderParams: any[] = [tenantId, startDate, endDate];
  if (branchId) {
    orderQuery += ` AND branch_id = $4`;
    orderParams.push(branchId);
  }

  const { rows: orderAgg } = await query(orderQuery, orderParams, { tenantId });
  const o = orderAgg[0] || {};
  const totalOrders = Number(o.total_orders || 0);
  const grossSales = Number(o.gross_sales || 0);
  const discounts = Number(o.discounts || 0);
  const taxCollected = Number(o.tax_collected || 0);
  const serviceCharges = Number(o.service_charges || 0);
  const deliveryFees = Number(o.delivery_fees || 0);

  // 1b. Active & Unpaid Orders aggregation (Live operations pipeline)
  let activeQuery = `
    SELECT
      COUNT(*)::int as active_orders_count,
      COUNT(*) FILTER (WHERE status = 'SERVED')::int as served_unpaid_count,
      COALESCE(SUM(grand_total), 0)::numeric as unpaid_amount
    FROM orders
    WHERE tenant_id = $1
      AND status IN ('PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'ON_HOLD')
  `;
  const activeParams: any[] = [tenantId];
  if (branchId) {
    activeQuery += ` AND branch_id = $2`;
    activeParams.push(branchId);
  }
  const { rows: activeAgg } = await query(activeQuery, activeParams, { tenantId });
  const activeOrdersCount = Number(activeAgg[0]?.active_orders_count || 0);
  const servedUnpaidCount = Number(activeAgg[0]?.served_unpaid_count || 0);
  const unpaidAmount = Number(activeAgg[0]?.unpaid_amount || 0);

  // 2. Refunds aggregation
  let refundQuery = `
    SELECT COALESCE(SUM(total_refund_amount), 0)::numeric as refunds
    FROM order_refunds
    WHERE tenant_id = $1 AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz
  `;
  const refundParams: any[] = [tenantId, startDate, endDate];
  if (branchId) {
    refundQuery += ` AND branch_id = $4`;
    refundParams.push(branchId);
  }
  const { rows: refundAgg } = await query(refundQuery, refundParams, { tenantId });
  const refunds = Number(refundAgg[0]?.refunds || 0);

  // Net Sales formula: Gross Sales - Discounts - Refunds (Excluding Tax)
  const netSales = Math.max(0, grossSales - discounts - refunds);
  const totalCollected = netSales + taxCollected + serviceCharges + deliveryFees;

  // 3. Cost of Goods Sold (COGS) from exact FIFO batch consumptions
  let cogsQuery = `
    SELECT COALESCE(SUM(total_cost), 0)::numeric as cogs
    FROM order_item_batch_consumptions
    WHERE tenant_id = $1
      AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz
  `;
  const cogsParams: any[] = [tenantId, startDate, endDate];
  if (branchId) {
    cogsQuery += ` AND branch_id = $4`;
    cogsParams.push(branchId);
  }
  const { rows: cogsAgg } = await query(cogsQuery, cogsParams, { tenantId });
  let costOfGoodsSold = Number(cogsAgg[0]?.cogs || 0);

  // Fallback to stock movements if no FIFO batch consumptions exist yet
  if (costOfGoodsSold === 0) {
    let fallbackCogs = `
      SELECT COALESCE(SUM(total_cost), 0)::numeric as cogs
      FROM stock_movements
      WHERE tenant_id = $1 AND movement_type = 'SALE_CONSUMPTION'
        AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz
    `;
    const fbParams: any[] = [tenantId, startDate, endDate];
    if (branchId) {
      fallbackCogs += ` AND branch_id = $4`;
      fbParams.push(branchId);
    }
    const { rows: fbAgg } = await query(fallbackCogs, fbParams, { tenantId });
    costOfGoodsSold = Number(fbAgg[0]?.cogs || 0);
  }

  // Gross Profit formula: Net Sales - COGS
  const grossProfit = netSales - costOfGoodsSold;
  const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // 4. Operating Expenses
  let expQuery = `
    SELECT COALESCE(SUM(amount), 0)::numeric as total_expenses
    FROM expenses
    WHERE tenant_id = $1 AND expense_date >= $2::date AND expense_date <= $3::date
  `;
  const expParams: any[] = [tenantId, startDate.split('T')[0], endDate.split('T')[0]];
  if (branchId) {
    expQuery += ` AND branch_id = $4`;
    expParams.push(branchId);
  }
  const { rows: expAgg } = await query(expQuery, expParams, { tenantId });
  const totalExpenses = Number(expAgg[0]?.total_expenses || 0);

  // Operating Profit formula: Gross Profit - Operating Expenses
  const operatingProfit = grossProfit - totalExpenses;
  const operatingMarginPercent = netSales > 0 ? (operatingProfit / netSales) * 100 : 0;

  // 5. Payment Breakdown
  let payQuery = `
    SELECT op.method, COALESCE(SUM(op.amount), 0)::numeric as sum_amount
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    WHERE op.tenant_id = $1 AND o.status = 'COMPLETED'
      AND op.paid_at >= $2::timestamptz AND op.paid_at <= $3::timestamptz
  `;
  const payParams: any[] = [tenantId, startDate, endDate];
  if (branchId) {
    payQuery += ` AND o.branch_id = $4`;
    payParams.push(branchId);
  }
  payQuery += ` GROUP BY op.method`;

  const { rows: payAgg } = await query(payQuery, payParams, { tenantId });
  const paymentBreakdown: Record<PaymentMethod, number> = {
    [PaymentMethod.CASH]: 0,
    [PaymentMethod.CARD]: 0,
    [PaymentMethod.BANK_TRANSFER]: 0,
    [PaymentMethod.DIGITAL_WALLET]: 0,
    [PaymentMethod.CUSTOMER_CREDIT]: 0,
  };

  for (const p of payAgg) {
    if (paymentBreakdown[p.method as PaymentMethod] !== undefined) {
      paymentBreakdown[p.method as PaymentMethod] = Number(p.sum_amount);
    }
  }

  return {
    startDate,
    endDate,
    branchId: branchId || null,
    totalOrders,
    grossSales,
    discounts,
    refunds,
    netSales,
    taxCollected,
    serviceCharges,
    totalCollected,
    costOfGoodsSold,
    grossProfit,
    grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
    totalExpenses,
    operatingProfit,
    operatingMarginPercent: Math.round(operatingMarginPercent * 100) / 100,
    paymentBreakdown,
    activeOrdersCount,
    servedUnpaidCount,
    unpaidAmount,
  };
}

export interface DaybookFilters {
  tenantId: string;
  branchId?: string | null;
  date?: string; // YYYY-MM-DD
}

export interface DaybookData {
  date: string;
  displayDate: string;
  branchId: string | null;
  branchName: string;
  currencySymbol: string;
  summary: {
    totalGrossSales: number;
    totalNetSales: number;
    totalTax: number;
    totalDiscounts: number;
    totalDeliveryFees: number;
    totalServiceCharges?: number;
    totalGrandTotal: number;
    completedOrdersCount: number;
    activeOrdersCount: number;
    cancelledOrdersCount: number;
    refundedOrdersCount: number;
    totalRefundedAmount: number;

    totalPurchasesAmount: number;
    totalPurchasesPaid: number;
    totalPurchasesUnpaid: number;
    purchasesCount: number;

    totalIngredientsCost: number; // FIFO COGS
    grossProfit: number;
    grossMarginPercent: number;

    totalWastageCost: number;
    totalWastageQuantity: number;
    wastageCount: number;

    totalExpensesAmount: number;
    totalCashExpenses: number;
    expensesCount: number;

    openingRegisterCash: number;
    cashSalesCollected: number;
    nonCashSalesCollected: number;
    netDailyProfit: number;
    netOperatingCashPosition: number;
  };
  paymentMethods: Array<{
    method: string;
    totalAmount: number;
    transactionCount: number;
    percentage: number;
  }>;
  salesOrders: Array<{
    id: string;
    orderNumber: string;
    orderType: string;
    tableNumber: string | null;
    customerName: string | null;
    customerPhone: string | null;
    riderName: string | null;
    status: string;
    paymentStatus: string;
    grandTotal: number;
    taxAmount: number;
    totalDiscount: number;
    deliveryFee: number;
    cashierName: string;
    createdAt: string;
    branchName: string;
    paymentMethods: string | null;
    itemsCount: number;
  }>;
  purchases: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    balancePayable: number;
    status: string;
    createdAt: string;
    receivedAt: string | null;
    supplierName: string;
    branchName: string;
    receivedByName: string | null;
    itemsCount: number;
  }>;
  ingredientConsumptions: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    totalQuantityUsed: number;
    totalFifoCost: number;
    ordersCount: number;
  }>;
  wastageRecords: Array<{
    id: string;
    ingredientId: string;
    ingredientName: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    reason: string;
    recordedByName: string | null;
    branchName: string;
    createdAt: string;
  }>;
  expenses: Array<{
    id: string;
    categoryName: string;
    description: string;
    amount: number;
    paymentMethod: string;
    recordedByName: string | null;
    branchName: string;
    expenseDate: string;
    createdAt: string;
  }>;
  shifts: Array<{
    id: string;
    cashierName: string;
    branchName: string;
    openedAt: string;
    closedAt: string | null;
    openingCash: number;
    cashSales: number;
    cashIn: number;
    cashOut: number;
    expectedCash: number;
    actualCash: number | null;
    variance: number | null;
    status: string;
    closingNotes: string | null;
  }>;
}

export async function getDaybookData(filters: DaybookFilters): Promise<DaybookData> {
  const { tenantId, branchId } = filters;
  const dNow = new Date();
  const defaultLocalDate = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
  const targetDate = filters.date || defaultLocalDate;
  const startDate = `${targetDate} 00:00:00.000`;
  const endDate = `${targetDate} 23:59:59.999`;

  // 1. Resolve Branch Name & Currency Symbol
  let branchName = 'All Branches Consolidated';
  if (branchId) {
    const bRes = await query('SELECT name FROM branches WHERE id = $1 AND tenant_id = $2', [branchId, tenantId], { tenantId });
    if (bRes.rows.length > 0) branchName = bRes.rows[0].name;
  }

  const sRes = await query('SELECT currency_symbol FROM restaurant_settings WHERE tenant_id = $1', [tenantId], { tenantId });
  const currencySymbol = sRes.rows[0]?.currency_symbol || 'Rs.';

  const branchParam = branchId ? [branchId] : [];
  const baseParams = [tenantId, startDate, endDate, ...branchParam];
  const bClauseOrders = branchId ? 'AND o.branch_id = $4' : '';
  const bClausePurchases = branchId ? 'AND p.branch_id = $4' : '';
  const bClauseStock = branchId ? 'AND sm.branch_id = $4' : '';
  const bClauseExp = branchId ? 'AND e.branch_id = $4' : '';
  const bClauseShifts = branchId ? 'AND rs.branch_id = $4' : '';
  const bClauseConsumptions = branchId ? 'AND c.branch_id = $4' : '';

  // 2. Orders Summary (Completed, Active, Cancelled, Totals)
  const ordersSummaryRes = await query(
    `
    SELECT
      COUNT(*)::int as total_orders,
      COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END)::int as completed_count,
      COUNT(CASE WHEN o.status IN ('PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'OUT_FOR_DELIVERY') THEN 1 END)::int as active_count,
      COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END)::int as cancelled_count,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.subtotal ELSE 0 END), 0)::numeric as total_gross_sales,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN (o.subtotal - o.total_discount) ELSE 0 END), 0)::numeric as total_net_sales,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.service_charge_amount ELSE 0 END), 0)::numeric as total_service_charges,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.tax_amount ELSE 0 END), 0)::numeric as total_tax,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_discount ELSE 0 END), 0)::numeric as total_discounts,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.delivery_fee ELSE 0 END), 0)::numeric as total_delivery_fees,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.grand_total ELSE 0 END), 0)::numeric as total_grand_total
    FROM orders o
    WHERE o.tenant_id = $1
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
      ${bClauseOrders}
    `,
    baseParams,
    { tenantId }
  );
  const oSum = ordersSummaryRes.rows[0] || {};

  // 3. Refunds Summary
  const refundsRes = await query(
    `
    SELECT
      COUNT(*)::int as refund_count,
      COALESCE(SUM(r.total_refund_amount), 0)::numeric as total_refund_amount
    FROM order_refunds r
    WHERE r.tenant_id = $1
      AND r.created_at >= $2::timestamptz AND r.created_at <= $3::timestamptz
      ${branchId ? 'AND r.branch_id = $4' : ''}
    `,
    baseParams,
    { tenantId }
  );
  const refSum = refundsRes.rows[0] || {};

  // 4. Payment Methods Breakdown
  const paymentsRes = await query(
    `
    SELECT
      op.method,
      COALESCE(SUM(op.amount), 0)::numeric as total_amount,
      COUNT(*)::int as transaction_count
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    WHERE o.tenant_id = $1
      AND o.status = 'COMPLETED'
      AND op.paid_at >= $2::timestamptz AND op.paid_at <= $3::timestamptz
      ${bClauseOrders}
    GROUP BY op.method
    ORDER BY total_amount DESC
    `,
    baseParams,
    { tenantId }
  );

  const totalCollectedSum = paymentsRes.rows.reduce((acc, r) => acc + Number(r.total_amount), 0);
  const paymentMethods = paymentsRes.rows.map((r) => ({
    method: r.method,
    totalAmount: Number(r.total_amount),
    transactionCount: Number(r.transaction_count),
    percentage: totalCollectedSum > 0 ? Math.round((Number(r.total_amount) / totalCollectedSum) * 100) : 0,
  }));

  // 5. Purchases Done Today
  const purchasesRes = await query(
    `
    SELECT
      p.id,
      p.invoice_number,
      p.total_amount,
      p.paid_amount,
      p.balance_payable,
      p.status,
      p.created_at,
      p.received_at,
      s.name as supplier_name,
      b.name as branch_name,
      u.full_name as received_by_name,
      (SELECT COUNT(*)::int FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
    FROM purchase_invoices p
    JOIN suppliers s ON s.id = p.supplier_id
    JOIN branches b ON b.id = p.branch_id
    LEFT JOIN users u ON u.id = p.recorded_by_user_id
    WHERE p.tenant_id = $1
      AND (p.created_at >= $2::timestamptz AND p.created_at <= $3::timestamptz OR (p.received_at IS NOT NULL AND p.received_at >= $2::timestamptz AND p.received_at <= $3::timestamptz))
      ${bClausePurchases}
    ORDER BY p.created_at DESC
    `,
    baseParams,
    { tenantId }
  );

  const purchases = purchasesRes.rows.map((p) => ({
    id: p.id,
    invoiceNumber: p.invoice_number,
    totalAmount: Number(p.total_amount),
    paidAmount: Number(p.paid_amount),
    balancePayable: Number(p.balance_payable),
    status: p.status,
    createdAt: p.created_at,
    receivedAt: p.received_at,
    supplierName: p.supplier_name,
    branchName: p.branch_name,
    receivedByName: p.received_by_name,
    itemsCount: Number(p.items_count || 0),
  }));

  // 6. Ingredients Consumed in Today's Sales (FIFO COGS)
  const consumptionsRes = await query(
    `
    SELECT
      i.id as ingredient_id,
      i.name as ingredient_name,
      i.unit,
      COALESCE(SUM(c.quantity), 0)::numeric as total_quantity_used,
      COALESCE(SUM(c.total_cost), 0)::numeric as total_fifo_cost,
      COUNT(DISTINCT c.order_id)::int as orders_count
    FROM order_item_batch_consumptions c
    JOIN ingredients i ON i.id = c.ingredient_id
    JOIN orders o ON o.id = c.order_id
    WHERE c.tenant_id = $1
      AND o.status = 'COMPLETED'
      AND c.created_at >= $2::timestamptz AND c.created_at <= $3::timestamptz
      ${bClauseConsumptions}
    GROUP BY i.id, i.name, i.unit
    ORDER BY total_fifo_cost DESC
    `,
    baseParams,
    { tenantId }
  );

  const ingredientConsumptions = consumptionsRes.rows.map((c) => ({
    ingredientId: c.ingredient_id,
    ingredientName: c.ingredient_name,
    unit: c.unit,
    totalQuantityUsed: Number(c.total_quantity_used),
    totalFifoCost: Number(c.total_fifo_cost),
    ordersCount: Number(c.orders_count),
  }));

  // 7. Wastage Log Today
  const wastageRes = await query(
    `
    SELECT
      sm.id,
      sm.ingredient_id,
      sm.quantity,
      sm.unit_cost,
      sm.total_cost,
      sm.reason,
      sm.created_at,
      i.name as ingredient_name,
      i.unit,
      b.name as branch_name,
      u.full_name as recorded_by_name
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id
    JOIN branches b ON b.id = sm.branch_id
    LEFT JOIN users u ON u.id = sm.recorded_by_user_id
    WHERE sm.tenant_id = $1
      AND sm.movement_type = 'WASTAGE'
      AND sm.created_at >= $2::timestamptz AND sm.created_at <= $3::timestamptz
      ${bClauseStock}
    ORDER BY sm.created_at DESC
    `,
    baseParams,
    { tenantId }
  );

  const wastageRecords = wastageRes.rows.map((w) => ({
    id: w.id,
    ingredientId: w.ingredient_id,
    ingredientName: w.ingredient_name,
    unit: w.unit,
    quantity: Math.abs(Number(w.quantity)),
    unitCost: Number(w.unit_cost),
    totalCost: Math.abs(Number(w.total_cost)),
    reason: w.reason || 'Recorded as kitchen wastage',
    recordedByName: w.recorded_by_name,
    branchName: w.branch_name,
    createdAt: w.created_at,
  }));

  // 8. Expenses Done Today
  const expensesRes = await query(
    `
    SELECT
      e.id,
      e.title,
      e.amount,
      e.payment_method,
      e.description,
      e.paid_to,
      e.notes,
      e.expense_date,
      e.created_at,
      ec.name as category_name,
      b.name as branch_name,
      u.full_name as recorded_by_name
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    JOIN branches b ON b.id = e.branch_id
    LEFT JOIN users u ON u.id = e.recorded_by_user_id
    WHERE e.tenant_id = $1
      AND (e.created_at >= $2::timestamptz AND e.created_at <= $3::timestamptz OR e.expense_date = $2::date)
      ${bClauseExp}
    ORDER BY e.created_at DESC
    `,
    baseParams,
    { tenantId }
  );

  const expenses = expensesRes.rows.map((e) => ({
    id: e.id,
    title: e.title || e.description,
    categoryName: e.category_name,
    description: e.description,
    paidTo: e.paid_to,
    notes: e.notes,
    amount: Number(e.amount),
    paymentMethod: e.payment_method,
    recordedByName: e.recorded_by_name,
    branchName: e.branch_name,
    expenseDate: e.expense_date,
    createdAt: e.created_at,
  }));

  // 9. Register Shifts Today
  const shiftsRes = await query(
    `
    SELECT
      rs.id,
      rs.opened_at,
      rs.closed_at,
      rs.opening_cash,
      rs.total_cash_sales,
      rs.total_cash_in,
      rs.total_cash_out,
      rs.expected_cash,
      rs.actual_cash,
      rs.cash_variance,
      rs.status,
      rs.closing_notes,
      u.full_name as cashier_name,
      b.name as branch_name
    FROM register_shifts rs
    JOIN users u ON u.id = rs.cashier_id
    JOIN branches b ON b.id = rs.branch_id
    WHERE rs.tenant_id = $1
      AND (rs.opened_at >= $2::timestamptz AND rs.opened_at <= $3::timestamptz OR (rs.closed_at IS NOT NULL AND rs.closed_at >= $2::timestamptz AND rs.closed_at <= $3::timestamptz))
      ${bClauseShifts}
    ORDER BY rs.opened_at DESC
    `,
    baseParams,
    { tenantId }
  );

  const shifts = shiftsRes.rows.map((s) => ({
    id: s.id,
    cashierName: s.cashier_name,
    branchName: s.branch_name,
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    openingCash: Number(s.opening_cash || 0),
    cashSales: Number(s.total_cash_sales || 0),
    cashIn: Number(s.total_cash_in || 0),
    cashOut: Number(s.total_cash_out || 0),
    expectedCash: Number(s.expected_cash || 0),
    actualCash: s.actual_cash !== null ? Number(s.actual_cash) : null,
    variance: s.cash_variance !== null ? Number(s.cash_variance) : null,
    status: s.status,
    closingNotes: s.closing_notes,
  }));

  // 10. Detailed Sales Orders List
  const ordersListRes = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.order_type,
      o.table_number,
      o.customer_name,
      o.customer_phone,
      o.rider_name,
      o.status,
      o.payment_status,
      o.grand_total,
      o.tax_amount,
      o.total_discount,
      o.delivery_fee,
      o.cashier_name,
      o.created_at,
      b.name as branch_name,
      (SELECT string_agg(DISTINCT op.method, ', ') FROM order_payments op WHERE op.order_id = o.id) as payment_methods,
      (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) as items_count
    FROM orders o
    JOIN branches b ON b.id = o.branch_id
    WHERE o.tenant_id = $1
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
      ${bClauseOrders}
    ORDER BY o.created_at DESC
    `,
    baseParams,
    { tenantId }
  );

  const salesOrders = ordersListRes.rows.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    orderType: o.order_type,
    tableNumber: o.table_number,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    riderName: o.rider_name,
    status: o.status,
    paymentStatus: o.payment_status,
    grandTotal: Number(o.grand_total),
    taxAmount: Number(o.tax_amount),
    totalDiscount: Number(o.total_discount),
    deliveryFee: Number(o.delivery_fee),
    cashierName: o.cashier_name,
    createdAt: o.created_at,
    branchName: o.branch_name,
    paymentMethods: o.payment_methods,
    itemsCount: Number(o.items_count || 0),
  }));

  // Calculations for Summary
  const totalGrossSales = Number(oSum.total_gross_sales || 0);
  const totalNetSales = Number(oSum.total_net_sales || 0);
  const totalTax = Number(oSum.total_tax || 0);
  const totalDiscounts = Number(oSum.total_discounts || 0);
  const totalDeliveryFees = Number(oSum.total_delivery_fees || 0);
  const totalServiceCharges = Number(oSum.total_service_charges || 0);
  const totalGrandTotal = Number(oSum.total_grand_total || 0);
  const completedOrdersCount = Number(oSum.completed_count || 0);
  const activeOrdersCount = Number(oSum.active_count || 0);
  const cancelledOrdersCount = Number(oSum.cancelled_count || 0);
  const refundedOrdersCount = Number(refSum.refund_count || 0);
  const totalRefundedAmount = Number(refSum.total_refund_amount || 0);

  const totalPurchasesAmount = purchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalPurchasesPaid = purchases.reduce((acc, p) => acc + p.paidAmount, 0);
  const totalPurchasesUnpaid = Math.max(0, totalPurchasesAmount - totalPurchasesPaid);

  const totalIngredientsCost = ingredientConsumptions.reduce((acc, i) => acc + i.totalFifoCost, 0);
  const grossProfit = totalNetSales - totalIngredientsCost;
  const grossMarginPercent = totalNetSales > 0 ? Math.round((grossProfit / totalNetSales) * 100) : 0;

  const totalWastageCost = wastageRecords.reduce((acc, w) => acc + w.totalCost, 0);
  const totalWastageQuantity = wastageRecords.reduce((acc, w) => acc + w.quantity, 0);

  const totalExpensesAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalCashExpenses = expenses.filter((e) => e.paymentMethod === 'CASH').reduce((acc, e) => acc + e.amount, 0);

  const openingRegisterCash = shifts.reduce((acc, s) => acc + s.openingCash, 0);
  const cashSalesCollected = paymentMethods.find((p) => p.method === 'CASH')?.totalAmount || 0;
  const nonCashSalesCollected = paymentMethods.filter((p) => p.method !== 'CASH').reduce((acc, p) => acc + p.totalAmount, 0);

  const netDailyProfit = grossProfit - totalExpensesAmount - totalWastageCost;
  const netOperatingCashPosition = (openingRegisterCash + cashSalesCollected) - totalCashExpenses;

  // Format Human Readable Date
  const parsedD = new Date(`${targetDate}T12:00:00`);
  const displayDate = parsedD.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    date: targetDate,
    displayDate,
    branchId: branchId || null,
    branchName,
    currencySymbol,
    summary: {
      totalGrossSales,
      totalNetSales,
      totalTax,
      totalDiscounts,
      totalDeliveryFees,
      totalServiceCharges,
      totalGrandTotal,
      completedOrdersCount,
      activeOrdersCount,
      cancelledOrdersCount,
      refundedOrdersCount,
      totalRefundedAmount,

      totalPurchasesAmount,
      totalPurchasesPaid,
      totalPurchasesUnpaid,
      purchasesCount: purchases.length,

      totalIngredientsCost,
      grossProfit,
      grossMarginPercent,

      totalWastageCost,
      totalWastageQuantity,
      wastageCount: wastageRecords.length,

      totalExpensesAmount,
      totalCashExpenses,
      expensesCount: expenses.length,

      openingRegisterCash,
      cashSalesCollected,
      nonCashSalesCollected,
      netDailyProfit,
      netOperatingCashPosition,
    },
    paymentMethods,
    salesOrders,
    purchases,
    ingredientConsumptions,
    wastageRecords,
    expenses,
    shifts,
  };
}
