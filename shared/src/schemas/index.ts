import { z } from 'zod';
import { SystemRole, Permission } from '../types/auth.js';
import { SubscriptionStatus, SubscriptionPaymentMethod, FeatureKey } from '../types/subscription.js';
import { TableStatus } from '../types/restaurant.js';
import { PrepStation } from '../types/menu.js';
import { OrderType, OrderStatus, PaymentMethod } from '../types/order.js';
import { PrepStatus } from '../types/kds.js';
import { StockUnit, StockMovementType, PurchaseStatus } from '../types/inventory.js';
import { CashMovementType } from '../types/financial.js';

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceFingerprint: z.string().optional(),
  deviceName: z.string().optional(),
});

export const RegisterSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  adminSecretKey: z.string(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.nativeEnum(SystemRole),
  branchId: z.string().uuid().nullable().optional(),
  customPermissions: z.array(z.nativeEnum(Permission)).optional(),
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(SystemRole).optional(),
  branchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  customPermissions: z.array(z.nativeEnum(Permission)).optional(),
});

// Platform Super Admin - Restaurant creation
export const CreateTenantSchema = z.object({
  name: z.string().min(2),
  legalName: z.string().optional(),
  ownerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  country: z.string().default('Pakistan'),
  currency: z.string().default('PKR'),
  timeZone: z.string().default('Asia/Karachi'),
  businessType: z.enum(['CAFE', 'FAST_FOOD', 'FINE_DINE', 'TAKEAWAY', 'BAKERY', 'FOOD_TRUCK', 'OTHER']).default('CAFE'),
  planId: z.string().uuid(),
  initialAdminPassword: z.string().min(6),
  trialDays: z.number().int().min(0).default(14),
});

// Subscription Plan schemas
export const CreatePlanSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).regex(/^[A-Z0-9_-]+$/),
  description: z.string().default(''),
  monthlyPrice: z.number().min(0),
  annualPrice: z.number().min(0),
  currency: z.string().default('PKR'),
  trialDays: z.number().int().min(0).default(14),
  gracePeriodDays: z.number().int().min(0).default(3),
  entitlements: z.object({
    maxBranches: z.number().int(),
    maxStaff: z.number().int(),
    maxDevices: z.number().int(),
    features: z.record(z.nativeEnum(FeatureKey), z.boolean()).default({}),
  }),
});

export const RecordSubscriptionPaymentSchema = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('PKR'),
  paymentMethod: z.nativeEnum(SubscriptionPaymentMethod),
  transactionReference: z.string().min(1),
  paymentDate: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  notes: z.string().optional(),
});

// Restaurant Onboarding
export const OnboardingSchema = z.object({
  legalName: z.string().optional(),
  phone: z.string().min(6),
  address: z.string().min(3),
  city: z.string().min(2),
  currency: z.string().default('PKR'),
  currencySymbol: z.string().default('Rs.'),
  timeZone: z.string().default('Asia/Karachi'),
  taxRatePercent: z.number().min(0).max(100).default(16.0),
  taxRegistrationNumber: z.string().optional(),
  isTaxInclusive: z.boolean().default(false),
  serviceChargePercent: z.number().min(0).max(100).default(0),
  initialBranchName: z.string().min(2).default('Main Branch'),
  receiptSettings: z.object({
    headerText: z.string().optional(),
    footerText: z.string().optional(),
    showLogo: z.boolean().default(true),
    paperWidth: z.enum(['58mm', '80mm', 'A4']).default('80mm'),
    showTaxBreakdown: z.boolean().default(true),
    showCashierName: z.boolean().default(true),
    showCustomerDetails: z.boolean().default(true),
    bilingualUrduEnglish: z.boolean().default(true),
    customUrduHeader: z.string().optional(),
    customUrduFooter: z.string().optional(),
  }).optional(),
});

// Branch & Tables
export const CreateBranchSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().optional(),
  isMainBranch: z.boolean().default(false),
});

export const CreateFloorSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

export const CreateTableSchema = z.object({
  branchId: z.string().uuid(),
  floorId: z.string().uuid(),
  tableNumber: z.string().min(1),
  capacity: z.number().int().positive().default(4),
});

// Categories & Products
export const CreateCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  nameUrdu: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
  imageUrl: z.string().url().optional(),
});

export const CreateProductVariantSchema = z.object({
  name: z.string().min(1),
  nameUrdu: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
});

export const CreateModifierOptionSchema = z.object({
  name: z.string().min(1),
  nameUrdu: z.string().optional(),
  price: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
});

export const CreateModifierGroupSchema = z.object({
  name: z.string().min(1),
  nameUrdu: z.string().optional(),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  options: z.array(CreateModifierOptionSchema).min(1),
});

export const CreateProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  nameUrdu: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  basePrice: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  station: z.nativeEnum(PrepStation).default(PrepStation.KITCHEN),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  trackInventory: z.boolean().default(true),
  dineInPrice: z.number().min(0).optional(),
  takeawayPrice: z.number().min(0).optional(),
  deliveryPrice: z.number().min(0).optional(),
  variants: z.array(CreateProductVariantSchema).optional(),
  modifierGroupIds: z.array(z.string().uuid()).optional(),
});

// Orders & POS Checkout
export const SelectedModifierSchema = z.object({
  groupId: z.string().optional(),
  groupName: z.string().optional(),
  optionId: z.string().optional(),
  optionName: z.string().optional(),
  name: z.string().optional(),
  unitPrice: z.number().min(0).default(0),
});

export const OrderItemInputSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
  notes: z.string().optional(),
  itemDiscount: z.number().min(0).default(0),
  modifiers: z.array(SelectedModifierSchema).default([]),
});

export const CreateOrderSchema = z.object({
  branchId: z.string().uuid(),
  orderType: z.nativeEnum(OrderType),
  tableId: z.string().uuid().nullable().optional(),
  coverCount: z.number().int().positive().optional(),
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryFee: z.number().min(0).default(0),
  billDiscountPercent: z.number().min(0).max(100).default(0),
  billDiscountAmount: z.number().min(0).default(0),
  waiterId: z.string().uuid().nullable().optional(),
  shiftId: z.string().uuid().nullable().optional(),
  orderNotes: z.string().optional(),
  items: z.array(OrderItemInputSchema).min(1),
  idempotencyKey: z.string().optional(),
});

export const PaymentInputSchema = z.object({
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
});

export const CompleteOrderCheckoutSchema = z.object({
  payments: z.array(PaymentInputSchema).min(1),
  changeGiven: z.number().min(0).default(0),
  idempotencyKey: z.string().optional(),
});

export const CancelOrderSchema = z.object({
  reason: z.string().min(3),
});

// Kitchen Display System
export const UpdateKOTStatusSchema = z.object({
  status: z.nativeEnum(PrepStatus),
});

// Inventory & Recipes
export const CreateIngredientSchema = z.object({
  name: z.string().min(1),
  nameUrdu: z.string().optional(),
  sku: z.string().min(1),
  unit: z.nativeEnum(StockUnit),
  costPerUnit: z.number().min(0).default(0),
  minStockAlert: z.number().min(0).default(5),
  initialBranchStock: z.record(z.string().uuid(), z.number().min(0)).optional(), // branchId -> initial stock
});

export const CreateRecipeSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  yieldCount: z.number().positive().default(1),
  ingredients: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().positive(),
      unit: z.nativeEnum(StockUnit),
    })
  ).min(1),
});

export const StockAdjustmentSchema = z.object({
  branchId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  movementType: z.enum([
    StockMovementType.ADJUSTMENT_ADD,
    StockMovementType.ADJUSTMENT_SUBTRACT,
    StockMovementType.WASTAGE,
  ]),
  quantity: z.number().positive(),
  reason: z.string().min(2),
});

export const CreateSupplierSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().optional(),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
});

export const CreatePurchaseInvoiceSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  taxAmount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      unit: z.nativeEnum(StockUnit),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
    })
  ).min(1),
});

// Shifts & Cash
export const OpenShiftSchema = z.object({
  branchId: z.string().uuid(),
  registerName: z.string().default('Main Register'),
  openingCash: z.number().min(0),
});

export const CashMovementSchema = z.object({
  shiftId: z.string().uuid(),
  movementType: z.nativeEnum(CashMovementType),
  amount: z.number().positive(),
  reason: z.string().min(2),
});

export const CloseShiftSchema = z.object({
  actualCash: z.number().min(0),
  closingNotes: z.string().optional(),
});

// Expenses & Refunds
export const CreateExpenseSchema = z.object({
  branchId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  description: z.string().min(2),
  expenseDate: z.string().optional(),
});

export const ProcessRefundSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reason: z.string().min(3),
  restockStock: z.boolean().default(true),
  itemIds: z.array(z.string().uuid()).optional(), // if partial, specify item IDs
});

// Customers
export const CreateCustomerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
});
