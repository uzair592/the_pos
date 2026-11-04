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

  // 1b. Active & Unpaid Orders aggregation (Live operations pipeline)
  let activeQuery = `
    SELECT
      COUNT(*)::int as active_orders_count,
      COUNT(*) FILTER (WHERE status = 'SERVED')::int as served_unpaid_count,
      COALESCE(SUM(grand_total), 0)::numeric as unpaid_amount
    FROM orders
    WHERE tenant_id = $1
      AND status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'ON_HOLD')
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
  const totalCollected = netSales + taxCollected + serviceCharges;

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
