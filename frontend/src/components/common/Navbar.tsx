import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  UtensilsCrossed,
  Store,
  Monitor,
  ChefHat,
  LogOut,
  User,
  ShieldCheck,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';

export const Navbar: React.FC = () => {
  const { user, tenant, isSuperAdmin, logout, hasFeature } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(isSuperAdmin ? '/platform-admin/login' : '/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link
              to={isSuperAdmin ? '/platform-admin' : '/app'}
              className="flex items-center space-x-2.5 text-slate-900 group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight block leading-tight">
                  {isSuperAdmin ? 'CloudPOS' : tenant?.name || 'Restaurant POS'}
                </span>
                <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider block">
                  {isSuperAdmin ? 'Platform Super Admin' : 'Point of Sale SaaS'}
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center space-x-3">
            {!isSuperAdmin && (
              <>
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
                    className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                  >
                    <ChefHat className="w-4 h-4 text-orange-600" />
                    <span className="hidden sm:inline">Kitchen Display</span>
                  </Link>
                )}
              </>
            )}

            {/* User Badge */}
            <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                {isSuperAdmin ? <ShieldCheck className="w-4 h-4 text-brand-600" /> : <User className="w-4 h-4" />}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">{user?.fullName || 'User'}</p>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
