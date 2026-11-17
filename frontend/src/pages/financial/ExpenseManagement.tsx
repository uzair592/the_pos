import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Calendar,
  Download,
  Trash2,
  Edit2,
  FileText,
  DollarSign,
  Building,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  ChevronDown,
  ArrowUpRight,
  TrendingDown,
  Wallet,
  Landmark,
  Tag,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { formatPKR } from '../../utils/formatPKR.js';
import { ErpPageHeader } from '../../components/common/ErpPageHeader.js';
import { ErpMetricRibbon } from '../../components/common/ErpMetricRibbon.js';
import { StatCard } from '../../components/common/StatCard.js';
import { Permission, PaymentMethod } from '@pos/shared';
import { exportExpenseReportPdf, exportExpenseVoucherPdf } from '../../utils/pdfExport.js';

interface ExpenseItem {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name?: string;
  category_id: string;
  category_name: string;
  title?: string;
  amount: number | string;
  payment_method: string;
  bank_account_id?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  paid_to?: string | null;
  description: string;
  notes?: string | null;
  recorded_by_user_id?: string;
  recorded_by_name?: string;
  expense_date: string;
  created_at: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  current_balance: number | string;
}

interface Branch {
  id: string;
  name: string;
  is_main_branch?: boolean;
}

export const ExpenseManagement: React.FC = () => {
  const { user, tenant, hasPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const currencySymbol = tenant?.currency_symbol || 'Rs.';
  const canManage = hasPermission(Permission.EXPENSES_MANAGE);

  // Data states
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [dateRangeMode, setDateRangeMode] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);
  const [voucherToView, setVoucherToView] = useState<ExpenseItem | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [formBankAccountId, setFormBankAccountId] = useState('');
  const [formPaidTo, setFormPaidTo] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formBranchId, setFormBranchId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  // Set initial date range (This Month)
  useEffect(() => {
    applyDateFilter('month');
  }, []);

  // Keyboard shortcut: ESC closes full-screen voucher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRecordModalOpen) setIsRecordModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordModalOpen]);

  const applyDateFilter = (mode: 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom') => {
    setDateRangeMode(mode);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (mode === 'today') {
      const today = toYMD(now);
      setStartDate(today);
      setEndDate(today);
    } else if (mode === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = toYMD(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (mode === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      setStartDate(toYMD(weekStart));
      setEndDate(toYMD(now));
    } else if (mode === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(now));
    } else if (mode === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      let url = '/financial/expenses?';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedBranch !== 'ALL') params.append('branchId', selectedBranch);
      if (selectedCategory !== 'ALL') params.append('categoryId', selectedCategory);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const [expRes, catRes, bankRes, branchRes] = await Promise.all([
        api.get(url + params.toString()),
        api.get('/financial/expenses/categories'),
        api.get('/financial/bank-accounts').catch(() => ({ bankAccounts: [] })),
        api.get('/restaurant/branches').catch(() => ({ branches: [] })),
      ]);

      setExpenses(expRes.expenses || []);
      setCategories(catRes.categories || []);
      setBankAccounts(bankRes.bankAccounts || []);
      setBranches(branchRes.branches || []);

      if (catRes.categories?.length > 0 && !formCategoryId) {
        setFormCategoryId(catRes.categories[0].id);
      }
      if (branchRes.branches?.length > 0 && !formBranchId) {
        const defaultBranch = branchRes.branches.find((b: Branch) => b.is_main_branch) || branchRes.branches[0];
        setFormBranchId(defaultBranch.id);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to load expense records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedBranch, selectedCategory]);

  // Client-side search & filtering
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedPaymentMethod !== 'ALL' && e.payment_method !== selectedPaymentMethod) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (e.title || '').toLowerCase().includes(q);
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const catMatch = (e.category_name || '').toLowerCase().includes(q);
        const paidToMatch = (e.paid_to || '').toLowerCase().includes(q);
        const notesMatch = (e.notes || '').toLowerCase().includes(q);
        const recorderMatch = (e.recorded_by_name || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !catMatch && !paidToMatch && !notesMatch && !recorderMatch) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, selectedPaymentMethod, searchQuery]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let total = 0;
    let cash = 0;
    let bank = 0;

    filteredExpenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      total += amt;
      if (e.payment_method === 'CASH') {
        cash += amt;
      } else {
        bank += amt;
      }
    });

    return {
      total,
      cash,
      bank,
      count: filteredExpenses.length,
      average: filteredExpenses.length > 0 ? total / filteredExpenses.length : 0,
    };
  }, [filteredExpenses]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingExpense(null);
    setFormTitle('');
    setFormAmount('');
    setFormPaymentMethod(PaymentMethod.CASH);
    setFormBankAccountId('');
    setFormPaidTo('');
    setFormNotes('');
    setFormDate(new Date().toISOString().split('T')[0]);
    if (categories.length > 0) setFormCategoryId(categories[0].id);
    if (branches.length > 0) {
      const main = branches.find((b) => b.is_main_branch) || branches[0];
      setFormBranchId(main.id);
    }
    setIsRecordModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (expense: ExpenseItem) => {
    setEditingExpense(expense);
    setFormTitle(expense.title || expense.description || '');
    setFormAmount(String(expense.amount));
    setFormCategoryId(expense.category_id);
    setFormPaymentMethod((expense.payment_method as PaymentMethod) || PaymentMethod.CASH);
    setFormBankAccountId(expense.bank_account_id || '');
    setFormPaidTo(expense.paid_to || '');
    setFormNotes(expense.notes || expense.description || '');
    setFormDate(expense.expense_date ? expense.expense_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormBranchId(expense.branch_id);
    setIsRecordModalOpen(true);
  };

  // Submit Expense Form (Create or Edit)
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toastError('Please enter an expense title or purpose.');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      toastError('Please enter a valid expense amount greater than 0.');
      return;
    }
    if (!formCategoryId) {
      toastError('Please select an expense category.');
      return;
    }
    if ((formPaymentMethod === PaymentMethod.BANK_TRANSFER || formPaymentMethod === PaymentMethod.DIGITAL_WALLET || formPaymentMethod === PaymentMethod.CARD) && !formBankAccountId) {
      toastError('Please select a bank account for bank/card/digital payment.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        branchId: formBranchId || user?.branchId,
        categoryId: formCategoryId,
        title: formTitle.trim(),
        amount: Number(formAmount),
        paymentMethod: formPaymentMethod,
        bankAccountId: formBankAccountId || undefined,
        paidTo: formPaidTo.trim() || undefined,
        description: formNotes.trim() || formTitle.trim(),
        notes: formNotes.trim() || undefined,
        expenseDate: formDate,
      };

      if (editingExpense) {
        await api.put(`/financial/expenses/${editingExpense.id}`, payload);
        success(`Expense "${formTitle}" updated successfully.`);
      } else {
        await api.post('/financial/expenses', payload);
        success(`Expense of ${currencySymbol} ${Number(formAmount).toLocaleString()} recorded successfully.`);
      }

      setIsRecordModalOpen(false);
      fetchData();
    } catch (err: any) {
      toastError(err.message || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      await api.delete(`/financial/expenses/${expenseToDelete.id}`);
      success(`Expense deleted successfully.`);
      setExpenseToDelete(null);
      fetchData();
    } catch (err: any) {
      toastError(err.message || 'Failed to delete expense');
    }
  };

  // Add custom category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toastError('Please enter category name');
      return;
    }
    try {
      setAddingCat(true);
      const res = await api.post('/financial/expenses/categories', {
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
      });
      success(`Category "${newCatName}" added successfully.`);
      setNewCatName('');
      setNewCatDesc('');
      setCategories((prev) => [...prev, res.category].sort((a, b) => a.name.localeCompare(b.name)));
      setFormCategoryId(res.category.id);
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      toastError(err.message || 'Failed to add category');
    } finally {
      setAddingCat(false);
    }
  };

  // Export PDF Report
  const handleExportPdf = () => {
    const meta = {
      name: tenant?.name || 'Restaurant',
      branch: branches.find((b) => b.id === selectedBranch)?.name || 'All Outlets',
      currencySymbol,
    };
    const dates = {
      startDate: startDate || 'Beginning',
      endDate: endDate || 'Present',
    };
    exportExpenseReportPdf(meta, dates, filteredExpenses);
    success('Expense report downloaded as PDF.');
  };

  // Print single voucher
  const handlePrintVoucher = (item: ExpenseItem) => {
    const meta = {
      name: tenant?.name || 'Restaurant',
      branch: item.branch_name || 'Main Branch',
      currencySymbol,
    };
    exportExpenseVoucherPdf(meta, {
      ...item,
      categoryName: item.category_name,
      paidTo: item.paid_to,
      recordedByName: item.recorded_by_name,
      paymentMethod: item.payment_method,
    });
  };

  return (
    <div className="h-[calc(100vh-48px)] overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 1. Desktop High-Density Page Header (44px) */}
      <ErpPageHeader
        title="Operating Expenses (OPEX)"
        badge={`${filteredExpenses.length} Vouchers`}
        subtitle="Operational overheads, utility bills, salaries, and disbursements"
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center gap-1.5 shadow-2xs"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Categories</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={filteredExpenses.length === 0}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Expense</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Compact Vyapar-Style Metric Ribbon (44px) */}
      <ErpMetricRibbon
        metrics={[
          {
            label: 'Total Expenses',
            value: `${currencySymbol} ${stats.total.toLocaleString()}`,
            variant: 'rose',
            subtext: `${stats.count} entries`,
          },
          {
            label: 'Cash in Hand (Drawer)',
            value: `${currencySymbol} ${stats.cash.toLocaleString()}`,
            variant: 'emerald',
            subtext: 'disbursed',
          },
          {
            label: 'Bank & Online',
            value: `${currencySymbol} ${stats.bank.toLocaleString()}`,
            variant: 'indigo',
            subtext: 'transfers',
          },
          {
            label: 'Avg Entry',
            value: `${currencySymbol} ${Math.round(stats.average).toLocaleString()}`,
            variant: 'slate',
            subtext: 'per voucher',
          },
        ]}
      />

      {/* 3. Compact Filter & Search Toolbar (44px) */}
      <div className="h-11 min-h-[44px] max-h-[44px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between gap-2 shrink-0 select-none overflow-x-auto">
        {/* Left: Date Presets & Picker */}
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: '7D' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDateFilter(p.id as any)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  dateRangeMode === p.id
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800 text-[11px]">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateRangeMode('custom');
              }}
              className="px-1.5 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateRangeMode('custom');
              }}
              className="px-1.5 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
            />
          </div>
        </div>

        {/* Right: Search & Dropdowns */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search box */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search memo, payee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-6 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-1 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 max-w-[130px] truncate"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Payment Method */}
          <select
            value={selectedPaymentMethod}
            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
            className="py-1 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 max-w-[120px] truncate"
          >
            <option value="ALL">All Channels</option>
            <option value="CASH">Cash Drawer</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="ONLINE">Online / Card</option>
          </select>

          {/* Branch Dropdown */}
          {branches.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="hidden md:block py-1 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 max-w-[120px] truncate"
            >
              <option value="ALL">All Outlets</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 4. Main Expense Ledger Table (Full Viewport Height) */}
      <div className="flex-1 overflow-auto min-h-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px] z-10 shadow-2xs">
            <tr>
              <th className="px-3.5 py-2.5 whitespace-nowrap">Date</th>
              <th className="px-3.5 py-2.5">Expense Purpose & Particulars</th>
              <th className="px-3.5 py-2.5 whitespace-nowrap">Category</th>
              <th className="px-3.5 py-2.5 whitespace-nowrap">Payee / Paid To</th>
              <th className="px-3.5 py-2.5 whitespace-nowrap">Payment Channel</th>
              <th className="px-3.5 py-2.5 whitespace-nowrap">Branch</th>
              <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Amount</th>
              <th className="px-3.5 py-2.5 whitespace-nowrap">Recorded By</th>
              <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-700 dark:text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full mx-auto mb-2" />
                  Loading expense transactions...
                </td>
              </tr>
            ) : filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                  <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-600 dark:text-slate-400">No expense vouchers found</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Adjust your date filters or click "Record Expense" to create a new disbursement voucher.
                  </p>
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  {/* Date */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-900 dark:text-white font-mono text-[11px]">
                    {new Date(exp.expense_date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Title & Notes */}
                  <td className="px-3.5 py-2.5 max-w-xs">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {exp.title || exp.description}
                    </div>
                    {exp.notes && exp.notes !== exp.title && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {exp.notes}
                      </div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900">
                      {exp.category_name}
                    </span>
                  </td>

                  {/* Paid To */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    {exp.paid_to ? (
                      <span className="font-medium text-slate-800 dark:text-slate-200">{exp.paid_to}</span>
                    ) : (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </td>

                  {/* Payment Channel */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {exp.payment_method === 'CASH' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                          <Wallet className="w-3 h-3" /> Cash Drawer
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                          <Landmark className="w-3 h-3" />
                          {exp.bank_name ? `${exp.bank_name} (${exp.bank_account_name || 'Acc'})` : 'Bank Transfer'}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400 text-[11px]">
                    {exp.branch_name || 'Main'}
                  </td>

                  {/* Amount */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-black font-mono text-rose-600 dark:text-rose-400 text-xs">
                    {currencySymbol} {Number(exp.amount).toLocaleString()}
                  </td>

                  {/* Recorded By */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500 text-[11px]">
                    {exp.recorded_by_name || 'Staff'}
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePrintVoucher(exp)}
                        title="Print / View Voucher PDF"
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(exp)}
                            title="Edit Expense Voucher"
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpenseToDelete(exp)}
                            title="Delete Expense Record"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {filteredExpenses.length > 0 && (
            <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs shadow-md">
              <tr>
                <td colSpan={6} className="px-3.5 py-2 text-right uppercase tracking-wider text-slate-500">
                  Total Filtered Expenses:
                </td>
                <td className="px-3.5 py-2 text-right font-black font-mono text-rose-600 dark:text-rose-400">
                  {currencySymbol} {stats.total.toLocaleString()}
                </td>
                <td colSpan={2} className="px-3.5 py-2 text-slate-400 text-[11px]">
                  {stats.count} vouchers
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ======================================================== */}
      {/* FULL-SCREEN VYAPAR EXPENSE VOUCHER WORKSPACE             */}
      {/* ======================================================== */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col h-screen w-screen overflow-hidden select-none animate-in fade-in duration-150">
          {/* Top Bar Header (48px) */}
          <div className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-xs">
                <Receipt className="w-3.5 h-3.5" />
                <span>EXPENSE VOUCHER</span>
              </div>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                {editingExpense ? 'Edit Operating Expense Voucher' : 'Record Operating Expense Voucher'}
              </span>
              <span className="hidden sm:inline text-xs text-slate-400 font-medium">
                • {branches.find((b) => b.id === formBranchId)?.name || 'Main Branch'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Close and return to Expenses list (ESC)"
              >
                <X className="w-4 h-4" />
                <span>Close (ESC)</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitExpense} className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Scrollable Center Voucher Slip */}
            <div className="flex-1 overflow-auto bg-slate-100/70 dark:bg-slate-950 p-4 sm:p-6 flex justify-center items-start">
              <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
                {/* 1. Header & Voucher Particulars */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Payment & Disbursement Voucher
                      </span>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">
                        Operational Outflow Voucher
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Voucher Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      {branches.length > 1 && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Operating Branch
                          </label>
                          <select
                            value={formBranchId}
                            onChange={(e) => setFormBranchId(e.target.value)}
                            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          >
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} {b.is_main_branch ? '(Main Branch)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Main Expense Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Title / Purpose */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Expense Title / Purpose <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. November Outlet Rent, Chef Staff Payroll, K-Electric Utility Bill, Crockery replacement"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        Expense Category <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold"
                      >
                        + New Category
                      </button>
                    </div>
                    <select
                      required
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Expense Amount ({currencySymbol}) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        min="0.01"
                        placeholder="0.00"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-full pl-11 pr-4 py-2 text-base font-black font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-rose-600 dark:text-rose-400 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  {/* Payment Channel Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Disbursement Channel <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value={PaymentMethod.CASH}>Cash Drawer (Cash in Hand)</option>
                      <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer (Direct Account)</option>
                      <option value={PaymentMethod.CARD}>Credit / Debit Card</option>
                      <option value={PaymentMethod.DIGITAL_WALLET}>Digital Wallet (EasyPaisa / JazzCash)</option>
                    </select>
                  </div>

                  {/* Paid To / Payee */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Paid To / Payee Details
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Landlord Name, K-Electric, Sui Gas, Staff Employee"
                      value={formPaidTo}
                      onChange={(e) => setFormPaidTo(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Bank Account Selection (Conditional) */}
                  {(formPaymentMethod === PaymentMethod.BANK_TRANSFER ||
                    formPaymentMethod === PaymentMethod.DIGITAL_WALLET ||
                    formPaymentMethod === PaymentMethod.CARD) && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                        Select Bank Account to Deduct <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formBankAccountId}
                        onChange={(e) => setFormBankAccountId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">-- Choose Bank Account --</option>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bank_name} - {b.account_name} ({currencySymbol} {Number(b.current_balance).toLocaleString()} available)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Notes / Particulars */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Particulars / Memo / Bill Reference <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Optional voucher note, cheque number, utility consumer ID, or invoice memo..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* 3. Automatic Ledger Banner */}
                <div className="p-4 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/50 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white font-bold">Automatic Multi-Ledger Posting:</strong>{' '}
                    This operational expense voucher will instantly update your{' '}
                    <span className="font-semibold text-rose-700 dark:text-rose-300">Cash/Bank Balance</span>, record into the{' '}
                    <span className="font-semibold text-rose-700 dark:text-rose-300">Daily Daybook</span>, and reduce net profit on your{' '}
                    <span className="font-semibold text-rose-700 dark:text-rose-300">Profit & Loss (P&L) Statement</span>.
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Docked Financial Summary Bar (h-16) */}
            <div className="h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg z-10">
              <div className="flex items-center space-x-4">
                <span className="text-xs text-slate-500 font-semibold">
                  Category: <strong className="text-slate-900 dark:text-white">{categories.find((c) => c.id === formCategoryId)?.name || 'General'}</strong>
                </span>
                <span className="text-xs text-slate-400">
                  Channel: <strong className="text-slate-900 dark:text-white font-mono">{formPaymentMethod}</strong>
                </span>
                {formPaidTo && (
                  <span className="hidden sm:inline text-xs text-slate-400">
                    Payee: <strong className="text-slate-900 dark:text-white">{formPaidTo}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase text-slate-400">Voucher Total:</span>
                  <span className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                    {currencySymbol} {Number(formAmount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel (ESC)
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg flex items-center space-x-1.5 disabled:opacity-50 transition-all transform active:scale-95"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{editingExpense ? 'Save Voucher Changes' : 'Record Expense Voucher'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {/* ======================================================== */}
      {/* CATEGORY MANAGEMENT MODAL                                */}
      {/* ======================================================== */}
      {isCategoryModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCategoryModalOpen(false)}
          title={
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Expense Categories</h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Manage budget groups for reporting</p>
              </div>
            </div>
          }
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Add Category Form */}
            <form onSubmit={handleAddCategory} className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Add New Category</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Category Name (e.g. Marketing)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="form-input"
                />
                <input
                  type="text"
                  placeholder="Optional description"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={addingCat}
                  className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Categories ({categories.length})</div>
              {categories.map((c) => (
                <div key={c.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{c.name}</span>
                    {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">Active</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION MODAL                                */}
      {/* ======================================================== */}
      {expenseToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setExpenseToDelete(null)}
          title="Delete Expense Record"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-800 dark:text-rose-300 text-sm">Are you sure you want to delete this expense?</p>
                <p className="text-slate-600 dark:text-slate-400 mt-1.5 text-xs">
                  Title: <strong className="text-slate-900 dark:text-white">{expenseToDelete.title || expenseToDelete.description}</strong>
                  <br />
                  Amount: <strong className="text-rose-600 font-mono text-sm">{currencySymbol} {Number(expenseToDelete.amount).toLocaleString()}</strong>
                </p>
                {expenseToDelete.bank_account_id && expenseToDelete.payment_method !== 'CASH' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                    Notice: Deleting this transaction will automatically restore the balance of the linked bank account.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setExpenseToDelete(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExpense}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ExpenseManagement;
