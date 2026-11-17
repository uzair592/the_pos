import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Search,
  X,
  ShoppingBag,
  UtensilsCrossed,
  Boxes,
  Users,
  Building,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface HeaderSearchProps {
  className?: string;
}

export const HeaderSearch: React.FC<HeaderSearchProps> = ({ className = '' }) => {
  const { tenant, currentBranchId, user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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

  // Debounced search query
  useEffect(() => {
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
        console.error('Header search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, currentBranchId]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const totalResults =
    results.orders.length +
    results.products.length +
    results.ingredients.length +
    results.customers.length +
    results.suppliers.length;

  const handleSelect = (path: string) => {
    setIsOpen(false);
    setQuery('');
    navigate(path);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Compact Input */}
      <div className="relative flex items-center">
        <Search
          className={`w-3.5 h-3.5 absolute left-2.5 pointer-events-none transition-colors ${
            loading ? 'text-brand-500 animate-pulse' : 'text-slate-400'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="Search..."
          className="w-full h-8 pl-8 pr-7 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all"
        />

        {loading ? (
          <Loader2 className="w-3.5 h-3.5 absolute right-2 text-slate-400 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden xl:inline-block absolute right-2 px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[9px] text-slate-400 pointer-events-none">
            Ctrl+K
          </kbd>
        )}
      </div>

      {/* Clean Dropdown Attached to Search Bar */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-1.5 w-[320px] sm:w-[420px] md:w-[460px] max-w-[90vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header Strip */}
          <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>
              Search results for "<strong>{query}</strong>"
            </span>
            <span>{totalResults} found</span>
          </div>

          {/* Results List */}
          <div className="max-h-[min(420px,calc(100vh-100px))] overflow-y-auto p-2.5 space-y-3">
            {totalResults === 0 && !loading && (
              <div className="py-8 text-center text-slate-400">
                <p className="text-xs font-semibold">No records found matching "{query}"</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Try searching an order #, item name, customer or supplier.</p>
              </div>
            )}

            {/* 1. Orders */}
            {results.orders.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                  <ShoppingBag className="w-3 h-3 text-blue-500" />
                  <span>Orders</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {results.orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleSelect(`/app/orders?search=${encodeURIComponent(order.order_number)}`)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Order #{order.order_number}
                        </span>
                        <span className="text-slate-500 text-[11px] ml-1.5">
                          {order.customer_name || 'Walk-in'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          {currencySymbol} {Number(order.grand_total).toLocaleString()}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Menu Products */}
            {results.products.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                  <UtensilsCrossed className="w-3 h-3 text-orange-500" />
                  <span>Menu Products</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {results.products.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => handleSelect(`/app/menu?search=${encodeURIComponent(prod.name)}`)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-900 dark:text-white">{prod.name}</span>
                        {prod.category_name && (
                          <span className="text-slate-400 text-[11px] ml-1.5">({prod.category_name})</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {Number(prod.base_price).toLocaleString()}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Ingredients & Stock */}
            {results.ingredients.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                  <Boxes className="w-3 h-3 text-purple-500" />
                  <span>Inventory Ingredients</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {results.ingredients.map((ing) => (
                    <button
                      key={ing.id}
                      onClick={() => handleSelect(`/app/inventory?search=${encodeURIComponent(ing.name)}`)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-900 dark:text-white">{ing.name}</span>
                        {ing.sku && <span className="text-slate-400 text-[10px] ml-1.5 font-mono">[{ing.sku}]</span>}
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                          {Number(ing.current_stock).toLocaleString()} {ing.unit || ing.base_unit || ing.purchase_unit || 'units'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Customers */}
            {results.customers.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                  <Users className="w-3 h-3 text-teal-500" />
                  <span>Customers</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {results.customers.map((cust) => (
                    <button
                      key={cust.id}
                      onClick={() => handleSelect(`/app/orders?tab=customers&search=${encodeURIComponent(cust.name)}`)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-900 dark:text-white">{cust.name}</span>
                        {cust.phone && <span className="text-slate-400 text-[11px] ml-1.5">({cust.phone})</span>}
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="text-[11px] text-slate-500">
                          {cust.total_orders || 0} orders
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Suppliers */}
            {results.suppliers.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                  <Building className="w-3 h-3 text-cyan-500" />
                  <span>Suppliers</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {results.suppliers.map((supp) => (
                    <button
                      key={supp.id}
                      onClick={() => handleSelect(`/app/purchases?tab=suppliers&search=${encodeURIComponent(supp.name)}`)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-900 dark:text-white">{supp.name}</span>
                        {supp.contact_person && (
                          <span className="text-slate-400 text-[11px] ml-1.5">({supp.contact_person})</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="text-[11px] text-slate-500 font-mono">{supp.phone || 'Supplier'}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Press <strong>ESC</strong> to close</span>
            <span>Click any item to view in module</span>
          </div>
        </div>
      )}
    </div>
  );
};
