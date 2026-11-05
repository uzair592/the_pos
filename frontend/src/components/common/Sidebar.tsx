import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  LayoutGrid,
  Building2,
  CreditCard,
  DollarSign,
  Utensils,
  Boxes,
  Truck,
  Clock,
  BarChart3,
  Users,
  Settings,
  Monitor,
  ChefHat,
  ShoppingBag,
  BookOpen,
  Landmark,
  Plus,
  Receipt,
  Layers,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { FeatureKey, Permission } from '@pos/shared';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
  permission?: Permission;
  feature?: FeatureKey;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { isSuperAdmin, hasFeature, hasPermission, tenant, user, currentBranchId, branches } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Vyapar Alt+S keyboard shortcut to quickly launch POS Billing from anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        navigate('/pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const activeBranchName =
    branches.find((b) => b.id === (currentBranchId || user?.branchId))?.name || 'Main Branch';

  // Super Admin Navigation
  const superAdminSections: NavSection[] = [
    {
      title: 'PLATFORM MANAGEMENT',
      items: [
        { to: '/platform-admin', label: 'Platform Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/platform-admin/tenants', label: 'Restaurants & Tenants', icon: Building2 },
        { to: '/platform-admin/plans', label: 'Subscription Plans', icon: CreditCard },
        { to: '/platform-admin/payments', label: 'Subscription Payments', icon: DollarSign },
      ],
    },
  ];

  // Vyapar-Style Categorized Restaurant Navigation System
  const restaurantSections: NavSection[] = [
    {
      title: 'GENERAL',
      items: [
        { to: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/hub', label: 'Workspace Hub', icon: LayoutGrid },
      ],
    },
    {
      title: 'SALES',
      items: [
        {
          to: '/pos',
          label: 'POS Billing Terminal',
          icon: Monitor,
          badge: 'SALE',
          badgeColor: 'bg-emerald-500 text-white',
          shortcut: 'Alt+S',
        },
        {
          to: '/app/orders',
          label: 'Orders',
          icon: ShoppingBag,
          permission: Permission.ORDERS_VIEW,
        },
        {
          to: '/kds',
          label: 'Kitchen Display (KDS)',
          icon: ChefHat,
          feature: FeatureKey.KDS,
          badge: 'LIVE',
          badgeColor: 'bg-orange-500 text-white',
        },
      ],
    },
    {
      title: 'ITEMS & CATALOG',
      items: [
        {
          to: '/app/menu',
          label: 'Menu & Products',
          icon: Utensils,
          permission: Permission.MENU_VIEW,
        },
        {
          to: '/app/inventory',
          label: 'Stock & FIFO Batches',
          icon: Boxes,
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_VIEW,
        },
      ],
    },
    {
      title: 'PURCHASE & EXPENSES',
      items: [
        {
          to: '/app/purchases',
          label: 'Purchases & Vendors',
          icon: Truck,
          feature: FeatureKey.INVENTORY,
          permission: Permission.PURCHASES_VIEW,
        },
        {
          to: '/app/shifts',
          label: 'Cash Registers & Shifts',
          icon: Clock,
          permission: Permission.SHIFTS_VIEW,
        },
      ],
    },
    {
      title: 'CASH & BANK (BANKING)',
      items: [
        {
          to: '/app/reports/cash-and-bank',
          label: 'Cash & Bank Accounts',
          icon: Landmark,
          permission: Permission.REPORTS_FINANCIAL,
          badge: 'BANKING',
          badgeColor: 'bg-blue-600 text-white',
        },
      ],
    },
    {
      title: 'REPORTS & ANALYTICS',
      items: [
        {
          to: '/app/reports/daybook',
          label: 'Daily Daybook Ledger',
          icon: BookOpen,
          permission: Permission.REPORTS_SALES,
          badge: 'DAILY',
          badgeColor: 'bg-indigo-600 text-white',
        },
        {
          to: '/app/reports',
          label: 'Financial Reports & P&L',
          icon: BarChart3,
          permission: Permission.REPORTS_SALES,
          exact: true,
        },
        {
          to: '/app/reports?tab=BILL_PROFIT_LOSS',
          label: 'Bill-Wise Profit & Loss',
          icon: Receipt,
          permission: Permission.REPORTS_SALES,
        },
      ],
    },
    {
      title: 'SETTINGS & SYSTEM',
      items: [
        {
          to: '/app/staff',
          label: 'Staff & Roles',
          icon: Users,
          permission: Permission.STAFF_MANAGE,
        },
        {
          to: '/app/settings',
          label: 'Restaurant Settings',
          icon: Settings,
          permission: Permission.SETTINGS_MANAGE,
        },
      ],
    },
  ];

  const sections = isSuperAdmin ? superAdminSections : restaurantSections;

  return (
    <aside className="w-68 lg:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-4rem)] flex flex-col justify-between hidden md:flex shrink-0 transition-colors shadow-sm">
      {/* Scrollable Navigation Body */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
        {/* Vyapar-Style Prominent Quick Add Sale Button */}
        {!isSuperAdmin && (
          <div className="pt-1 pb-1">
            <NavLink
              to="/pos"
              className="w-full flex items-center justify-between py-2.5 px-3.5 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white rounded-xl font-black text-xs shadow-md shadow-brand-500/20 hover:shadow-lg transition-all transform active:scale-[0.98] group"
              title="Launch POS Terminal (Alt+S)"
            >
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                </div>
                <span className="tracking-wide uppercase font-extrabold">+ ADD SALE / BILL</span>
              </div>
              <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                Alt+S
              </span>
            </NavLink>
          </div>
        )}

        {/* Vyapar Grouped Menu Sections */}
        {sections.map((section, sIdx) => {
          // Filter items by feature and permissions
          const visibleItems = section.items.filter((item) => {
            if (item.feature && !hasFeature(item.feature)) return false;
            if (item.permission && !hasPermission(item.permission)) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              {/* Section Header with subtle divider */}
              <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <span>{section.title}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Items List */}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  // Handle custom query match for tab links
                  const isCurrentActive =
                    item.to.includes('?')
                      ? location.pathname + location.search === item.to
                      : location.pathname === item.to ||
                        (item.exact === false && location.pathname.startsWith(item.to));

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      className={({ isActive }) => {
                        const active = item.to.includes('?') ? isCurrentActive : isActive;
                        return `relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all group ${
                          active
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-extrabold'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`;
                      }}
                    >
                      {({ isActive }) => {
                        const active = item.to.includes('?') ? isCurrentActive : isActive;
                        return (
                          <>
                            {/* Left Accent indicator for active item */}
                            {active && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-brand-500 rounded-r-full" />
                            )}

                            <div className="flex items-center space-x-2.5 truncate">
                              <Icon
                                className={`w-4 h-4 shrink-0 transition-colors ${
                                  active
                                    ? 'text-brand-400 dark:text-brand-600'
                                    : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>

                            {/* Item Badge or Shortcut */}
                            {item.badge ? (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0 ${
                                  item.badgeColor || 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400'
                                }`}
                              >
                                {item.badge}
                              </span>
                            ) : (
                              <ChevronRight
                                className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity ${
                                  active ? 'text-white dark:text-slate-900' : 'text-slate-400'
                                }`}
                              />
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Vyapar-Style Bottom Company & Profile Card */}
      {!isSuperAdmin && tenant && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <div className="w-6 h-6 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-black text-xs shrink-0">
                  {tenant.name.charAt(0).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate leading-tight">
                    {tenant.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {activeBranchName}
                  </p>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="System Online & Synced" />
            </div>

            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                {tenant.currency}
              </span>
              <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <ShieldCheck className="w-3 h-3" />
                <span>Vyapar POS</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
