import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Monitor,
  CalendarClock,
  ArrowDownLeft,
  RotateCcw,
  FileText,
  Truck,
  PlusCircle,
  FolderPlus,
  Sparkles,
  Layers,
  ToggleRight,
  Receipt,
  ClipboardList,
  Undo2,
  ArrowUpRight,
  UserPlus,
  PackagePlus,
  Sliders,
  ArrowLeftRight,
  AlertTriangle,
  Coins,
  BookOpen,
  UserCheck,
  CalendarCheck,
  Users,
  LayoutGrid,
  Search,
  X,
  ChevronDown,
} from 'lucide-react';
import { QuickActionType } from './QuickActionModals.js';

interface AddMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerModal: (type: QuickActionType) => void;
}

interface ActionItem {
  id: string;
  name: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  action: () => void;
}

interface ActionCategory {
  title: string;
  items: ActionItem[];
}

export const AddMoreMenu: React.FC<AddMoreMenuProps> = ({ isOpen, onClose, onTriggerModal }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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

  const categories: ActionCategory[] = [
    {
      title: 'A. Sales & Order Operations',
      items: [
        {
          id: 'pos',
          name: 'New Sale / POS Terminal',
          shortcut: 'Alt + S',
          icon: Monitor,
          color: 'text-brand-500 bg-brand-50 dark:bg-brand-950/40',
          action: () => runAndClose(() => navigate('/pos')),
        },
        {
          id: 'advance_order',
          name: 'Sale Order / Advance Order',
          shortcut: 'Alt + F',
          icon: CalendarClock,
          color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
          action: () => runAndClose(() => onTriggerModal('ADVANCE_ORDER')),
        },
        {
          id: 'payment_in',
          name: 'Payment-In (Customer Receipt)',
          shortcut: 'Alt + I',
          icon: ArrowDownLeft,
          color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
          action: () => runAndClose(() => onTriggerModal('PAYMENT_IN')),
        },
        {
          id: 'sale_return',
          name: 'Sale Return / Refund',
          shortcut: 'Alt + R',
          icon: RotateCcw,
          color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40',
          action: () => runAndClose(() => onTriggerModal('SALE_RETURN')),
        },
        {
          id: 'estimate',
          name: 'Estimate / Quotation',
          shortcut: 'Alt + M',
          icon: FileText,
          color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40',
          action: () => runAndClose(() => onTriggerModal('ESTIMATE_QUOTATION')),
        },
        {
          id: 'delivery_challan',
          name: 'Delivery Challan Slip',
          shortcut: 'Alt + D',
          icon: Truck,
          color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40',
          action: () => runAndClose(() => onTriggerModal('DELIVERY_CHALLAN')),
        },
      ],
    },
    {
      title: 'B. Menu & Product Management',
      items: [
        {
          id: 'create_product',
          name: 'Create Menu Item',
          icon: PlusCircle,
          color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
          action: () => runAndClose(() => navigate('/app/menu?action=new-product')),
        },
        {
          id: 'create_category',
          name: 'Create Menu Category',
          icon: FolderPlus,
          color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40',
          action: () => runAndClose(() => navigate('/app/menu?action=new-category')),
        },
        {
          id: 'create_deal',
          name: 'Create Deal / Combo Meal',
          icon: Sparkles,
          color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950/40',
          action: () => runAndClose(() => onTriggerModal('CREATE_DEAL')),
        },
        {
          id: 'create_addon',
          name: 'Create Modifier / Add-on',
          icon: Layers,
          color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/40',
          action: () => runAndClose(() => navigate('/app/menu?action=new-modifier')),
        },
        {
          id: 'menu_availability',
          name: 'Manage Menu Availability',
          icon: ToggleRight,
          color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
          action: () => runAndClose(() => onTriggerModal('MENU_AVAILABILITY')),
        },
      ],
    },
    {
      title: 'C. Purchase & Supplier Operations',
      items: [
        {
          id: 'add_purchase',
          name: 'Add Purchase / Purchase Bill',
          shortcut: 'Alt + P',
          icon: Receipt,
          color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40',
          action: () => runAndClose(() => navigate('/app/purchases?action=new-bill')),
        },
        {
          id: 'purchase_order',
          name: 'Create Purchase Order',
          shortcut: 'Alt + G',
          icon: ClipboardList,
          color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
          action: () => runAndClose(() => navigate('/app/purchases')),
        },
        {
          id: 'purchase_return',
          name: 'Purchase Return to Supplier',
          shortcut: 'Alt + L',
          icon: Undo2,
          color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40',
          action: () => runAndClose(() => onTriggerModal('PURCHASE_RETURN')),
        },
        {
          id: 'payment_out',
          name: 'Payment-Out (Supplier Payment)',
          shortcut: 'Alt + O',
          icon: ArrowUpRight,
          color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40',
          action: () => runAndClose(() => onTriggerModal('PAYMENT_OUT')),
        },
        {
          id: 'add_supplier',
          name: 'Add Supplier Profile',
          icon: UserPlus,
          color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40',
          action: () => runAndClose(() => onTriggerModal('ADD_SUPPLIER')),
        },
      ],
    },
    {
      title: 'D. Inventory Operations',
      items: [
        {
          id: 'add_ingredient',
          name: 'Add Raw Ingredient',
          icon: PackagePlus,
          color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40',
          action: () => runAndClose(() => navigate('/app/inventory?tab=STOCK&action=new-ingredient')),
        },
        {
          id: 'stock_adjustment',
          name: 'Stock Adjustment (Shortage / Wastage)',
          icon: Sliders,
          color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
          action: () => runAndClose(() => navigate('/app/inventory?tab=adjustments&action=new')),
        },
        {
          id: 'stock_transfer',
          name: 'Branch Stock Transfer',
          icon: ArrowLeftRight,
          color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40',
          action: () => runAndClose(() => navigate('/app/inventory?tab=TRANSFERS&action=new')),
        },
        {
          id: 'view_low_stock',
          name: 'View Low Stock & Reorder',
          icon: AlertTriangle,
          color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40',
          action: () => runAndClose(() => navigate('/app/inventory?tab=low_stock')),
        },
      ],
    },
    {
      title: 'E. Finance & Expense Operations',
      items: [
        {
          id: 'expense_management',
          name: 'Expense Management (Ledger & Audit)',
          icon: Receipt,
          color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
          action: () => runAndClose(() => navigate('/app/expenses')),
        },
        {
          id: 'record_expense',
          name: 'Record Operating Expense',
          icon: Receipt,
          color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40',
          action: () => runAndClose(() => onTriggerModal('RECORD_EXPENSE')),
        },
        {
          id: 'cash_movement',
          name: 'Cash In / Cash Out (Drawer)',
          icon: Coins,
          color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
          action: () => runAndClose(() => onTriggerModal('CASH_MOVEMENT')),
        },
        {
          id: 'daybook',
          name: 'Daybook & Register Shifts',
          icon: BookOpen,
          color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
          action: () => runAndClose(() => navigate('/app/daybook')),
        },
      ],
    },
    {
      title: 'F. Customers & Restaurant Operations',
      items: [
        {
          id: 'add_customer',
          name: 'Add Customer Profile',
          icon: UserCheck,
          color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/40',
          action: () => runAndClose(() => onTriggerModal('ADD_CUSTOMER')),
        },
        {
          id: 'reservation',
          name: 'Table Reservation',
          icon: CalendarCheck,
          color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40',
          action: () => runAndClose(() => navigate('/app/orders?tab=reservations&action=new')),
        },
        {
          id: 'waitlist',
          name: 'Waitlist Queue Entry',
          icon: Users,
          color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40',
          action: () => runAndClose(() => navigate('/app/orders?tab=waitlist&action=new')),
        },
        {
          id: 'manage_tables',
          name: 'Manage Dining Tables & Floors',
          icon: LayoutGrid,
          color: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
          action: () => runAndClose(() => navigate('/app/settings?tab=tables')),
        },
      ],
    },
  ];

  // Filter categories and items based on search input
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) =>
          it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (it.shortcut && it.shortcut.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div
      ref={menuRef}
      className="absolute left-0 sm:left-auto top-full mt-2 w-full sm:w-[680px] lg:w-[860px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* In-Dropdown Search Header */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
        <div className="relative flex-1 mr-3">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search restaurant operation or shortcut (e.g. Alt+P, Return, Expense, Deal)..."
            autoFocus
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Close (ESC)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Categorized Actions Grid */}
      <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full py-10 text-center text-slate-400">
            <p className="font-semibold text-xs">No restaurant operations match "{searchQuery}"</p>
          </div>
        ) : (
          filteredCategories.map((cat, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                {cat.title}
              </h4>
              <div className="space-y-1">
                {cat.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      onClick={it.action}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all group"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${it.color} transition-transform group-hover:scale-105`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                          {it.name}
                        </span>
                      </div>
                      {it.shortcut && (
                        <kbd className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[9px] font-black text-slate-500 dark:text-slate-400 shrink-0">
                          {it.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>Press <strong>ESC</strong> to dismiss menu</span>
        <span>Keyboard shortcuts are active platform-wide</span>
      </div>
    </div>
  );
};

