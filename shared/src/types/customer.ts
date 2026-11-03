export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  creditLimit: number;
  outstandingBalance: number;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
