import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatCard } from '../../components/common/StatCard.js';
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
  Monitor,
  ChefHat,
  Clock,
  ArrowUpRight,
  Boxes,
  Users,
  ListOrdered,
  Building2,
  Globe,
  ArrowRight,
  CheckCircle2,
  Tablet,
  Layers,
  Receipt,
  Scale,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';

export const RestaurantDashboard: React.FC = () => {
  const { tenant, hasFeature, currentBranchId, currentBranch, switchBranch } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [headOfficeSummary, setHeadOfficeSummary] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currency = tenant?.currency || 'PKR';
  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const isHeadOffice = !currentBranchId;

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const start = `${today}T00:00:00Z`;
      const end = `${today}T23:59:59Z`;

      if (isHeadOffice) {
        // Head Office Consolidated Mode
        const [hoRes, ordersRes] = await Promise.all([
          api.get(`/financial/reports/head-office-summary?startDate=${start}&endDate=${end}`),
          api.get('/orders?limit=8'),
        ]);
        setHeadOfficeSummary(hoRes);
        setRecentOrders(ordersRes.orders || []);
        setTopProducts(hoRes.topProducts || []);

        if (hasFeature(FeatureKey.INVENTORY)) {
          const stockRes = await api.get('/inventory/ingredients?lowStockOnly=true');
          setLowStock(stockRes.ingredients || []);
        }
      } else {
        // Specific Branch Mode
        const branchParam = `&branchId=${currentBranchId}`;
        const [summaryRes, ordersRes, productsRes] = await Promise.all([
          api.get(`/financial/reports/summary?startDate=${start}&endDate=${end}${branchParam}`),
          api.get(`/orders?limit=8&branchId=${currentBranchId}`),
          api.get(`/financial/reports/sales-by-product?startDate=${start}&endDate=${end}${branchParam}`),
        ]);

        setSummary(summaryRes.report);
        setRecentOrders(ordersRes.orders || []);
        setTopProducts((productsRes.products || []).slice(0, 6));

        if (hasFeature(FeatureKey.INVENTORY)) {
          const stockRes = await api.get(`/inventory/ingredients?branchId=${currentBranchId}&lowStockOnly=true`);
          setLowStock(stockRes.ingredients || []);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Head Office Consolidated Dashboard View
  if (isHeadOffice && headOfficeSummary) {
    const c = headOfficeSummary.consolidated || {};
    const branches: any[] = headOfficeSummary.branches || [];

    const grossMarginPercent = c.netSales > 0
      ? ((c.grossProfit / c.netSales) * 100).toFixed(1)
      : '0.0';

    const netMarginPercent = c.netSales > 0
      ? ((c.netProfit / c.netSales) * 100).toFixed(1)
      : '0.0';

    return (
      <div className="p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Head Office Consolidated Overview
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-extrabold uppercase">
                  Multi-Branch
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Consolidated financials, FIFO COGS, and branch-by-branch performance across {branches.length} branches
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              to="/app/orders"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ListOrdered className="w-4 h-4 text-blue-500" />
              <span>All Orders</span>
            </Link>
            <Link
              to="/app/inventory"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Boxes className="w-4 h-4 text-amber-500" />
              <span>Stock Transfers</span>
            </Link>
          </div>
        </div>

        {/* Consolidated KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Consolidated Net Sales"
            value={`${currencySymbol} ${Number(c.netSales || 0).toLocaleString()}`}
            subtitle={`${c.totalOrders || 0} orders across ${branches.length} branches`}
            icon={DollarSign}
            color="blue"
          />
          <StatCard
            title="Consolidated FIFO COGS"
            value={`${currencySymbol} ${Number(c.fifoCogs || 0).toLocaleString()}`}
            subtitle="Exact consumed stock lot costs"
            icon={TrendingUp}
            color="amber"
          />
          <StatCard
            title="Gross Profit"
            value={`${currencySymbol} ${Number(c.grossProfit || 0).toLocaleString()}`}
            subtitle={`${grossMarginPercent}% gross margin`}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Consolidated Net Profit"
            value={`${currencySymbol} ${Number(c.netProfit || 0).toLocaleString()}`}
            subtitle={`${netMarginPercent}% net margin (${currencySymbol} ${Number(c.totalExpenses || 0).toLocaleString()} exp.)`}
            icon={DollarSign}
            color="purple"
          />
        </div>

        {/* Operational Scope Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Branches</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{branches.length} Active</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Stock Valuation</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {currencySymbol} {Number(c.inventoryValuation || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Dining Tables</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {c.occupiedTables || 0} / {c.activeTables || 0} Occupied
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Connected Terminals</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {c.activeDevices || 0} Registered
              </p>
            </div>
          </div>
        </div>

        {/* Branch-by-Branch Comparative Matrix */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Branch-by-Branch Performance Comparison
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comparative revenue, FIFO profit margins, expenses, and inventory across all locations
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Updated Live
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Net Sales</th>
                  <th className="py-3 px-4 text-right">FIFO COGS</th>
                  <th className="py-3 px-4 text-right">Gross Profit</th>
                  <th className="py-3 px-4 text-right">Margin %</th>
                  <th className="py-3 px-4 text-right">Expenses</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-right">Inventory Value</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {branches.map((b) => (
                  <tr key={b.branch_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-black text-xs shrink-0">
                          {b.branch_code || 'BR'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">{b.branch_name}</span>
                            {b.is_main_branch && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-black text-[9px] uppercase">
                                Main
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{b.branch_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                      {b.city || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-700 dark:text-slate-200">
                      {b.total_orders}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white">
                      {currencySymbol} {Number(b.net_sales).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-amber-600 dark:text-amber-400">
                      {currencySymbol} {Number(b.fifo_cogs).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {currencySymbol} {Number(b.gross_profit).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                        {b.gross_margin_percent}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-rose-600 dark:text-rose-400">
                      {currencySymbol} {Number(b.total_expenses).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white">
                      {currencySymbol} {Number(b.net_profit).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600 dark:text-slate-300">
                      {currencySymbol} {Number(b.inventory_valuation).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => switchBranch(b.branch_id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-500 hover:text-white text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all"
                        title={`Switch to ${b.branch_name}`}
                      >
                        <span>Focus</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Organization-Wide Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-4 flex items-center justify-between">
              <span>Top Revenue Products (All Branches)</span>
              <span className="text-[11px] text-slate-400">Today</span>
            </h3>
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 font-black flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-400">{p.category} • {p.total_quantity_sold} sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {currencySymbol} {Number(p.total_revenue).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Profit: {currencySymbol} {Number(p.product_gross_profit).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-4 flex items-center justify-between">
              <span>Organization Recent Orders</span>
              <Link to="/app/orders" className="text-xs text-brand-600 hover:underline">
                View Hub
              </Link>
            </h3>
            <div className="space-y-3 text-xs">
              {recentOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        #{o.order_number}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                        {o.order_type}
                      </span>
                      {o.branch_name && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold">
                          {o.branch_name}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 dark:text-white">
                      {currencySymbol} {Number(o.grand_total).toLocaleString()}
                    </p>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Branch-Specific Dashboard View
  const avgOrderValue = summary?.totalOrders > 0
    ? Math.round(Number(summary.netSales) / summary.totalOrders)
    : 0;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header and Quick Launcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {currentBranch?.name || tenant?.name || 'Restaurant Dashboard'}
            </h1>
            {currentBranch?.code && (
              <span className="px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-600 dark:text-brand-400 font-mono text-xs font-bold border border-brand-500/30">
                {currentBranch.code}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time branch sales, FIFO batch costing, and terminal operations for today
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/app/orders"
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <ListOrdered className="w-4 h-4 text-brand-600" />
            <span>Orders Hub</span>
          </Link>

          <Link
            to="/pos"
            className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Monitor className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </Link>

          {hasFeature(FeatureKey.KDS) && (
            <Link
              to="/kds"
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <ChefHat className="w-4 h-4 text-orange-500" />
              <span>Kitchen Screen</span>
            </Link>
          )}
        </div>
      </div>

      {/* Low Stock Banner Alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">
                {lowStock.length} ingredient(s) have dropped below minimum stock alert at this branch!
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-[11px] mt-0.5">
                {lowStock.map((i) => `${i.name} (${Number(i.current_stock)} ${i.unit})`).join(', ')}
              </p>
            </div>
          </div>
          <Link
            to="/app/inventory"
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 ml-4"
          >
            Restock
          </Link>
        </div>
      )}

      {/* Main KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Today's Net Sales"
          value={`${currencySymbol} ${Number(summary?.netSales || 0).toLocaleString()}`}
          subtitle={`${summary?.totalOrders || 0} completed orders`}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          title="FIFO Cost of Goods Sold"
          value={`${currencySymbol} ${Number(summary?.costOfGoodsSold || 0).toLocaleString()}`}
          subtitle="Exact batch consumption cost"
          icon={TrendingUp}
          color="amber"
        />
        <StatCard
          title="Gross Profit"
          value={`${currencySymbol} ${Number(summary?.grossProfit || 0).toLocaleString()}`}
          subtitle={`${summary?.grossMarginPercent || 0}% gross margin`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Average Order Value"
          value={`${currencySymbol} ${avgOrderValue.toLocaleString()}`}
          subtitle="Net revenue per order"
          icon={ShoppingBag}
          color="blue"
        />
      </div>

      {/* Payment Methods and Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Breakdown Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
            <span>Payment Methods Today</span>
            <span className="text-[11px] text-slate-400">Total Collected</span>
          </h3>

          <div className="space-y-3 text-xs">
            {summary?.paymentBreakdown &&
              Object.entries(summary.paymentBreakdown).map(([method, amount]: [string, any]) => (
                <div
                  key={method}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                    {method.replace('_', ' ').toLowerCase()}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {currencySymbol} {Number(amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white text-xs">
              <span>Total Collections</span>
              <span>{currencySymbol} {Number(summary?.totalCollected || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
            <span>Top Selling Products</span>
            <span className="text-[11px] text-slate-400">Quantity</span>
          </h3>

          <div className="space-y-3 text-xs">
            {topProducts.length === 0 ? (
              <p className="text-slate-400 italic text-center py-6">No sales recorded yet today</p>
            ) : (
              topProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {p.total_quantity_sold} sold
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders Stream */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
            <span>Recent Orders</span>
            <Link to="/app/orders" className="text-xs text-brand-600 hover:underline">
              View All
            </Link>
          </h3>

          <div className="space-y-3 text-xs">
            {recentOrders.length === 0 ? (
              <p className="text-slate-400 italic text-center py-6">No orders today</p>
            ) : (
              recentOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      #{o.order_number}
                    </span>
                    <span className="text-slate-400 text-[10px] ml-2">
                      {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currencySymbol} {Number(o.grand_total).toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {o.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
