import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  UtensilsCrossed,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleQuickFill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Generate / retrieve a consistent browser fingerprint for terminal tracking
      let fingerprint = localStorage.getItem('pos_device_fp');
      if (!fingerprint) {
        fingerprint = 'dev-' + Math.random().toString(36).substring(2, 12) + '-' + Date.now();
        localStorage.setItem('pos_device_fp', fingerprint);
      }

      const data = await api.post('/auth/login', {
        email,
        password,
        deviceFingerprint: fingerprint,
        deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Terminal' : 'Desktop POS',
      });

      login(data.token, data.user);

      // Route based on role
      if (data.user.role === 'SUPER_ADMIN') {
        navigate('/platform-admin');
      } else {
        // Direct to Workspace Hub Launcher
        navigate('/hub');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans select-none">
      {/* Decorative Grid Dot Pattern - Top Left */}
      <div className="absolute top-6 left-6 w-40 h-40 opacity-25 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="login-dot-grid-tl" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.3" fill="#60a5fa" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-dot-grid-tl)" />
        </svg>
      </div>

      {/* Decorative Grid Dot Pattern - Bottom Right */}
      <div className="absolute bottom-6 right-6 w-40 h-40 opacity-20 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="login-dot-grid-br" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.3" fill="#818cf8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-dot-grid-br)" />
        </svg>
      </div>

      {/* Ambient Radial Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-6 bg-[#0f1423]/95 p-8 sm:p-10 rounded-3xl border border-slate-800/90 shadow-2xl relative z-10">
        <div className="text-center">
          {/* Glowing Radial Avatar Badge */}
          <div className="relative mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 flex items-center justify-center text-white text-2xl font-black shadow-[0_0_35px_rgba(37,99,235,0.55)] border-2 border-blue-400/40">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Restaurant Staff Portal</h2>
          <p className="mt-1.5 text-xs text-slate-400">
            Sign in to access your POS terminal, Kitchen Display, and Dashboard
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-center space-x-3 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Credential Pills */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Click to Quick-Fill Demo Station:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickFill('waiter@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-[#141b2e] border border-slate-700/80 rounded-xl hover:border-emerald-500 hover:text-emerald-400 font-semibold transition-all group"
            >
              🍽️ <span className="font-bold text-white group-hover:text-emerald-400">Waiter</span>
              <span className="block text-[10px] text-slate-400 font-normal">Table Ordering</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('kitchen@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-[#141b2e] border border-slate-700/80 rounded-xl hover:border-rose-500 hover:text-rose-400 font-semibold transition-all group"
            >
              👨‍🍳 <span className="font-bold text-white group-hover:text-rose-400">Kitchen</span>
              <span className="block text-[10px] text-slate-400 font-normal">KDS Screen</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('cashier@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-[#141b2e] border border-slate-700/80 rounded-xl hover:border-blue-500 hover:text-blue-400 font-semibold transition-all group"
            >
              💵 <span className="font-bold text-white group-hover:text-blue-400">Cashier</span>
              <span className="block text-[10px] text-slate-400 font-normal">POS & Billing</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('owner@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-[#141b2e] border border-slate-700/80 rounded-xl hover:border-amber-500 hover:text-amber-400 font-semibold transition-all group"
            >
              👑 <span className="font-bold text-white group-hover:text-amber-400">Owner</span>
              <span className="block text-[10px] text-slate-400 font-normal">Full Workspace</span>
            </button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Staff Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="waiter@lahorekarahi.com"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 text-sm"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Workspace Hub'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 text-center border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>POS v1.0 Multi-Device</span>
          <a
            href="/platform-admin/login"
            className="flex items-center gap-1 text-slate-400 hover:text-blue-400 font-bold transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            Platform Super Admin
          </a>
        </div>
      </div>
    </div>
  );
};
