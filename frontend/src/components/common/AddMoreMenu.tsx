import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  Monitor,
  ShoppingBag,
  Users,
  Truck,
  Receipt,
  Building,
  Boxes,
  Utensils,
  Calculator,
  AlertTriangle,
  FileText,
  Landmark,
  ArrowDownLeft,
  BarChart3,
  Layers,
  DollarSign,
  Sparkles,
  LayoutGrid,
  Clock,
  X,
  PlusCircle,
} from 'lucide-react';
import { FeatureKey, Permission } from '@pos/shared';
import { QuickActionType } from './QuickActionModals.js';

interface AddMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerModal: (type: QuickActionType) => void;
}

interface ActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  action: () => void;
  permission?: Permission;
  feature?: FeatureKey;
}

interface ActionCategory {
  title: string;
  items: ActionItem[];
}

export const AddMoreMenu: React.FC<AddMoreMenuProps> = ({ isOpen, onClose, onTriggerModal }) => {
  const navigate = useNavigate();
  const { user, isSuperAdmin, hasPermission, hasFeature } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const runAndClose = (fn: () => void) => {
    onClose();
    fn();
  };

  const isItemAllowed = (item: ActionItem) => {
    if (isSuperAdmin) return true;
    const roleStr = String(user?.role || '').toUpperCase();
    if (
      roleStr === 'RESTAURANT_OWNER' ||
      roleStr === 'OWNER' ||
      roleStr === 'BRANCH_MANAGER' ||
      roleStr === 'MANAGER'
    ) {
      return true;
    }
    if (item.feature && !hasFeature(item.feature)) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  };

  const categories: ActionCategory[] = [
    {
      title: 'Sales & Orders',
      items: [
        {
          id: 'pos_sale',
          label: 'New Sale / POS Billing',
          icon: Monitor,
          color: 'text-orange-500',
          permission: Permission.ORDERS_CREATE,
          action: () => runAndClose(() => navigate('/pos')),
        },
        {
          id: 'orders_list',
          label: 'Orders',
          icon: ShoppingBag,
          color: 'text-blue-500',
          permission: Permission.ORDERS_VIEW,
          action: () => runAndClose(() => navigate('/app/orders')),
        },
        {
          id: 'customers',
          label: 'Customers',
          icon: Users,
          color: 'text-teal-500',
          permission: Permission.ORDERS_VIEW,
          action: () => runAndClose(() => onTriggerModal('ADD_CUSTOMER')),
        },
      ],
    },
    {
      title: 'Purchases',
      items: [
        {
          id: 'new_purchase',
          label: 'New Purchase',
          icon: Receipt,
          color: 'text-indigo-500',
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_MANAGE,
          action: () => runAndClose(() => navigate('/app/purchases?action=new-bill')),
        },
        {
          id: 'purchase_history',
          label: 'Purchase History',
          icon: Truck,
          color: 'text-sky-500',
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_MANAGE,
          action: () => runAndClose(() => navigate('/app/purchases')),
        },
        {
          id: 'suppliers',
          label: 'Suppliers',
          icon: Building,
          color: 'text-cyan-500',
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_MANAGE,
          action: () => runAndClose(() => onTriggerModal('ADD_SUPPLIER')),
        },
      ],
    },
    {
      title: 'Inventory',
      items: [
        {
          id: 'inventory_mgmt',
          label: 'Inventory Management',
          icon: Boxes,
          color: 'text-purple-500',
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_VIEW,
          action: () => runAndClose(() => navigate('/app/inventory')),
        },
        {
          id: 'menu_items',
          label: 'Menu Items',
          icon: Utensils,
          color: 'text-amber-500',
          permission: Permission.MENU_VIEW,
          action: () => runAndClose(() => navigate('/app/menu')),
        },
        {
          id: 'recipes',
          label: 'Recipes',
          icon: Calculator,
          color: 'text-emerald-500',
          permission: Permission.MENU_MANAGE,
          action: () => runAndClose(() => navigate('/app/reports/recipe-costing')),
        },
        {
          id: 'wastage_mgmt',
          label: 'Wastage Management',
          icon: AlertTriangle,
          color: 'text-rose-500',
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_MANAGE,
          action: () => runAndClose(() => navigate('/app/inventory?tab=wastage')),
        },
      ],
    },
    {
      title: 'Finance',
      items: [
        {
          id: 'add_expense',
          label: 'Add Expense',
          icon: FileText,
          color: 'text-rose-500',
          permission: Permission.EXPENSES_VIEW,
          action: () => runAndClose(() => onTriggerModal('RECORD_EXPENSE')),
        },
        {
          id: 'cash_bank',
          label: 'Cash & Bank',
          icon: Landmark,
          color: 'text-emerald-500',
          permission: Permission.REPORTS_FINANCIAL,
          action: () => runAndClose(() => navigate('/app/cash-and-bank')),
        },
        {
          id: 'record_payment',
          label: 'Record Payment',
          icon: ArrowDownLeft,
          color: 'text-blue-500',
          permission: Permission.ORDERS_CREATE,
          action: () => runAndClose(() => onTriggerModal('PAYMENT_IN')),
        },
      ],
    },
    {
      title: 'Reports',
      items: [
        {
          id: 'sales_reports',
          label: 'Sales Reports',
          icon: BarChart3,
          color: 'text-orange-500',
          permission: Permission.REPORTS_FINANCIAL,
          action: () => runAndClose(() => navigate('/app/reports?tab=sales')),
        },
        {
          id: 'purchase_reports',
          label: 'Purchase Reports',
          icon: FileText,
          color: 'text-indigo-500',
          permission: Permission.REPORTS_FINANCIAL,
          action: () => runAndClose(() => navigate('/app/reports?tab=purchases')),
        },
        {
          id: 'inventory_reports',
          label: 'Inventory Reports',
          icon: Layers,
          color: 'text-purple-500',
          permission: Permission.REPORTS_FINANCIAL,
          action: () => runAndClose(() => navigate('/app/reports?tab=inventory')),
        },
        {
          id: 'profit_loss',
          label: 'Profit & Loss',
          icon: DollarSign,
          color: 'text-emerald-500',
          permission: Permission.REPORTS_FINANCIAL,
          action: () => runAndClose(() => navigate('/app/reports/bill-profit-loss')),
        },
        {
          id: 'costing_profitability',
          label: 'Costing & Profitability',
          icon: Sparkles,
          color: 'text-amber-500',
          permission: Permission.REPORTS_FINANCIAL,
          action: () => runAndClose(() => navigate('/app/reports/recipe-costing')),
        },
      ],
    },
    {
      title: 'Restaurant Operations',
      items: [
        {
          id: 'tables_floors',
          label: 'Floor & Table Management',
          icon: LayoutGrid,
          color: 'text-slate-600 dark:text-slate-300',
          permission: Permission.SETTINGS_MANAGE,
          action: () => runAndClose(() => navigate('/app/settings?tab=tables')),
        },
        {
          id: 'shifts',
          label: 'Shift Management',
          icon: Clock,
          color: 'text-blue-500',
          permission: Permission.SHIFTS_VIEW,
          action: () => runAndClose(() => navigate('/app/shifts')),
        },
      ],
    },
  ];

  // Filter categories by permissions
  const authorizedCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(isItemAllowed),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-2 w-[92vw] sm:w-[580px] md:w-[680px] lg:w-[720px] max-w-[740px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Quick Actions Menu
          </span>
          <span className="hidden sm:inline text-[10px] text-slate-400 font-medium font-sans">
            (Vyapar Desktop ERP)
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Close (ESC)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Categorized Quick Actions Grid (3 columns on desktop, 2 on tablet, 1 on mobile) */}
      <div className="max-h-[min(500px,calc(100vh-80px))] overflow-y-auto p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {authorizedCategories.map((cat, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 space-y-1.5"
          >
            <h4 className="font-black text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 border-b border-slate-200/50 dark:border-slate-700/50 pb-1">
              {cat.title}
            </h4>
            <div className="space-y-0.5">
              {cat.items.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.id}
                    onClick={it.action}
                    className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg text-left hover:bg-white dark:hover:bg-slate-700/70 hover:shadow-xs transition-all group"
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${it.color} transition-transform group-hover:scale-110`} />
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                      {it.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>Click any action to launch page or entry form</span>
        <span>Press <strong>ESC</strong> to dismiss</span>
      </div>
    </div>
  );
};
