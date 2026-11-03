export enum PrepStation {
  KITCHEN = 'KITCHEN',
  BBQ = 'BBQ',
  DRINKS = 'DRINKS',
  DESSERTS = 'DESSERTS',
  PACKAGING = 'PACKAGING',
}

export interface Category {
  id: string;
  tenantId: string;
  parentId?: string | null;
  name: string;
  nameUrdu?: string;
  description?: string;
  sortOrder: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string; // e.g. "Small", "Regular", "Large"
  nameUrdu?: string;
  sku?: string;
  price: number;
  costPrice?: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  nameUrdu?: string;
  price: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface ModifierGroup {
  id: string;
  tenantId: string;
  name: string;
  nameUrdu?: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  nameUrdu?: string;
  description?: string;
  sku: string;
  barcode?: string;
  basePrice: number;
  costPrice: number;
  station: PrepStation;
  imageUrl?: string;
  isAvailable: boolean;
  trackInventory: boolean;
  // Specific prices for order types if different from basePrice
  dineInPrice?: number;
  takeawayPrice?: number;
  deliveryPrice?: number;
  variants: ProductVariant[];
  modifierGroups?: ModifierGroup[];
  createdAt: string;
  updatedAt: string;
}
