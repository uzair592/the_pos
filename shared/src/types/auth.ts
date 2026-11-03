export enum SystemRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  RESTAURANT_OWNER = 'RESTAURANT_OWNER',
  RESTAURANT_ADMIN = 'RESTAURANT_ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  CASHIER = 'CASHIER',
  WAITER = 'WAITER',
  KITCHEN_STAFF = 'KITCHEN_STAFF',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
}

export enum Permission {
  // Orders & POS
  ORDERS_CREATE = 'orders:create',
  ORDERS_VIEW = 'orders:view',
  ORDERS_EDIT = 'orders:edit',
  ORDERS_CANCEL = 'orders:cancel',
  ORDERS_DISCOUNT = 'orders:discount',
  ORDERS_PRICE_OVERRIDE = 'orders:price_override',
  ORDERS_REFUND = 'orders:refund',

  // Tables
  TABLES_MANAGE = 'tables:manage',
  TABLES_VIEW = 'tables:view',

  // Kitchen Display
  KDS_VIEW = 'kds:view',
  KDS_UPDATE = 'kds:update',

  // Menu & Catalog
  MENU_VIEW = 'menu:view',
  MENU_MANAGE = 'menu:manage',

  // Inventory & Purchasing
  INVENTORY_VIEW = 'inventory:view',
  INVENTORY_MANAGE = 'inventory:manage',
  PURCHASES_VIEW = 'purchases:view',
  PURCHASES_MANAGE = 'purchases:manage',

  // Cash & Shifts
  SHIFTS_OPEN = 'shifts:open',
  SHIFTS_CLOSE = 'shifts:close',
  SHIFTS_VIEW = 'shifts:view',
  CASH_ADJUST = 'cash:adjust',

  // Financial & Reports
  EXPENSES_VIEW = 'expenses:view',
  EXPENSES_MANAGE = 'expenses:manage',
  REPORTS_SALES = 'reports:sales',
  REPORTS_FINANCIAL = 'reports:financial',
  REPORTS_INVENTORY = 'reports:inventory',
  REPORTS_EXPORT = 'reports:export',

  // Administration
  STAFF_MANAGE = 'staff:manage',
  BRANCHES_MANAGE = 'branches:manage',
  SETTINGS_MANAGE = 'settings:manage',
  CUSTOMERS_MANAGE = 'customers:manage',
}

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SystemRole.SUPER_ADMIN]: Object.values(Permission),
  [SystemRole.RESTAURANT_OWNER]: Object.values(Permission),
  [SystemRole.RESTAURANT_ADMIN]: [
    Permission.ORDERS_CREATE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_EDIT,
    Permission.ORDERS_CANCEL,
    Permission.ORDERS_DISCOUNT,
    Permission.ORDERS_PRICE_OVERRIDE,
    Permission.ORDERS_REFUND,
    Permission.TABLES_MANAGE,
    Permission.TABLES_VIEW,
    Permission.KDS_VIEW,
    Permission.KDS_UPDATE,
    Permission.MENU_VIEW,
    Permission.MENU_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.PURCHASES_VIEW,
    Permission.PURCHASES_MANAGE,
    Permission.SHIFTS_OPEN,
    Permission.SHIFTS_CLOSE,
    Permission.SHIFTS_VIEW,
    Permission.CASH_ADJUST,
    Permission.EXPENSES_VIEW,
    Permission.EXPENSES_MANAGE,
    Permission.REPORTS_SALES,
    Permission.REPORTS_FINANCIAL,
    Permission.REPORTS_INVENTORY,
    Permission.REPORTS_EXPORT,
    Permission.STAFF_MANAGE,
    Permission.BRANCHES_MANAGE,
    Permission.SETTINGS_MANAGE,
    Permission.CUSTOMERS_MANAGE,
  ],
  [SystemRole.BRANCH_MANAGER]: [
    Permission.ORDERS_CREATE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_EDIT,
    Permission.ORDERS_CANCEL,
    Permission.ORDERS_DISCOUNT,
    Permission.ORDERS_REFUND,
    Permission.TABLES_MANAGE,
    Permission.TABLES_VIEW,
    Permission.KDS_VIEW,
    Permission.KDS_UPDATE,
    Permission.MENU_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.PURCHASES_VIEW,
    Permission.SHIFTS_OPEN,
    Permission.SHIFTS_CLOSE,
    Permission.SHIFTS_VIEW,
    Permission.CASH_ADJUST,
    Permission.EXPENSES_VIEW,
    Permission.EXPENSES_MANAGE,
    Permission.REPORTS_SALES,
    Permission.CUSTOMERS_MANAGE,
  ],
  [SystemRole.CASHIER]: [
    Permission.ORDERS_CREATE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_EDIT,
    Permission.ORDERS_DISCOUNT,
    Permission.TABLES_VIEW,
    Permission.MENU_VIEW,
    Permission.SHIFTS_OPEN,
    Permission.SHIFTS_CLOSE,
    Permission.SHIFTS_VIEW,
    Permission.CASH_ADJUST,
    Permission.CUSTOMERS_MANAGE,
  ],
  [SystemRole.WAITER]: [
    Permission.ORDERS_CREATE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_EDIT,
    Permission.TABLES_VIEW,
    Permission.MENU_VIEW,
  ],
  [SystemRole.KITCHEN_STAFF]: [
    Permission.KDS_VIEW,
    Permission.KDS_UPDATE,
  ],
  [SystemRole.INVENTORY_MANAGER]: [
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.PURCHASES_VIEW,
    Permission.PURCHASES_MANAGE,
    Permission.REPORTS_INVENTORY,
  ],
  [SystemRole.ACCOUNTANT]: [
    Permission.ORDERS_VIEW,
    Permission.EXPENSES_VIEW,
    Permission.EXPENSES_MANAGE,
    Permission.REPORTS_SALES,
    Permission.REPORTS_FINANCIAL,
    Permission.REPORTS_INVENTORY,
    Permission.REPORTS_EXPORT,
    Permission.PURCHASES_VIEW,
  ],
};

export interface AuthUser {
  id: string;
  tenantId: string | null; // null for platform SUPER_ADMIN
  branchId: string | null;
  email: string;
  fullName: string;
  role: SystemRole;
  permissions: Permission[];
  isActive: boolean;
}

export interface AuthTokenPayload {
  userId: string;
  tenantId: string | null;
  branchId: string | null;
  role: SystemRole;
  deviceId?: string;
}
