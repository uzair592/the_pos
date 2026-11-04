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
  Printer,
  Eye,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  Search,
  Bike,
  UtensilsCrossed,
  Layers,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/common/Modal.js';
import {
  exportSalesReportPdf,
  exportPurchaseReportPdf,
  exportExpenseReportPdf,
  exportGrossProfitReportPdf,
  exportNetProfitReportPdf,
  exportBillWiseProfitLossPdf,
} from '../../utils/pdfExport.js';

export type ReportTab = 'OVERVIEW' | 'BILL_PROFIT_LOSS' | 'SALES' | 'PURCHASES' | 'EXPENSES' | 'GROSS_PROFIT';

interface FinancialReportsProps {
  defaultTab?: ReportTab;
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({ defaultTab = 'OVERVIEW' }) => {
  const { tenant } = useAuth();
  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') as ReportTab;
  const [activeTab, setActiveTab] = useState<ReportTab>(queryTab || defaultTab);
  const [summary, setSummary] = useState<any>(null);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<any[]>([]);
  
  // Dedicated sub-reports
  const [detailedSales, setDetailedSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dailyProfits, setDailyProfits] = useState<any[]>([]);

  // Bill-Wise Profit & Loss state
  const [billProfitLossReport, setBillProfitLossReport] = useState<any>(null);
  const [billOrderTypeFilter, setBillOrderTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('ALL');
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [billSortField, setBillSortField] = useState<'profit_desc' | 'profit_asc' | 'margin_desc' | 'margin_asc' | 'revenue_desc' | 'date_desc' | 'date_asc'>('date_desc');
  const [selectedBillForBreakdown, setSelectedBillForBreakdown] = useState<any | null>(null);

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
      if (activeTab === 'BILL_PROFIT_LOSS' || activeTab === 'OVERVIEW') {
        const bplRes = await api.get(
          `/financial/reports/bill-profit-loss?startDate=${start}&endDate=${end}${
            billOrderTypeFilter !== 'ALL' ? `&orderType=${billOrderTypeFilter}` : ''
          }${billSearchQuery ? `&search=${encodeURIComponent(billSearchQuery)}` : ''}`
        );
        setBillProfitLossReport(bplRes);
      }
    } catch (err) {
      console.error('Failed to load financial reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, activeTab, billOrderTypeFilter, billSearchQuery]);

  const meta = {
    name: tenant?.name || 'Restaurant',
    currency,
    currencySymbol,
  };
  const dates = { startDate, endDate };

  const filteredAndSortedBills = React.useMemo(() => {
    if (!billProfitLossReport?.bills) return [];
    let list = [...billProfitLossReport.bills];

    if (billSearchQuery.trim()) {
      const q = billSearchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.orderNumber.toLowerCase().includes(q) ||
          (b.customerName && b.customerName.toLowerCase().includes(q)) ||
          (b.customerPhone && b.customerPhone.includes(q))
      );
    }

    if (billOrderTypeFilter !== 'ALL') {
      list = list.filter((b) => b.orderType === billOrderTypeFilter);
    }

    list.sort((a, b) => {
      switch (billSortField) {
        case 'profit_desc':
          return b.grossProfit - a.grossProfit;
        case 'profit_asc':
          return a.grossProfit - b.grossProfit;
        case 'margin_desc':
          return b.grossMarginPercent - a.grossMarginPercent;
        case 'margin_asc':
          return a.grossMarginPercent - b.grossMarginPercent;
        case 'revenue_desc':
          return b.grandTotal - a.grandTotal;
        case 'date_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date_desc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return list;
  }, [billProfitLossReport, billOrderTypeFilter, billSearchQuery, billSortField]);

  const handleExportBillProfitLossCsv = () => {
    const start = `${startDate}T00:00:00Z`;
    const end = `${endDate}T23:59:59Z`;
    window.open(
      `/api/financial/reports/bill-profit-loss/export?startDate=${start}&endDate=${end}${
        billOrderTypeFilter !== 'ALL' ? `&orderType=${billOrderTypeFilter}` : ''
      }`,
      '_blank'
    );
  };

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
          onClick={() => setActiveTab('BILL_PROFIT_LOSS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'BILL_PROFIT_LOSS'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4 text-amber-400" />
          <span>Bill-Wise Profit & Loss</span>
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


      {/* ==================== SUB-SECTION: BILL-WISE PROFIT & LOSS REPORT ==================== */}
      {activeTab === 'BILL_PROFIT_LOSS' && (
        <div className="space-y-6">
          {/* Top Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Bill-Wise Profit & Loss Audit Report
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Exact invoice-by-invoice reconciliation of selling revenue against batch FIFO ingredient cost
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
                title="Print Bill-Wise Report"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>

              <button
                onClick={handleExportBillProfitLossCsv}
                className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
                title="Export CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => exportBillWiseProfitLossPdf(meta, dates, billProfitLossReport?.summary, filteredAndSortedBills)}
                className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Quick Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Bills</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {billProfitLossReport?.summary?.totalBills || 0}
              </p>
              <span className="text-[10px] text-slate-500">Completed & settled</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Food Sales</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {currencySymbol} {Number(billProfitLossReport?.summary?.totalNetSales || 0).toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500">Excl. taxes & discounts</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">FIFO COGS</span>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {currencySymbol} {Number(billProfitLossReport?.summary?.totalCogs || 0).toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500">Exact batch cost</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</span>
              <p className={`text-xl font-black mt-1 ${
                Number(billProfitLossReport?.summary?.totalGrossProfit || 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {currencySymbol} {Number(billProfitLossReport?.summary?.totalGrossProfit || 0).toLocaleString()}
              </p>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {Number(billProfitLossReport?.summary?.averageMarginPercent || 0).toFixed(1)}% margin
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Profit / Bill</span>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {currencySymbol} {Number(billProfitLossReport?.summary?.averageProfitPerBill || 0).toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500">Per customer order</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Profitable Bills</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {billProfitLossReport?.summary?.profitableBillsCount || 0} / {billProfitLossReport?.summary?.totalBills || 0}
              </p>
              <span className="text-[10px] text-emerald-600 font-bold">
                {billProfitLossReport?.summary?.totalBills > 0
                  ? ((billProfitLossReport.summary.profitableBillsCount / billProfitLossReport.summary.totalBills) * 100).toFixed(0)
                  : 0}
                % win rate
              </span>
            </div>
          </div>

          {/* Filter Bar: Channel Pills + Search + Sort */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Order Channel Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
              {(['ALL', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setBillOrderTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    billOrderTypeFilter === type
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {type === 'ALL' && 'All Channels'}
                  {type === 'DINE_IN' && 'Dine-In'}
                  {type === 'TAKEAWAY' && 'Takeaway'}
                  {type === 'DELIVERY' && 'Delivery'}
                </button>
              ))}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search order #, customer..."
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center space-x-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={billSortField}
                  onChange={(e: any) => setBillSortField(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="profit_desc">Highest Profit</option>
                  <option value="profit_asc">Lowest Profit</option>
                  <option value="margin_desc">Highest Margin %</option>
                  <option value="margin_asc">Lowest Margin %</option>
                  <option value="revenue_desc">Highest Bill Amount</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bill-Wise P&L Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Bill / Order #</th>
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-5 py-3.5">Channel / Customer</th>
                    <th className="px-5 py-3.5">Items</th>
                    <th className="px-5 py-3.5 text-right">Net Sales</th>
                    <th className="px-5 py-3.5 text-right">FIFO Cost</th>
                    <th className="px-5 py-3.5 text-right">Gross Profit</th>
                    <th className="px-5 py-3.5 text-center">Margin %</th>
                    <th className="px-5 py-3.5 text-right">Grand Total</th>
                    <th className="px-5 py-3.5 text-center">Payment</th>
                    <th className="px-5 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAndSortedBills.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="font-bold text-sm">No completed bills found</p>
                        <p className="text-xs text-slate-400 mt-1">Try selecting another date range or channel filter</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedBills.map((bill: any) => {
                      const dt = new Date(bill.createdAt);
                      const isProfit = Number(bill.grossProfit) >= 0;
                      const margin = Number(bill.grossMarginPercent || 0);

                      return (
                        <tr key={bill.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => setSelectedBillForBreakdown(bill)}
                              className="font-black text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                            >
                              <span>{bill.orderNumber}</span>
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                            <div>{dt.toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-400">{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center space-x-1.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                                bill.orderType === 'DINE_IN'
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                  : bill.orderType === 'TAKEAWAY'
                                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {bill.orderType === 'DINE_IN' ? `Table ${bill.tableNumber || '-'}` : bill.orderType}
                              </span>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 font-semibold mt-0.5 truncate max-w-[140px]">
                              {bill.customerName || (bill.orderType === 'DELIVERY' ? 'Delivery Guest' : 'Walk-in')}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{bill.itemCount} items</span>
                            {bill.items && bill.items.length > 0 && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                {bill.items.map((i: any) => `${i.quantity}x ${i.productName}`).join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800 dark:text-slate-200">
                            {currencySymbol} {Number(bill.netSales).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-amber-600 dark:text-amber-400">
                            {currencySymbol} {Number(bill.fifoCogs).toLocaleString()}
                          </td>
                          <td className={`px-5 py-3.5 text-right font-black ${
                            isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {currencySymbol} {Number(bill.grossProfit).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                              margin >= 50
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : margin >= 30
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                : margin >= 10
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                            }`}>
                              {margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                            {currencySymbol} {Number(bill.grandTotal).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              {bill.paymentMethods || 'CASH'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => setSelectedBillForBreakdown(bill)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-brand-500 transition-colors"
                              title="View Item Cost & Profit Breakdown"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Itemized Bill Cost & Profit Breakdown Modal */}
          {selectedBillForBreakdown && (
            <Modal
              isOpen={Boolean(selectedBillForBreakdown)}
              onClose={() => setSelectedBillForBreakdown(null)}
              title={`Bill P&L Breakdown: ${selectedBillForBreakdown.orderNumber}`}
              maxWidth="2xl"
            >
              <div className="space-y-4">
                {/* Meta details banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Channel</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedBillForBreakdown.orderType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Customer</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedBillForBreakdown.customerName || 'Walk-in'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Payment</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedBillForBreakdown.paymentMethods || 'CASH'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Date</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {new Date(selectedBillForBreakdown.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="px-4 py-2.5">Menu Item</th>
                        <th className="px-3 py-2.5 text-center">Qty</th>
                        <th className="px-4 py-2.5 text-right">Selling Price</th>
                        <th className="px-4 py-2.5 text-right">FIFO Cost</th>
                        <th className="px-4 py-2.5 text-right">Item Profit</th>
                        <th className="px-3 py-2.5 text-center">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedBillForBreakdown.items && selectedBillForBreakdown.items.length > 0 ? (
                        selectedBillForBreakdown.items.map((item: any, idx: number) => {
                          const itemProfit = Number(item.grossProfit || 0);
                          const itemMargin = Number(item.grossMarginPercent || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-2.5">
                                <span className="font-bold text-slate-900 dark:text-white">{item.productName}</span>
                                {item.variantName && (
                                  <span className="text-slate-400 text-[10px] block">{item.variantName}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                                {currencySymbol} {Number(item.totalPrice).toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">
                                {currencySymbol} {Number(item.cogs).toLocaleString()}
                              </td>
                              <td className={`px-4 py-2.5 text-right font-black ${
                                itemProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}>
                                {currencySymbol} {itemProfit.toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  itemMargin >= 50
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                    : itemMargin >= 30
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {itemMargin.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No individual item lines recorded for this order.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Reconciliation Summary Box */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Food Subtotal:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{currencySymbol} {Number(selectedBillForBreakdown.subtotal).toLocaleString()}</span>
                  </div>
                  {Number(selectedBillForBreakdown.totalDiscount) > 0 && (
                    <div className="flex justify-between text-rose-500 font-semibold">
                      <span>Discount Applied:</span>
                      <span>- {currencySymbol} {Number(selectedBillForBreakdown.totalDiscount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-700 pt-1.5">
                    <span>Net Food Revenue:</span>
                    <span>{currencySymbol} {Number(selectedBillForBreakdown.netSales).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                    <span>Total FIFO Ingredient Cost (COGS):</span>
                    <span>- {currencySymbol} {Number(selectedBillForBreakdown.fifoCogs).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-black text-sm border-t border-dashed border-slate-200 dark:border-slate-700 pt-2">
                    <span>Gross Food Profit:</span>
                    <span>
                      {currencySymbol} {Number(selectedBillForBreakdown.grossProfit).toLocaleString()} ({Number(selectedBillForBreakdown.grossMarginPercent || 0).toFixed(1)}%)
                    </span>
                  </div>
                  {(Number(selectedBillForBreakdown.taxAmount) > 0 || Number(selectedBillForBreakdown.deliveryFee) > 0) && (
                    <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                      <span>Taxes & Additional Fees:</span>
                      <span>
                        + {currencySymbol} {(Number(selectedBillForBreakdown.taxAmount) + Number(selectedBillForBreakdown.deliveryFee)).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 dark:text-white font-black text-sm pt-1">
                    <span>Grand Total Paid by Customer:</span>
                    <span>{currencySymbol} {Number(selectedBillForBreakdown.grandTotal).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedBillForBreakdown(null)}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
                  >
                    Close Breakdown
                  </button>
                </div>
              </div>
            </Modal>
          )}
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
