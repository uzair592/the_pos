import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { formatPKR } from '../../utils/formatPKR.js';
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
  ChevronDown,
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
  const { success, error } = useToast();

  // Filters State
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => currentBranchId || '');
  const [activeTab, setActiveTab] = useState<
    'all' | 'sales' | 'purchases' | 'ingredients' | 'expenses' | 'wastage' | 'shifts'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Reset horizontal scroll when switching tabs
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  }, [activeTab]);

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
  const [selectedDaybookWastage, setSelectedDaybookWastage] = useState<any | null>(null);

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Download PDF
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

  // Thermal Summary Print (80mm)
  const handleThermalSummaryPrint = () => {
    if (!daybook) return;
    const branchName = branches.find((b) => b.id === selectedBranchId)?.name || 'Main Branch';
    const thermalWindow = window.open('', '_blank', 'width=380,height=600');
    if (thermalWindow) {
      thermalWindow.document.write(`
        <html>
          <head>
            <title>Daybook Summary 80mm</title>
            <style>
              body { font-family: monospace; font-size: 12px; width: 280px; padding: 10px; margin: 0; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .line { border-top: 1px dashed #000; margin: 6px 0; }
              .row { display: flex; justify-content: space-between; margin: 3px 0; }
            </style>
          </head>
          <body>
            <div class="center bold">${tenant?.name || 'Restaurant POS'}</div>
            <div class="center">${branchName}</div>
            <div class="center">DAILY DAYBOOK & Z-REPORT</div>
            <div class="center">${selectedDate}</div>
            <div class="line"></div>
            <div class="row"><span>Net Sales:</span><span class="bold">${formatPKR(summary.totalNetSales || 0)}</span></div>
            <div class="row"><span>Purchases:</span><span>${formatPKR(summary.totalPurchasesAmount || 0)}</span></div>
            <div class="row"><span>Raw Ingredients:</span><span>${formatPKR(summary.totalIngredientsCost || 0)}</span></div>
            <div class="row"><span>Wastage Loss:</span><span>${formatPKR(summary.totalWastageCost || 0)}</span></div>
            <div class="row"><span>Daily Expenses:</span><span>${formatPKR(summary.totalExpensesAmount || 0)}</span></div>
            <div class="line"></div>
            <div class="row bold"><span>Expected Drawer:</span><span>${formatPKR(summary.netOperatingCashPosition || 0)}</span></div>
            <div class="row bold"><span>Net Day Profit:</span><span>${formatPKR(summary.netDailyProfit || 0)}</span></div>
            <div class="line"></div>
            <div class="center">Generated: ${new Date().toLocaleTimeString()}</div>
          </body>
        </html>
      `);
      thermalWindow.document.close();
      thermalWindow.focus();
      thermalWindow.print();
      thermalWindow.close();
    }
  };

  // Open Full Order Details
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

  const displayDateLabel = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (_) {
      return selectedDate;
    }
  }, [selectedDate]);

  // Synthesis of Unified All Transactions Ledger
  const allTransactions = useMemo(() => {
    if (!daybook) return [];
    const list: any[] = [];

    // 1. Sales
    (daybook.salesOrders || []).forEach((s: any) => {
      const isCash = !s.paymentMethods || s.paymentMethods.toUpperCase().includes('CASH');
      list.push({
        id: `sale-${s.id}`,
        time: s.createdAt,
        ref: `#${s.orderNumber}`,
        type: 'SALE',
        particulars: `${s.orderType}${s.tableNumber ? ` • Table ${s.tableNumber}` : ''} • ${s.itemsCount || 1} items (${s.cashierName || 'Cashier'})`,
        modeOrLot: s.paymentMethods || 'CASH',
        cashIn: isCash ? Number(s.grandTotal || 0) : 0,
        cashOut: 0,
        inventoryImpact: 0,
        raw: s,
      });
    });

    // 2. Purchases
    (daybook.purchases || []).forEach((p: any) => {
      list.push({
        id: `purchase-${p.id}`,
        time: p.createdAt,
        ref: p.invoiceNumber || `BILL-${p.id.substring(0, 6).toUpperCase()}`,
        type: 'PURCHASE',
        particulars: `${p.supplierName} (${p.itemsCount || 0} items)`,
        modeOrLot: p.status || 'RECEIVED',
        cashIn: 0,
        cashOut: Number(p.paidAmount || 0),
        inventoryImpact: Number(p.totalAmount || 0),
        raw: p,
      });
    });

    // 3. Expenses
    (daybook.expenses || []).forEach((e: any) => {
      list.push({
        id: `expense-${e.id}`,
        time: e.createdAt,
        ref: `EXP-${e.id.substring(0, 6).toUpperCase()}`,
        type: 'EXPENSE',
        particulars: `${e.categoryName} - ${e.description}`,
        modeOrLot: e.paymentMethod || 'CASH',
        cashIn: 0,
        cashOut: Number(e.amount || 0),
        inventoryImpact: 0,
        raw: e,
      });
    });

    // 4. Wastage
    (daybook.wastageRecords || []).forEach((w: any) => {
      list.push({
        id: `wastage-${w.id}`,
        time: w.createdAt,
        ref: `WST-${w.id.substring(0, 6).toUpperCase()}`,
        type: 'WASTAGE',
        particulars: `${w.ingredientName} (${w.quantity} ${w.unit}) - ${w.reason}`,
        modeOrLot: `@ ${formatPKR(w.unitCost)}/${w.unit}`,
        cashIn: 0,
        cashOut: 0,
        inventoryImpact: Number(w.totalCost || 0),
        raw: w,
      });
    });

    // 5. Shifts
    (daybook.shifts || []).forEach((sh: any) => {
      list.push({
        id: `shift-${sh.id}`,
        time: sh.openedAt,
        ref: `SH-${sh.id.substring(0, 6).toUpperCase()}`,
        type: 'SHIFT',
        particulars: `Register Shift: ${sh.cashierName} (${sh.status})`,
        modeOrLot: `Opening: ${formatPKR(sh.openingCash || 0)}`,
        cashIn: Number(sh.openingCash || 0),
        cashOut: 0,
        inventoryImpact: 0,
        raw: sh,
      });
    });

    // Sort descending by timestamp
    list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return list;
  }, [daybook]);

  // Filter Transactions by Search Query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return allTransactions;
    const q = searchQuery.toLowerCase();
    return allTransactions.filter(
      (tx) =>
        tx.ref.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        tx.particulars.toLowerCase().includes(q) ||
        tx.modeOrLot.toLowerCase().includes(q)
    );
  }, [allTransactions, searchQuery]);

  // Totals for All Transactions Table Footer
  const totalCashIn = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + (tx.cashIn || 0), 0);
  }, [filteredTransactions]);

  const totalCashOut = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + (tx.cashOut || 0), 0);
  }, [filteredTransactions]);

  const totalNonCashLoss = useMemo(() => {
    return (daybook?.summary?.totalIngredientsCost || 0) + (daybook?.summary?.totalWastageCost || 0);
  }, [daybook]);

  const cogsPercent = summary.totalNetSales
    ? Math.round((Number(summary.totalIngredientsCost || 0) / Number(summary.totalNetSales)) * 100)
    : 0;

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden bg-slate-100/70 select-none font-sans">
      {/* ======================================================== */}
      {/* ZONE 1: COMPACT SINGLE-ROW HEADER & DATE BAR (h-12)      */}
      {/* ======================================================== */}
      <header className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-20">
        {/* Left: Title + Badge + Stepper */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center space-x-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-black text-slate-900 whitespace-nowrap">
              Daily Daybook
            </h1>
          </div>

          {isToday && (
            <span className="shrink-0 flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Today</span>
            </span>
          )}

          {/* Date Picker & Navigators */}
          <div className="flex items-center space-x-1 bg-slate-100 rounded-md p-0.5 border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => handleJumpDay(-1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="relative flex items-center px-1.5 cursor-pointer">
              <Calendar className="w-3.5 h-3.5 text-brand-500 mr-1.5 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {displayDateLabel}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                title="Select Date"
              />
            </div>
            <button
              type="button"
              onClick={() => handleJumpDay(1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={handleJumpToday}
                className="px-2 py-0.5 text-[11px] font-bold bg-white text-brand-600 rounded shadow-xs hover:bg-slate-50 transition-colors ml-1"
              >
                Today
              </button>
            )}
          </div>

          {/* Branch indicator */}
          {daybook?.branchName && (
            <span className="hidden 2xl:inline-block text-[11px] text-slate-500 font-medium truncate max-w-[120px]">
              • {daybook.branchName}
            </span>
          )}
        </div>

        {/* Right: Actions Cluster in Single Non-Wrapping Row */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Record Expense</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWastageModalOpen(true)}
            className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>+ Log Wastage</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>View Z-Report</span>
          </button>

          {/* Export / Print Dropdown */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Export / Print</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleDownloadPdf();
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-brand-600" />
                  <span>Download A4 PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsPrintModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>Print A4 Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleThermalSummaryPrint();
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <Receipt className="w-3.5 h-3.5 text-amber-600" />
                  <span>Thermal 80mm Summary</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchDaybook(true)}
            disabled={isRefreshing}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors border border-slate-300 shrink-0"
            title="Refresh Daybook"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* ZONE 2: HIGH-DENSITY 6-COLUMN FINANCIAL RIBBON           */}
      {/* ======================================================== */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 grid grid-cols-6 gap-2.5 shrink-0 z-10">
        {/* 1. Net Sales */}
        <div className="p-2 rounded-lg border border-slate-200 bg-white border-l-4 border-l-emerald-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
            <span>Net Sales</span>
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-slate-900 whitespace-nowrap">
            {formatPKR(summary.totalNetSales || 0)}
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            Gross: {formatPKR(summary.totalGrossSales || 0)} • {daybook?.salesOrders?.length || 0} orders
          </div>
        </div>

        {/* 2. Purchases */}
        <div className="p-2 rounded-lg border border-slate-200 bg-white border-l-4 border-l-blue-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
            <span>Purchases</span>
            <Truck className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-blue-700 whitespace-nowrap">
            {formatPKR(summary.totalPurchasesAmount || 0)}
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            Paid: {formatPKR(summary.totalPurchasesPaid || 0)} • {daybook?.purchases?.length || 0} bills
          </div>
        </div>

        {/* 3. COGS (Ingredients) */}
        <div className="p-2 rounded-lg border border-slate-200 bg-white border-l-4 border-l-violet-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
            <span>COGS (Ingredients)</span>
            <ChefHat className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-violet-700 whitespace-nowrap">
            {formatPKR(summary.totalIngredientsCost || 0)}
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            Food Cost: {cogsPercent}% • {daybook?.ingredientConsumptions?.length || 0} items
          </div>
        </div>

        {/* 4. Wastage Loss */}
        <div
          onClick={() => setActiveTab('wastage')}
          className="p-2 rounded-lg border border-slate-200 bg-white border-l-4 border-l-amber-500 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-amber-50/50 transition-colors"
          title="Click to view wastage records"
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
            <span className="text-amber-800">Wastage Loss</span>
            <Trash2 className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-amber-700 whitespace-nowrap">
            {formatPKR(summary.totalWastageCost || 0)}
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {Number(summary.totalWastageQuantity || 0).toFixed(1)} units • {daybook?.wastageRecords?.length || 0} records
          </div>
        </div>

        {/* 5. Daily Expenses */}
        <div className="p-2 rounded-lg border border-slate-200 bg-white border-l-4 border-l-rose-500 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
            <span>Daily Expenses</span>
            <Receipt className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-rose-700 whitespace-nowrap">
            {formatPKR(summary.totalExpensesAmount || 0)}
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            Cash: {formatPKR(summary.totalCashExpenses || 0)} • {daybook?.expenses?.length || 0} entries
          </div>
        </div>

        {/* 6. Net Day Profit */}
        <div className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-white border-l-4 border-l-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            <span>Net Day Profit</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div
            className={`text-sm font-black font-mono tabular-nums whitespace-nowrap ${
              Number(summary.netDailyProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatPKR(summary.netDailyProfit || 0)}
          </div>
          <div className="text-[10px] text-slate-300 truncate mt-0.5">
            Drawer: {formatPKR(summary.netOperatingCashPosition || 0)} • {summary.grossMarginPercent || 0}% gross
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ZONE 3: MASTER SPLIT WORKSPACE (Locked 100vh Layout)      */}
      {/* ======================================================== */}
      <div className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* ------------------------------------------------------ */}
        {/* LEFT COLUMN: Cash Drawer & Operating Statement (col 4) */}
        {/* ------------------------------------------------------ */}
        <div className="col-span-4 flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs overflow-y-auto min-h-0 text-xs">
          {/* Header */}
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
              <Scale className="w-3.5 h-3.5 text-brand-600" />
              <span>Daily Operating & Drawer Statement</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
              Balanced
            </span>
          </div>

          {/* Section A: Physical Cash Drawer Reconciliation */}
          <div className="bg-emerald-50/50 p-3 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-emerald-900 font-bold">
              <span className="flex items-center space-x-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. Physical Cash Drawer Reconciliation</span>
              </span>
            </div>
            <div className="space-y-1 text-slate-700 text-[11px] pt-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Opening Register Cash:</span>
                <span className="font-mono font-semibold whitespace-nowrap tabular-nums text-right">
                  {formatPKR(summary.openingRegisterCash || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">(+) Cash Sales Collected:</span>
                <span className="font-mono font-bold text-emerald-700 whitespace-nowrap tabular-nums text-right">
                  {formatPKR(summary.cashSalesCollected || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">(-) Cash Expenses & Supplier Payouts:</span>
                <span className="font-mono font-semibold text-rose-700 whitespace-nowrap tabular-nums text-right">
                  {formatPKR((Number(summary.totalCashExpenses || 0) + Number(summary.totalPurchasesPaid || 0)))}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-emerald-200/80 flex justify-between items-center">
              <span className="font-black text-emerald-900 text-[11px] uppercase tracking-wide">
                = Expected Cash in Drawer
              </span>
              <span className="font-mono font-black text-sm text-emerald-900 whitespace-nowrap tabular-nums text-right">
                {formatPKR(summary.netOperatingCashPosition || 0)}
              </span>
            </div>
            <p className="text-[10px] text-emerald-700 leading-tight">
              Physical currency expected in cashier registers at day close.
            </p>
          </div>

          {/* Section B: Digital & Bank Collections */}
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-slate-900 font-bold">
              <span className="flex items-center space-x-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>2. Digital & Bank Collections</span>
              </span>
            </div>
            <div className="space-y-1 text-slate-700 text-[11px] pt-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Card / POS / Online Transfers:</span>
                <span className="font-mono font-semibold whitespace-nowrap tabular-nums text-right">
                  {formatPKR(summary.nonCashSalesCollected || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Taxes & Delivery Fees:</span>
                <span className="font-mono font-semibold whitespace-nowrap tabular-nums text-right">
                  {formatPKR((Number(summary.totalTaxAmount || 0) + Number(summary.totalDeliveryFees || 0)))}
                </span>
              </div>
            </div>
          </div>

          {/* Section C: Inventory & Accrual P&L Impact */}
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-slate-900 font-bold">
              <span className="flex items-center space-x-1.5">
                <Scale className="w-3.5 h-3.5 text-violet-600" />
                <span>3. Inventory & Accrual P&L Impact</span>
              </span>
            </div>
            <div className="space-y-1 text-slate-700 text-[11px] pt-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">(-) Raw Ingredients Consumed (FIFO COGS):</span>
                <span className="font-mono font-semibold text-violet-700 whitespace-nowrap tabular-nums text-right">
                  {formatPKR(summary.totalIngredientsCost || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">(-) Wastage & Spoilage Loss (Non-Cash):</span>
                <span className="font-mono font-bold text-amber-700 whitespace-nowrap tabular-nums text-right">
                  {formatPKR(summary.totalWastageCost || 0)}
                </span>
              </div>
            </div>

            {/* Explanatory non-cash callout */}
            <div className="bg-amber-50 border border-amber-200 rounded p-1.5 text-[10px] text-amber-800 flex items-start gap-1.5 leading-snug">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Non-Cash Asset Loss:</strong> Wastage is an inventory asset write-off. It reduces net operating profit without reducing physical drawer cash.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="font-black text-slate-900 text-[11px] uppercase tracking-wide">
                = Net Day Profit / Loss:
              </span>
              <span
                className={`font-mono font-black text-sm whitespace-nowrap tabular-nums text-right ${
                  Number(summary.netDailyProfit || 0) < 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {formatPKR(summary.netDailyProfit || 0)}
              </span>
            </div>
          </div>

          {/* Section D: Compact Payment Mode & Order Status Pills */}
          <div className="p-3 space-y-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Daily Sales Channels & Status Summary
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Completed Orders</span>
                <span className="text-sm font-black text-emerald-600">{summary.completedOrdersCount || 0}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">In-Flight / Active</span>
                <span className="text-sm font-black text-amber-600">{summary.inFlightOrdersCount || 0}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Cancelled Orders</span>
                <span className="text-sm font-black text-rose-600">{summary.cancelledOrdersCount || 0}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Refunded Total</span>
                <span className="text-sm font-mono font-black text-slate-700 whitespace-nowrap tabular-nums">
                  {formatPKR(summary.refundedAmount || 0)}
                </span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Cash: <strong className="text-slate-900">{formatPKR(summary.cashSalesCollected || 0)}</strong></span>
              <span>Digital: <strong className="text-slate-900">{formatPKR(summary.nonCashSalesCollected || 0)}</strong></span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------ */}
        {/* RIGHT COLUMN: Unified Vyapar Transaction Ledger (col 8)*/}
        {/* ------------------------------------------------------ */}
        <div className="col-span-8 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden min-h-0">
          {/* Top Filter & Segmented Tabs Bar */}
          <div className="h-10 bg-slate-50 border-b border-slate-200 px-3 flex items-center justify-between gap-2 shrink-0">
            {/* Tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto min-w-0 py-0.5">
              {[
                { id: 'all', label: 'All', count: allTransactions.length },
                { id: 'sales', label: 'Sales', count: daybook?.salesOrders?.length || 0 },
                { id: 'purchases', label: 'Purchases', count: daybook?.purchases?.length || 0 },
                { id: 'ingredients', label: 'COGS', count: daybook?.ingredientConsumptions?.length || 0 },
                { id: 'expenses', label: 'Expenses', count: daybook?.expenses?.length || 0 },
                { id: 'wastage', label: 'Wastage', count: daybook?.wastageRecords?.length || 0 },
                { id: 'shifts', label: 'Shifts', count: daybook?.shifts?.length || 0 },
              ].map((t) => {
                const isActive = activeTab === t.id;
                const isWastageActive = t.id === 'wastage' && t.count > 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                        : isWastageActive
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span
                      className={`px-1 py-0.2 rounded-full text-[10px] font-mono ${
                        isWastageActive
                          ? 'bg-amber-500 text-white font-bold'
                          : isActive
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative shrink-0 w-44">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-5 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Table Container (flex-1 overflow-auto) */}
          <div ref={tableContainerRef} className="flex-1 overflow-auto min-h-0 bg-white">
            {/* ================================================== */}
            {/* TAB: ALL TRANSACTIONS (DEFAULT CHRONOLOGICAL FEED)  */}
            {/* ================================================== */}
            {activeTab === 'all' && (
              <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-2 py-1.5 w-16">Time</th>
                    <th className="px-2 py-1.5 w-24">Ref / #</th>
                    <th className="px-2 py-1.5 w-20">Type</th>
                    <th className="px-2 py-1.5">Particulars / Description</th>
                    <th className="px-2 py-1.5 w-24">Mode / Lot</th>
                    <th className="px-2 py-1.5 w-20 text-right">Cash In (+)</th>
                    <th className="px-2 py-1.5 w-20 text-right">Cash Out (-)</th>
                    <th className="px-2 py-1.5 w-24 text-right">Inv / P&L</th>
                    <th className="px-2 py-1.5 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        No transactions recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const timeStr = new Date(tx.time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <tr
                          key={tx.id}
                          className="h-8 hover:bg-amber-50/50 transition-colors divide-x divide-slate-100 text-slate-800 text-[11px]"
                        >
                          <td className="px-2 py-1 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {timeStr}
                          </td>
                          <td className="px-2 py-1 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {tx.ref}
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider inline-block ${
                                tx.type === 'SALE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : tx.type === 'PURCHASE'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : tx.type === 'EXPENSE'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : tx.type === 'WASTAGE'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-2 py-1 truncate max-w-[200px]" title={tx.particulars}>
                            {tx.particulars}
                          </td>
                          <td className="px-2 py-1 font-mono text-[10px] text-slate-600 truncate max-w-[110px]" title={tx.modeOrLot}>
                            {tx.modeOrLot}
                          </td>
                          <td className="px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap text-emerald-700 font-bold">
                            {tx.cashIn > 0 ? formatPKR(tx.cashIn) : '—'}
                          </td>
                          <td className="px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap text-rose-700 font-bold">
                            {tx.cashOut > 0 ? formatPKR(tx.cashOut) : '—'}
                          </td>
                          <td className="px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap text-amber-700 font-bold">
                            {tx.inventoryImpact > 0 ? formatPKR(tx.inventoryImpact) : '—'}
                          </td>
                          <td className="px-1.5 py-1 text-center whitespace-nowrap">
                            {tx.type === 'WASTAGE' ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDaybookWastage(tx.raw)}
                                className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold transition-colors"
                              >
                                Inspect
                              </button>
                            ) : tx.type === 'SALE' ? (
                              <button
                                type="button"
                                onClick={() => handleViewOrderDetail(tx.raw.id)}
                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-semibold transition-colors"
                              >
                                Inspect
                              </button>
                            ) : tx.type === 'PURCHASE' ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDaybookPurchase(tx.raw)}
                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold transition-colors"
                              >
                                Inspect
                              </button>
                            ) : tx.type === 'EXPENSE' ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDaybookExpense(tx.raw)}
                                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold transition-colors"
                              >
                                Inspect
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedDaybookShift(tx.raw)}
                                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold transition-colors"
                              >
                                Inspect
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-100 font-bold text-xs border-t-2 border-slate-300 z-10 divide-x divide-slate-200">
                  <tr>
                    <td colSpan={5} className="px-2 py-1.5 text-right uppercase text-[10px] text-slate-700">
                      TOTALS
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-emerald-800 whitespace-nowrap text-[11px]">
                      {formatPKR(totalCashIn)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-rose-800 whitespace-nowrap text-[11px]">
                      {formatPKR(totalCashOut)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-amber-800 whitespace-nowrap text-[11px]">
                      {formatPKR(totalNonCashLoss)}
                    </td>
                    <td className="px-2 py-1.5"></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ================================================== */}
            {/* TAB: SALES ORDERS                                  */}
            {/* ================================================== */}
            {activeTab === 'sales' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-3 py-2">Order #</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Channel / Customer</th>
                    <th className="px-3 py-2 text-center">Items</th>
                    <th className="px-3 py-2">Cashier</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Grand Total</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!daybook?.salesOrders || daybook.salesOrders.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        No sales orders found for this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.salesOrders.map((ord: any) => {
                      const time = new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={ord.id} className="h-9 hover:bg-slate-50 transition-colors divide-x divide-slate-100">
                          <td className="px-3 py-1 font-mono font-bold text-slate-900 whitespace-nowrap">
                            #{ord.orderNumber}
                          </td>
                          <td className="px-3 py-1 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                            {time}
                          </td>
                          <td className="px-3 py-1 truncate max-w-[180px]">
                            <span className="font-semibold text-slate-900 block truncate">
                              {ord.orderType} {ord.tableNumber ? `• Table ${ord.tableNumber}` : ''}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {ord.customerName ? `${ord.customerName} (${ord.customerPhone || ''})` : 'Walk-in Guest'}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-center font-bold">
                            {ord.itemsCount}
                          </td>
                          <td className="px-3 py-1 text-slate-600 truncate max-w-[120px]">
                            {ord.cashierName || 'Cashier'}
                          </td>
                          <td className="px-3 py-1">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {ord.paymentMethods || 'Cash'}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ord.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : ord.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {ord.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-right font-black font-mono tabular-nums whitespace-nowrap text-slate-900">
                            {formatPKR(ord.grandTotal)}
                          </td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
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
            )}

            {/* ================================================== */}
            {/* TAB: PURCHASES DONE                                */}
            {/* ================================================== */}
            {activeTab === 'purchases' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-3 py-2">Inward Date</th>
                    <th className="px-3 py-2">Invoice #</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2 text-center">Items</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Total Amount</th>
                    <th className="px-3 py-2 text-right">Paid Amount</th>
                    <th className="px-3 py-2 text-right">Balance Due</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!daybook?.purchases || daybook.purchases.length === 0) ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        No inward purchases logged for this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.purchases.map((p: any) => {
                      const time = new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={p.id} className="h-9 hover:bg-slate-50 transition-colors divide-x divide-slate-100">
                          <td className="px-3 py-1 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {time}
                          </td>
                          <td className="px-3 py-1 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {p.invoiceNumber}
                          </td>
                          <td className="px-3 py-1 font-semibold text-slate-900 truncate max-w-[150px]">
                            {p.supplierName}
                          </td>
                          <td className="px-3 py-1 text-slate-500 truncate max-w-[100px]">
                            {p.branchName}
                          </td>
                          <td className="px-3 py-1 text-center font-bold">
                            {p.itemsCount}
                          </td>
                          <td className="px-3 py-1 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.status === 'RECEIVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-right font-black font-mono tabular-nums whitespace-nowrap text-slate-900">
                            {formatPKR(p.totalAmount)}
                          </td>
                          <td className="px-3 py-1 text-right font-mono tabular-nums whitespace-nowrap text-emerald-700 font-bold">
                            {formatPKR(p.paidAmount)}
                          </td>
                          <td className="px-3 py-1 text-right font-mono tabular-nums whitespace-nowrap text-rose-700 font-bold">
                            {formatPKR(p.balancePayable)}
                          </td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
                            <ActionMenu
                              items={[
                                {
                                  label: 'View Voucher',
                                  icon: Eye,
                                  onClick: () => setSelectedDaybookPurchase(p),
                                },
                                {
                                  label: 'Download PDF',
                                  icon: Download,
                                  onClick: () => handleDownloadDaybookPurchase(p),
                                },
                                {
                                  label: 'Print Voucher',
                                  icon: Printer,
                                  onClick: () => handlePrintDaybookPurchase(p),
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
            )}

            {/* ================================================== */}
            {/* TAB: INGREDIENTS CONSUMED (FIFO COGS)              */}
            {/* ================================================== */}
            {activeTab === 'ingredients' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-3 py-2">Ingredient</th>
                    <th className="px-3 py-2 text-center">Unit</th>
                    <th className="px-3 py-2 text-center">Orders</th>
                    <th className="px-3 py-2 text-center">Quantity Consumed</th>
                    <th className="px-3 py-2 text-right">Est. FIFO Cost</th>
                    <th className="px-3 py-2 text-right">Total COGS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!daybook?.ingredientConsumptions || daybook.ingredientConsumptions.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        No recipe-linked ingredient consumptions computed for this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.ingredientConsumptions.map((c: any) => {
                      const avgUnitCost = c.totalQuantityUsed > 0 ? c.totalFifoCost / c.totalQuantityUsed : 0;
                      return (
                        <tr key={c.ingredientId} className="h-9 hover:bg-slate-50 transition-colors divide-x divide-slate-100">
                          <td className="px-3 py-1 font-bold text-slate-900 flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-violet-500" />
                            <span>{c.ingredientName}</span>
                          </td>
                          <td className="px-3 py-1 text-center text-slate-500 font-mono text-[11px]">
                            {c.unit}
                          </td>
                          <td className="px-3 py-1 text-center font-bold text-violet-700">
                            {c.ordersCount} orders
                          </td>
                          <td className="px-3 py-1 text-center font-bold text-slate-900 font-mono">
                            {Number(c.totalQuantityUsed).toFixed(2)} {c.unit}
                          </td>
                          <td className="px-3 py-1 text-right text-slate-500 font-mono tabular-nums whitespace-nowrap">
                            {formatPKR(avgUnitCost)} / {c.unit}
                          </td>
                          <td className="px-3 py-1 text-right font-black font-mono tabular-nums whitespace-nowrap text-violet-700">
                            {formatPKR(c.totalFifoCost)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* ================================================== */}
            {/* TAB: EXPENSES LOGGED                               */}
            {/* ================================================== */}
            {activeTab === 'expenses' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Voucher #</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Description / Voucher</th>
                    <th className="px-3 py-2">Paid Via</th>
                    <th className="px-3 py-2">Recorded By</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!daybook?.expenses || daybook.expenses.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        No operational expenses recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.expenses.map((e: any) => {
                      const time = new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={e.id} className="h-9 hover:bg-slate-50 transition-colors divide-x divide-slate-100">
                          <td className="px-3 py-1 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {time}
                          </td>
                          <td className="px-3 py-1 font-mono font-bold text-slate-800 whitespace-nowrap">
                            EXP-{e.id.substring(0, 6).toUpperCase()}
                          </td>
                          <td className="px-3 py-1 font-bold text-rose-700 whitespace-nowrap">
                            {e.categoryName}
                          </td>
                          <td className="px-3 py-1 text-slate-700 truncate max-w-[200px]" title={e.description}>
                            {e.description}
                          </td>
                          <td className="px-3 py-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {e.paymentMethod}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-slate-500 text-[11px] truncate max-w-[120px]">
                            {e.recordedByName || 'Staff'}
                          </td>
                          <td className="px-3 py-1 text-right font-black font-mono tabular-nums whitespace-nowrap text-rose-700">
                            {formatPKR(e.amount)}
                          </td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
                            <ActionMenu
                              items={[
                                {
                                  label: 'View Voucher',
                                  icon: Eye,
                                  onClick: () => setSelectedDaybookExpense(e),
                                },
                                {
                                  label: 'Download PDF',
                                  icon: Download,
                                  onClick: () => handleDownloadDaybookExpense(e),
                                },
                                {
                                  label: 'Print Voucher',
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
            )}

            {/* ================================================== */}
            {/* TAB: WASTAGE RECORDED (Rs. 14,000 Immediately Here) */}
            {/* ================================================== */}
            {activeTab === 'wastage' && (
              <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-2 py-1.5 w-16">Time</th>
                    <th className="px-2 py-1.5 w-24">Ref #</th>
                    <th className="px-2 py-1.5">Ingredient</th>
                    <th className="px-2 py-1.5 text-center w-14">Unit</th>
                    <th className="px-2 py-1.5 text-center w-20">Wasted Qty</th>
                    <th className="px-2 py-1.5 text-right w-24">FIFO Unit Cost</th>
                    <th className="px-2 py-1.5 text-right w-28">Total Loss Value</th>
                    <th className="px-2 py-1.5">Reason</th>
                    <th className="px-2 py-1.5 w-24">Logged By</th>
                    <th className="px-2 py-1.5 text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!daybook?.wastageRecords || daybook.wastageRecords.length === 0) ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        No food wastage or kitchen spoilage recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.wastageRecords.map((w: any) => {
                      const time = new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={w.id} className="h-8 hover:bg-amber-50/50 transition-colors divide-x divide-slate-100 text-[11px]">
                          <td className="px-2 py-1 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {time}
                          </td>
                          <td className="px-2 py-1 font-mono font-bold text-slate-800 whitespace-nowrap">
                            WST-{w.id.substring(0, 6).toUpperCase()}
                          </td>
                          <td className="px-2 py-1 font-bold text-slate-900 whitespace-nowrap">
                            {w.ingredientName}
                          </td>
                          <td className="px-2 py-1 text-center font-mono text-slate-500 text-[10px]">
                            {w.unit}
                          </td>
                          <td className="px-2 py-1 text-center font-mono font-bold text-rose-700">
                            {Number(w.quantity).toFixed(1)} {w.unit}
                          </td>
                          <td className="px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap text-slate-600">
                            {formatPKR(w.unitCost)} / {w.unit}
                          </td>
                          <td className="px-2 py-1 text-right font-black font-mono tabular-nums whitespace-nowrap text-amber-700">
                            {formatPKR(w.totalCost)}
                          </td>
                          <td className="px-2 py-1 text-slate-600 truncate max-w-[160px]" title={w.reason}>
                            {w.reason}
                          </td>
                          <td className="px-2 py-1 text-slate-500 text-[10px] truncate max-w-[100px]">
                            {w.recordedByName || 'Staff'}
                          </td>
                          <td className="px-1.5 py-1 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedDaybookWastage(w)}
                              className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* ================================================== */}
            {/* TAB: SHIFTS & REGISTERS                            */}
            {/* ================================================== */}
            {activeTab === 'shifts' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-3 py-2">Cashier</th>
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Opened At</th>
                    <th className="px-3 py-2">Closed At</th>
                    <th className="px-3 py-2 text-right">Opening Cash</th>
                    <th className="px-3 py-2 text-right">Cash Sales</th>
                    <th className="px-3 py-2 text-right">Expected Cash</th>
                    <th className="px-3 py-2 text-right">Actual Count</th>
                    <th className="px-3 py-2 text-right">Variance</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!daybook?.shifts || daybook.shifts.length === 0) ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        No cashier register shifts opened or closed on this date.
                      </td>
                    </tr>
                  ) : (
                    daybook.shifts.map((s: any) => {
                      const openTime = new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const closeTime = s.closedAt
                        ? new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'In Progress';
                      return (
                        <tr key={s.id} className="h-9 hover:bg-slate-50 transition-colors divide-x divide-slate-100">
                          <td className="px-3 py-1 font-bold text-slate-900 whitespace-nowrap">
                            {s.cashierName}
                          </td>
                          <td className="px-3 py-1 text-slate-500 truncate max-w-[120px]">
                            {s.branchName}
                          </td>
                          <td className="px-3 py-1 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {openTime}
                          </td>
                          <td className="px-3 py-1 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {closeTime}
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                            {formatPKR(s.openingCash)}
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                            {formatPKR(s.cashSales)}
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-bold text-slate-800 whitespace-nowrap tabular-nums">
                            {formatPKR(s.expectedCash)}
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-bold text-slate-900 whitespace-nowrap tabular-nums">
                            {s.actualCash !== null ? formatPKR(s.actualCash) : '—'}
                          </td>
                          <td
                            className={`px-3 py-1 text-right font-mono font-black whitespace-nowrap tabular-nums ${
                              s.variance === null
                                ? 'text-slate-400'
                                : s.variance === 0
                                ? 'text-emerald-700'
                                : s.variance > 0
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {s.variance !== null ? `${s.variance > 0 ? '+' : ''}${formatPKR(s.variance)}` : '—'}
                          </td>
                          <td className="px-3 py-1 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.status === 'OPEN'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
                            <ActionMenu
                              items={[
                                {
                                  label: 'View Shift Particulars',
                                  icon: Eye,
                                  onClick: () => setSelectedDaybookShift(s),
                                },
                                {
                                  label: 'Download Z-Report PDF',
                                  icon: Download,
                                  onClick: () => handleDownloadDaybookShift(s),
                                },
                                {
                                  label: 'Print Shift Slip',
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
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: RECORD OPERATIONAL EXPENSE                      */}
      {/* ======================================================== */}
      {isExpenseModalOpen && (
        <Modal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          title="Record Daily Operational Expense"
          maxWidth="md"
        >
          <form onSubmit={handleSaveExpense} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Branch</label>
              <select
                value={expenseForm.branchId}
                onChange={(e) => setExpenseForm({ ...expenseForm, branchId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Expense Category *</label>
              <select
                value={expenseForm.categoryId}
                onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              >
                <option value="">Select Category...</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Amount ({currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                <select
                  value={expenseForm.paymentMethod}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value={PaymentMethod.CASH}>Cash (Drawer)</option>
                  <option value={PaymentMethod.CARD}>Card / POS</option>
                  <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                  <option value={PaymentMethod.DIGITAL_WALLET}>Digital Wallet (JazzCash/Easypaisa)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Description / Voucher Ref *</label>
              <textarea
                rows={2}
                placeholder="e.g. Daily vegetable market purchase, cleaning supplies, milk refill"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Expense Date</label>
              <input
                type="date"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingExpense}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold shadow-sm"
              >
                {isSubmittingExpense ? 'Saving...' : 'Record Expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: LOG INVENTORY WASTAGE                           */}
      {/* ======================================================== */}
      {isWastageModalOpen && (
        <Modal
          isOpen={isWastageModalOpen}
          onClose={() => setIsWastageModalOpen(false)}
          title="Log Kitchen Wastage & Spoilage"
          maxWidth="md"
        >
          <form onSubmit={handleSaveWastage} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Branch</label>
              <select
                value={wastageForm.branchId}
                onChange={(e) => setWastageForm({ ...wastageForm, branchId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Ingredient *</label>
              <select
                value={wastageForm.ingredientId}
                onChange={(e) => setWastageForm({ ...wastageForm, ingredientId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              >
                <option value="">Select Ingredient...</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Wasted Quantity *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 2.50"
                value={wastageForm.quantity}
                onChange={(e) => setWastageForm({ ...wastageForm, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Reason for Wastage *</label>
              <textarea
                rows={2}
                placeholder="e.g. Expired, spilled, burnt during preparation, power outage spoil"
                value={wastageForm.reason}
                onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsWastageModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingWastage}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold shadow-sm"
              >
                {isSubmittingWastage ? 'Logging...' : 'Log Wastage'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PRINTABLE DAYBOOK Z-REPORT STATEMENT            */}
      {/* ======================================================== */}
      {isPrintModalOpen && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Print Daily Daybook & Z-Report"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <p className="text-slate-500">
                Official Daily Operations & Financial Statement in standard A4 PDF format.
              </p>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download A4 PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A4 Statement</span>
                </button>
              </div>
            </div>

            {/* Document Paper Container */}
            <div id="printable-daybook-statement" className="p-5 bg-white text-slate-900 border border-slate-300 rounded-xl space-y-4">
              <div className="text-center pb-3 border-b border-slate-300 space-y-0.5">
                <h2 className="text-lg font-black uppercase tracking-wider">{tenant?.name || 'Restaurant Management'}</h2>
                <p className="text-xs font-bold text-slate-600">{daybook?.branchName || 'Branch'}</p>
                <p className="text-xs font-extrabold text-slate-800 uppercase">Daily Operations & Financial Daybook (Z-Report)</p>
                <p className="text-[10px] text-slate-500 font-mono">Date: {daybook?.displayDate} ({selectedDate}) • Generated: {new Date().toLocaleTimeString()}</p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Financial Summary</h4>
                <table className="w-full text-xs border border-slate-300">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 font-bold">Gross Sales</td>
                      <td className="p-1.5 text-right font-mono font-bold">{formatPKR(summary.totalGrossSales || 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 font-bold">Net Sales</td>
                      <td className="p-1.5 text-right font-mono font-bold text-emerald-700">{formatPKR(summary.totalNetSales || 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 font-bold">Raw Ingredients (COGS)</td>
                      <td className="p-1.5 text-right font-mono text-violet-700">{formatPKR(summary.totalIngredientsCost || 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 font-bold">Wastage Loss (Non-Cash)</td>
                      <td className="p-1.5 text-right font-mono text-amber-700">{formatPKR(summary.totalWastageCost || 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 font-bold">Daily Expenses</td>
                      <td className="p-1.5 text-right font-mono text-rose-700">{formatPKR(summary.totalExpensesAmount || 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-1.5 font-black">Net Operating Day Profit</td>
                      <td className={`p-1.5 text-right font-mono font-black ${Number(summary.netDailyProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatPKR(summary.netDailyProfit || 0)}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50">
                      <td className="p-1.5 font-black text-emerald-900">Expected Register Drawer Cash</td>
                      <td className="p-1.5 text-right font-mono font-black text-emerald-900">{formatPKR(summary.netOperatingCashPosition || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ORDER DETAILS BREAKDOWN                         */}
      {/* ======================================================== */}
      {selectedOrderDetail && (
        <Modal
          isOpen={!!selectedOrderDetail}
          onClose={() => setSelectedOrderDetail(null)}
          title={`Order #${selectedOrderDetail.order_number} Details`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  {selectedOrderDetail.order_type} {selectedOrderDetail.table_number ? `• Table ${selectedOrderDetail.table_number}` : ''}
                </span>
                <span className="text-[11px] text-slate-500">
                  {new Date(selectedOrderDetail.created_at).toLocaleString()}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                {selectedOrderDetail.status}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-700">Order Items</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                {selectedOrderDetail.items?.map((item: any, idx: number) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{item.item_name}</span>
                      <span className="text-slate-500 text-[11px] block">
                        Qty: {item.quantity} × {formatPKR(item.unit_price)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{formatPKR(item.total_price)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">{formatPKR(selectedOrderDetail.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-mono">{formatPKR(selectedOrderDetail.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200 text-sm">
                <span>Grand Total</span>
                <span className="font-mono">{formatPKR(selectedOrderDetail.grand_total)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: INWARD PURCHASE INVOICE DETAILS                 */}
      {/* ======================================================== */}
      {selectedDaybookPurchase && (
        <Modal
          isOpen={!!selectedDaybookPurchase}
          onClose={() => setSelectedDaybookPurchase(null)}
          title="Inward Purchase Invoice Details"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoice #</span>
                <span className="font-mono font-bold text-slate-900">{selectedDaybookPurchase.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier</span>
                <span className="font-bold text-slate-900">{selectedDaybookPurchase.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Branch</span>
                <span className="font-semibold text-slate-700">{selectedDaybookPurchase.branchName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                <span className="font-bold text-emerald-700">{selectedDaybookPurchase.status}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-mono font-bold text-slate-900">{formatPKR(selectedDaybookPurchase.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid Amount:</span>
                <span className="font-mono font-bold text-emerald-700">{formatPKR(selectedDaybookPurchase.paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance Due:</span>
                <span className="font-mono font-bold text-rose-700">{formatPKR(selectedDaybookPurchase.balancePayable)}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleDownloadDaybookPurchase(selectedDaybookPurchase)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintDaybookPurchase(selectedDaybookPurchase)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: OPERATIONAL EXPENSE PARTICULARS                 */}
      {/* ======================================================== */}
      {selectedDaybookExpense && (
        <Modal
          isOpen={!!selectedDaybookExpense}
          onClose={() => setSelectedDaybookExpense(null)}
          title="Operational Expense Particulars"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Category</span>
                <span className="font-bold text-rose-700">{selectedDaybookExpense.categoryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Description</span>
                <span className="font-semibold text-slate-900">{selectedDaybookExpense.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Amount</span>
                <span className="font-mono font-bold text-rose-700 text-sm">{formatPKR(selectedDaybookExpense.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Payment Method</span>
                <span className="font-semibold text-slate-700">{selectedDaybookExpense.paymentMethod}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleDownloadDaybookExpense(selectedDaybookExpense)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintDaybookExpense(selectedDaybookExpense)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: CASHIER SHIFT RECONCILIATION                    */}
      {/* ======================================================== */}
      {selectedDaybookShift && (
        <Modal
          isOpen={!!selectedDaybookShift}
          onClose={() => setSelectedDaybookShift(null)}
          title="Cashier Shift Reconciliation"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cashier</span>
                <span className="font-bold text-slate-900">{selectedDaybookShift.cashierName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Branch</span>
                <span className="font-semibold text-slate-700">{selectedDaybookShift.branchName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                <span className="font-bold text-emerald-700">{selectedDaybookShift.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Expected Cash</span>
                <span className="font-mono font-bold text-slate-900">{formatPKR(selectedDaybookShift.expectedCash)}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleDownloadDaybookShift(selectedDaybookShift)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintDaybookShift(selectedDaybookShift)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Z-Report</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 8: WASTAGE DETAIL INSPECT MODAL                    */}
      {/* ======================================================== */}
      {selectedDaybookWastage && (
        <Modal
          isOpen={!!selectedDaybookWastage}
          onClose={() => setSelectedDaybookWastage(null)}
          title="Wastage & Spoilage Particulars"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Non-Cash Inventory Write-Off</span>
              </div>
              <p className="text-[11px] text-amber-700">
                This record accounts for physical stock reduction (FIFO asset cost). It is deducted from operating profit but does not reduce cash register drawer balances.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ingredient</span>
                <span className="font-bold text-slate-900 text-sm">{selectedDaybookWastage.ingredientName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Quantity Wasted</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  {selectedDaybookWastage.quantity} {selectedDaybookWastage.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">FIFO Unit Cost</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatPKR(selectedDaybookWastage.unitCost)} / {selectedDaybookWastage.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Loss Value</span>
                <span className="font-mono font-black text-rose-700 text-sm">
                  {formatPKR(selectedDaybookWastage.totalCost)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Reason</span>
                <span className="font-semibold text-slate-900">{selectedDaybookWastage.reason || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Recorded By</span>
                <span className="font-semibold text-slate-900">{selectedDaybookWastage.recordedByName || 'Staff'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Branch</span>
                <span className="font-semibold text-slate-900">{selectedDaybookWastage.branchName || 'Main Branch'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Recorded At</span>
                <span className="font-mono text-slate-700">{new Date(selectedDaybookWastage.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDaybookWastage(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800"
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

export default Daybook;
