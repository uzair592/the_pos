import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff, HelpCircle, Store } from 'lucide-react';

export const PlatformLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { user, isSuperAdmin, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isSuperAdmin) {
      navigate('/platform-admin', { replace: true });
    }
  }, [user, isSuperAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post('/auth/platform/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      login(data.token, data.user);
      navigate('/platform-admin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-6 bg-slate-900/90 p-8 sm:p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Platform Administration</h2>
          <p className="mt-1.5 text-xs text-slate-400">
            Root control console for SaaS platform and tenant operations
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
              Super Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@posplatform.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
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
            <span>{loading ? 'Authenticating Super Admin...' : 'Sign In as Super Admin'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Collapsible reference */}
        <div>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-950/60 rounded-xl border border-slate-800 transition-colors"
          >
            <span className="flex items-center space-x-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Super Admin Credentials</span>
            </span>
            <span className="text-[10px] text-slate-500">{showGuide ? 'Hide ▲' : 'Show ▼'}</span>
          </button>

          {showGuide && (
            <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-300 animate-in fade-in">
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="font-mono text-slate-200">admin@posplatform.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Password:</span>
                <span className="font-mono text-emerald-400 font-bold">SuperAdmin123!</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 text-center border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-slate-400 hover:text-blue-400 font-bold transition-colors"
          >
            <Store className="w-3.5 h-3.5 text-blue-500" />
            Restaurant Staff Login
          </Link>
          <span>Multi-Tenant Root</span>
        </div>
      </div>
    </div>
  );
};
