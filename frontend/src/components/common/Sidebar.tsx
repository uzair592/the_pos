import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
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
  ChevronDown,
  Sparkles,
  Calculator,
  UtensilsCrossed,
  X,
  MapPin,
  HardDrive,
  LifeBuoy,
  Activity,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { FeatureKey, Permission } from '@pos/shared';

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavSubItem {
  to: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
  permission?: Permission;
  feature?: FeatureKey;
}

interface NavItem {
  id?: string;
  to?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
  permission?: Permission;
  permissions?: Permission[];
  feature?: FeatureKey;
  isAccordion?: boolean;
  subItems?: NavSubItem[];
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

  // Storage key per logged-in user or fallback to global
  const storageKey = user?.id ? `pos_sidebar_width_${user.id}` : 'pos_sidebar_width';

  // Manual resizable width state (min 200px, max 480px, default 260px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 200 && parsed <= 480) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return 260;
  });

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(260);

  // Sync width when user changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 200 && parsed <= 480) {
          setSidebarWidth(parsed);
        }
      }
    } catch {}
  }, [storageKey]);

  // Handle Dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  }, [isCollapsed, sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(480, startWidthRef.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem(storageKey, String(sidebarWidth));
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth, storageKey]);

  // Billz POS Accordion: Exactly ONE dropdown open at a time
  const [openDropdown, setOpenDropdown] = useState<string | null>(() => {
    try {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/app/orders') || pathname.startsWith('/app/reservations')) return 'ORDERS';
      if (pathname.startsWith('/app/inventory')) return 'INVENTORY';
      if (pathname.startsWith('/app/settings') || pathname.startsWith('/app/tables')) return 'SETTINGS';
      return null;
    } catch {
      return null;
    }
  });

  // Dynamic live notification badges polled from backend
  const [badges, setBadges] = useState<{
    activeOrders: number;
    pendingKitchen: number;
    lowStock: number;
    pendingReservations: number;
    waitlistCount: number;
  }>({
    activeOrders: 0,
    pendingKitchen: 0,
    lowStock: 0,
    pendingReservations: 0,
    waitlistCount: 0,
  });

  // Toggle Accordion Dropdown (Only ONE open at a time; clicking open parent collapses it)
  const handleToggleDropdown = (dropdownId: string) => {
    setOpenDropdown((prev) => (prev === dropdownId ? null : dropdownId));
  };

  // Automatically expand and keep open the matching parent when user visits via URL
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/app/orders') || path.startsWith('/app/reservations')) {
      setOpenDropdown('ORDERS');
    } else if (path.startsWith('/app/inventory')) {
      setOpenDropdown('INVENTORY');
    } else if (path.startsWith('/app/settings') || path.startsWith('/app/tables')) {
      setOpenDropdown('SETTINGS');
    }
  }, [location.pathname]);

  // Poll backend sidebar badges every 12 seconds
  useEffect(() => {
    if (isSuperAdmin || !user) return;

    let isMounted = true;
    const fetchBadges = async () => {
      try {
        const branchParam = currentBranchId ? `?branchId=${currentBranchId}` : '';
        const res = await api.get(`/restaurant/sidebar-badges${branchParam}`);
        if (isMounted && res?.badges) {
          setBadges(res.badges);
        }
      } catch {
        // Fallback gracefully on temporary network drops
      }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSuperAdmin, user, currentBranchId]);

  // Billz POS Alt+S keyboard shortcut to quickly launch POS Billing from anywhere
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
      title: 'BUSINESS & RESTAURANTS',
      items: [
        { to: '/platform-admin', label: 'Platform Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/platform-admin/tenants', label: 'Restaurants & Tenants', icon: Building2 },
        { to: '/platform-admin/plans', label: 'Subscription Plans', icon: CreditCard },
        { to: '/platform-admin/payments', label: 'Subscription Payments', icon: DollarSign },
        { to: '/platform-admin/branches', label: 'Restaurant Branches', icon: MapPin },
      ],
    },
    {
      title: 'DEVICES & DATA',
      items: [
        { to: '/platform-admin/devices', label: 'Devices & Sessions', icon: Monitor },
        { to: '/platform-admin/backups', label: 'Backups & Restoration', icon: HardDrive },
      ],
    },
    {
      title: 'SUPPORT & SERVICE',
      items: [
        { to: '/platform-admin/tickets', label: 'Support Tickets', icon: LifeBuoy },
      ],
    },
    {
      title: 'GOVERNANCE & SYSTEM',
      items: [
        { to: '/platform-admin/users', label: 'Platform Admins', icon: Users },
        { to: '/platform-admin/audit-logs', label: 'Security Audit Logs', icon: ShieldAlert },
        { to: '/platform-admin/health', label: 'System Health & Infra', icon: Activity },
        { to: '/platform-admin/settings', label: 'Platform Settings', icon: Settings },
      ],
    },
  ];

  // FINAL APPROVED RESTAURANT SIDEBAR STRUCTURE
  const restaurantSections: NavSection[] = [
    {
      title: 'SALES',
      items: [
        {
          to: '/pos',
          label: 'Bill',
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
          badge: badges.activeOrders > 0 ? String(badges.activeOrders) : undefined,
          badgeColor: 'bg-blue-500 text-white',
        },
        {
          to: '/kds',
          label: 'Kitchen',
          icon: ChefHat,
          feature: FeatureKey.KDS,
          permission: Permission.ORDERS_VIEW,
          badge: badges.pendingKitchen > 0 ? String(badges.pendingKitchen) : undefined,
          badgeColor: 'bg-orange-500 text-white',
        },
      ],
    },
    {
      title: 'INVENTORY',
      items: [
        {
          to: '/app/menu',
          label: 'Menu',
          icon: Utensils,
          permission: Permission.MENU_MANAGE,
        },
        {
          to: '/app/purchases',
          label: 'Purchases',
          icon: Truck,
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_MANAGE,
        },
        {
          to: '/app/inventory',
          label: 'Inventory',
          icon: Boxes,
          feature: FeatureKey.INVENTORY,
          permission: Permission.INVENTORY_VIEW,
          badge: badges.lowStock > 0 ? String(badges.lowStock) : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        {
          to: '/app/recipe-costing',
          label: 'Costing',
          icon: Calculator,
          feature: FeatureKey.INVENTORY,
          permissions: [Permission.INVENTORY_VIEW, Permission.REPORTS_FINANCIAL, Permission.MENU_VIEW],
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          to: '/app/daybook',
          label: 'Daybook',
          icon: BookOpen,
          permission: Permission.REPORTS_FINANCIAL,
        },
        {
          to: '/app/cash-and-bank',
          label: 'Banking',
          icon: Landmark,
          permission: Permission.REPORTS_FINANCIAL,
        },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        {
          to: '/app/expenses',
          label: 'Expenses',
          icon: Receipt,
          permission: Permission.EXPENSES_VIEW,
        },
        {
          to: '/app/reports',
          label: 'Reports',
          icon: BarChart3,
          permission: Permission.REPORTS_FINANCIAL,
        },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        {
          to: '/app/staff',
          label: 'Staff',
          icon: Users,
          permission: Permission.STAFF_MANAGE,
        },
        {
          to: '/app/settings',
          label: 'Settings',
          icon: Settings,
          permission: Permission.SETTINGS_MANAGE,
        },
      ],
    },
  ];

  const sections = isSuperAdmin ? superAdminSections : restaurantSections;

  // Check if a link is currently active
  const isUrlActive = (targetUrl?: string, exact: boolean = false) => {
    if (!targetUrl) return false;
    if (targetUrl === '/app/recipe-costing' || targetUrl === '/app/reports/recipe-costing') {
      return location.pathname === '/app/recipe-costing' || location.pathname === '/app/reports/recipe-costing';
    }
    if (targetUrl === '/app/reports') {
      return location.pathname === '/app/reports' && !location.pathname.includes('recipe-costing');
    }
    if (targetUrl.includes('?')) {
      const [path, query] = targetUrl.split('?');
      return location.pathname === path && location.search.includes(query);
    }
    if (exact) {
      return location.pathname === targetUrl && location.search === '';
    }
    return location.pathname === targetUrl || location.pathname.startsWith(targetUrl + '/');
  };

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

      {/* Scrollable Navigation Body (Independent internal scrolling) */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 custom-scrollbar">
        {/* Billz POS Quick Add Sale Button */}
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
                  <span className="text-amber-400 font-extrabold">+ BILL</span>
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
                  <span className="tracking-wide uppercase font-extrabold">+ BILL</span>
                </div>
                <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                  Alt+S
                </span>
              </NavLink>
            </div>
          )
        )}

        {/* Billz POS Accordion Navigation */}
        {sections.map((section, sIdx) => {
            // Filter items by feature and permissions
            const visibleItems = section.items.filter((item) => {
              if (item.feature && !hasFeature(item.feature)) return false;
              if (item.permissions && !item.permissions.some((p) => hasPermission(p))) return false;
              if (item.permission && !hasPermission(item.permission)) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} className="space-y-1">
                {collapsed ? (
                  <div className="my-2 border-t border-slate-800/80 mx-2" title={section.title} />
                ) : (
                  <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>{section.title}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isAccordion = !!item.isAccordion;
                    const accordionKey = item.id || item.label;
                    const isOpen = openDropdown === accordionKey;

                    // Parent is active if direct link matches OR any child subitem matches
                    const isParentActive = isAccordion
                      ? item.subItems?.some((sub) => isUrlActive(sub.to))
                      : isUrlActive(item.to, item.exact);

                    // ==========================================
                    // 1. COLLAPSED MODE VIEW (Width 20 / 80px)
                    // ==========================================
                    if (collapsed) {
                      return (
                        <div key={accordionKey} className="relative group flex justify-center">
                          {isAccordion ? (
                            <button
                              type="button"
                              onClick={() => {
                                onToggleCollapse?.();
                                setOpenDropdown(accordionKey);
                              }}
                              className={`relative w-10 h-10 flex items-center justify-center rounded-xl text-xs transition-all ${
                                isParentActive
                                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 font-bold'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                              }`}
                            >
                              <Icon className="w-5 h-5 shrink-0" />
                              {isParentActive && (
                                <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 bg-white rounded-r-full shadow-sm" />
                              )}
                              {item.badge && !isParentActive && (
                                <span
                                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shadow-md ${
                                    item.badgeColor || 'bg-brand-500 text-white'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          ) : (
                            <NavLink
                              to={item.to!}
                              end={item.exact}
                              className={`relative w-10 h-10 flex items-center justify-center rounded-xl text-xs transition-all ${
                                isParentActive
                                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 font-bold'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                              }`}
                            >
                              <Icon className="w-5 h-5 shrink-0" />
                              {isParentActive && (
                                <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 bg-white rounded-r-full shadow-sm" />
                              )}
                              {item.badge && !isParentActive && (
                                <span
                                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shadow-md ${
                                    item.badgeColor || 'bg-brand-500 text-white'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </NavLink>
                          )}

                          {/* Floating Flyout Menu / Tooltip on Hover in Collapsed Mode */}
                          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 pointer-events-auto">
                            <div className="bg-slate-950 text-white border border-slate-700/90 rounded-xl shadow-2xl p-2 min-w-[200px] space-y-1.5">
                              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 px-1">
                                <span className="font-extrabold text-xs text-white">{item.label}</span>
                                {item.badge && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
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

                              {/* Accordion Sub-items inside flyout */}
                              {isAccordion && item.subItems && (
                                <div className="space-y-0.5">
                                  {item.subItems.map((sub) => {
                                    const subActive = isUrlActive(sub.to);
                                    return (
                                      <Link
                                        key={sub.to}
                                        to={sub.to}
                                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                          subActive
                                            ? 'bg-brand-500/20 text-brand-300 font-bold'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                                        }`}
                                      >
                                        <span>{sub.label}</span>
                                        {sub.badge && (
                                          <span
                                            className={`text-[9px] px-1 py-0.2 rounded font-black ${
                                              sub.badgeColor || 'bg-brand-500 text-white'
                                            }`}
                                          >
                                            {sub.badge}
                                          </span>
                                        )}
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ==========================================
                    // 2. EXPANDED MODE ACCORDION DROPDOWN ITEM
                    // ==========================================
                    if (isAccordion) {
                      return (
                        <div key={accordionKey} className="space-y-0.5">
                          {/* Accordion Parent Header Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleDropdown(accordionKey)}
                            aria-expanded={isOpen}
                            className={`w-full relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all group ${
                              isParentActive
                                ? 'bg-slate-800/90 text-white font-extrabold border border-slate-700/80 shadow-sm'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                            }`}
                          >
                            {isParentActive && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-brand-500 rounded-r-full shadow-sm" />
                            )}
                            <div className="flex items-center space-x-2.5 truncate">
                              <Icon
                                className={`w-4 h-4 shrink-0 transition-colors ${
                                  isParentActive ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              {/* Parent Badge (e.g. pending orders or low stock count) */}
                              {item.badge && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                                    item.badgeColor || 'bg-brand-400/20 text-brand-300 border border-brand-400/30'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                              {/* Rotating Chevron Icon */}
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isOpen ? 'rotate-180 text-brand-400' : 'text-slate-400'
                                }`}
                              />
                            </div>
                          </button>

                          {/* Accordion Submenu Items (Only rendered when open) */}
                          {isOpen && item.subItems && (
                            <div className="ml-4 pl-3 border-l-2 border-slate-800 space-y-0.5 pt-1 pb-1 animate-fade-in">
                              {item.subItems.map((sub) => {
                                const subActive = isUrlActive(sub.to);
                                return (
                                  <NavLink
                                    key={sub.to}
                                    to={sub.to}
                                    onClick={isMobileDrawer ? onCloseMobile : undefined}
                                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                      subActive
                                        ? 'bg-brand-500 text-white font-extrabold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 font-medium'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2 truncate">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                          subActive ? 'bg-white' : 'bg-slate-600'
                                        }`}
                                      />
                                      <span className="truncate">{sub.label}</span>
                                    </div>
                                    {sub.badge && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                                          sub.badgeColor || 'bg-brand-400 text-slate-900'
                                        }`}
                                      >
                                        {sub.badge}
                                      </span>
                                    )}
                                  </NavLink>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // ==========================================
                    // 3. EXPANDED MODE DIRECT NAVLINK ITEM
                    // ==========================================
                    return (
                      <NavLink
                        key={item.to!}
                        to={item.to!}
                        end={item.exact}
                        onClick={isMobileDrawer ? onCloseMobile : undefined}
                        className={`relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all group ${
                          isParentActive
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 font-extrabold'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                        }`}
                      >
                        {isParentActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-white rounded-r-full shadow-sm" />
                        )}
                        <div className="flex items-center space-x-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isParentActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {item.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                                item.badgeColor || 'bg-brand-400/20 text-brand-300 border border-brand-400/30'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.shortcut && (
                            <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded font-mono text-slate-300">
                              {item.shortcut}
                            </span>
                          )}
                        </div>
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
        style={{ width: isCollapsed ? '80px' : `${sidebarWidth}px` }}
        className={`h-screen bg-slate-900 dark:bg-[#0b0f19] border-r border-slate-800 text-slate-200 hidden md:flex md:flex-col justify-between shrink-0 relative z-30 select-none shadow-xl ${
          isResizing ? 'transition-none select-none pointer-events-none' : 'transition-[width] duration-150 ease-out'
        }`}
      >
        {renderContent(isCollapsed, false)}

        {/* Draggable Resize Handle on Right Border (Only when not collapsed) */}
        {!isCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            title="Drag left/right to resize sidebar (Double click to reset)"
            onDoubleClick={() => {
              setSidebarWidth(260);
              try {
                localStorage.setItem(storageKey, '260');
              } catch {}
            }}
            className={`absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-40 group flex items-center justify-center transition-colors pointer-events-auto ${
              isResizing ? 'bg-brand-500/80' : 'hover:bg-brand-500/30'
            }`}
          >
            <div
              className={`w-1 h-14 rounded-full transition-colors ${
                isResizing
                  ? 'bg-white shadow'
                  : 'bg-transparent group-hover:bg-brand-400 group-hover:shadow-xs'
              }`}
            />
          </div>
        )}
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
