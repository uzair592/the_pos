import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { api } from '../../api/client.js';
import {
  UtensilsCrossed,
  Monitor,
  ShoppingBag,
  ChefHat,
  PlusCircle,
  ChevronDown,
  LogOut,
  User,
  ShieldCheck,
  Sun,
  Moon,
  Menu,
  Search,
  Keyboard,
  Building,
  Check,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';
import { Breadcrumbs } from './Breadcrumbs.js';
import { AddMoreMenu } from './AddMoreMenu.js';
import { GlobalSearchModal } from './GlobalSearchModal.js';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal.js';
import { NotificationCenter } from './NotificationCenter.js';
import { QuickActionModals, QuickActionType } from './QuickActionModals.js';

export interface NavbarProps {
  onToggleMobileMenu?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { user, tenant, isSuperAdmin, logout, hasFeature, branches, currentBranchId, switchBranch } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // State for menus & modals
  const [isAddMoreOpen, setIsAddMoreOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeQuickModal, setActiveQuickModal] = useState<QuickActionType>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Live sidebar / notification badges
  const [badges, setBadges] = useState({
    activeOrders: 0,
    pendingKitchen: 0,
    lowStock: 0,
    pendingReservations: 0,
    waitlistCount: 0,
  });

  const fetchBadges = async () => {
    if (isSuperAdmin) return;
    try {
      const branchParam = currentBranchId ? `?branchId=${currentBranchId}` : '';
      const res = await api.get(`/restaurant/sidebar-badges${branchParam}`);
      if (res?.badges) {
        setBadges(res.badges);
      }
    } catch {
      // Background poll failure
    }
  };

  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 12000);
    return () => clearInterval(interval);
  }, [currentBranchId, isSuperAdmin]);

  // Global Keyboard Shortcuts (Alt+S, Alt+F, Alt+I, Alt+R, Alt+M, Alt+D, Alt+P, Alt+G, Alt+L, Alt+O, Ctrl+K)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl + K or Cmd + K: Global Search
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
        return;
      }

      // Check if user is actively typing in an input, textarea, or contentEditable element
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      if (isInputActive) return;

      if (e.altKey) {
        const key = e.key.toLowerCase();
        switch (key) {
          case 's': // Alt + S: POS Terminal
            e.preventDefault();
            navigate('/pos');
            break;
          case 'f': // Alt + F: Sale Order / Advance Order
            e.preventDefault();
            setActiveQuickModal('ADVANCE_ORDER');
            break;
          case 'i': // Alt + I: Payment-In
            e.preventDefault();
            setActiveQuickModal('PAYMENT_IN');
            break;
          case 'r': // Alt + R: Sale Return / Refund
            e.preventDefault();
            setActiveQuickModal('SALE_RETURN');
            break;
          case 'm': // Alt + M: Estimate / Quotation
            e.preventDefault();
            setActiveQuickModal('ESTIMATE_QUOTATION');
            break;
          case 'd': // Alt + D: Delivery Challan
            e.preventDefault();
            setActiveQuickModal('DELIVERY_CHALLAN');
            break;
          case 'p': // Alt + P: Add Purchase / Purchase Bill
            e.preventDefault();
            navigate('/app/purchases?action=new-bill');
            break;
          case 'g': // Alt + G: Purchase Order
            e.preventDefault();
            navigate('/app/purchases');
            break;
          case 'l': // Alt + L: Purchase Return
            e.preventDefault();
            setActiveQuickModal('PURCHASE_RETURN');
            break;
          case 'o': // Alt + O: Payment-Out
            e.preventDefault();
            setActiveQuickModal('PAYMENT_OUT');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [navigate]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  const handleLogout = () => {
    logout();
    navigate(isSuperAdmin ? '/platform-admin/login' : '/login');
  };

  const activeBranchName =
    branches?.find((b) => b.id === (currentBranchId || user?.branchId))?.name || 'Main Branch';

  const isPosActive = location.pathname === '/pos';
  const isOrdersActive = location.pathname.startsWith('/app/orders');
  const isKdsActive = location.pathname === '/kds';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 shrink-0 transition-colors z-30 sticky top-0">
      <div className="px-3 sm:px-6 h-full">
        <div className="flex items-center justify-between h-full space-x-2 sm:space-x-4">
          {/* ========================================================= */}
          {/* LEFT: Mobile Toggle + Brand & Compact Context Area        */}
          {/* ========================================================= */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
            {/* Mobile hamburger menu toggle */}
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Brand Link (< md) */}
            <div className="flex items-center space-x-2 md:hidden">
              <Link to={isSuperAdmin ? '/platform-admin' : '/app'} className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-sm">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Breadcrumbs */}
            <div className="hidden md:flex items-center space-x-3">
              {isSuperAdmin && (
                <>
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Platform Super Admin</span>
                  </div>
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                </>
              )}
              <Breadcrumbs />
            </div>
          </div>

          {/* ========================================================= */}
          {/* CENTER: The Four Primary Action Buttons                   */}
          {/* ========================================================= */}
          {!isSuperAdmin && (
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              {/* 1. POS Terminal Button (Most prominent) */}
              <Link
                to="/pos"
                className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all ${
                  isPosActive
                    ? 'bg-brand-600 text-white ring-2 ring-brand-500/30 shadow-md'
                    : 'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white hover:shadow-md'
                }`}
                title="Open POS Billing Terminal (Alt + S)"
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span className="tracking-tight">POS Terminal</span>
                <span className="hidden xl:inline-block px-1.5 py-0.5 rounded bg-black/20 text-[9px] font-mono font-bold">
                  Alt+S
                </span>
              </Link>

              {/* 2. Orders Button */}
              <Link
                to="/app/orders"
                className={`relative flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isOrdersActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60'
                }`}
                title="View All Orders & Status"
              >
                <ShoppingBag className="w-4 h-4 shrink-0 text-blue-500" />
                <span className="hidden sm:inline">Orders</span>
                {badges.activeOrders > 0 && (
                  <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-blue-500 text-[9px] font-black text-white">
                    {badges.activeOrders}
                  </span>
                )}
              </Link>

              {/* 3. Kitchen Display Button */}
              {hasFeature(FeatureKey.KDS) && (
                <Link
                  to="/kds"
                  className={`relative flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isKdsActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60'
                  }`}
                  title="Kitchen Display System (KDS)"
                >
                  <ChefHat className="w-4 h-4 shrink-0 text-orange-500" />
                  <span className="hidden sm:inline">Kitchen Display</span>
                  {badges.pendingKitchen > 0 && (
                    <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white">
                      {badges.pendingKitchen}
                    </span>
                  )}
                </Link>
              )}

              {/* 4. Add More Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAddMoreOpen(!isAddMoreOpen)}
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isAddMoreOpen
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border-brand-300 dark:border-brand-800 shadow-sm'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80'
                  }`}
                  title="Add More Restaurant Operations"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Add More</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isAddMoreOpen ? 'rotate-180 text-brand-500' : ''}`} />
                </button>

                {/* Categorized Dropdown Menu */}
                <AddMoreMenu
                  isOpen={isAddMoreOpen}
                  onClose={() => setIsAddMoreOpen(false)}
                  onTriggerModal={(modalType) => setActiveQuickModal(modalType)}
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* RIGHT: Utility Actions Toolbar                            */}
          {/* ========================================================= */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
            {/* Global Search Button */}
            {!isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsGlobalSearchOpen(true)}
                className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium border border-slate-200/80 dark:border-slate-700/60 transition-colors"
                title="Global Search (Ctrl + K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-slate-500 dark:text-slate-400">Search...</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[9px] font-bold text-slate-500">
                  Ctrl+K
                </kbd>
              </button>
            )}

            {/* Mobile/Compact Search Icon */}
            {!isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsGlobalSearchOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Global Search (Ctrl + K)"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Notification Center */}
            {!isSuperAdmin && (
              <NotificationCenter badges={badges} onRefresh={fetchBadges} />
            )}

            {/* Keyboard Shortcut Help */}
            {!isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(true)}
                className="hidden sm:flex p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Keyboard Shortcuts Cheat Sheet"
                aria-label="View shortcuts"
              >
                <Keyboard className="w-4 h-4" />
              </button>
            )}

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* User Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                aria-label="User profile options"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-black text-xs">
                  {user?.fullName?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                </div>
                <div className="hidden xl:block text-left">
                  <span className="text-xs font-black text-slate-900 dark:text-white block leading-tight truncate max-w-[110px]">
                    {user?.fullName || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold capitalize block leading-none mt-0.5">
                    {user?.role?.replace('_', ' ').toLowerCase() || 'Staff'}
                  </span>
                </div>
                <ChevronDown className={`hidden xl:block w-3.5 h-3.5 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Menu Popover */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {user?.fullName || 'User'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</p>
                    <div className="mt-2 flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                        {user?.role?.replace('_', ' ').toLowerCase() || 'Staff'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">• {activeBranchName}</span>
                    </div>
                  </div>

                  {/* Multi-Branch Switcher */}
                  {branches && branches.length > 1 && switchBranch && (
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="px-3 py-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Switch Outlet Branch
                      </span>
                      <div className="space-y-0.5">
                        {branches.map((b) => {
                          const isCurrent = b.id === (currentBranchId || user?.branchId);
                          return (
                            <button
                              key={b.id}
                              onClick={() => {
                                switchBranch(b.id);
                                setIsProfileOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                                isCurrent
                                  ? 'bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 font-bold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate">{b.name}</span>
                              </div>
                              {isCurrent && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setIsShortcutsOpen(true);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Keyboard className="w-4 h-4 text-slate-400" />
                      <span>Keyboard Shortcuts</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Modals Mounted at Root */}
      <GlobalSearchModal isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} />
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <QuickActionModals
        activeModal={activeQuickModal}
        onClose={() => setActiveQuickModal(null)}
        onSuccess={fetchBadges}
      />
    </header>
  );
};
