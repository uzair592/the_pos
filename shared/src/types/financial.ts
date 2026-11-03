import { PaymentMethod } from './order.js';

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMovementType {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
}

export interface CashMovement {
  id: string;
  shiftId: string;
  tenantId: string;
  branchId: string;
  movementType: CashMovementType;
  amount: number;
  reason: string;
  recordedByUserId: string;
  createdAt: string;
}

export interface RegisterShift {
  id: string;
  tenantId: string;
  branchId: string;
  registerName: string;
  cashierId: string;
  cashierName?: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  totalCashSales: number;
  totalCashRefunds: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number; // openingCash + totalCashSales - totalCashRefunds + totalCashIn - totalCashOut
  actualCash?: number | null;
  cashVariance?: number | null; // actualCash - expectedCash
  closingNotes?: string;
}

export interface ExpenseCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  branchId: string;
  categoryId: string;
  categoryName?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
  receiptUrl?: string;
  recordedByUserId: string;
  expenseDate: string;
  createdAt: string;
}

export interface RefundItem {
  id: string;
  refundId: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  restockStock: boolean;
}

export interface OrderRefund {
  id: string;
  tenantId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  refundNumber: string;
  totalRefundAmount: number;
  paymentMethod: PaymentMethod;
  reason: string;
  authorizedByUserId: string;
  authorizedByName?: string;
  items: RefundItem[];
  createdAt: string;
}

export interface FinancialSummaryReport {
  startDate: string;
  endDate: string;
  branchId?: string | null;
  totalOrders: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number; // grossSales - discounts - refunds (excluding sales tax)
  taxCollected: number;
  serviceCharges: number;
  totalCollected: number; // netSales + taxCollected + serviceCharges
  costOfGoodsSold: number; // inventory consumption cost
  grossProfit: number; // netSales - costOfGoodsSold
  grossMarginPercent: number; // (grossProfit / netSales) * 100
  totalExpenses: number;
  operatingProfit: number; // grossProfit - totalExpenses
  operatingMarginPercent: number;
  paymentBreakdown: Record<PaymentMethod, number>;
}
