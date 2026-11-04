import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { UtensilsCrossed, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

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
      } else if (data.user.role === 'CASHIER' || data.user.role === 'WAITER') {
        navigate('/pos');
      } else if (data.user.role === 'KITCHEN_STAFF') {
        navigate('/kds');
      } else {
        // If not onboarded yet, take to onboarding
        if (data.user.isOnboarded === false) {
          navigate('/app/onboarding');
        } else {
          navigate('/app');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-brand-500 to-brand-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Restaurant Staff Portal</h2>
          <p className="mt-1.5 text-xs text-slate-500">
            Sign in to access your branch dashboard, POS terminal, or kitchen display
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center space-x-3 text-rose-600 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Credential Pills */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Click to Quick-Fill Demo Account:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickFill('owner@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-white border border-slate-200 rounded-xl hover:border-brand-500 hover:text-brand-600 font-semibold transition-all"
            >
              👑 <span className="font-bold">Owner</span>
              <span className="block text-[10px] text-slate-400 font-normal">owner@lahorekarahi.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('cashier@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-white border border-slate-200 rounded-xl hover:border-brand-500 hover:text-brand-600 font-semibold transition-all"
            >
              💵 <span className="font-bold">Cashier (POS)</span>
              <span className="block text-[10px] text-slate-400 font-normal">cashier@lahorekarahi.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('waiter@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-white border border-slate-200 rounded-xl hover:border-brand-500 hover:text-brand-600 font-semibold transition-all"
            >
              🍽️ <span className="font-bold">Waiter</span>
              <span className="block text-[10px] text-slate-400 font-normal">waiter@lahorekarahi.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('kitchen@lahorekarahi.com', 'Password123!')}
              className="px-2.5 py-1.5 text-left bg-white border border-slate-200 rounded-xl hover:border-brand-500 hover:text-brand-600 font-semibold transition-all"
            >
              👨‍🍳 <span className="font-bold">Kitchen (KDS)</span>
              <span className="block text-[10px] text-slate-400 font-normal">kitchen@lahorekarahi.com</span>
            </button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Staff Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@lahorekarahi.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 text-sm"
          >
            <span>{loading ? 'Signing In...' : 'Sign In to Restaurant'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 text-center border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Multi-Tenant POS v1.0</span>
          <a
            href="/platform-admin/login"
            className="flex items-center gap-1 text-slate-600 hover:text-brand-600 font-bold transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
            Platform Super Admin
          </a>
        </div>
      </div>
    </div>
  );
};
