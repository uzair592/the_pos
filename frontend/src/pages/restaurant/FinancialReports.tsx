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
  ShoppingBag,
  ShoppingCart,
  Receipt,
  FileSpreadsheet,
  FileText,
  Filter,
} from 'lucide-react';
import {
  exportSalesReportPdf,
  exportPurchaseReportPdf,
  exportExpenseReportPdf,
  exportGrossProfitReportPdf,
  exportNetProfitReportPdf,
} from '../../utils/pdfExport.js';

type ReportTab = 'OVERVIEW' | 'SALES' | 'PURCHASES' | 'EXPENSES' | 'GROSS_PROFIT';

export const FinancialReports: React.FC = () => {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('OVERVIEW');
  const [summary, setSummary] = useState<any>(null);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<any[]>([]);
  
  // Dedicated sub-reports
  const [detailedSales, setDetailedSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dailyProfits, setDailyProfits] = useState<any[]>([]);

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

      // If specific sub-report tab is active or preloaded:
      if (activeTab === 'SALES' || activeTab === 'OVERVIEW') {
        const salesRes = await api.get(`/financial/reports/sales-detailed?startDate=${start}&endDate=${end}`);
        setDetailedSales(salesRes.sales || []);
      }
      if (activeTab === 'PURCHASES' || activeTab === 'OVERVIEW') {
        const purRes = await api.get(`/financial/reports/purchases?startDate=${start}&endDate=${end}`);
        setPurchases(purRes.purchases || []);
      }
      if (activeTab === 'EXPENSES' || activeTab === 'OVERVIEW') {
        const expRes = await api.get(`/financial/reports/expenses-detailed?startDate=${start}&endDate=${end}`);
        setExpenses(expRes.expenses || []);
      }
      if (activeTab === 'GROSS_PROFIT' || activeTab === 'OVERVIEW') {
        const gpRes = await api.get(`/financial/reports/gross-profit-report?startDate=${start}&endDate=${end}`);
        setDailyProfits(gpRes.dailyProfit || []);
      }
    } catch (err) {
      console.error('Failed to load financial reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, activeTab]);

  const meta = {
    name: tenant?.name || 'Restaurant',
    currency,
    currencySymbol,
  };
  const dates = { startDate, endDate };

  const handleExportCsv = () => {
    const start = `${startDate}T00:00:00Z`;
    const end = `${endDate}T23:59:59Z`;
    window.open(`/api/financial/reports/export?startDate=${start}&endDate=${end}`, '_blank');
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Financial & Profit Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            FIFO Cost of Goods Sold (COGS), Sales revenue, Inward purchases, Operating expenses, and P&L audit reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
            title="Export full orders dump to CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Sub-Sections Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'OVERVIEW'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Net Profit (P&L Overview)</span>
        </button>

        <button
          onClick={() => setActiveTab('SALES')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'SALES'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Sales Report</span>
        </button>

        <button
          onClick={() => setActiveTab('GROSS_PROFIT')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'GROSS_PROFIT'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span>FIFO Gross Profit & COGS</span>
        </button>

        <button
          onClick={() => setActiveTab('PURCHASES')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'PURCHASES'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Purchase Report</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'EXPENSES'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Expenses Report</span>
        </button>
      </div>

      {/* ==================== SUB-SECTION: OVERVIEW (P&L) ==================== */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Top Download Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Profit & Loss Executive Summary</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calculated from {startDate} to {endDate}
              </p>
            </div>
            <button
              onClick={() => exportNetProfitReportPdf(meta, dates, summary)}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download P&L Statement (PDF)</span>
            </button>
          </div>

          {/* Primary Mathematical KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Net Sales (Excl. Tax)"
              value={`${currencySymbol} ${Number(summary?.netSales || 0).toLocaleString()}`}
              subtitle={`Gross Sales: ${currencySymbol} ${Number(summary?.grossSales || 0).toLocaleString()}`}
              icon={DollarSign}
              color="orange"
            />
            <StatCard
              title="FIFO Cost of Goods Sold"
              value={`${currencySymbol} ${Number(summary?.costOfGoodsSold || 0).toLocaleString()}`}
              subtitle="Batch-tracked ingredient cost"
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
              title="Net Operating Profit"
              value={`${currencySymbol} ${Number(summary?.operatingProfit || 0).toLocaleString()}`}
              subtitle={`After ${currencySymbol} ${Number(summary?.totalExpenses || 0).toLocaleString()} expenses`}
              icon={BarChart3}
              color="blue"
            />
          </div>

          {/* Accounting Breakdown Equation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Profit & Loss Accounting Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Completed Orders:</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{summary?.totalOrders || 0}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Total Discounts Given:</span>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">
                  -{currencySymbol} {Number(summary?.discounts || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Sales Tax Liability:</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  +{currencySymbol} {Number(summary?.taxCollected || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Service Charges:</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  +{currencySymbol} {Number(summary?.serviceCharges || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Sales by Product & Sales by Category Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Sales by Product Item</h3>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3 text-center">Qty</th>
                      <th className="px-5 py-3 text-right">Revenue</th>
                      <th className="px-5 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {productSales.map((p) => (
                      <tr key={p.product_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">{p.product_name}</td>
                        <td className="px-5 py-3 text-center font-bold text-slate-900 dark:text-white">{p.total_quantity}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {Number(p.total_sales).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {Number(p.gross_profit).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sales by Menu Category</h3>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3 text-center">Total Quantity</th>
                      <th className="px-5 py-3 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {categorySales.map((c) => (
                      <tr key={c.category_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">{c.category_name}</td>
                        <td className="px-5 py-3 text-center font-bold text-slate-900 dark:text-white">{c.total_quantity}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white">
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
      )}

      {/* ==================== SUB-SECTION: SALES REPORT ==================== */}
      {activeTab === 'SALES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Detailed Orders & Sales Report</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {detailedSales.length} completed transactions found in selected period
              </p>
            </div>
            <button
              onClick={() => exportSalesReportPdf(meta, dates, detailedSales)}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Download Sales Report (PDF)</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Order #</th>
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5 text-center">Items</th>
                    <th className="px-5 py-3.5 text-right">Subtotal</th>
                    <th className="px-5 py-3.5 text-right">Discount</th>
                    <th className="px-5 py-3.5 text-right">Tax</th>
                    <th className="px-5 py-3.5 text-right">Grand Total</th>
                    <th className="px-5 py-3.5">Payment</th>
                    <th className="px-5 py-3.5">Cashier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {detailedSales.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-10 text-center text-slate-400">
                        No completed sales found in this date range.
                      </td>
                    </tr>
                  ) : (
                    detailedSales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">{s.order_number}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {new Date(s.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300">{s.order_type}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{s.customer_name || 'Walk-in'}</td>
                        <td className="px-5 py-3 text-center font-bold text-slate-900 dark:text-white">{s.item_count}</td>
                        <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">
                          {currencySymbol} {Number(s.subtotal).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right text-rose-500">
                          {Number(s.total_discount) > 0 ? `-${currencySymbol} ${Number(s.total_discount).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500">
                          {currencySymbol} {Number(s.tax_amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white">
                          {currencySymbol} {Number(s.grand_total).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                          {s.payment_methods || 'CASH'}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{s.cashier_name || 'Staff'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-SECTION: FIFO GROSS PROFIT ==================== */}
      {activeTab === 'GROSS_PROFIT' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Daily Gross Profit & FIFO Cost Report</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracks exact historical batch cost consumption for each recipe sold
              </p>
            </div>
            <button
              onClick={() => exportGrossProfitReportPdf(meta, dates, dailyProfits)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Download Gross Profit (PDF)</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Report Date</th>
                    <th className="px-6 py-3.5 text-center">Orders Count</th>
                    <th className="px-6 py-3.5 text-right">Net Sales</th>
                    <th className="px-6 py-3.5 text-right">FIFO COGS (Batch Cost)</th>
                    <th className="px-6 py-3.5 text-right">Gross Profit</th>
                    <th className="px-6 py-3.5 text-center">Gross Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dailyProfits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                        No orders recorded in this date range.
                      </td>
                    </tr>
                  ) : (
                    dailyProfits.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                          {new Date(d.report_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {d.order_count}
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {Number(d.net_sales).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-amber-600 dark:text-amber-400">
                          {currencySymbol} {Number(d.fifo_cogs).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {Number(d.gross_profit).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {d.gross_margin_percent}%
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
      )}

      {/* ==================== SUB-SECTION: PURCHASES REPORT ==================== */}
      {activeTab === 'PURCHASES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Purchase Invoices & Inventory Inward Report</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {purchases.length} supplier invoices recorded
              </p>
            </div>
            <button
              onClick={() => exportPurchaseReportPdf(meta, dates, purchases)}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Download Purchase Report (PDF)</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Invoice #</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Supplier</th>
                    <th className="px-5 py-3.5">Branch</th>
                    <th className="px-5 py-3.5 text-center">Items</th>
                    <th className="px-5 py-3.5 text-right">Subtotal</th>
                    <th className="px-5 py-3.5 text-right">Tax</th>
                    <th className="px-5 py-3.5 text-right">Total Amount</th>
                    <th className="px-5 py-3.5 text-right">Paid</th>
                    <th className="px-5 py-3.5 text-right">Balance</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-10 text-center text-slate-400">
                        No purchase invoices found in this date range.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3 font-mono font-bold text-slate-900 dark:text-white">{p.invoice_number}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-200">{p.supplier_name}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{p.branch_name}</td>
                        <td className="px-5 py-3 text-center font-bold text-slate-900 dark:text-white">{p.item_count}</td>
                        <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">
                          {currencySymbol} {Number(p.subtotal).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500">
                          {currencySymbol} {Number(p.tax_amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white">
                          {currencySymbol} {Number(p.total_amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                          {currencySymbol} {Number(p.paid_amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-rose-500">
                          {currencySymbol} {Number(p.balance_payable).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'RECEIVED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                          }`}>
                            {p.status}
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
      )}

      {/* ==================== SUB-SECTION: EXPENSES REPORT ==================== */}
      {activeTab === 'EXPENSES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Operating Expenses (OPEX) Report</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {expenses.length} operating expense entries recorded
              </p>
            </div>
            <button
              onClick={() => exportExpenseReportPdf(meta, dates, expenses)}
              className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Download Expense Report (PDF)</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Description</th>
                    <th className="px-6 py-3.5">Branch</th>
                    <th className="px-6 py-3.5">Payment Method</th>
                    <th className="px-6 py-3.5">Recorded By</th>
                    <th className="px-6 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                        No expenses recorded in this date range.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                          {new Date(e.expense_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 font-extrabold text-brand-600 dark:text-brand-400">{e.category_name}</td>
                        <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{e.description || '-'}</td>
                        <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{e.branch_name}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{e.payment_method}</td>
                        <td className="px-6 py-3.5 text-slate-500">{e.recorded_by_name}</td>
                        <td className="px-6 py-3.5 text-right font-black text-rose-600 dark:text-rose-400">
                          {currencySymbol} {Number(e.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
