import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  UtensilsCrossed,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const { user, isSuperAdmin, login } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (user) {
      if (isSuperAdmin) {
        navigate('/platform-admin', { replace: true });
      } else {
        navigate('/hub', { replace: true });
      }
    }
  }, [user, isSuperAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let fingerprint = localStorage.getItem('pos_device_fp');
      if (!fingerprint) {
        fingerprint = 'dev-' + Math.random().toString(36).substring(2, 12) + '-' + Date.now();
        localStorage.setItem('pos_device_fp', fingerprint);
      }

      const data = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
        deviceFingerprint: fingerprint,
        deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Tablet' : 'POS Terminal',
      });

      login(data.token, data.user, data.sessionId, fingerprint);

      if (data.user.role === 'SUPER_ADMIN') {
        navigate('/platform-admin', { replace: true });
      } else {
        navigate('/hub', { replace: true });
      }
    } catch (err: any) {
      if (err.data?.code === 'CONCURRENT_LIMIT_REACHED') {
        setError(`Concurrent Session Limit Reached: ${err.message || 'Maximum active devices connected'}. Please log out from another device or revoke an idle session.`);
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
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

      <div className="max-w-md w-full space-y-6 bg-[#0f1423]/95 p-8 sm:p-10 rounded-3xl border border-slate-800/90 shadow-2xl relative z-10 backdrop-blur-md">
        <div className="text-center">
          {/* Glowing Radial Avatar Badge */}
          <div className="relative mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 flex items-center justify-center text-white text-2xl font-black shadow-[0_0_35px_rgba(37,99,235,0.55)] border-2 border-blue-400/40">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Restaurant Security Portal</h2>
          <p className="mt-1.5 text-xs text-slate-400">
            Enter your credentials to unlock POS, Kitchen Display, and Operations
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-center space-x-3 text-rose-400 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Staff Email / Username
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. waiter@lahorekarahi.com"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 text-sm mt-2"
          >
            <span>{loading ? 'Authenticating Station...' : 'Secure Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Collapsible Demo Accounts Reference (Click to Auto-Fill) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900/40 rounded-xl border border-slate-800/60 transition-colors"
          >
            <span className="flex items-center space-x-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Available Demo Credentials (Click to Fill)</span>
            </span>
            <span className="text-[10px] text-slate-500">{showGuide ? 'Hide ▲' : 'Show ▼'}</span>
          </button>

          {showGuide && (
            <div className="mt-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-[11px] text-slate-300 animate-in fade-in">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400 font-bold">Standard Password:</span>
                <span className="font-mono text-emerald-400 font-bold">Password123!</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setEmail('owner@lahorekarahi.com'); setPassword('Password123!'); setError(''); }}
                  className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/40 border border-transparent transition-all text-left"
                >
                  <span className="font-bold text-slate-200">👑 Owner (Lahore Karahi):</span>
                  <span className="font-mono text-blue-400 text-[10px]">owner@lahorekarahi.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('cashier@lahorekarahi.com'); setPassword('Password123!'); setError(''); }}
                  className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/40 border border-transparent transition-all text-left"
                >
                  <span className="font-bold text-slate-200">💵 Cashier (Express POS):</span>
                  <span className="font-mono text-blue-400 text-[10px]">cashier@lahorekarahi.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('waiter@lahorekarahi.com'); setPassword('Password123!'); setError(''); }}
                  className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/40 border border-transparent transition-all text-left"
                >
                  <span className="font-bold text-slate-200">🍽️ Waiter:</span>
                  <span className="font-mono text-blue-400 text-[10px]">waiter@lahorekarahi.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('kitchen@lahorekarahi.com'); setPassword('Password123!'); setError(''); }}
                  className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/40 border border-transparent transition-all text-left"
                >
                  <span className="font-bold text-slate-200">👨‍🍳 Kitchen Display (KDS):</span>
                  <span className="font-mono text-blue-400 text-[10px]">kitchen@lahorekarahi.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('kashif@santex.com'); setPassword('Password123!'); setError(''); }}
                  className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/40 border border-amber-500/20 transition-all text-left"
                >
                  <span className="font-bold text-amber-300">☕ santex cafe (Newly Created):</span>
                  <span className="font-mono text-amber-400 text-[10px]">kashif@santex.com</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 text-center border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>RLS Multi-Tenant Encrypted</span>
          </span>
          <Link
            to="/platform-admin/login"
            className="flex items-center gap-1 text-slate-400 hover:text-blue-400 font-bold transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            Super Admin
          </Link>
        </div>
      </div>
    </div>
  );
};
