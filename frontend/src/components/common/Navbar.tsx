import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { api } from '../../api/client.js';
import {
  UtensilsCrossed,
  Monitor,
  ChefHat,
  PlusCircle,
  ChevronDown,
  LogOut,
  User,
  ShieldCheck,
  Sun,
  Moon,
  Menu,
  Building,
  Check,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';
import { HeaderSearch } from './HeaderSearch.js';
import { AddMoreMenu } from './AddMoreMenu.js';
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

  // State for menus & quick action modals
  const [isAddMoreOpen, setIsAddMoreOpen] = useState(false);
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

  // Global Keyboard Shortcuts (Alt+S for POS, Alt+P for Purchases, Alt+E for Expenses)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
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
          case 'p': // Alt + P: Add Purchase
            e.preventDefault();
            navigate('/app/purchases?action=new-bill');
            break;
          case 'e': // Alt + E: Record Expense
            e.preventDefault();
            setActiveQuickModal('RECORD_EXPENSE');
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
  const isKdsActive = location.pathname === '/kds';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-12 min-h-[48px] max-h-[48px] shrink-0 transition-colors z-30 sticky top-0">
      <div className="px-2.5 sm:px-3 lg:px-4 h-full">
        <div className="flex items-center justify-between h-full space-x-2 sm:space-x-3">
          {/* ========================================================= */}
          {/* 1. LEFT: Mobile Toggle + Restaurant & Branch Identity    */}
          {/* ========================================================= */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Mobile hamburger menu toggle */}
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-1.5 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Restaurant Brand & Branch Info */}
            <Link
              to={isSuperAdmin ? '/platform-admin' : '/app'}
              className="flex items-center space-x-2 shrink-0 group"
              title={tenant?.name || 'Restaurant POS'}
            >
              <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                <UtensilsCrossed className="w-3.5 h-3.5" />
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="font-black text-xs text-slate-900 dark:text-white truncate max-w-[110px] md:max-w-[140px] lg:max-w-[170px]">
                  {isSuperAdmin ? 'Platform Admin' : tenant?.name || 'Restaurant POS'}
                </span>
                {!isSuperAdmin ? (
                  <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[110px] md:max-w-[140px] lg:max-w-[170px] flex items-center gap-0.5">
                    <Building className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{activeBranchName}</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Super Admin</span>
                )}
              </div>
            </Link>
          </div>

          {/* ========================================================= */}
          {/* 2. CENTER-LEFT: Small Global Search Bar                   */}
          {/* ========================================================= */}
          {!isSuperAdmin && (
            <div className="flex-1 max-w-[180px] sm:max-w-[220px] md:max-w-[260px] lg:max-w-[280px]">
              <HeaderSearch />
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. RIGHT: POS Terminal, KDS, Add More, User/Profile       */}
          {/* ========================================================= */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 ml-auto">
            {!isSuperAdmin && (
              <>
                {/* POS Terminal Shortcut Button */}
                <Link
                  to="/pos"
                  className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 ${
                    isPosActive
                      ? 'bg-orange-600 text-white ring-2 ring-orange-400/50'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                  title="Launch POS Billing Terminal"
                >
                  <Monitor className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xs:inline">POS Terminal</span>
                  <span className="xs:hidden">POS</span>
                </Link>

                {/* Kitchen Display (KDS) Button */}
                {hasFeature(FeatureKey.KDS) && (
                  <Link
                    to="/kds"
                    className={`flex items-center space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                      isKdsActive
                        ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                    title="Kitchen Display System"
                  >
                    <ChefHat className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                    <span>KDS</span>
                    {badges.pendingKitchen > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-[10px] font-bold text-white leading-tight">
                        {badges.pendingKitchen}
                      </span>
                    )}
                  </Link>
                )}

                {/* Add More Dropdown (Vyapar Quick-Entry Action Menu) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAddMoreOpen(!isAddMoreOpen)}
                    className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 shadow-sm ${
                      isAddMoreOpen
                        ? 'bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    title="Vyapar Quick-Entry Actions Menu"
                  >
                    <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Add More</span>
                    <span className="sm:hidden">More</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isAddMoreOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AddMoreMenu
                    isOpen={isAddMoreOpen}
                    onClose={() => setIsAddMoreOpen(false)}
                    onTriggerModal={(modalType) => setActiveQuickModal(modalType)}
                  />
                </div>
              </>
            )}

            {/* Dark / Light Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* User Profile Dropdown */}
            <div className="relative shrink-0" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-1.5 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                aria-label="User profile options"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-black text-xs">
                  {user?.fullName?.charAt(0).toUpperCase() || <User className="w-3.5 h-3.5" />}
                </div>
                <div className="hidden xl:block text-left leading-tight">
                  <span className="text-xs font-black text-slate-900 dark:text-white block truncate max-w-[100px]">
                    {user?.fullName || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold capitalize block truncate max-w-[100px]">
                    {user?.role?.replace('_', ' ').toLowerCase() || 'Staff'}
                  </span>
                </div>
                <ChevronDown className={`hidden sm:block w-3 h-3 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Menu Popover */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                      {user?.fullName || 'User'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</p>
                    <div className="mt-1.5 flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                        {user?.role?.replace('_', ' ').toLowerCase() || 'Staff'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold truncate">• {activeBranchName}</span>
                    </div>
                  </div>

                  {/* Multi-Branch Switcher */}
                  {branches && branches.length > 1 && switchBranch && (
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="px-2 py-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
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
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                  <div className="p-1.5">
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
      <QuickActionModals
        activeModal={activeQuickModal}
        onClose={() => setActiveQuickModal(null)}
        onSuccess={fetchBadges}
      />
    </header>
  );
};
