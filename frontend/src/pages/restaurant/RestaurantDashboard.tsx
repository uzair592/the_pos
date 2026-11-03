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
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';

export const RestaurantDashboard: React.FC = () => {
  const { tenant, hasFeature } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currency = tenant?.currency || 'PKR';

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const start = `${today}T00:00:00Z`;
      const end = `${today}T23:59:59Z`;

      const [summaryRes, ordersRes, productsRes] = await Promise.all([
        api.get(`/financial/reports/summary?startDate=${start}&endDate=${end}`),
        api.get('/orders?limit=8'),
        api.get(`/financial/reports/sales-by-product?startDate=${start}&endDate=${end}`),
      ]);

      setSummary(summaryRes.report);
      setRecentOrders(ordersRes.orders || []);
      setTopProducts((productsRes.products || []).slice(0, 5));

      // Fetch low stock if inventory entitled
      if (hasFeature(FeatureKey.INVENTORY)) {
        const stockRes = await api.get('/inventory/ingredients?lowStockOnly=true');
        setLowStock(stockRes.ingredients || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const avgOrderValue = summary?.totalOrders > 0
    ? Math.round(Number(summary.netSales) / summary.totalOrders)
    : 0;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header and Quick Launcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {tenant?.name || 'Restaurant Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time business performance, sales breakdown, and register activity for today
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
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
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <ChefHat className="w-4 h-4 text-orange-500" />
              <span>Kitchen Screen</span>
            </Link>
          )}
        </div>
      </div>

      {/* Low Stock Banner Alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">
                {lowStock.length} ingredient(s) have dropped below their minimum stock alert threshold!
              </p>
              <p className="text-amber-700 text-[11px] mt-0.5">
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
          value={`${currency} ${Number(summary?.netSales || 0).toLocaleString()}`}
          subtitle={`${summary?.totalOrders || 0} completed orders`}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          title="Average Order Value"
          value={`${currency} ${avgOrderValue.toLocaleString()}`}
          subtitle="Revenue per customer order"
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Gross Profit"
          value={`${currency} ${Number(summary?.grossProfit || 0).toLocaleString()}`}
          subtitle={`${summary?.grossMarginPercent || 0}% gross margin`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Tax Collected"
          value={`${currency} ${Number(summary?.taxCollected || 0).toLocaleString()}`}
          subtitle="Sales Tax (liability)"
          icon={ShoppingBag}
          color="amber"
        />
      </div>

      {/* Payment Methods and Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Breakdown Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
            <span>Payment Methods Today</span>
            <span className="text-[11px] text-slate-400">Total Collected</span>
          </h3>

          <div className="space-y-3 text-xs">
            {summary?.paymentBreakdown &&
              Object.entries(summary.paymentBreakdown).map(([method, amount]: [string, any]) => (
                <div key={method} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-semibold text-slate-700 capitalize">
                    {method.replace('_', ' ').toLowerCase()}
                  </span>
                  <span className="font-bold text-slate-900">
                    {currency} {Number(amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}

            <div className="pt-2 border-t flex justify-between font-bold text-slate-900 text-xs">
              <span>Total Collections</span>
              <span>{currency} {Number(summary?.totalCollected || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Popular Products Today</h3>
            <Link to="/app/reports" className="text-xs font-semibold text-brand-600 hover:underline">
              Full Sales Report →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2 text-center">Qty Sold</th>
                  <th className="px-4 py-2 text-right">Total Revenue</th>
                  <th className="px-4 py-2 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No sales recorded today yet.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((p) => (
                    <tr key={p.product_id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-bold text-slate-800">{p.product_name}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-700">
                        {p.total_quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                        {currency} {Number(p.total_sales).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                        {currency} {Number(p.gross_profit).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent Customer Orders</h3>
          <Link to="/pos" className="text-xs font-bold text-brand-600 hover:underline">
            View POS Terminal →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Order #</th>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Type / Table</th>
                <th className="px-6 py-3">Cashier</th>
                <th className="px-6 py-3">Items</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No orders created yet. Launch the POS to start taking orders.
                  </td>
                </tr>
              ) : (
                recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-bold text-brand-600">
                      {ord.order_number}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-slate-800">{ord.order_type}</span>
                      {ord.table_number && (
                        <span className="text-slate-400 text-[11px] block">Table: {ord.table_number}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{ord.cashier_name}</td>
                    <td className="px-6 py-3.5 text-slate-600">{ord.item_count} item(s)</td>
                    <td className="px-6 py-3.5 font-bold text-slate-900">
                      {currency} {Number(ord.grand_total).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ord.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : ord.status === 'CANCELLED'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
