import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatCard } from '../../components/common/StatCard.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import { Modal } from '../../components/common/Modal.js';
import { ReceiptModal } from '../../components/common/ReceiptModal.js';
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
  RefreshCw,
  Bell,
  MapPin,
  Flame,
  CheckCircle,
  Eye,
  Printer,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';
import { getTodayRangeISO } from '../../utils/dateUtils.js';

export const RestaurantDashboard: React.FC = () => {
  const { tenant, hasFeature, currentBranchId, currentBranch, branches } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  const handleViewOrderDetail = async (orderId: string) => {
    try {
      const data = await api.get(`/orders/${orderId}`);
      setSelectedOrderDetail(data.order);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch order details');
    }
  };

  const currency = tenant?.currency || 'PKR';
  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const fetchData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }

    try {
      // Local start of day and end of day to respect user's local timezone (e.g. Asia/Karachi UTC+5)
      const { start, end } = getTodayRangeISO();

      const branchId = currentBranchId || (branches.length > 0 ? branches[0].id : null);
      const branchQuery = branchId ? `?branchId=${branchId}` : '';
      const branchAmpParam = branchId ? `&branchId=${branchId}` : '';

      const [summaryRes, ordersRes, activeRes, productsRes] = await Promise.all([
        api.get(`/financial/reports/summary?startDate=${start}&endDate=${end}${branchAmpParam}`),
        api.get(`/orders?limit=10${branchAmpParam}`),
        api.get(`/orders/active${branchQuery}`),
        api.get(`/financial/reports/sales-by-product?startDate=${start}&endDate=${end}${branchAmpParam}`),
      ]);

      setSummary(summaryRes.report);
      setRecentOrders(ordersRes.orders || []);
      setActiveOrders(activeRes.orders || []);
      const sortedByQuantity = [...(productsRes.products || [])].sort((a, b) => {
        const qtyDiff = (Number(b.total_quantity || b.total_quantity_sold) || 0) - (Number(a.total_quantity || a.total_quantity_sold) || 0);
        if (qtyDiff !== 0) return qtyDiff;
        return (Number(b.total_sales) || 0) - (Number(a.total_sales) || 0);
      });
      setTopProducts(sortedByQuantity.slice(0, 6));

      if (hasFeature(FeatureKey.INVENTORY)) {
        const stockRes = await api.get(
          `/inventory/ingredients?${branchId ? `branchId=${branchId}&` : ''}lowStockOnly=true`
        );
        setLowStock(stockRes.ingredients || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (!isBackground) setLoading(false);
      setIsSyncing(false);
    }
  };

  // Initial load, 3s auto-polling, and real-time reactive event listeners
  useEffect(() => {
    fetchData(false);

    // Live auto-polling every 3 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);

    // Instant reactivity triggers for POS orders, checkout, and window focus
    const handleOrderEvent = () => {
      fetchData(true);
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true);
      }
    };

    window.addEventListener('pos_order_updated', handleOrderEvent);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('storage', handleOrderEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pos_order_updated', handleOrderEvent);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleOrderEvent);
    };
  }, [currentBranchId]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Paid & Completed
          </span>
        );
      case 'SERVED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
            Served (Unpaid)
          </span>
        );
      case 'READY':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            Ready in Kitchen
          </span>
        );
      case 'PREPARING':
      case 'ACCEPTED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Kitchen Cooking
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Order Confirmed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Active Orders Segregation for Live Operations
  const servedUnpaidOrders = activeOrders.filter(
    (o) => o.status === 'SERVED' || (o.prep_status === 'SERVED' && o.status !== 'COMPLETED' && o.status !== 'CANCELLED')
  );
  const inKitchenOrders = activeOrders.filter(
    (o) =>
      ['PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status) ||
      ['PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.prep_status)
  );
  const totalUnpaidAmount = activeOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const servedUnpaidAmount = servedUnpaidOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const inKitchenAmount = inKitchenOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);

  // Single Restaurant Dashboard View
  const avgOrderValue = summary?.totalOrders > 0
    ? Math.round(Number(summary.netSales) / summary.totalOrders)
    : 0;

  const totalOrdersPlaced = (summary?.totalOrders || 0) + activeOrders.length;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header and Quick Launcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {tenant?.name || 'Restaurant Dashboard'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time restaurant sales, FIFO batch costing, and terminal operations for today
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Auto-Sync Status Indicator */}
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-600 dark:text-slate-300 font-semibold text-[11px]">
              {isSyncing ? 'Syncing...' : 'Live Sync Active (3s)'}
            </span>
            <button
              onClick={() => fetchData(true)}
              disabled={isSyncing}
              className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Refresh live data now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-500' : ''}`} />
            </button>
          </div>

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

      {/* Live Operations Banner: Shown when ANY order is active (Kitchen cooking or Served Unpaid) */}
      {activeOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-blue-500/10 border-2 border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shrink-0 animate-pulse">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {activeOrders.length} Active Order(s) In-Flight ({servedUnpaidOrders.length} Served Unpaid • {inKitchenOrders.length} in Kitchen)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] uppercase">
                    Live Operational Pipeline
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Total Active Value: <strong className="text-amber-600 dark:text-amber-400">{currencySymbol} {totalUnpaidAmount.toLocaleString()}</strong>.
                  {servedUnpaidOrders.length > 0 && (
                    <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">
                      ({currencySymbol} {servedUnpaidAmount.toLocaleString()} served awaiting payment).
                    </span>
                  )}
                  Collect payments at POS Terminal to complete orders.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link
                to="/pos"
                className="inline-flex items-center space-x-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Collect at POS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {hasFeature(FeatureKey.KDS) && (
                <Link
                  to="/kds"
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs shadow-sm transition-all"
                >
                  <ChefHat className="w-3.5 h-3.5 text-orange-500" />
                  <span>KDS Screen</span>
                </Link>
              )}
            </div>
          </div>

          {/* Grid of Active Orders (Served Unpaid + Kitchen In-Flight) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeOrders.map((o) => {
              const isServed = o.status === 'SERVED' || o.prep_status === 'SERVED';
              const isReady = o.status === 'READY' || o.prep_status === 'READY';
              return (
                <div
                  key={o.id}
                  className={`bg-white dark:bg-slate-900 border ${
                    isServed
                      ? 'border-amber-300 dark:border-amber-800/80 shadow-amber-100 dark:shadow-none'
                      : isReady
                      ? 'border-teal-300 dark:border-teal-800/80'
                      : 'border-blue-200 dark:border-blue-900/50'
                  } rounded-xl p-3.5 flex items-center justify-between shadow-sm`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">
                        #{o.order_number}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                        {o.table_name ? `Table ${o.table_name}` : (o.order_type || 'Takeaway')}
                      </span>
                      {renderStatusBadge(o.status)}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Staff: <span className="font-semibold text-slate-700 dark:text-slate-300">{o.waiter_name || o.cashier_name || 'Staff'}</span> • {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 dark:text-white text-xs">
                      {currencySymbol} {Number(o.grand_total).toLocaleString()}
                    </p>
                    <Link
                      to="/pos"
                      className={`inline-block mt-1 text-[11px] font-bold ${
                        isServed
                          ? 'text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline'
                          : 'text-brand-600 hover:text-brand-700 hover:underline'
                      }`}
                    >
                      {isServed ? 'Collect Pay →' : 'View in POS →'}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Today's Net Sales"
          value={`${currencySymbol} ${Number(summary?.netSales || 0).toLocaleString()}`}
          subtitle={
            activeOrders.length > 0
              ? `${summary?.totalOrders || 0} completed • ${activeOrders.length} in-flight (${currencySymbol} ${totalUnpaidAmount.toLocaleString()})`
              : `${summary?.totalOrders || 0} completed orders`
          }
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
          subtitle={`Total Placed Today: ${totalOrdersPlaced} orders`}
          icon={ShoppingBag}
          color="blue"
        />
      </div>

      {/* Live Operational Metrics Pipeline Strip (Clickable to respective terminals) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/pos"
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-amber-400 dark:hover:border-amber-600 transition-all group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Served & Unpaid</p>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {servedUnpaidOrders.length} Orders ({currencySymbol} {servedUnpaidAmount.toLocaleString()})
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/kds"
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Kitchen In-Flight</p>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {inKitchenOrders.length} Active Orders ({currencySymbol} {inKitchenAmount.toLocaleString()})
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/app/orders"
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-purple-400 dark:hover:border-purple-600 transition-all group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Active Orders Pipeline</p>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {currencySymbol} {totalUnpaidAmount.toLocaleString()} Total In Flight
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* Payment Methods, Top Selling Products, and Recent Orders Stream */}
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
            <span className="text-[11px] text-slate-400">Quantity Sold</span>
          </h3>

          <div className="space-y-3 text-xs">
            {topProducts.length === 0 ? (
              <p className="text-slate-400 italic text-center py-6">No sales recorded yet today</p>
            ) : (
              topProducts.map((p, idx) => (
                <div
                  key={p.product_id || p.id || idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {p.product_name || p.name || 'Product'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {p.total_quantity || p.total_quantity_sold || 0} sold
                    </span>
                    {p.total_sales && (
                      <span className="text-[11px] text-slate-400">
                        ({currencySymbol} {Number(p.total_sales).toLocaleString()})
                      </span>
                    )}
                  </div>
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
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                        #{o.order_number}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {o.table_name ? `Table ${o.table_name}` : (o.order_type || 'Order')} • {o.items?.length || 0} item(s)
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {currencySymbol} {Number(o.grand_total).toLocaleString()}
                    </span>
                    {renderStatusBadge(o.status)}
                    <ActionMenu
                      items={[
                        {
                          label: 'View Order Breakdown',
                          icon: Eye,
                          onClick: () => handleViewOrderDetail(o.id),
                        },
                        {
                          label: 'Print Bill / Receipt',
                          icon: Printer,
                          onClick: () => setReceiptOrder(o),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Order Details */}
      {selectedOrderDetail && (
        <Modal
          isOpen={!!selectedOrderDetail}
          onClose={() => setSelectedOrderDetail(null)}
          title={`Order Breakdown #${selectedOrderDetail.order_number}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Type & Table</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedOrderDetail.order_type} {selectedOrderDetail.table_name ? `• Table ${selectedOrderDetail.table_name}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                <span className="font-bold uppercase text-brand-600 dark:text-brand-400">
                  {selectedOrderDetail.status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Created At</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(selectedOrderDetail.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Server / Cashier</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {selectedOrderDetail.server_name || selectedOrderDetail.cashier_name || 'Staff'}
                </span>
              </div>
            </div>

            {selectedOrderDetail.customer_name && (
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1 text-[11px]">
                <p><strong>Customer:</strong> {selectedOrderDetail.customer_name} ({selectedOrderDetail.customer_phone || ''})</p>
                {selectedOrderDetail.delivery_address && <p><strong>Address:</strong> {selectedOrderDetail.delivery_address}</p>}
              </div>
            )}

            <div>
              <h5 className="font-bold mb-1.5">Line Items:</h5>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {(selectedOrderDetail.items || []).map((it: any) => (
                  <div key={it.id} className="p-2.5 flex justify-between items-center bg-white dark:bg-slate-900">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{it.quantity}x {it.product_name}</span>
                      {it.variant_name && <span className="text-slate-400 ml-1">({it.variant_name})</span>}
                    </div>
                    <span className="font-mono font-bold">{currencySymbol} {Number(it.total_price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 font-bold text-sm border-t border-slate-100 dark:border-slate-800">
              <span>Grand Total:</span>
              <span className="font-mono text-emerald-600">{currencySymbol} {Number(selectedOrderDetail.grand_total).toLocaleString()}</span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReceiptOrder(selectedOrderDetail);
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-black text-white font-bold rounded-lg text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Receipt Modal */}
      {receiptOrder && (
        <ReceiptModal
          isOpen={!!receiptOrder}
          receiptData={receiptOrder}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
};
