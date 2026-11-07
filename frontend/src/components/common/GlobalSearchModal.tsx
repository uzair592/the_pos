import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Search,
  X,
  ShoppingBag,
  UtensilsCrossed,
  Package,
  Users,
  Building,
  ArrowRight,
  Clock,
  Command,
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { tenant, currentBranchId } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    orders: any[];
    products: any[];
    ingredients: any[];
    customers: any[];
    suppliers: any[];
  }>({
    orders: [],
    products: [],
    ingredients: [],
    customers: [],
    suppliers: [],
  });

  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ orders: [], products: [], ingredients: [], customers: [], suppliers: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ orders: [], products: [], ingredients: [], customers: [], suppliers: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const branchParam = currentBranchId ? `&branchId=${currentBranchId}` : '';
        const res = await api.get(`/restaurant/global-search?q=${encodeURIComponent(trimmed)}${branchParam}`);
        setResults(res.results || { orders: [], products: [], ingredients: [], customers: [], suppliers: [] });
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen, currentBranchId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalResults =
    results.orders.length +
    results.products.length +
    results.ingredients.length +
    results.customers.length +
    results.suppliers.length;

  const handleSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 p-4 transition-all">
      <div
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <Search className={`w-5 h-5 mr-3 shrink-0 ${loading ? 'animate-pulse text-brand-500' : 'text-slate-400'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders, menu items, ingredients, customers, suppliers..."
            className="w-full bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-semibold focus:outline-none focus:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block px-2 py-1 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md border border-slate-200 dark:border-slate-700">
            ESC
          </span>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {query.trim().length >= 2 && totalResults === 0 && !loading && (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-semibold">No results found for "{query}"</p>
              <p className="text-xs text-slate-500 mt-1">Try searching by order #, food name, phone number, or supplier.</p>
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="py-8 text-center text-slate-400">
              <Command className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Type at least 2 characters to search across the entire restaurant system
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px]">
                <button
                  onClick={() => handleSelect('/pos')}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/40 rounded-lg font-bold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  POS Terminal (Alt+S)
                </button>
                <button
                  onClick={() => handleSelect('/app/orders')}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/40 rounded-lg font-bold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  All Orders
                </button>
                <button
                  onClick={() => handleSelect('/app/menu')}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/40 rounded-lg font-bold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  Menu Items
                </button>
                <button
                  onClick={() => handleSelect('/app/inventory?tab=low_stock')}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/40 rounded-lg font-bold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  Low Stock Ingredients
                </button>
              </div>
            </div>
          )}

          {/* Section: Orders */}
          {results.orders.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                <span>Orders ({results.orders.length})</span>
              </div>
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                {results.orders.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => handleSelect('/app/orders')}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-brand-600 dark:text-brand-400">
                          {o.order_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {o.order_type}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          o.status === 'COMPLETED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                        }`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {o.customer_name || 'Walk-in'} {o.customer_phone ? `(${o.customer_phone})` : ''}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3 text-right">
                      <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-white">
                        {currencySymbol} {Number(o.grand_total).toLocaleString()}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Menu Products */}
          {results.products.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                <span>Menu Items ({results.products.length})</span>
              </div>
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                {results.products.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelect('/app/menu')}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{p.name}</span>
                      <span className="text-[11px] text-slate-400 font-semibold">{p.category_name || 'General'}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {currencySymbol} {Number(p.base_price).toLocaleString()}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Ingredients */}
          {results.ingredients.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <Package className="w-3.5 h-3.5 text-purple-500" />
                <span>Raw Ingredients & Stock ({results.ingredients.length})</span>
              </div>
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                {results.ingredients.map((i) => (
                  <div
                    key={i.id}
                    onClick={() => handleSelect('/app/inventory')}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{i.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">SKU: {i.sku || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {Number(i.current_stock).toLocaleString()} {i.base_unit}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Customers */}
          {results.customers.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span>Customers ({results.customers.length})</span>
              </div>
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                {results.customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelect('/pos')}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{c.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{c.phone}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {Number(c.outstanding_balance) > 0 && (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                          Bal: {currencySymbol} {Number(c.outstanding_balance).toLocaleString()}
                        </span>
                      )}
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Suppliers */}
          {results.suppliers.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <Building className="w-3.5 h-3.5 text-indigo-500" />
                <span>Suppliers ({results.suppliers.length})</span>
              </div>
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                {results.suppliers.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelect('/app/purchases')}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{s.name}</span>
                      <span className="text-[11px] text-slate-400">Contact: {s.contact_person || s.phone}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {Number(s.balance_payable) > 0 && (
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                          Payable: {currencySymbol} {Number(s.balance_payable).toLocaleString()}
                        </span>
                      )}
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Tip: Press <strong>Ctrl + K</strong> from anywhere to quickly search.</span>
          <span>Press <strong>ESC</strong> to dismiss</span>
        </div>
      </div>
    </div>
  );
};

