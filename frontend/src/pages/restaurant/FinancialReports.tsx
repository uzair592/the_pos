import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatCard } from '../../components/common/StatCard.js';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart,
} from 'lucide-react';

export const FinancialReports: React.FC = () => {
  const { tenant } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const currency = tenant?.currency || 'PKR';
  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const fetchReports = async () => {
    setLoading(true);
    try {
      const start = `${startDate}T00:00:00Z`;
      const end = `${endDate}T23:59:59Z`;

      const [summaryRes, prodRes, catRes] = await Promise.all([
        api.get(`/financial/reports/summary?startDate=${start}&endDate=${end}`),
        api.get(`/financial/reports/sales-by-product?startDate=${start}&endDate=${end}`),
        api.get(`/financial/reports/sales-by-category?startDate=${start}&endDate=${end}`),
      ]);

      setSummary(summaryRes.report);
      setProductSales(prodRes.products || []);
      setCategorySales(catRes.categories || []);
    } catch (err) {
      console.error('Failed to load financial reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  const handleExportCsv = () => {
    const start = `${startDate}T00:00:00Z`;
    const end = `${endDate}T23:59:59Z`;
    window.open(`/api/financial/reports/export?startDate=${start}&endDate=${end}`, '_blank');
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header & Date Range Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial & Sales Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Auditable revenue calculations, inventory cost of goods sold, gross margin, and operating profit
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-none text-slate-800 focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-none text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Mathematical KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Net Sales (Excl. Tax)"
          value={`${currencySymbol} ${Number(summary?.netSales || 0).toLocaleString()}`}
          subtitle={`Gross: ${currencySymbol} ${Number(summary?.grossSales || 0).toLocaleString()}`}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          title="Cost of Goods Sold (COGS)"
          value={`${currencySymbol} ${Number(summary?.costOfGoodsSold || 0).toLocaleString()}`}
          subtitle="Direct ingredient consumption"
          icon={TrendingUp}
          color="amber"
        />
        <StatCard
          title="Gross Profit"
          value={`${currencySymbol} ${Number(summary?.grossProfit || 0).toLocaleString()}`}
          subtitle={`${summary?.grossMarginPercent || 0}% Gross Margin`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Operating Profit"
          value={`${currencySymbol} ${Number(summary?.operatingProfit || 0).toLocaleString()}`}
          subtitle={`After ${currencySymbol} ${Number(summary?.totalExpenses || 0).toLocaleString()} expenses`}
          icon={BarChart3}
          color="blue"
        />
      </div>

      {/* Accounting Breakdown Equation Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Profit & Loss Accounting Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold">Total Completed Orders:</span>
            <p className="text-base font-bold text-slate-900 mt-1">{summary?.totalOrders || 0}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold">Total Discounts Given:</span>
            <p className="text-base font-bold text-rose-600 mt-1">
              -{currencySymbol} {Number(summary?.discounts || 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold">Sales Tax Liability:</span>
            <p className="text-base font-bold text-slate-900 mt-1">
              +{currencySymbol} {Number(summary?.taxCollected || 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold">Service Charges:</span>
            <p className="text-base font-bold text-slate-900 mt-1">
              +{currencySymbol} {Number(summary?.serviceCharges || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Sales by Product & Sales by Category Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Sales */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Sales by Product Item</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold sticky top-0">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-center">Qty</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productSales.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-semibold text-slate-800">{p.product_name}</td>
                    <td className="px-5 py-3 text-center font-bold">{p.total_quantity}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">
                      {currencySymbol} {Number(p.total_sales).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-600">
                      {currencySymbol} {Number(p.gross_profit).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Sales */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Sales by Category</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold sticky top-0">
                <tr>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-center">Total Quantity</th>
                  <th className="px-5 py-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categorySales.map((c) => (
                  <tr key={c.category_id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-semibold text-slate-800">{c.category_name}</td>
                    <td className="px-5 py-3 text-center font-bold">{c.total_quantity}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">
                      {currencySymbol} {Number(c.total_sales).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
