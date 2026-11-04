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
  activeOrdersCount?: number;
  servedUnpaidCount?: number;
  unpaidAmount?: number;
}

export enum CashBankTransferType {
  CASH_TO_BANK = 'CASH_TO_BANK', // Cash Deposit
  BANK_TO_CASH = 'BANK_TO_CASH', // Cash Withdrawal
  BANK_TO_BANK = 'BANK_TO_BANK', // Account to Account
}

export interface BankAccount {
  id: string;
  tenantId: string;
  accountName: string;
  bankName: string;
  accountNumber?: string | null;
  iban?: string | null;
  branchCode?: string | null;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashBankTransfer {
  id: string;
  tenantId: string;
  transferType: CashBankTransferType;
  fromBankAccountId?: string | null;
  toBankAccountId?: string | null;
  fromAccountName?: string;
  toAccountName?: string;
  amount: number;
  transferDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
  recordedByUserId?: string | null;
  recordedByName?: string | null;
  createdAt: string;
}

export interface CashBankSummary {
  totalCashInHand: number;
  totalBankBalance: number;
  totalLiquidFunds: number;
  todayCashSales: number;
  todayBankSales: number;
  todayCashDepositedToBank: number;
  todayBankWithdrawnToCash: number;
  todayCashExpenses: number;
  todayBankExpenses: number;
  bankAccounts: BankAccount[];
}
