import { PrepStation } from './menu.js';
import { OrderType } from './order.js';

export enum PrepStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export interface KOTItem {
  id: string;
  kotId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  variantName?: string;
  quantity: number;
  modifiersSummary?: string;
  notes?: string;
  station: PrepStation;
  status: PrepStatus;
}

export interface KitchenOrderTicket {
  id: string;
  tenantId: string;
  branchId: string;
  kotNumber: string;
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  tableNumber?: string | null;
  serverName?: string | null;
  station: PrepStation;
  status: PrepStatus;
  items: KOTItem[];
  notes?: string;
  createdAt: string;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
}
