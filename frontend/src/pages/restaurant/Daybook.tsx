import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import {
  exportDaybookPdf,
  exportPurchaseVoucherPdf,
  exportExpenseVoucherPdf,
  exportShiftZReportPdf,
} from '../../utils/pdfExport.js';
import { executeThermalPrint } from '../../utils/receiptPrinter.js';
import {
  Calendar,
  CalendarDays,
  Download,
  BookOpen,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Truck,
  ChefHat,
  Trash2,
  Printer,
  RefreshCw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X,
  Layers,
  Eye,
  Receipt,
  CreditCard,
  Wallet,
  Banknote,
  FileText,
  PieChart,
  BarChart3,
  Building2,
  Boxes,
  Scale,
  Sparkles,
  User,
  ShieldCheck,
} from 'lucide-react';
import { PaymentMethod, StockMovementType } from '@pos/shared';

// Format Date YYYY-MM-DD local
const formatLocalYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const Daybook: React.FC = () => {
  const { tenant, branches, currentBranchId, user } = useAuth();
  const { success, error, info } = useToast();

  // Filters State
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => currentBranchId || '');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'sales' | 'purchases' | 'ingredients' | 'expenses' | 'wastage' | 'shifts'
  >('overview');

  // Daybook Data State
  const [daybook, setDaybook] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isWastageModalOpen, setIsWastageModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [selectedDaybookPurchase, setSelectedDaybookPurchase] = useState<any | null>(null);
  const [selectedDaybookExpense, setSelectedDaybookExpense] = useState<any | null>(null);
  const [selectedDaybookShift, setSelectedDaybookShift] = useState<any | null>(null);

  const handleDownloadDaybookPurchase = (p: any) => {
    exportPurchaseVoucherPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: p.branchName || 'Main Branch',
      },
      p,
      [],
      { autoPrint: false }
    );
  };

  const handlePrintDaybookPurchase = (p: any) => {
    exportPurchaseVoucherPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: p.branchName || 'Main Branch',
      },
      p,
      [],
      { autoPrint: true }
    );
  };

  const handleDownloadDaybookExpense = (e: any) => {
    exportExpenseVoucherPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: e.branchName || 'Main Branch',
      },
      e,
      { autoPrint: false }
    );
  };

  const handlePrintDaybookExpense = (e: any) => {
    exportExpenseVoucherPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: e.branchName || 'Main Branch',
      },
      e,
      { autoPrint: true }
    );
  };

  const handleDownloadDaybookShift = (s: any) => {
    exportShiftZReportPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: s.branchName || 'Main Branch',
      },
      s,
      { autoPrint: false }
    );
  };

  const handlePrintDaybookShift = (s: any) => {
    exportShiftZReportPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: s.branchName || 'Main Branch',
      },
      s,
      { autoPrint: true }
    );
  };

  // Catalog helpers for modals
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    branchId: currentBranchId || branches[0]?.id || '',
    categoryId: '',
    amount: '',
    paymentMethod: PaymentMethod.CASH,
    description: '',
    expenseDate: formatLocalYMD(new Date()),
  });
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Wastage Form State
  const [wastageForm, setWastageForm] = useState({
    branchId: currentBranchId || branches[0]?.id || '',
    ingredientId: '',
    quantity: '',
    reason: '',
  });
  const [isSubmittingWastage, setIsSubmittingWastage] = useState(false);

  // Keep branch in sync with auth context
  useEffect(() => {
    if (currentBranchId) {
      setSelectedBranchId(currentBranchId);
    }
  }, [currentBranchId]);

  // Fetch Daybook Data
  const fetchDaybook = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const params: any = { date: selectedDate };
      if (selectedBranchId) params.branchId = selectedBranchId;

      const res = await api.get('/financial/daybook', { params });
      setDaybook(res.daybook);
    } catch (err: any) {
      error(err.message || 'Failed to load daybook');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate, selectedBranchId, error]);

  useEffect(() => {
    fetchDaybook();
  }, [fetchDaybook]);

  // Load auxiliary data for expense & wastage forms
  useEffect(() => {
    const loadAuxData = async () => {
      try {
        const [catRes, ingRes] = await Promise.all([
          api.get('/financial/expenses/categories'),
          api.get('/inventory/ingredients'),
        ]);
        setExpenseCategories(catRes.categories || []);
        setIngredients(ingRes.ingredients || []);
        if (catRes.categories?.length > 0) {
          setExpenseForm((prev) => ({ ...prev, categoryId: catRes.categories[0].id }));
        }
        if (ingRes.ingredients?.length > 0) {
          setWastageForm((prev) => ({ ...prev, ingredientId: ingRes.ingredients[0].id }));
        }
      } catch (_) {}
    };
    loadAuxData();
  }, []);

  // Day Navigation Handlers
  const handleJumpDay = (offsetDays: number) => {
    const curr = new Date(`${selectedDate}T12:00:00`);
    curr.setDate(curr.getDate() + offsetDays);
    setSelectedDate(formatLocalYMD(curr));
  };

  const handleJumpToday = () => {
    setSelectedDate(formatLocalYMD(new Date()));
  };

  // Submit Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.categoryId) {
      error('Please select an expense category');
      return;
    }
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      error('Please enter a valid expense amount');
      return;
    }
    if (!expenseForm.description.trim()) {
      error('Please enter an expense description or voucher reference');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      await api.post('/financial/expenses', {
        branchId: expenseForm.branchId || branches[0]?.id,
        categoryId: expenseForm.categoryId,
        amount: Number(expenseForm.amount),
        paymentMethod: expenseForm.paymentMethod,
        description: expenseForm.description.trim(),
        expenseDate: expenseForm.expenseDate,
      });

      success('Daily expense recorded successfully!');
      setIsExpenseModalOpen(false);
      setExpenseForm({
        branchId: currentBranchId || branches[0]?.id || '',
        categoryId: expenseCategories[0]?.id || '',
        amount: '',
        paymentMethod: PaymentMethod.CASH,
        description: '',
        expenseDate: selectedDate,
      });
      fetchDaybook(true);
    } catch (err: any) {
      error(err.message || 'Failed to record expense');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Submit Wastage
  const handleSaveWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wastageForm.ingredientId) {
      error('Please select an ingredient');
      return;
    }
    if (!wastageForm.quantity || Number(wastageForm.quantity) <= 0) {
      error('Please enter a valid wasted quantity');
      return;
    }
    if (!wastageForm.reason.trim()) {
      error('Please enter a reason for wastage (e.g. spoilage, burn, dropped)');
      return;
    }

    setIsSubmittingWastage(true);
    try {
      await api.post('/inventory/adjustments', {
        branchId: wastageForm.branchId || branches[0]?.id,
        ingredientId: wastageForm.ingredientId,
        movementType: StockMovementType.WASTAGE,
        quantity: Number(wastageForm.quantity),
        reason: wastageForm.reason.trim(),
      });

      success('Wastage record logged and FIFO stock updated!');
      setIsWastageModalOpen(false);
      setWastageForm({
        branchId: currentBranchId || branches[0]?.id || '',
        ingredientId: ingredients[0]?.id || '',
        quantity: '',
        reason: '',
      });
      fetchDaybook(true);
    } catch (err: any) {
      error(err.message || 'Failed to log wastage');
    } finally {
      setIsSubmittingWastage(false);
    }
  };

  // Open Full Order Details
  const handleDownloadPdf = () => {
    if (!daybook) return;
    const branchName = branches.find((b) => b.id === selectedBranchId)?.name || 'Main Branch';
    exportDaybookPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: branchName,
      },
      selectedDate,
      daybook
    );
    success('Daybook PDF downloaded successfully');
  };

  const handleViewOrderDetail = async (orderId: string) => {
    try {
      const data = await api.get(`/orders/${orderId}`);
      setSelectedOrderDetail(data.order);
    } catch (err: any) {
      error(err.message || 'Failed to fetch order details');
    }
  };

  const currencySymbol = daybook?.currencySymbol || tenant?.currency_symbol || 'Rs.';
  const summary = daybook?.summary || {};

  const isToday = selectedDate === formatLocalYMD(new Date());

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & DATE / BRANCH NAVIGATION */}
      {/* ======================================================== */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Daily Daybook & Operations Ledger
                </h1>
                                {isToday && (
                  <span className="flex items-center space-x-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Today</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Consolidated operations: Sales, Purchases, Ingredient Consumption, Wastage & Daily Expenses
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Branch Controls */}
        <div className="flex flex-wrap items-center gap-2.5">


          {/* Date Picker & Navigators */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleJumpDay(-1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-1.5 px-2">
              <Calendar className="w-3.5 h-3.5 text-brand-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => handleJumpDay(1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isToday && (
              <button
                onClick={handleJumpToday}
                className="px-2 py-1 text-[11px] font-bold bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Today
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => setIsWastageModalOpen(true)}
            className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Log Wastage</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
            title="Download complete Daybook Statement as A4 PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download A4 PDF</span>
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
            title="Preview and print A4 Daybook Statement"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print A4 Statement</span>
          </button>

          <button
            onClick={() => fetchDaybook(true)}
            disabled={isRefreshing}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date Banner */}
      <div className="flex items-center justify-between px-2 text-xs">
        <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
          <CalendarDays className="w-4 h-4 text-brand-500" />
          <span>Statement for {daybook?.displayDate || selectedDate}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500 font-medium">{daybook?.branchName}</span>
        </span>
      </div>

      {/* ======================================================== */}
      {/* 2. THE AT-A-GLANCE METRIC CARDS STRIP */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Net Sales */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Net Sales</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {currencySymbol} {Number(summary.totalNetSales || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-medium">
              Gross: <span className="font-bold">{currencySymbol} {Number(summary.totalGrossSales || 0).toLocaleString()}</span>
            </p>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold">
              {summary.completedOrdersCount || 0} completed orders
            </p>
          </div>
        </div>

        {/* Card 2: Inward Purchases */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Purchases</span>
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {currencySymbol} {Number(summary.totalPurchasesAmount || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-medium">
              Paid: <span className="font-bold text-emerald-600 dark:text-emerald-400">{currencySymbol} {Number(summary.totalPurchasesPaid || 0).toLocaleString()}</span>
            </p>
            <p className="font-medium text-amber-600 dark:text-amber-400 font-bold">
              Credit: {currencySymbol} {Number(summary.totalPurchasesUnpaid || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 3: Ingredients Consumed (FIFO COGS) */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Ingredients COGS</span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-300">
            {currencySymbol} {Number(summary.totalIngredientsCost || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-medium">
              Gross Margin: <span className="font-black text-brand-600 dark:text-brand-400">{summary.grossMarginPercent || 0}%</span>
            </p>
            <p className="font-medium text-emerald-600 dark:text-emerald-400 font-bold">
              Gross Profit: {currencySymbol} {Number(summary.grossProfit || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 4: Wastage & Spoilage */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Wastage Loss</span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">
            {currencySymbol} {Number(summary.totalWastageCost || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-medium">
              Qty Lost: <span className="font-bold">{Number(summary.totalWastageQuantity || 0).toFixed(2)} units</span>
            </p>
            <p className="text-amber-600 dark:text-amber-400 font-bold">
              {summary.wastageCount || 0} wastage records
            </p>
          </div>
        </div>

        {/* Card 5: Daily Expenses */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Daily Expenses</span>
            <div className="w-7 h-7 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400">
            {currencySymbol} {Number(summary.totalExpensesAmount || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-medium">
              Cash: <span className="font-bold">{currencySymbol} {Number(summary.totalCashExpenses || 0).toLocaleString()}</span>
            </p>
            <p className="text-rose-600 dark:text-rose-400 font-bold">
              {summary.expensesCount || 0} expense vouchers
            </p>
          </div>
        </div>

        {/* Card 6: Net Operating Profit */}
        <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm relative overflow-hidden border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Net Operating Profit</span>
            <div className="w-7 h-7 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-black ${Number(summary.netDailyProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {currencySymbol} {Number(summary.netDailyProfit || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-[10px] text-slate-300 space-y-0.5">
            <p>
              Drawer Cash: <span className="font-bold text-white">{currencySymbol} {Number(summary.netOperatingCashPosition || 0).toLocaleString()}</span>
            </p>
            <p className="text-slate-400 font-medium">
              Sales - COGS - Expenses - Wastage
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. BALANCED DAILY FINANCIAL LEDGER FLOW (P&L & CASH) */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <h3 className="font-black text-sm text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
          <Scale className="w-4 h-4 text-brand-500" />
          <span>Balanced Daily Cash Flow & Operating Statement</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column A: Inflows */}
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 space-y-2 text-xs">
            <div className="flex items-center justify-between font-extrabold text-emerald-800 dark:text-emerald-300 pb-2 border-b border-emerald-200 dark:border-emerald-900/60">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>1. Cash & Revenue Inflows</span>
              </span>
              <span>{currencySymbol} {(Number(summary.totalGrandTotal || 0) + Number(summary.openingRegisterCash || 0)).toLocaleString()}</span>
            </div>
            <div className="space-y-1.5 pt-1 text-slate-700 dark:text-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span>Opening Register Cash:</span>
                <span className="font-bold font-mono">{currencySymbol} {Number(summary.openingRegisterCash || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales Collected:</span>
                <span className="font-bold font-mono text-emerald-600">{currencySymbol} {Number(summary.cashSalesCollected || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Digital / Card Collections:</span>
                <span className="font-bold font-mono">{currencySymbol} {Number(summary.nonCashSalesCollected || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes & Delivery Fees:</span>
                <span className="font-bold font-mono">{currencySymbol} {(Number(summary.totalTax || 0) + Number(summary.totalDeliveryFees || 0)).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Column B: Outflows */}
          <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 space-y-2 text-xs">
            <div className="flex items-center justify-between font-extrabold text-rose-800 dark:text-rose-300 pb-2 border-b border-rose-200 dark:border-rose-900/60">
              <span className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>2. Operating Costs & Outflows</span>
              </span>
              <span>{currencySymbol} {(Number(summary.totalIngredientsCost || 0) + Number(summary.totalExpensesAmount || 0) + Number(summary.totalWastageCost || 0)).toLocaleString()}</span>
            </div>
            <div className="space-y-1.5 pt-1 text-slate-700 dark:text-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span>Raw Ingredients Consumed (COGS):</span>
                <span className="font-bold font-mono text-purple-600">{currencySymbol} {Number(summary.totalIngredientsCost || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Daily Operational Expenses:</span>
                <span className="font-bold font-mono text-rose-600">{currencySymbol} {Number(summary.totalExpensesAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Wastage & Spoilage Loss:</span>
                <span className="font-bold font-mono text-amber-600">{currencySymbol} {Number(summary.totalWastageCost || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Purchases Paid to Suppliers:</span>
                <span className="font-bold font-mono">{currencySymbol} {Number(summary.totalPurchasesPaid || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Column C: Net Position */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-500" />
                  <span>3. Net Reconciliation</span>
                </span>
                <span className="font-black text-brand-600 dark:text-brand-400">
                  {summary.grossMarginPercent || 0}% Gross
                </span>
              </div>
              <div className="space-y-1.5 pt-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Operating Profit:</span>
                  <span className="font-bold font-mono">{currencySymbol} {Number(summary.grossProfit || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Operating Day Profit:</span>
                  <span className={`font-black font-mono ${Number(summary.netDailyProfit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {currencySymbol} {Number(summary.netDailyProfit || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Cash In Drawer:</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">
                    {currencySymbol} {Number(summary.netOperatingCashPosition || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Status: Reconciled</span>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Z-Report</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. ACTIVITY TABS & TABLES */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center space-x-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-x-auto text-xs">
          {[
            { id: 'overview', label: 'Overview & Collections', icon: PieChart },
            { id: 'sales', label: `Sales Orders (${daybook?.salesOrders?.length || 0})`, icon: ShoppingBag },
            { id: 'purchases', label: `Purchases Done (${daybook?.purchases?.length || 0})`, icon: Truck },
            { id: 'ingredients', label: `Ingredients Used (${daybook?.ingredientConsumptions?.length || 0})`, icon: ChefHat },
            { id: 'expenses', label: `Expenses Logged (${daybook?.expenses?.length || 0})`, icon: Receipt },
            { id: 'wastage', label: `Wastage Recorded (${daybook?.wastageRecords?.length || 0})`, icon: Trash2 },
            { id: 'shifts', label: `Shifts & Registers (${daybook?.shifts?.length || 0})`, icon: Clock },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ====================================================== */}
        {/* TAB 1: OVERVIEW & COLLECTIONS */}
        {/* ====================================================== */}
        {activeTab === 'overview' && (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Payment Methods Breakdown */}
              <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <Wallet className="w-4 h-4 text-brand-500" />
                    <span>Payment Methods Collected Today</span>
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">
                    Total: {currencySymbol} {Number(summary.totalGrandTotal || 0).toLocaleString()}
                  </span>
                </div>

                {(!daybook?.paymentMethods || daybook.paymentMethods.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No payment collections recorded for this date.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {daybook.paymentMethods.map((pm: any) => (
                      <div key={pm.method} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-200">
                            {pm.method === 'CASH' && <Banknote className="w-3.5 h-3.5 text-emerald-500" />}
                            {pm.method === 'CARD' && <CreditCard className="w-3.5 h-3.5 text-blue-500" />}
                            {pm.method === 'DIGITAL_WALLET' && <Wallet className="w-3.5 h-3.5 text-purple-500" />}
                            {pm.method === 'BANK_TRANSFER' && <Receipt className="w-3.5 h-3.5 text-amber-500" />}
                            <span>{pm.method.replace('_', ' ')}</span>
                            <span className="text-[10px] text-slate-400">({pm.transactionCount} txn)</span>
                          </span>
                          <span className="font-black text-slate-900 dark:text-white font-mono">
                            {currencySymbol} {Number(pm.totalAmount).toLocaleString()} ({pm.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pm.method === 'CASH'
                                ? 'bg-emerald-500'
                                : pm.method === 'CARD'
                                ? 'bg-blue-500'
                                : pm.method === 'DIGITAL_WALLET'
                                ? 'bg-purple-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.max(2, pm.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Channels & Stats */}
              <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <BarChart3 className="w-4 h-4 text-brand-500" />
                    <span>Daily Sales Channels & Status Summary</span>
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">
                    {summary.completedOrdersCount || 0} Finished Orders
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold mb-0.5">COMPLETED ORDERS</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{summary.completedOrdersCount || 0}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold mb-0.5">IN-FLIGHT / ACTIVE</span>
                    <span className="text-base font-black text-amber-600 dark:text-amber-400">{summary.activeOrdersCount || 0}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold mb-0.5">CANCELLED ORDERS</span>
                    <span className="text-base font-black text-rose-600 dark:text-rose-400">{summary.cancelledOrdersCount || 0}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold mb-0.5">REFUNDED TOTAL</span>
                    <span className="text-base font-black text-slate-700 dark:text-slate-300">
                      {currencySymbol} {Number(summary.totalRefundedAmount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-brand-50/50 dark:bg-brand-950/20 rounded-xl border border-brand-200/60 dark:border-brand-900/40 text-[11px] text-brand-900 dark:text-brand-300">
                  <p className="font-semibold">
                    💡 All sales orders are automatically reconciled with exact ingredient batch deductions (FIFO) and register cash tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* TAB 2: SALES ORDERS */}
        {/* ====================================================== */}
        {activeTab === 'sales' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Channel / Customer</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {(!daybook?.salesOrders || daybook.salesOrders.length === 0) ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No sales orders found for this date.
                    </td>
                  </tr>
                ) : (
                  daybook.salesOrders.map((ord: any) => {
                    const time = new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                          #{ord.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {time}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {ord.orderType} {ord.tableNumber ? `• Table ${ord.tableNumber}` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {ord.customerName ? `${ord.customerName} (${ord.customerPhone || ''})` : 'Walk-in Guest'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          {ord.itemsCount}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {ord.cashierName || 'Cashier'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {ord.paymentMethods || 'Cash'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              ord.status === 'COMPLETED'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : ord.status === 'CANCELLED'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {ord.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black font-mono text-slate-900 dark:text-white">
                          {currencySymbol} {Number(ord.grandTotal).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <ActionMenu
                            items={[
                              {
                                label: 'Preview Breakdown',
                                icon: Eye,
                                onClick: () => handleViewOrderDetail(ord.id),
                              },
                              {
                                label: 'Print Receipt',
                                icon: Printer,
                                onClick: async () => {
                                  const currentBranch = branches?.find((b: any) => b.id === (currentBranchId || user?.branchId));
                                  try {
                                    const receiptRes = await api.get(`/orders/${ord.id}/receipt`);
                                    executeThermalPrint(receiptRes.receipt || ord, {
                                      isReprint: true,
                                      context: { tenant, branch: currentBranch, user },
                                    });
                                  } catch {
                                    executeThermalPrint(ord, {
                                      isReprint: true,
                                      context: { tenant, branch: currentBranch, user },
                                    });
                                  }
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ====================================================== */}
        {/* TAB 3: INWARD PURCHASES */}
        {/* ====================================================== */}
        {activeTab === 'purchases' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3 text-center">Items Count</th>
                  <th className="px-4 py-3">Received By</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {(!daybook?.purchases || daybook.purchases.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No inward purchases recorded on this date.
                    </td>
                  </tr>
                ) : (
                  daybook.purchases.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {p.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {p.supplierName}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.branchName}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {p.itemsCount} lines
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {p.receivedByName || 'Inventory Manager'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            p.balancePayable <= 0
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200'
                          }`}
                        >
                          {p.balancePayable <= 0 ? 'PAID' : 'UNPAID / CREDIT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black font-mono text-slate-900 dark:text-white">
                        {currencySymbol} {Number(p.totalAmount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {currencySymbol} {Number(p.paidAmount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-amber-600 dark:text-amber-400">
                        {currencySymbol} {Number(p.balancePayable).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ActionMenu
                          items={[
                            {
                              label: 'View Invoice Details',
                              icon: Eye,
                              onClick: () => setSelectedDaybookPurchase(p),
                            },
                            {
                              label: 'Download A4 Voucher (PDF)',
                              icon: Download,
                              onClick: () => handleDownloadDaybookPurchase(p),
                            },
                            {
                              label: 'Print A4 Voucher',
                              icon: Printer,
                              onClick: () => handlePrintDaybookPurchase(p),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ====================================================== */}
        {/* TAB 4: INGREDIENTS USED IN TODAY'S SALES (FIFO COGS) */}
        {/* ====================================================== */}
        {activeTab === 'ingredients' && (
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <ChefHat className="w-4 h-4 text-purple-600" />
                  <span>Exact Ingredients Consumed in Today's Sales (FIFO Cost of Goods Sold)</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Calculated directly from recipe ingredient deductions and weighted inward lot consumption.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total FIFO Ingredient Cost</span>
                <span className="text-base font-black text-purple-700 dark:text-purple-300 font-mono">
                  {currencySymbol} {Number(summary.totalIngredientsCost || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Ingredient Name</th>
                    <th className="px-4 py-2.5 text-center">Unit</th>
                    <th className="px-4 py-2.5 text-center">Total Quantity Consumed</th>
                    <th className="px-4 py-2.5 text-center">Orders Drawn</th>
                    <th className="px-4 py-2.5 text-right">Avg Unit Cost</th>
                    <th className="px-4 py-2.5 text-right">Total FIFO Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {(!daybook?.ingredientConsumptions || daybook.ingredientConsumptions.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No recipe ingredient deductions recorded for today's completed orders.
                      </td>
                    </tr>
                  ) : (
                    daybook.ingredientConsumptions.map((c: any) => {
                      const avgUnitCost = c.totalQuantityUsed > 0 ? (c.totalFifoCost / c.totalQuantityUsed) : 0;
                      return (
                        <tr key={c.ingredientId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span>{c.ingredientName}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px]">
                            {c.unit}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white font-mono">
                            {Number(c.totalQuantityUsed).toFixed(2)} {c.unit}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-purple-600 dark:text-purple-400">
                            {c.ordersCount} orders
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 font-mono">
                            {currencySymbol} {avgUnitCost.toFixed(2)} / {c.unit}
                          </td>
                          <td className="px-4 py-3 text-right font-black font-mono text-purple-700 dark:text-purple-300">
                            {currencySymbol} {Number(c.totalFifoCost).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* TAB 5: EXPENSES LOGGED */}
        {/* ====================================================== */}
        {activeTab === 'expenses' && (
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Receipt className="w-4 h-4 text-rose-600" />
                  <span>Daily Operational Expenses & Petty Cash Out</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Log utilities, staff refreshments, maintenance, and petty cash vouchers.
                </p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Expense</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Description / Voucher</th>
                    <th className="px-4 py-2.5">Branch</th>
                    <th className="px-4 py-2.5">Payment Method</th>
                    <th className="px-4 py-2.5">Recorded By</th>
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {(!daybook?.expenses || daybook.expenses.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No operational expenses recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.expenses.map((e: any) => {
                      const time = new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            <span className="px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-[10px]">
                              {e.categoryName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">
                            {e.description}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {e.branchName}
                          </td>
                          <td className="px-4 py-3 font-bold">
                            {e.paymentMethod}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {e.recordedByName || 'Staff'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            {time}
                          </td>
                          <td className="px-4 py-3 text-right font-black font-mono text-rose-600 dark:text-rose-400">
                            {currencySymbol} {Number(e.amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <ActionMenu
                              items={[
                                {
                                  label: 'View Voucher Details',
                                  icon: Eye,
                                  onClick: () => setSelectedDaybookExpense(e),
                                },
                                {
                                  label: 'Download A4 Voucher (PDF)',
                                  icon: Download,
                                  onClick: () => handleDownloadDaybookExpense(e),
                                },
                                {
                                  label: 'Print A4 Voucher',
                                  icon: Printer,
                                  onClick: () => handlePrintDaybookExpense(e),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* TAB 6: WASTAGE & SPOILAGE LOG */}
        {/* ====================================================== */}
        {activeTab === 'wastage' && (
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Trash2 className="w-4 h-4 text-amber-600" />
                  <span>Kitchen Spoilage, Damage & Wastage Records</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tracks raw material waste, burns, power outage spoilage, and automatically adjusts FIFO inventory.
                </p>
              </div>
              <button
                onClick={() => setIsWastageModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Log Wastage</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Ingredient Wasted</th>
                    <th className="px-4 py-2.5 text-center">Quantity</th>
                    <th className="px-4 py-2.5 text-right">Unit Cost</th>
                    <th className="px-4 py-2.5 text-right">Financial Loss</th>
                    <th className="px-4 py-2.5">Reason & Notes</th>
                    <th className="px-4 py-2.5">Logged By</th>
                    <th className="px-4 py-2.5">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {(!daybook?.wastageRecords || daybook.wastageRecords.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No wastage or spoilage incidents recorded on this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.wastageRecords.map((w: any) => {
                      const time = new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={w.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {w.ingredientName}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-amber-600 font-mono">
                            {w.quantity} {w.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 font-mono">
                            {currencySymbol} {Number(w.unitCost).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-black font-mono text-rose-600 dark:text-rose-400">
                            {currencySymbol} {Number(w.totalCost).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                            {w.reason}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {w.recordedByName || 'Chef'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            {time}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* TAB 7: SHIFTS & REGISTERS */}
        {/* ====================================================== */}
        {activeTab === 'shifts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Opened At</th>
                  <th className="px-4 py-3">Closed At</th>
                  <th className="px-4 py-3 text-right">Opening Cash</th>
                  <th className="px-4 py-3 text-right">Cash Sales</th>
                  <th className="px-4 py-3 text-right">Cash In / Out</th>
                  <th className="px-4 py-3 text-right">Expected Cash</th>
                  <th className="px-4 py-3 text-right">Actual Count</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {(!daybook?.shifts || daybook.shifts.length === 0) ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                      No cashier register shifts opened or closed on this date.
                    </td>
                  </tr>
                ) : (
                  daybook.shifts.map((s: any) => {
                    const openTime = new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const closeTime = s.closedAt ? new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress';
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {s.cashierName}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {s.branchName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {openTime}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {closeTime}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {currencySymbol} {s.openingCash.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {s.cashSales.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                          +{s.cashIn} / -{s.cashOut}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {currencySymbol} {s.expectedCash.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {s.actualCash !== null ? `${currencySymbol} ${s.actualCash.toLocaleString()}` : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-black ${
                          s.variance === null ? 'text-slate-400' : s.variance === 0 ? 'text-emerald-600' : s.variance > 0 ? 'text-blue-600' : 'text-rose-600'
                        }`}>
                          {s.variance !== null ? `${s.variance > 0 ? '+' : ''}${currencySymbol} ${s.variance.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              s.status === 'OPEN'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <ActionMenu
                            items={[
                              {
                                label: 'View Shift Breakdown',
                                icon: Eye,
                                onClick: () => setSelectedDaybookShift(s),
                              },
                              {
                                label: 'Download A4 Z-Report (PDF)',
                                icon: Download,
                                onClick: () => handleDownloadDaybookShift(s),
                              },
                              {
                                label: 'Print A4 Z-Report',
                                icon: Printer,
                                onClick: () => handlePrintDaybookShift(s),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: RECORD EXPENSE */}
      {/* ======================================================== */}
      {isExpenseModalOpen && (
        <Modal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          title="Record Daily Operational Expense"
          maxWidth="md"
        >
          <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
            {branches.length > 1 && (
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Branch *
                </label>
                <select
                  value={expenseForm.branchId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Expense Category *
              </label>
              <select
                value={expenseForm.categoryId}
                onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                required
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 1500"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Method *
                </label>
                <select
                  value={expenseForm.paymentMethod}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                >
                  <option value={PaymentMethod.CASH}>Cash (Petty Cash)</option>
                  <option value={PaymentMethod.CARD}>Company Card</option>
                  <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                  <option value={PaymentMethod.DIGITAL_WALLET}>Digital Wallet / EasyPaisa</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Description / Voucher Reference *
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Purchased cleaning detergent, tissue rolls, and handwash..."
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingExpense}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors"
              >
                {isSubmittingExpense ? 'Saving...' : 'Save Expense Voucher'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RECORD WASTAGE */}
      {/* ======================================================== */}
      {isWastageModalOpen && (
        <Modal
          isOpen={isWastageModalOpen}
          onClose={() => setIsWastageModalOpen(false)}
          title="Log Kitchen Spoilage / Wastage"
          maxWidth="md"
        >
          <form onSubmit={handleSaveWastage} className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Select Ingredient Wasted *
              </label>
              <select
                value={wastageForm.ingredientId}
                onChange={(e) => setWastageForm({ ...wastageForm, ingredientId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                required
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Quantity Wasted *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 2.50"
                value={wastageForm.quantity}
                onChange={(e) => setWastageForm({ ...wastageForm, quantity: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-sm"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Reason for Wastage *
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Freezing compartment tripped during load shedding; thawed chicken spoiled..."
                value={wastageForm.reason}
                onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsWastageModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingWastage}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors"
              >
                {isSubmittingWastage ? 'Logging...' : 'Log Wastage & Deduct Stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PRINTABLE DAYBOOK Z-REPORT (DAILY CLOSING STATEMENT) */}
      {/* ======================================================== */}
      {isPrintModalOpen && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Print Daily Daybook & Z-Report"
          maxWidth="2xl"
        >
          <div className="space-y-6 text-xs font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <p className="text-slate-500">
                Official Daily Operations & Financial Statement in standard A4 PDF format.
              </p>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download A4 PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print A4 Statement</span>
                </button>
              </div>
            </div>

            {/* Print Document Paper Container */}
            <div id="printable-daybook-statement" className="p-6 bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-sm space-y-5 print:p-0 print:border-none print:shadow-none">
              {/* Header */}
              <div className="text-center pb-4 border-b border-slate-300 space-y-1">
                <h2 className="text-xl font-black uppercase tracking-wider">{tenant?.name || 'Restaurant Management'}</h2>
                <p className="text-xs font-bold text-slate-600">{daybook?.branchName || 'Branch'}</p>
                <p className="text-sm font-extrabold text-slate-800 uppercase mt-1">Daily Operations & Financial Daybook (Z-Report)</p>
                <p className="text-[11px] text-slate-500 font-mono">Date: {daybook?.displayDate} ({selectedDate}) • Generated: {new Date().toLocaleTimeString()}</p>
              </div>

              {/* Summary Statement Table */}
              <div className="space-y-2">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-700">1. Financial & Operating Summary</h4>
                <table className="w-full text-xs border border-slate-300">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-medium">Gross Sales ({summary.completedOrdersCount} orders)</td>
                      <td className="p-2 text-right font-bold font-mono">{currencySymbol} {Number(summary.totalGrossSales || 0).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-medium">(-) Discounts Given</td>
                      <td className="p-2 text-right font-bold font-mono text-rose-600">-{currencySymbol} {Number(summary.totalDiscounts || 0).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50 font-bold">
                      <td className="p-2">Net Food Revenue</td>
                      <td className="p-2 text-right font-mono text-emerald-700">{currencySymbol} {Number(summary.totalNetSales || 0).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-medium">(-) Raw Ingredients Cost (FIFO COGS)</td>
                      <td className="p-2 text-right font-bold font-mono text-purple-700">-{currencySymbol} {Number(summary.totalIngredientsCost || 0).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50 font-bold">
                      <td className="p-2">Gross Profit Margin ({summary.grossMarginPercent}%)</td>
                      <td className="p-2 text-right font-mono">{currencySymbol} {Number(summary.grossProfit || 0).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-medium">(-) Daily Operational Expenses</td>
                      <td className="p-2 text-right font-bold font-mono text-rose-600">-{currencySymbol} {Number(summary.totalExpensesAmount || 0).toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-medium">(-) Recorded Wastage / Spoilage Loss</td>
                      <td className="p-2 text-right font-bold font-mono text-amber-700">-{currencySymbol} {Number(summary.totalWastageCost || 0).toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-100 font-black text-sm">
                      <td className="p-2">Net Operating Day Profit</td>
                      <td className="p-2 text-right font-mono">{currencySymbol} {Number(summary.netDailyProfit || 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Collections by Payment Method */}
              <div className="space-y-2">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-700">2. Payment Collections Breakdown</h4>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2 text-left">Payment Channel</th>
                      <th className="p-2 text-center">Transactions</th>
                      <th className="p-2 text-right">Amount Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(daybook?.paymentMethods || []).map((pm: any) => (
                      <tr key={pm.method} className="border-b border-slate-200">
                        <td className="p-2 font-medium">{pm.method.replace('_', ' ')}</td>
                        <td className="p-2 text-center font-mono">{pm.transactionCount}</td>
                        <td className="p-2 text-right font-bold font-mono">{currencySymbol} {Number(pm.totalAmount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Inward Purchases & Expenses Summary */}
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div className="p-3 border border-slate-300 rounded-xl space-y-1">
                  <h5 className="font-bold uppercase text-slate-600">Purchases Received Today</h5>
                  <p>Invoices: <span className="font-bold">{summary.purchasesCount || 0}</span></p>
                  <p>Total Purchases: <span className="font-bold">{currencySymbol} {Number(summary.totalPurchasesAmount || 0).toLocaleString()}</span></p>
                  <p>Paid: <span className="font-bold text-emerald-600">{currencySymbol} {Number(summary.totalPurchasesPaid || 0).toLocaleString()}</span></p>
                  <p>Payable: <span className="font-bold text-amber-600">{currencySymbol} {Number(summary.totalPurchasesUnpaid || 0).toLocaleString()}</span></p>
                </div>
                <div className="p-3 border border-slate-300 rounded-xl space-y-1">
                  <h5 className="font-bold uppercase text-slate-600">Register Cash Reconciliation</h5>
                  <p>Opening Register Cash: <span className="font-bold">{currencySymbol} {Number(summary.openingRegisterCash || 0).toLocaleString()}</span></p>
                  <p>Cash Sales In: <span className="font-bold text-emerald-600">+{currencySymbol} {Number(summary.cashSalesCollected || 0).toLocaleString()}</span></p>
                  <p>Cash Out (Expenses): <span className="font-bold text-rose-600">-{currencySymbol} {Number(summary.totalCashExpenses || 0).toLocaleString()}</span></p>
                  <p className="font-bold text-slate-900 border-t border-slate-200 pt-1">
                    Ending Cash in Drawer: {currencySymbol} {Number(summary.netOperatingCashPosition || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-1.5 font-bold">
                  Prepared By (Cashier / Accountant)
                </div>
                <div className="border-t border-slate-400 pt-1.5 font-bold">
                  Approved By (General Manager / Owner)
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ORDER BREAKDOWN PREVIEW */}
      {/* ======================================================== */}
      {selectedOrderDetail && (
        <Modal
          isOpen={!!selectedOrderDetail}
          onClose={() => setSelectedOrderDetail(null)}
          title={`Order #${selectedOrderDetail.order_number} Details`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-black text-sm text-slate-900 dark:text-white block">
                  {selectedOrderDetail.order_type} {selectedOrderDetail.table_number ? `• Table ${selectedOrderDetail.table_number}` : ''}
                </span>
                <span className="text-[11px] text-slate-500">
                  {new Date(selectedOrderDetail.created_at).toLocaleString()}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200">
                {selectedOrderDetail.status}
              </span>
            </div>

            {selectedOrderDetail.customer_name && (
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1 text-[11px]">
                <p><strong>Customer:</strong> {selectedOrderDetail.customer_name} ({selectedOrderDetail.customer_phone || ''})</p>
                {selectedOrderDetail.delivery_address && <p><strong>Address:</strong> {selectedOrderDetail.delivery_address}</p>}
                {selectedOrderDetail.rider_name && <p><strong>Rider:</strong> {selectedOrderDetail.rider_name} ({selectedOrderDetail.rider_phone || ''})</p>}
              </div>
            )}

            <div>
              <h5 className="font-bold mb-1.5">Order Line Items:</h5>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
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

            <div className="flex justify-between items-center pt-2 font-bold text-sm">
              <span>Total Paid:</span>
              <span className="font-mono text-emerald-600">{currencySymbol} {Number(selectedOrderDetail.grand_total).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL: DAYBOOK PURCHASE DETAILS */}
      {/* ======================================================== */}
      {selectedDaybookPurchase && (
        <Modal
          isOpen={!!selectedDaybookPurchase}
          onClose={() => setSelectedDaybookPurchase(null)}
          title="Inward Purchase Invoice Details"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoice #</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedDaybookPurchase.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedDaybookPurchase.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Branch</span>
                <span className="text-slate-700 dark:text-slate-300">{selectedDaybookPurchase.branchName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Received By</span>
                <span className="text-slate-700 dark:text-slate-300">{selectedDaybookPurchase.receivedByName || 'Inventory Manager'}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Total Purchase Amount:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{currencySymbol} {Number(selectedDaybookPurchase.totalAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600 dark:text-slate-400">Paid Amount:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{currencySymbol} {Number(selectedDaybookPurchase.paidAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600 dark:text-slate-400">Outstanding Balance:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{currencySymbol} {Number(selectedDaybookPurchase.balancePayable).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadDaybookPurchase(selectedDaybookPurchase)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download A4 PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintDaybookPurchase(selectedDaybookPurchase)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-black text-white font-bold rounded-lg text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4 Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDaybookPurchase(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL: DAYBOOK EXPENSE DETAILS */}
      {/* ======================================================== */}
      {selectedDaybookExpense && (
        <Modal
          isOpen={!!selectedDaybookExpense}
          onClose={() => setSelectedDaybookExpense(null)}
          title="Operational Expense Particulars"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Category</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{selectedDaybookExpense.categoryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Description</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedDaybookExpense.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Branch</span>
                <span className="text-slate-700 dark:text-slate-300">{selectedDaybookExpense.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Payment Method</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedDaybookExpense.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Recorded By</span>
                <span className="text-slate-700 dark:text-slate-300">{selectedDaybookExpense.recordedByName || 'Staff'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Time</span>
                <span className="text-slate-600 dark:text-slate-400">{new Date(selectedDaybookExpense.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-bold text-sm">
                <span>Amount Paid:</span>
                <span className="font-mono text-rose-600 dark:text-rose-400">{currencySymbol} {Number(selectedDaybookExpense.amount).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadDaybookExpense(selectedDaybookExpense)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download A4 PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintDaybookExpense(selectedDaybookExpense)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-black text-white font-bold rounded-lg text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4 Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDaybookExpense(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL: DAYBOOK SHIFT DETAILS */}
      {/* ======================================================== */}
      {selectedDaybookShift && (
        <Modal
          isOpen={!!selectedDaybookShift}
          onClose={() => setSelectedDaybookShift(null)}
          title="Cashier Shift Reconciliation"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cashier</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedDaybookShift.cashierName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Branch</span>
                <span className="text-slate-700 dark:text-slate-300">{selectedDaybookShift.branchName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Opened</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono">{new Date(selectedDaybookShift.openedAt).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Closed</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono">{selectedDaybookShift.closedAt ? new Date(selectedDaybookShift.closedAt).toLocaleTimeString() : 'In Progress'}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Opening Cash Float:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{currencySymbol} {Number(selectedDaybookShift.openingCash).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600 dark:text-slate-400">+ Cash Sales Revenue:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{currencySymbol} {Number(selectedDaybookShift.cashSales).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600 dark:text-slate-400">Expected Drawer Cash:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{currencySymbol} {Number(selectedDaybookShift.expectedCash).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600 dark:text-slate-400">Actual Counted Cash:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedDaybookShift.actualCash !== null ? `${currencySymbol} ${Number(selectedDaybookShift.actualCash).toLocaleString()}` : '—'}</span>
              </div>
              <div className="flex justify-between pt-2 font-bold">
                <span>Cash Variance:</span>
                <span className={selectedDaybookShift.variance === 0 ? 'text-emerald-600' : selectedDaybookShift.variance > 0 ? 'text-blue-600' : 'text-rose-600'}>
                  {selectedDaybookShift.variance !== null ? `${selectedDaybookShift.variance > 0 ? '+' : ''}${currencySymbol} ${Number(selectedDaybookShift.variance).toLocaleString()}` : '—'}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadDaybookShift(selectedDaybookShift)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download A4 PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintDaybookShift(selectedDaybookShift)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-black text-white font-bold rounded-lg text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4 Z-Report</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDaybookShift(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
