export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  GRACE_PERIOD = 'GRACE_PERIOD',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum FeatureKey {
  INVENTORY = 'inventory',
  KDS = 'kds',
  ADVANCED_REPORTS = 'advancedReports',
  MULTI_BRANCH = 'multiBranch',
  CUSTOMER_MANAGEMENT = 'customerManagement',
  DATA_EXPORT = 'dataExport',
  ADVANCED_PERMISSIONS = 'advancedPermissions',
}

export interface PlanEntitlements {
  maxBranches: number; // e.g. 1, 3, 5, or -1 for unlimited
  maxStaff: number; // e.g. 5, 20, or -1
  maxDevices: number; // e.g. 2, 5, or -1
  features: {
    [key in FeatureKey]?: boolean;
  };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  gracePeriodDays: number;
  entitlements: PlanEntitlements;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  plan?: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum SubscriptionPaymentMethod {
  MANUAL_CASH = 'MANUAL_CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
  ONLINE_GATEWAY = 'ONLINE_GATEWAY',
}

export enum SubscriptionPaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface SubscriptionPaymentRecord {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  paymentMethod: SubscriptionPaymentMethod;
  transactionReference: string;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  status: SubscriptionPaymentStatus;
  notes?: string;
  recordedByAdminId: string;
  createdAt: string;
}

export interface DeviceRegistration {
  id: string;
  tenantId: string;
  branchId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: 'DESKTOP' | 'TABLET' | 'MOBILE' | 'POS_TERMINAL';
  ipAddress?: string;
  isActive: boolean;
  lastActiveAt: string;
  registeredAt: string;
}
