export enum StockUnit {
  KG = 'KG',
  G = 'G',
  L = 'L',
  ML = 'ML',
  PCS = 'PCS',
  DOZEN = 'DOZEN',
  PACK = 'PACK',
}

export interface Ingredient {
  id: string;
  tenantId: string;
  name: string;
  nameUrdu?: string;
  sku: string;
  unit: StockUnit;
  costPerUnit: number; // weighted average cost
  minStockAlert: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchStock {
  id: string;
  tenantId: string;
  branchId: string;
  ingredientId: string;
  ingredientName?: string;
  unit?: StockUnit;
  currentStock: number;
  costPerUnit: number;
  lastUpdated: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  ingredientName?: string;
  quantity: number; // quantity in ingredient's base unit
  unit: StockUnit;
  unitCost?: number;
  totalCost?: number;
}

export interface Recipe {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string | null;
  productName?: string;
  variantName?: string;
  yieldCount: number; // usually 1 serving
  totalCost: number; // computed sum of ingredient costs
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export enum StockMovementType {
  PURCHASE_RECEIVE = 'PURCHASE_RECEIVE',
  SALE_CONSUMPTION = 'SALE_CONSUMPTION',
  ADJUSTMENT_ADD = 'ADJUSTMENT_ADD',
  ADJUSTMENT_SUBTRACT = 'ADJUSTMENT_SUBTRACT',
  WASTAGE = 'WASTAGE',
  RETURN_TO_SUPPLIER = 'RETURN_TO_SUPPLIER',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  REFUND_RESTOCK = 'REFUND_RESTOCK',
}

export interface StockMovement {
  id: string;
  tenantId: string;
  branchId: string;
  ingredientId: string;
  ingredientName?: string;
  movementType: StockMovementType;
  quantity: number; // positive or negative
  stockBefore: number;
  stockAfter: number;
  unitCost: number;
  totalCost: number;
  referenceType?: 'ORDER' | 'PURCHASE' | 'TRANSFER' | 'ADJUSTMENT' | 'WASTAGE';
  referenceId?: string;
  reason?: string;
  recordedByUserId: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  balancePayable: number;
  isActive: boolean;
  createdAt: string;
}

export enum PurchaseStatus {
  DRAFT = 'DRAFT',
  ORDERED = 'ORDERED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  ingredientId: string;
  ingredientName?: string;
  unit: StockUnit;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseInvoice {
  id: string;
  tenantId: string;
  branchId: string;
  supplierId: string;
  supplierName?: string;
  invoiceNumber: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balancePayable: number;
  receivedAt?: string | null;
  recordedByUserId: string;
  notes?: string;
  createdAt: string;
}
