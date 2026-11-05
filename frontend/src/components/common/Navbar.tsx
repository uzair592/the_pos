import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import {
  UtensilsCrossed,
  Monitor,
  ChefHat,
  LayoutGrid,
  LogOut,
  User,
  ShieldCheck,
  Sun,
  Moon,
  Menu,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';

export interface NavbarProps {
  onToggleMobileMenu?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { user, tenant, isSuperAdmin, logout, hasFeature, branches, currentBranchId } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(isSuperAdmin ? '/platform-admin/login' : '/login');
  };

  const activeBranchName =
    branches?.find((b) => b.id === (currentBranchId || user?.branchId))?.name || 'Main Branch';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 shrink-0 transition-colors z-20">
      <div className="px-4 sm:px-6 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left Section: Mobile Menu Button + Mobile Brand + Desktop Active Workspace Context */}
          <div className="flex items-center space-x-3">
            {/* Mobile hamburger menu toggle */}
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
              aria-label="Open Navigation Menu"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Brand Link (visible only on mobile screens < md) */}
            <div className="flex items-center space-x-2.5 md:hidden">
              <Link
                to={isSuperAdmin ? '/platform-admin' : '/app'}
                className="flex items-center space-x-2 text-slate-900 dark:text-white"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-sm">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm tracking-tight truncate max-w-[130px] sm:max-w-[200px]">
                  {isSuperAdmin ? 'CloudPOS' : tenant?.name || 'Restaurant POS'}
                </span>
              </Link>
            </div>

            {/* Desktop Active Workspace & Branch Status */}
            <div className="hidden md:flex items-center space-x-3">
              {!isSuperAdmin ? (
                <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-extrabold text-slate-700 dark:text-slate-200">
                    {activeBranchName}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold font-mono">
                    ({tenant?.currency || 'PKR'})
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Platform Super Admin</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Quick Action Buttons, Theme Switcher & Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {!isSuperAdmin && (
              <>
                {/* Workspace Hub Launcher */}
                <Link
                  to="/hub"
                  className="flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                  title="Workspace Hub Launcher"
                >
                  <LayoutGrid className="w-4 h-4 text-blue-500" />
                  <span className="hidden md:inline">Workspace Hub</span>
                </Link>

                {/* Fast POS Button */}
                <Link
                  to="/pos"
                  className="flex items-center space-x-2 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:shadow"
                  title="Launch POS Terminal (Alt+S)"
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">Launch POS</span>
                </Link>

                {/* Kitchen Display System */}
                {hasFeature(FeatureKey.KDS) && (
                  <Link
                    to="/kds"
                    className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                    title="Kitchen Display System"
                  >
                    <ChefHat className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="hidden sm:inline">Kitchen Display</span>
                  </Link>
                )}
              </>
            )}

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* User Badge */}
            <div className="flex items-center space-x-2 sm:space-x-2.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden lg:block">
                <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight truncate max-w-[120px]">
                  {user?.fullName || 'User'}
                </span>
                <span className="text-[10px] text-slate-400 capitalize block">
                  {user?.role?.replace('_', ' ').toLowerCase() || 'Staff'}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors ml-0.5 sm:ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
