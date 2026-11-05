import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
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
  ChevronLeft,
  Sparkles,
  Calculator,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { FeatureKey, Permission } from '@pos/shared';

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

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

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { isSuperAdmin, hasFeature, hasPermission, tenant, user, currentBranchId, branches } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Vyapar Alt+S keyboard shortcut to quickly launch POS Billing from anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onCloseMobile?.();
        navigate('/pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onCloseMobile]);

  const activeBranchName =
    branches?.find((b) => b.id === (currentBranchId || user?.branchId))?.name || 'Main Branch';

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
          label: 'Kitchen Display',
          icon: ChefHat,
          feature: FeatureKey.KDS,
          permission: Permission.ORDERS_VIEW,
        },
      ],
    },
    {
      title: 'INVENTORY & ITEMS',
      items: [
        {
          to: '/app/menu',
          label: 'Menu Items & Recipes',
          icon: Utensils,
          permission: Permission.MENU_MANAGE,
        },
        {
          to: '/app/purchases',
          label: 'Purchases & Inward Stock',
          icon: Truck,
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_MANAGE,
        },
        {
          to: '/app/inventory',
          label: 'Ingredients & Inventory',
          icon: Boxes,
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_VIEW,
          exact: true,
        },
        {
          to: '/app/inventory?tab=alerts',
          label: 'Stock Alerts & Reorder',
          icon: Layers,
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_VIEW,
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          to: '/app/tables',
          label: 'Tables & Floor Plan',
          icon: LayoutGrid,
          permission: Permission.TABLES_MANAGE,
        },
        {
          to: '/app/reservations',
          label: 'Reservation & Waitlist',
          icon: Clock,
          permission: Permission.TABLES_MANAGE,
        },
        {
          to: '/app/daybook',
          label: 'Daybook / Register',
          icon: BookOpen,
          permission: Permission.REPORTS_FINANCIAL,
        },
        {
          to: '/app/cash-bank',
          label: 'Cash & Bank',
          icon: Landmark,
          permission: Permission.REPORTS_FINANCIAL,
        },
      ],
    },
    {
      title: 'FINANCE & REPORTS',
      items: [
        {
          to: '/app/reports',
          label: 'Financial Reports & P&L',
          icon: BarChart3,
          permission: Permission.REPORTS_FINANCIAL,
        },
        {
          to: '/app/reports/bill-profit-loss',
          label: 'Bill-Wise Profit & Loss',
          icon: Receipt,
          permission: Permission.REPORTS_SALES,
        },
        {
          to: '/app/reports/recipe-costing',
          label: 'Recipe Costing & Food Cost',
          icon: Calculator,
          permission: Permission.REPORTS_FINANCIAL,
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

  const renderContent = (collapsed: boolean, isMobileDrawer: boolean = false) => (
    <>
      {/* Top Header: Brand Identity + Collapse/Close Toggle */}
      <div className="h-16 px-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        {collapsed ? (
          <div className="w-full flex items-center justify-center relative">
            <Link
              to={isSuperAdmin ? '/platform-admin' : '/app'}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform"
              title={isSuperAdmin ? 'CloudPOS' : tenant?.name || 'Restaurant POS'}
            >
              <UtensilsCrossed className="w-5 h-5" />
            </Link>
            {/* Desktop Floating Expand Toggle Button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar navigation"
              className="absolute -right-5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800 hover:bg-brand-500 border border-slate-700 hover:border-brand-400 text-slate-300 hover:text-white shadow-lg flex items-center justify-center transition-all z-30"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Link
              to={isSuperAdmin ? '/platform-admin' : '/app'}
              onClick={isMobileDrawer ? onCloseMobile : undefined}
              className="flex items-center space-x-2.5 truncate group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform shrink-0">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="font-extrabold text-sm tracking-tight text-white block truncate leading-tight">
                  {isSuperAdmin ? 'CloudPOS' : tenant?.name || 'Restaurant POS'}
                </span>
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block truncate">
                  {isSuperAdmin ? 'Platform Super Admin' : 'Point of Sale SaaS'}
                </span>
              </div>
            </Link>

            {/* Toggle Button: Close on mobile, Collapse on desktop */}
            {isMobileDrawer ? (
              <button
                type="button"
                onClick={onCloseMobile}
                title="Close navigation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar navigation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Scrollable Navigation Body (Independent scrolling inside sidebar) */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 custom-scrollbar">
        {/* Vyapar-Style Quick Add Sale Button */}
        {!isSuperAdmin && (
          collapsed ? (
            <div className="pt-1 pb-1 flex justify-center relative group">
              <NavLink
                to="/pos"
                className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white rounded-xl shadow-md shadow-brand-500/20 hover:shadow-lg transition-all transform active:scale-95"
                aria-label="Launch POS Terminal (Alt+S)"
              >
                <Plus className="w-5 h-5" />
              </NavLink>
              {/* Floating Tooltip */}
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                <div className="bg-slate-950 text-white border border-slate-700/90 text-xs font-bold py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap flex items-center space-x-2">
                  <span className="text-amber-400 font-extrabold">+ ADD SALE / BILL</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-300">
                    Alt+S
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-1 pb-1">
              <NavLink
                to="/pos"
                onClick={isMobileDrawer ? onCloseMobile : undefined}
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
          )
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
              {collapsed ? (
                /* Subtle horizontal divider in collapsed mode */
                <div className="my-2 border-t border-slate-800/80 mx-2" title={section.title} />
              ) : (
                /* Section Header with badge dot in expanded mode */
                <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <span>{section.title}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                </div>
              )}

              {/* Items List */}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  // Handle custom query match for tab links
                  const isCurrentActive =
                    item.to === '/app/recipe-costing' || item.to === '/app/reports/recipe-costing'
                      ? location.pathname === '/app/recipe-costing' || location.pathname === '/app/reports/recipe-costing'
                      : item.to === '/app/reports/bill-profit-loss'
                      ? location.pathname === '/app/reports/bill-profit-loss' ||
                        (location.pathname === '/app/reports' && location.search.includes('tab=BILL_PROFIT_LOSS'))
                      : item.to === '/app/reports'
                      ? location.pathname === '/app/reports' &&
                        !location.search.includes('tab=BILL_PROFIT_LOSS') &&
                        !location.pathname.includes('recipe-costing')
                      : item.to.includes('?')
                      ? location.pathname + location.search === item.to
                      : location.pathname === item.to ||
                        (item.exact === false && location.pathname.startsWith(item.to));

                  if (collapsed) {
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.exact}
                        className={({ isActive }) => {
                          const active = item.to.includes('?') ? isCurrentActive : isActive;
                          return `relative w-10 h-10 mx-auto flex items-center justify-center rounded-xl text-xs transition-all group ${
                            active
                              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 font-bold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                          }`;
                        }}
                      >
                        {({ isActive }) => {
                          const active = item.to.includes('?') ? isCurrentActive : isActive;
                          return (
                            <>
                              <Icon
                                className={`w-5 h-5 shrink-0 transition-colors ${
                                  active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                                }`}
                              />
                              {active && (
                                <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 bg-white rounded-r-full shadow-sm" />
                              )}
                              {/* Floating Tooltip */}
                              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                                <div className="bg-slate-950 text-white border border-slate-700/90 text-xs font-bold py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap flex items-center space-x-2">
                                  <span>{item.label}</span>
                                  {item.badge && (
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                                        item.badgeColor || 'bg-brand-500 text-white'
                                      }`}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                  {item.shortcut && (
                                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-300">
                                      {item.shortcut}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        }}
                      </NavLink>
                    );
                  }

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      onClick={isMobileDrawer ? onCloseMobile : undefined}
                      className={({ isActive }) => {
                        const active = item.to.includes('?') ? isCurrentActive : isActive;
                        return `relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all group ${
                          active
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 font-extrabold'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                        }`;
                      }}
                    >
                      {({ isActive }) => {
                        const active = item.to.includes('?') ? isCurrentActive : isActive;
                        return (
                          <>
                            {active && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-white rounded-r-full shadow-sm" />
                            )}
                            <div className="flex items-center space-x-2.5 truncate">
                              <Icon
                                className={`w-4 h-4 shrink-0 transition-colors ${
                                  active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>

                            {/* Item Badge or Shortcut */}
                            {item.badge ? (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0 ${
                                  item.badgeColor || 'bg-brand-400/20 text-brand-300 border border-brand-400/30'
                                }`}
                              >
                                {item.badge}
                              </span>
                            ) : (
                              <ChevronRight
                                className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity ${
                                  active ? 'text-white' : 'text-slate-400'
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

      {/* Bottom Company & Active Profile Card */}
      {!isSuperAdmin && tenant && (
        collapsed ? (
          <div className="p-2 border-t border-slate-800 flex justify-center relative group">
            <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700/70 flex items-center justify-center text-brand-400 font-black text-sm relative">
              {tenant?.name?.charAt(0).toUpperCase() || 'R'}
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-sm"
                title="System Online & Synced"
              />
            </div>
            {/* Floating Tooltip */}
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
              <div className="bg-slate-950 text-white border border-slate-700/90 text-xs font-bold py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap">
                <p className="font-extrabold text-white">{tenant?.name || 'Restaurant POS'}</p>
                <p className="text-[10px] text-slate-400 font-normal">
                  {activeBranchName} • {tenant?.currency || 'PKR'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-slate-800 bg-slate-950/40">
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-2.5 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-black text-xs shrink-0">
                    {tenant.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="font-extrabold text-xs text-white truncate leading-tight">
                      {tenant.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {activeBranchName}
                    </p>
                  </div>
                </div>
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50"
                  title="System Online & Synced"
                />
              </div>

              <div className="pt-1.5 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                <span className="font-mono bg-slate-700/80 px-1.5 py-0.5 rounded text-slate-200">
                  {tenant.currency}
                </span>
                <span className="flex items-center space-x-1 text-emerald-400 font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>CloudPOS</span>
                </span>
              </div>
            </div>
          </div>
        )
      )}
    </>
  );

  return (
    <>
      {/* 1. Desktop Fixed Navigation Sidebar */}
      <aside
        className={`${
          isCollapsed ? 'w-20' : 'w-68 lg:w-72'
        } h-screen bg-slate-900 dark:bg-[#0b0f19] border-r border-slate-800 text-slate-200 hidden md:flex md:flex-col justify-between shrink-0 transition-all duration-300 ease-in-out relative z-30 select-none shadow-xl`}
      >
        {renderContent(isCollapsed, false)}
      </aside>

      {/* 2. Mobile Drawer Navigation Overlay (< md screens) */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-slate-900 border-r border-slate-800 text-slate-200 z-50 flex flex-col justify-between md:hidden shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderContent(false, true)}
      </aside>
    </>
  );
};
