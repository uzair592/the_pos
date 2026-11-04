export interface Tenant {
  id: string;
  name: string;
  legalName?: string;
  subdomain?: string;
  ownerName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country: string;
  currency: string;
  timeZone: string;
  businessType: 'CAFE' | 'FAST_FOOD' | 'FINE_DINE' | 'TAKEAWAY' | 'BAKERY' | 'FOOD_TRUCK' | 'OTHER';
  logoUrl?: string;
  isActive: boolean;
  isOnboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state?: string;
  isMainBranch: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReceiptTemplateType = 'STANDARD_80MM' | 'FINE_DINING' | 'COMPACT_58MM' | 'TAX_INVOICE_A4' | 'KITCHEN_TOKEN';

export interface ReceiptSettings {
  defaultTemplate?: ReceiptTemplateType;
  headerText?: string;
  footerText?: string;
  showLogo: boolean;
  paperWidth: '58mm' | '80mm' | 'A4';
  showTaxBreakdown: boolean;
  showCashierName: boolean;
  showCustomerDetails: boolean;
  bilingualUrduEnglish: boolean;
  customUrduHeader?: string;
  customUrduFooter?: string;
  showQrCode?: boolean;
  showBarcode?: boolean;
  showTipGuide?: boolean;
}

export interface RestaurantSettings {
  tenantId: string;
  currency: string; // e.g. "PKR", "USD", etc.
  currencySymbol: string; // e.g. "Rs.", "$"
  timeZone: string; // e.g. "Asia/Karachi"
  taxRatePercent: number; // e.g. 16.0 or 0
  taxRegistrationNumber?: string; // NTN / STRN
  isTaxInclusive: boolean; // whether menu prices already include tax
  serviceChargePercent: number; // e.g. 5.0 or 0
  stockDeductionTrigger: 'ON_ORDER_CONFIRMED' | 'ON_ORDER_COMPLETED' | 'ON_KOT_GENERATED';
  allowNegativeInventory: boolean;
  orderNumberPrefix: string;
  kotNumberPrefix: string;
  receiptSettings: ReceiptSettings;
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  BILL_PRINTED = 'BILL_PRINTED',
}

export interface Floor {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Table {
  id: string;
  tenantId: string;
  branchId: string;
  floorId: string;
  floorName?: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string | null;
  isActive: boolean;
}
