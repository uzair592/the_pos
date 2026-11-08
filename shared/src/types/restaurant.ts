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

export type ReceiptTemplateType = 
  | 'TABLE_GRID'
  | 'STANDARD_80MM' 
  | 'MODERN_DARK_BANNER'
  | 'FORMAL_ELEGANT'
  | 'ECO_SAVE_COMPACT'
  | 'FINE_DINING' 
  | 'COMPACT_58MM' 
  | 'TAX_INVOICE_A4' 
  | 'KITCHEN_TOKEN';

export type BillLogoSize = 'S' | 'M' | 'L' | 'XL';

export interface ReceiptSettings {
  defaultTemplate?: ReceiptTemplateType;
  headerText?: string;
  footerText?: string;
  sloganText?: string;
  showBusinessName?: boolean;
  businessNameFontSize?: number; // e.g. 21
  showPhone?: boolean;
  phoneFontSize?: number; // e.g. 14
  showAddress?: boolean;
  addressFontSize?: number; // e.g. 14
  showSlogan?: boolean;
  sloganFontSize?: number; // e.g. 12
  showLogo: boolean;
  logoUrl?: string;
  logoSize?: BillLogoSize; // 'S' | 'M' | 'L' | 'XL'
  paperWidth: '58mm' | '80mm' | 'A4';
  billFontSize?: number; // e.g. 15
  lineSpacing?: number; // e.g. 1.25
  marginLeftMm?: number; // e.g. 0
  marginRightMm?: number; // e.g. 0
  spaceAboveMm?: number; // e.g. 0
  spaceBelowMm?: number; // e.g. 20
  autoCutReceipt?: boolean;
  receiptCopies?: 'CUSTOMER_ONLY' | 'CUSTOMER_AND_KITCHEN' | 'TWO_CUSTOMER_COPIES';
  desktopCutterCommand?: 'FEED_PARTIAL_CUT' | 'FEED_FULL_CUT' | 'NO_CUT';
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

export type TableShape = 'RECTANGLE' | 'ROUND' | 'SQUARE';

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
  shape?: TableShape;
  posX?: number;
  posY?: number;
  assignedWaiterId?: string | null;
  assignedWaiterName?: string | null;
  status: TableStatus;
  currentOrderId?: string | null;
  isActive: boolean;
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SEATED = 'SEATED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  COMPLETED = 'COMPLETED',
}

export interface Reservation {
  id: string;
  tenantId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  guestCount: number;
  tableId?: string | null;
  tableNumber?: string | null;
  floorName?: string | null;
  reservationDate: string;
  reservationTime: string;
  durationMinutes: number;
  status: ReservationStatus;
  specialRequests?: string | null;
  convertedOrderId?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum WaitlistStatus {
  WAITING = 'WAITING',
  NOTIFIED = 'NOTIFIED',
  SEATED = 'SEATED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export interface WaitlistEntry {
  id: string;
  tenantId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  queueNumber: number;
  estimatedWaitMinutes: number;
  status: WaitlistStatus;
  assignedTableId?: string | null;
  assignedTableNumber?: string | null;
  notifiedAt?: string | null;
  seatedAt?: string | null;
  notes?: string | null;
  convertedOrderId?: string | null;
  createdAt: string;
  updatedAt: string;
}
