import { PrepStation } from './menu.js';

export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEAWAY = 'TAKEAWAY',
  DELIVERY = 'DELIVERY',
  COUNTER = 'COUNTER',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET', // e.g. EasyPaisa, JazzCash, ApplePay
  CUSTOMER_CREDIT = 'CUSTOMER_CREDIT',
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  unitPrice: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  station: PrepStation;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  modifiers: SelectedModifier[];
  notes?: string;
  itemDiscount: number;
  taxAmount: number;
  totalPrice: number;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string; // card auth code, transaction ID, etc.
  changeAmount: number;
  paidAt: string;
  recordedByUserId: string;
}

export interface Order {
  id: string;
  tenantId: string;
  branchId: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;

  // Dine-in specifics
  tableId?: string | null;
  tableNumber?: string | null;
  floorName?: string | null;
  coverCount?: number;

  // Delivery / Customer specifics
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryFee: number;

  // Items
  items: OrderItem[];

  // Financial calculations
  subtotal: number;
  itemDiscountsTotal: number;
  billDiscountPercent: number;
  billDiscountAmount: number;
  totalDiscount: number;
  taxPercent: number;
  taxAmount: number;
  serviceChargePercent: number;
  serviceChargeAmount: number;
  grandTotal: number;
  paidAmount: number;
  changeGiven: number;
  balanceDue: number;

  // Attribution & Staff
  cashierId: string;
  cashierName?: string;
  waiterId?: string | null;
  waiterName?: string | null;
  shiftId?: string | null;

  // Auditing & Notes
  orderNotes?: string;
  cancelReason?: string | null;
  cancelledByUserId?: string | null;
  idempotencyKey?: string | null;

  payments: OrderPayment[];

  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}
