import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutGrid,
  ShoppingCart,
  Package,
  Sliders,
  ChefHat,
  ArrowRight,
  LogOut,
  Users,
  ShieldCheck,
  Building2,
  Check,
  X,
} from 'lucide-react';

export const WorkspaceHub: React.FC = () => {
  const { user, tenant, isSuperAdmin, logout, login } = useAuth();
  const navigate = useNavigate();
  const [isSwitchStaffOpen, setIsSwitchStaffOpen] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);

  // Compute User Display Initial
  const userInitial = user?.fullName
    ? user.fullName.trim()[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : 'U';

  const handleLogout = () => {
    logout();
    navigate(isSuperAdmin ? '/platform-admin/login' : '/login');
  };

  // Quick switch between demo staff roles on shared restaurant tablet
  const handleSwitchStaff = async (staffEmail: string) => {
    setSwitchLoading(true);
    try {
      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: staffEmail,
          password: 'Password123!',
        }),
      });
      const data = await response.json();
      if (data.token) {
        login(data.token, data.user);
        setIsSwitchStaffOpen(false);
      }
    } catch (err) {
      console.error('Failed to switch staff:', err);
    } finally {
      setSwitchLoading(false);
    }
  };

  const modules = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      subtitle: 'Executive Overview',
      buttonText: 'Overview',
      route: '/app',
      icon: LayoutGrid,
      color: 'blue',
      cardBorder: 'hover:border-blue-500/60 border-b-2 border-b-blue-500',
      iconBg: 'bg-blue-500/20 border border-blue-500/30 text-blue-400',
      glowBg: 'bg-blue-500/15 group-hover:bg-blue-500/25',
      btnHover: 'group-hover:bg-blue-600 group-hover:border-blue-500',
    },
    {
      id: 'pos',
      title: 'POS Terminal',
      subtitle: 'Sales & Express Billing',
      buttonText: 'Open Register',
      route: '/pos',
      icon: ShoppingCart,
      color: 'emerald',
      cardBorder: 'hover:border-emerald-500/60 border-b-2 border-b-emerald-500',
      iconBg: 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400',
      glowBg: 'bg-emerald-500/15 group-hover:bg-emerald-500/25',
      btnHover: 'group-hover:bg-emerald-600 group-hover:border-emerald-500',
    },
    {
      id: 'inventory',
      title: 'Inventory',
      subtitle: 'Stock & Menu Control',
      buttonText: 'Manage Stock',
      route: '/app/inventory',
      icon: Package,
      color: 'amber',
      cardBorder: 'hover:border-amber-500/60 border-b-2 border-b-amber-500',
      iconBg: 'bg-amber-500/20 border border-amber-500/30 text-amber-400',
      glowBg: 'bg-amber-500/15 group-hover:bg-amber-500/25',
      btnHover: 'group-hover:bg-amber-600 group-hover:border-amber-500',
    },
    {
      id: 'operations',
      title: 'Operations',
      subtitle: 'Orders, Staff & Settings',
      buttonText: 'Manage',
      route: '/app/orders',
      icon: Sliders,
      color: 'purple',
      cardBorder: 'hover:border-purple-500/60 border-b-2 border-b-purple-500',
      iconBg: 'bg-purple-500/20 border border-purple-500/30 text-purple-400',
      glowBg: 'bg-purple-500/15 group-hover:bg-purple-500/25',
      btnHover: 'group-hover:bg-purple-600 group-hover:border-purple-500',
    },
    {
      id: 'kds',
      title: 'Kitchen Display',
      subtitle: 'Live Kitchen Orders (KDS)',
      buttonText: 'Open KDS',
      route: '/kds',
      icon: ChefHat,
      color: 'rose',
      cardBorder: 'hover:border-rose-500/60 border-b-2 border-b-rose-500',
      iconBg: 'bg-rose-500/20 border border-rose-500/30 text-rose-400',
      glowBg: 'bg-rose-500/15 group-hover:bg-rose-500/25',
      btnHover: 'group-hover:bg-rose-600 group-hover:border-rose-500',
    },
  ];

  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Decorative Grid Dot Pattern - Top Left */}
      <div className="absolute top-6 left-6 w-40 h-40 opacity-25 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-grid-tl" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.3" fill="#60a5fa" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid-tl)" />
        </svg>
      </div>

      {/* Decorative Grid Dot Pattern - Bottom Right */}
      <div className="absolute bottom-6 right-6 w-40 h-40 opacity-20 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-grid-br" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.3" fill="#818cf8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid-br)" />
        </svg>
      </div>

      {/* Ambient Radial Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Bar Header */}
      <header className="px-6 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-blue-600 flex items-center justify-center text-white font-black shadow-md">
            POS
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white leading-tight tracking-tight">
              {tenant?.name || 'Restaurant POS'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {isSuperAdmin ? 'Platform Management Console' : 'Cloud Workspace Portal'}
            </p>
          </div>
        </div>

        {/* User Badge & Switch Staff / Logout Controls */}
        <div className="flex items-center space-x-2.5">
          {!isSuperAdmin && (
            <button
              onClick={() => setIsSwitchStaffOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Switch Staff</span>
            </button>
          )}

          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">{user?.fullName || 'Staff Member'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-black">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Center Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 relative z-10 w-full max-w-7xl mx-auto">
        {/* Glowing Radial Avatar Badge */}
        <div className="relative mb-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 flex items-center justify-center text-white text-2xl font-black shadow-[0_0_40px_rgba(37,99,235,0.55)] border-2 border-blue-300/40">
            {userInitial}
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Welcome
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium max-w-md mx-auto">
            Select your workspace module to begin operations
          </p>
        </div>

        {/* The 5 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5 w-full max-w-6xl">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                onClick={() => navigate(m.route)}
                className={`bg-[#0f1423]/90 hover:bg-[#151c33] border border-slate-800/90 rounded-2xl p-6 transition-all duration-300 shadow-xl relative overflow-hidden flex flex-col justify-between group cursor-pointer ${m.cardBorder} hover:-translate-y-1`}
              >
                {/* Radial Glow in Corner */}
                <div
                  className={`absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl transition-all pointer-events-none ${m.glowBg}`}
                />

                {/* Card Top: Icon & Labels */}
                <div>
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${m.iconBg}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1 tracking-tight">
                    {m.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6 font-medium">
                    {m.subtitle}
                  </p>
                </div>

                {/* Card Bottom: Action Pill Button */}
                <div>
                  <span
                    className={`inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-300 group-hover:text-white text-xs font-semibold transition-all ${m.btnHover}`}
                  >
                    <span>{m.buttonText}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="px-6 py-4 text-center text-xs text-slate-500 relative z-10 flex flex-col sm:flex-row items-center justify-between max-w-6xl w-full mx-auto border-t border-slate-800/60">
        <div>
          <span>Multi-Device Synchronization: </span>
          <span className="text-emerald-400 font-bold">Active & Online</span>
        </div>
        <div className="mt-1 sm:mt-0">
          <span>POS v1.0 • Multi-Tenant Enterprise Engine</span>
        </div>
      </footer>

      {/* Switch Staff Modal (for shared waiter/cashier/kitchen tablets) */}
      {isSwitchStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1423] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Switch Staff Account</h3>
              </div>
              <button
                onClick={() => setIsSwitchStaffOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 my-4">
              Select an account to instantly switch station profile on this shared device:
            </p>

            <div className="space-y-2">
              {[
                {
                  email: 'owner@lahorekarahi.com',
                  name: 'Tariq Mahmood',
                  role: 'Owner (All Access)',
                  icon: '👑',
                },
                {
                  email: 'cashier@lahorekarahi.com',
                  name: 'Bilal Ahmed',
                  role: 'Cashier (POS & Billing)',
                  icon: '💵',
                },
                {
                  email: 'waiter@lahorekarahi.com',
                  name: 'Usman Shah',
                  role: 'Waiter (Table Orders)',
                  icon: '🍽️',
                },
                {
                  email: 'kitchen@lahorekarahi.com',
                  name: 'Chef Rasheed',
                  role: 'Kitchen (KDS)',
                  icon: '👨‍🍳',
                },
              ].map((staff) => (
                <button
                  key={staff.email}
                  disabled={switchLoading}
                  onClick={() => handleSwitchStaff(staff.email)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                    user?.email === staff.email
                      ? 'bg-blue-600/20 border-blue-500/50 text-white'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{staff.icon}</span>
                    <div>
                      <p className="text-xs font-bold leading-tight">{staff.name}</p>
                      <p className="text-[10px] text-slate-400">{staff.role}</p>
                    </div>
                  </div>
                  {user?.email === staff.email ? (
                    <span className="flex items-center space-x-1 text-[11px] font-bold text-blue-400">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 hover:text-blue-400">
                      Switch →
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
