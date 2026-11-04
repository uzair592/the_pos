import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import {
  UtensilsCrossed,
  Store,
  Monitor,
  ChefHat,
  LayoutGrid,
  LogOut,
  User,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';

export const Navbar: React.FC = () => {
  const { user, tenant, isSuperAdmin, logout, hasFeature } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(isSuperAdmin ? '/platform-admin/login' : '/login');
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link
              to={isSuperAdmin ? '/platform-admin' : '/app'}
              className="flex items-center space-x-2.5 text-slate-900 dark:text-white group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight block leading-tight">
                  {isSuperAdmin ? 'CloudPOS' : tenant?.name || 'Restaurant POS'}
                </span>
                <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider block">
                  {isSuperAdmin ? 'Platform Super Admin' : 'Point of Sale SaaS'}
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center space-x-3">
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
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">Launch POS Terminal</span>
                </Link>

                {/* Kitchen Display System */}
                {hasFeature(FeatureKey.KDS) && (
                  <Link
                    to="/kds"
                    className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
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
            <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                {isSuperAdmin ? <ShieldCheck className="w-4 h-4 text-brand-600" /> : <User className="w-4 h-4" />}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{user?.fullName || 'User'}</p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
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
