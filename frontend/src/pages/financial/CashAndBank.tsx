import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { StatCard } from '../../components/common/StatCard.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import { exportCashBankLedgerPdf, exportCashBankTransferPdf } from '../../utils/pdfExport.js';
import {
  Landmark,
  Trash2,
  Wallet,
  Edit2,
  Eye,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  Building2,
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  FileText,
  Search,
  FileDown,
  Layers,
  ArrowRight,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { CashBankTransferType } from '@pos/shared';

export const CashAndBank: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error: toastError } = useToast();

  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  // Data States
  const [summary, setSummary] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Vyapar Navigation & Account Selection States
  const [viewMode, setViewMode] = useState<'MASTER_DETAIL' | 'BANK_GRID' | 'TRANSFERS'>('MASTER_DETAIL');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL'); // 'ALL' | 'CASH' | bankAccountId
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>('');

  // Vyapar Ledger Filter States
  const [datePreset, setDatePreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [txnDirectionFilter, setTxnDirectionFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW' | 'CONTRA'>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Modal States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transaction Particulars & Voucher Modals
  const [selectedLedgerItem, setSelectedLedgerItem] = useState<any | null>(null);
  const [isLedgerDetailsOpen, setIsLedgerDetailsOpen] = useState(false);
  const [selectedTransferVoucher, setSelectedTransferVoucher] = useState<any | null>(null);
  const [isTransferVoucherOpen, setIsTransferVoucherOpen] = useState(false);

  // Transfer Form State (Contra Voucher)
  const [transferForm, setTransferForm] = useState({
    transferType: CashBankTransferType.CASH_TO_BANK,
    fromBankAccountId: '',
    toBankAccountId: '',
    amount: '',
    transferDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    notes: '',
  });

  // Account Form State
  const [accountForm, setAccountForm] = useState({
    id: '',
    accountName: '',
    bankName: 'Meezan Bank Ltd',
    accountNumber: '',
    iban: '',
    branchCode: '',
    openingBalance: '0',
    isDefault: false,
  });

  const fetchData = async (background = false) => {
    if (!background) setLoading(true);
    else setIsRefreshing(true);

    try {
      const dateQuery = customStartDate && customEndDate
        ? `&startDate=${customStartDate}&endDate=${customEndDate}`
        : '';

      const [sumRes, accRes, trRes, ledRes] = await Promise.all([
        api.get('/financial/cash-bank/summary'),
        api.get('/financial/bank-accounts'),
        api.get(`/financial/cash-bank/transfers?${dateQuery}`),
        api.get(`/financial/cash-bank/ledger?accountId=${selectedAccountId}${dateQuery}`),
      ]);

      setSummary(sumRes.summary);
      setBankAccounts(accRes.bankAccounts || []);
      setTransfers(trRes.transfers || []);
      setLedger(ledRes.ledger || []);

      // Pre-select default bank account in transfer form if not set
      if (accRes.bankAccounts?.length > 0 && !transferForm.toBankAccountId) {
        const def = accRes.bankAccounts.find((b: any) => b.isDefault) || accRes.bankAccounts[0];
        setTransferForm((prev) => ({
          ...prev,
          toBankAccountId: def.id,
          fromBankAccountId: def.id,
        }));
      }
    } catch (err: any) {
      console.error('Failed to load cash and bank data:', err);
      toastError(err.message || 'Failed to load cash and bank records');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedAccountId, customStartDate, customEndDate]);

  // Handle Quick Date Presets
  const applyDatePreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM') => {
    setDatePreset(preset);
    const now = new Date();
    const formatYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (preset === 'TODAY') {
      const todayStr = formatYMD(now);
      setCustomStartDate(todayStr);
      setCustomEndDate(todayStr);
    } else if (preset === 'WEEK') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      setCustomStartDate(formatYMD(weekAgo));
      setCustomEndDate(formatYMD(now));
    } else if (preset === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setCustomStartDate(formatYMD(startOfMonth));
      setCustomEndDate(formatYMD(now));
    } else if (preset === 'ALL') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  // Selected Account Object Details
  const selectedAccountDetails = useMemo(() => {
    if (selectedAccountId === 'ALL') {
      return {
        id: 'ALL',
        name: 'All Accounts Consolidated',
        subtitle: 'Cash in Hand + All Bank Accounts Book',
        currentBalance: Number(summary?.totalLiquidFunds || 0),
        isCash: false,
        isAll: true,
      };
    }
    if (selectedAccountId === 'CASH') {
      return {
        id: 'CASH',
        name: 'Cash in Hand',
        subtitle: 'Physical Register Drawer Cash',
        currentBalance: Number(summary?.totalCashInHand || 0),
        isCash: true,
        isAll: false,
      };
    }
    const bank = bankAccounts.find((b) => b.id === selectedAccountId);
    return {
      id: selectedAccountId,
      name: bank ? `${bank.bankName} - ${bank.accountName}` : 'Bank Account',
      subtitle: bank ? `A/C # ${bank.accountNumber || 'N/A'} • IBAN: ${bank.iban || 'N/A'}` : '',
      currentBalance: Number(bank?.currentBalance || 0),
      isCash: false,
      isAll: false,
      rawBank: bank,
    };
  }, [selectedAccountId, summary, bankAccounts]);

  // Compute Filtered Ledger & Running Balance (Vyapar trademark calculation)
  const { processedLedger, totalInflow, totalOutflow, netMovement } = useMemo(() => {
    // 1. Filter by Direction
    let rows = ledger.filter((item) => {
      if (txnDirectionFilter === 'INFLOW') return item.inflow > 0;
      if (txnDirectionFilter === 'OUTFLOW') return item.outflow > 0;
      if (txnDirectionFilter === 'CONTRA') {
        return (
          item.type.includes('DEPOSIT') ||
          item.type.includes('WITHDRAWAL') ||
          item.type.includes('TRANSFER')
        );
      }
      return true;
    });

    // 2. Filter by Search Query
    if (ledgerSearch.trim()) {
      const term = ledgerSearch.toLowerCase();
      rows = rows.filter(
        (it) =>
          it.typeLabel.toLowerCase().includes(term) ||
          it.accountName.toLowerCase().includes(term) ||
          (it.reference && it.reference.toLowerCase().includes(term)) ||
          (it.notes && it.notes.toLowerCase().includes(term)) ||
          (it.recordedBy && it.recordedBy.toLowerCase().includes(term))
      );
    }

    // 3. Compute running balance backwards from current balance
    const currentBal = selectedAccountDetails.currentBalance;
    let running = currentBal;
    const computedRows = rows.map((r, index) => {
      const rowBal = running;
      // Adjust running for the next older row
      running = running - (Number(r.inflow || 0) - Number(r.outflow || 0));
      return {
        ...r,
        runningBalance: rowBal,
      };
    });

    // Sum totals for period
    const inSum = rows.reduce((acc, r) => acc + Number(r.inflow || 0), 0);
    const outSum = rows.reduce((acc, r) => acc + Number(r.outflow || 0), 0);

    return {
      processedLedger: computedRows,
      totalInflow: inSum,
      totalOutflow: outSum,
      netMovement: inSum - outSum,
    };
  }, [ledger, txnDirectionFilter, ledgerSearch, selectedAccountDetails]);

  // Handle Fund Transfer Submit (Contra Voucher)
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferForm.amount);
    if (!amt || amt <= 0) {
      toastError('Please enter a valid transfer amount greater than 0');
      return;
    }

    if (transferForm.transferType === CashBankTransferType.CASH_TO_BANK && !transferForm.toBankAccountId) {
      toastError('Please select a destination bank account');
      return;
    }

    if (transferForm.transferType === CashBankTransferType.BANK_TO_CASH && !transferForm.fromBankAccountId) {
      toastError('Please select a source bank account');
      return;
    }

    if (
      transferForm.transferType === CashBankTransferType.BANK_TO_BANK &&
      (!transferForm.fromBankAccountId ||
        !transferForm.toBankAccountId ||
        transferForm.fromBankAccountId === transferForm.toBankAccountId)
    ) {
      toastError('Please select two different bank accounts for an internal transfer');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/financial/cash-bank/transfers', {
        transferType: transferForm.transferType,
        fromBankAccountId: transferForm.fromBankAccountId || undefined,
        toBankAccountId: transferForm.toBankAccountId || undefined,
        amount: amt,
        transferDate: transferForm.transferDate || undefined,
        referenceNumber: transferForm.referenceNumber || undefined,
        notes: transferForm.notes || undefined,
      });

      success(
        transferForm.transferType === CashBankTransferType.CASH_TO_BANK
          ? `Successfully deposited ${currencySymbol} ${amt.toLocaleString()} from drawer cash to bank!`
          : transferForm.transferType === CashBankTransferType.BANK_TO_CASH
          ? `Successfully withdrawn ${currencySymbol} ${amt.toLocaleString()} from bank to cash drawer!`
          : `Successfully transferred ${currencySymbol} ${amt.toLocaleString()} between bank accounts!`
      );

      setIsTransferModalOpen(false);
      setTransferForm({
        transferType: CashBankTransferType.CASH_TO_BANK,
        fromBankAccountId: bankAccounts[0]?.id || '',
        toBankAccountId: bankAccounts[0]?.id || '',
        amount: '',
        transferDate: new Date().toISOString().split('T')[0],
        referenceNumber: '',
        notes: '',
      });
      fetchData(true);
    } catch (err: any) {
      toastError(err.message || 'Transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create or Update Bank Account
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.accountName.trim() || !accountForm.bankName.trim()) {
      toastError('Please enter both Account Name and Bank Name');
      return;
    }

    setIsSubmitting(true);
    try {
      if (accountForm.id) {
        // Update existing
        await api.put(`/financial/bank-accounts/${accountForm.id}`, {
          accountName: accountForm.accountName,
          bankName: accountForm.bankName,
          accountNumber: accountForm.accountNumber || undefined,
          iban: accountForm.iban || undefined,
          branchCode: accountForm.branchCode || undefined,
          isDefault: accountForm.isDefault,
        });
        success('Bank account updated successfully!');
      } else {
        // Create new
        await api.post('/financial/bank-accounts', {
          accountName: accountForm.accountName,
          bankName: accountForm.bankName,
          accountNumber: accountForm.accountNumber || undefined,
          iban: accountForm.iban || undefined,
          branchCode: accountForm.branchCode || undefined,
          openingBalance: parseFloat(accountForm.openingBalance) || 0,
          isDefault: accountForm.isDefault,
        });
        success('New bank account registered successfully!');
      }

      setIsAccountModalOpen(false);
      setAccountForm({
        id: '',
        accountName: '',
        bankName: 'Meezan Bank Ltd',
        accountNumber: '',
        iban: '',
        branchCode: '',
        openingBalance: '0',
        isDefault: false,
      });
      fetchData(true);
    } catch (err: any) {
      toastError(err.message || 'Failed to save bank account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Bank Account
  const handleDeleteBankAccount = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete bank account "${name}"? This account will be deactivated and hidden from active books.`)) {
      return;
    }

    try {
      await api.delete(`/financial/bank-accounts/${id}`);
      success(`Bank account "${name}" deleted successfully`);
      if (selectedAccountId === id) {
        setSelectedAccountId('ALL');
      }
      fetchData(true);
    } catch (err: any) {
      toastError(err.message || 'Failed to delete bank account');
    }
  };

  // Handle Set Default Bank Account
  const handleSetDefaultBankAccount = async (id: string, name: string) => {
    try {
      await api.put(`/financial/bank-accounts/${id}`, { isDefault: true });
      success(`"${name}" is now the default POS bank account`);
      fetchData(true);
    } catch (err: any) {
      toastError(err.message || 'Failed to update default bank account');
    }
  };

  // Handle Reverse and Delete Fund Transfer Voucher
  const handleDeleteTransfer = async (id: string, ref: string, amount: number) => {
    if (!window.confirm(`Are you sure you want to reverse and delete this fund transfer (${ref || 'Slip #' + id.slice(0, 8)}) of ${currencySymbol} ${amount.toLocaleString()}?\n\nThis will restore the original balances in the respective accounts.`)) {
      return;
    }

    try {
      await api.delete(`/financial/cash-bank/transfers/${id}`);
      success('Fund transfer reversed and voucher deleted successfully');
      fetchData(true);
    } catch (err: any) {
      toastError(err.message || 'Failed to delete fund transfer');
    }
  };

  // Export PDF Statement
  const handleExportPdf = () => {
    try {
      exportCashBankLedgerPdf({
        accountName: selectedAccountDetails.name,
        accountNumber: selectedAccountDetails.subtitle,
        currentBalance: selectedAccountDetails.currentBalance,
        totalInflow,
        totalOutflow,
        transactions: processedLedger,
        meta: {
          name: tenant?.name || 'Restaurant POS',
          currencySymbol,
        },
        dates: {
          startDate: customStartDate || 'All Time',
          endDate: customEndDate || 'Present',
        },
      });
      success('Cash & Bank statement PDF downloaded successfully!');
    } catch (e: any) {
      toastError('Failed to generate PDF: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400">Loading Vyapar Cash & Bank Book...</span>
        </div>
      </div>
    );
  }

  // Filter bank accounts by search query in left sidebar
  const filteredBankAccounts = bankAccounts.filter((b) => {
    if (!accountSearchQuery.trim()) return true;
    const q = accountSearchQuery.toLowerCase();
    return (
      b.bankName.toLowerCase().includes(q) ||
      b.accountName.toLowerCase().includes(q) ||
      (b.accountNumber && b.accountNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Vyapar Top Header & Action Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Cash & Bank
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Vyapar System
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time drawer cash, bank accounts, contra transfers, and ledger books
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Contra Fund Transfer Button */}
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98]"
          >
            <ArrowRightLeft className="w-4 h-4 text-amber-200" />
            <span>Transfer Cash ⇄ Bank</span>
          </button>

          {/* Add Bank Account */}
          <button
            onClick={() => {
              setAccountForm({
                id: '',
                accountName: '',
                bankName: 'Meezan Bank Ltd',
                accountNumber: '',
                iban: '',
                branchCode: '',
                openingBalance: '0',
                isDefault: false,
              });
              setIsAccountModalOpen(true);
            }}
            className="flex items-center space-x-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-500" />
            <span>Add Bank Account</span>
          </button>

          {/* Download PDF Statement */}
          <button
            onClick={handleExportPdf}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Download PDF Ledger Statement"
          >
            <FileDown className="w-4 h-4 text-blue-500" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>

          {/* Print Statement */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Print Statement Voucher"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Live Refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors shadow-sm"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Vyapar Financial Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Cash in Hand (Drawer)"
          value={`${currencySymbol} ${Number(summary?.totalCashInHand || 0).toLocaleString()}`}
          subtitle={`Today's Cash Sales: ${currencySymbol} ${Number(summary?.todayCashSales || 0).toLocaleString()}`}
          icon={Wallet}
          color="green"
        />

        <StatCard
          title="Total Bank Balance"
          value={`${currencySymbol} ${Number(summary?.totalBankBalance || 0).toLocaleString()}`}
          subtitle={`${bankAccounts.length} Active Bank Account(s)`}
          icon={Landmark}
          color="blue"
        />

        <StatCard
          title="Total Liquid Working Funds"
          value={`${currencySymbol} ${Number(summary?.totalLiquidFunds || 0).toLocaleString()}`}
          subtitle="Combined Cash + Bank Balances"
          icon={DollarSign}
          color="purple"
        />

        <StatCard
          title="Today's Cash Deposited to Bank"
          value={`${currencySymbol} ${Number(summary?.todayCashDepositedToBank || 0).toLocaleString()}`}
          subtitle={`Bank Withdrawn: ${currencySymbol} ${Number(summary?.todayBankWithdrawnToCash || 0).toLocaleString()}`}
          icon={ArrowUpRight}
          color="orange"
        />
      </div>

      {/* Vyapar View Selector Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setViewMode('MASTER_DETAIL')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            viewMode === 'MASTER_DETAIL'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-brand-500" />
          <span>Account Books (Vyapar Master-Detail)</span>
        </button>

        <button
          onClick={() => setViewMode('BANK_GRID')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            viewMode === 'BANK_GRID'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4 text-blue-500" />
          <span>Bank Accounts Cards ({bankAccounts.length})</span>
        </button>

        <button
          onClick={() => setViewMode('TRANSFERS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            viewMode === 'TRANSFERS'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
          <span>Cash ⇄ Bank Transfers Contra Register ({transfers.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. VYAPAR ICONIC MASTER-DETAIL TWO-PANE ACCOUNT BOOK VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'MASTER_DETAIL' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT PANEL: VYAPAR ACCOUNT SELECTOR (30% WIDTH) */}
          <div className="w-full lg:w-80 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400">
                Accounts Explorer
              </h3>
              <button
                onClick={() => {
                  setAccountForm({
                    id: '',
                    accountName: '',
                    bankName: 'Meezan Bank Ltd',
                    accountNumber: '',
                    iban: '',
                    branchCode: '',
                    openingBalance: '0',
                    isDefault: false,
                  });
                  setIsAccountModalOpen(true);
                }}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bank</span>
              </button>
            </div>

            {/* Search Accounts */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={accountSearchQuery}
                onChange={(e) => setAccountSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* List of Accounts in Vyapar Style */}
            <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
              {/* Option 1: ALL ACCOUNTS (Consolidated Book) */}
              <button
                onClick={() => setSelectedAccountId('ALL')}
                className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between ${
                  selectedAccountId === 'ALL'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 shadow-sm'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                      All Accounts
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Consolidated Ledger
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-xs text-slate-900 dark:text-white block">
                    {currencySymbol} {Number(summary?.totalLiquidFunds || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                    Combined
                  </span>
                </div>
              </button>

              {/* SECTION: CASH ACCOUNTS */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 pb-1">
                  Cash in Hand
                </span>
                <button
                  onClick={() => setSelectedAccountId('CASH')}
                  className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between ${
                    selectedAccountId === 'CASH'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-sm'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                        Cash in Hand
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Drawer Cash
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 block">
                      {currencySymbol} {Number(summary?.totalCashInHand || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Physical Cash</span>
                  </div>
                </button>
              </div>

              {/* SECTION: BANK ACCOUNTS */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 pb-1">
                  Bank Accounts ({filteredBankAccounts.length})
                </span>
                <div className="space-y-1">
                  {filteredBankAccounts.map((b) => (
                    <div
                      key={b.id}
                      className={`w-full p-2.5 rounded-xl transition-all border flex items-center justify-between group ${
                        selectedAccountId === b.id
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm'
                          : 'border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedAccountId(b.id)}
                        className="flex-1 text-left flex items-center justify-between min-w-0 pr-2"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0">
                            <Landmark className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 truncate">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                              {b.bankName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold block truncate">
                              {b.accountName}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-1">
                          <span className="font-black text-xs text-slate-900 dark:text-white block">
                            {currencySymbol} {Number(b.currentBalance).toLocaleString()}
                          </span>
                          {b.isDefault && (
                            <span className="text-[9px] font-bold text-brand-600 dark:text-brand-400 uppercase">
                              Default
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          items={[
                            {
                              label: 'View Account Book',
                              icon: Eye,
                              onClick: () => {
                                setSelectedAccountId(b.id);
                                setViewMode('MASTER_DETAIL');
                              },
                            },
                            {
                              label: 'Edit Bank Account',
                              icon: Edit2,
                              onClick: () => {
                                setAccountForm({
                                  id: b.id,
                                  accountName: b.accountName,
                                  bankName: b.bankName,
                                  accountNumber: b.accountNumber || '',
                                  iban: b.iban || '',
                                  branchCode: b.branchCode || '',
                                  openingBalance: String(b.openingBalance),
                                  isDefault: b.isDefault,
                                });
                                setIsAccountModalOpen(true);
                              },
                            },
                            !b.isDefault && {
                              label: 'Set as Default POS Bank',
                              icon: CheckCircle2,
                              onClick: () => handleSetDefaultBankAccount(b.id, b.bankName),
                            },
                            {
                              label: 'Deposit Cash (+)',
                              icon: ArrowDownRight,
                              variant: 'success',
                              onClick: () => {
                                setTransferForm({
                                  transferType: CashBankTransferType.CASH_TO_BANK,
                                  fromBankAccountId: '',
                                  toBankAccountId: b.id,
                                  amount: '',
                                  transferDate: new Date().toISOString().split('T')[0],
                                  referenceNumber: '',
                                  notes: `Deposit into ${b.bankName}`,
                                });
                                setIsTransferModalOpen(true);
                              },
                            },
                            {
                              label: 'Withdraw Float (-)',
                              icon: ArrowUpRight,
                              variant: 'warning',
                              onClick: () => {
                                setTransferForm({
                                  transferType: CashBankTransferType.BANK_TO_CASH,
                                  fromBankAccountId: b.id,
                                  toBankAccountId: '',
                                  amount: '',
                                  transferDate: new Date().toISOString().split('T')[0],
                                  referenceNumber: '',
                                  notes: `Withdrawal from ${b.bankName}`,
                                });
                                setIsTransferModalOpen(true);
                              },
                            },
                            {
                              label: 'Delete Bank Account',
                              icon: Trash2,
                              variant: 'danger',
                              divider: true,
                              onClick: () => handleDeleteBankAccount(b.id, b.bankName),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Total Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">Total Liquid Funds</span>
              <span className="font-black text-slate-900 dark:text-white">
                {currencySymbol} {Number(summary?.totalLiquidFunds || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* RIGHT PANEL: VYAPAR DETAILED ACCOUNT LEDGER & OPERATIONS (70% WIDTH) */}
          <div className="flex-1 w-full space-y-4">
            {/* Selected Account Profile & Quick Action Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-black shrink-0">
                    {selectedAccountDetails.isCash ? (
                      <Wallet className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <Landmark className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">
                        {selectedAccountDetails.name}
                      </h2>
                      {selectedAccountDetails.rawBank?.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-extrabold text-[10px] uppercase">
                          Default POS Bank
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedAccountDetails.subtitle || 'Active Restaurant Fund Ledger'}
                    </p>
                  </div>
                </div>

                {/* Big Balance Callout & Quick Transfer Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Current Available Balance
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {currencySymbol} {selectedAccountDetails.currentBalance.toLocaleString()}
                    </span>
                  </div>

                  {/* Transfer / Deposit / Withdrawal Shortcut */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setTransferForm({
                          transferType: CashBankTransferType.CASH_TO_BANK,
                          fromBankAccountId: '',
                          toBankAccountId: selectedAccountId !== 'ALL' && selectedAccountId !== 'CASH' ? selectedAccountId : (bankAccounts[0]?.id || ''),
                          amount: '',
                          transferDate: new Date().toISOString().split('T')[0],
                          referenceNumber: '',
                          notes: `Deposit into ${selectedAccountDetails.name}`,
                        });
                        setIsTransferModalOpen(true);
                      }}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-1"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>+ Deposit</span>
                    </button>

                    <button
                      onClick={() => {
                        setTransferForm({
                          transferType: CashBankTransferType.BANK_TO_CASH,
                          fromBankAccountId: selectedAccountId !== 'ALL' && selectedAccountId !== 'CASH' ? selectedAccountId : (bankAccounts[0]?.id || ''),
                          toBankAccountId: '',
                          amount: '',
                          transferDate: new Date().toISOString().split('T')[0],
                          referenceNumber: '',
                          notes: `Withdrawal from ${selectedAccountDetails.name}`,
                        });
                        setIsTransferModalOpen(true);
                      }}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-1"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>- Withdraw</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Vyapar Transaction Filter & Period Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Direction Tabs (All, Inflow, Outflow, Contra) */}
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  {[
                    { id: 'ALL', label: 'All Transactions' },
                    { id: 'INFLOW', label: 'Money In (Credit +)' },
                    { id: 'OUTFLOW', label: 'Money Out (Debit -)' },
                    { id: 'CONTRA', label: 'Bank Transfers (Contra)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTxnDirectionFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        txnDirectionFilter === tab.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Period Pills */}
                <div className="flex items-center space-x-1 text-xs font-bold">
                  {(['ALL', 'TODAY', 'WEEK', 'MONTH', 'CUSTOM'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => applyDatePreset(p)}
                      className={`px-2.5 py-1 rounded-lg border transition-all text-[11px] ${
                        datePreset === p
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p === 'ALL' ? 'All Time' : p === 'TODAY' ? 'Today' : p === 'WEEK' ? 'Last 7 Days' : p === 'MONTH' ? 'This Month' : 'Custom'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range & Search Input Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by party, invoice #, ref, notes..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="w-64 pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {datePreset === 'CUSTOM' && (
                    <div className="flex items-center space-x-1.5 text-xs">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                      />
                      <span className="text-slate-400 font-bold">to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* Vyapar Inflow & Outflow Movement Tally */}
                <div className="flex items-center space-x-4 text-xs font-bold">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-semibold uppercase">Total Inflow (+)</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      + {currencySymbol} {totalInflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                    <span className="text-slate-400 text-[10px] block font-semibold uppercase">Total Outflow (-)</span>
                    <span className="text-rose-600 dark:text-rose-400 font-black">
                      - {currencySymbol} {totalOutflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                    <span className="text-slate-400 text-[10px] block font-semibold uppercase">Net Movement</span>
                    <span className={`font-black ${netMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {netMovement >= 0 ? '+' : ''} {currencySymbol} {netMovement.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* The Vyapar Transaction Ledger Table with RUNNING BALANCE */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Type / Category</th>
                      <th className="py-3 px-4">Ref / Invoice #</th>
                      <th className="py-3 px-4">Party / Narration</th>
                      <th className="py-3 px-4 text-right">Money Out (Debit -)</th>
                      <th className="py-3 px-4 text-right">Money In (Credit +)</th>
                      <th className="py-3 px-4 text-right">Running Balance</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {processedLedger.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                          No transactions found in this book matching the filters.
                        </td>
                      </tr>
                    ) : (
                      processedLedger.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Date & Time */}
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(row.date).toLocaleString([], {
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Type / Category */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                row.type.includes('SALE')
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : row.type.includes('DEPOSIT')
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                  : row.type.includes('WITHDRAWAL')
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              <span>{row.typeLabel}</span>
                            </span>
                          </td>

                          {/* Ref / Invoice # */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {row.reference || '—'}
                          </td>

                          {/* Party / Narration */}
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={row.notes}>
                            <div className="font-semibold">{row.accountName}</div>
                            {row.notes && <div className="text-[10px] text-slate-400 truncate">{row.notes}</div>}
                          </td>

                          {/* Money Out (Debit -) */}
                          <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                            {row.outflow > 0 ? `- ${currencySymbol} ${Number(row.outflow).toLocaleString()}` : '—'}
                          </td>

                          {/* Money In (Credit +) */}
                          <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                            {row.inflow > 0 ? `+ ${currencySymbol} ${Number(row.inflow).toLocaleString()}` : '—'}
                          </td>

                          {/* Running Balance */}
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/30">
                            {currencySymbol} {Number(row.runningBalance).toLocaleString()}
                          </td>

                          {/* 3-Dots Action */}
                          <td className="py-3 px-4 text-center">
                            <ActionMenu
                              items={[
                                {
                                  label: 'View Particulars',
                                  icon: Eye,
                                  onClick: () => {
                                    setSelectedLedgerItem(row);
                                    setIsLedgerDetailsOpen(true);
                                  },
                                },
                                {
                                  label: 'Print Voucher',
                                  icon: Printer,
                                  onClick: () => {
                                    setSelectedLedgerItem(row);
                                    setIsPrintModalOpen(true);
                                  },
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
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BANK ACCOUNTS CARDS GRID VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'BANK_GRID' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bankAccounts.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-brand-500/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                        {b.bankName}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-semibold">{b.accountName}</p>
                    </div>
                  </div>
                  {b.isDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 font-extrabold text-[10px] uppercase border border-brand-500/30">
                      Default POS
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Account Number:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {b.accountNumber || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>IBAN:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {b.iban || '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Balance</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {currencySymbol} {Number(b.currentBalance).toLocaleString()}
                    </span>
                  </div>

                  <ActionMenu
                    items={[
                      {
                        label: 'View Account Book',
                        icon: Eye,
                        onClick: () => {
                          setSelectedAccountId(b.id);
                          setViewMode('MASTER_DETAIL');
                        },
                      },
                      {
                        label: 'Edit Bank Account',
                        icon: Edit2,
                        onClick: () => {
                          setAccountForm({
                            id: b.id,
                            accountName: b.accountName,
                            bankName: b.bankName,
                            accountNumber: b.accountNumber || '',
                            iban: b.iban || '',
                            branchCode: b.branchCode || '',
                            openingBalance: String(b.openingBalance),
                            isDefault: b.isDefault,
                          });
                          setIsAccountModalOpen(true);
                        },
                      },
                      {
                        label: 'Deposit Cash (+ Drawer to Bank)',
                        icon: ArrowDownRight,
                        variant: 'success',
                        onClick: () => {
                          setTransferForm({
                            transferType: CashBankTransferType.CASH_TO_BANK,
                            fromBankAccountId: '',
                            toBankAccountId: b.id,
                            amount: '',
                            transferDate: new Date().toISOString().split('T')[0],
                            referenceNumber: '',
                            notes: `Deposit into ${b.bankName}`,
                          });
                          setIsTransferModalOpen(true);
                        },
                      },
                      {
                        label: 'Withdraw Float (- Bank to Drawer)',
                        icon: ArrowUpRight,
                        variant: 'warning',
                        onClick: () => {
                          setTransferForm({
                            transferType: CashBankTransferType.BANK_TO_CASH,
                            fromBankAccountId: b.id,
                            toBankAccountId: '',
                            amount: '',
                            transferDate: new Date().toISOString().split('T')[0],
                            referenceNumber: '',
                            notes: `Withdrawal from ${b.bankName}`,
                          });
                          setIsTransferModalOpen(true);
                        },
                      },
                      !b.isDefault && {
                        label: 'Set as Default POS Bank',
                        icon: CheckCircle2,
                        onClick: () => handleSetDefaultBankAccount(b.id, b.bankName),
                      },
                      {
                        label: 'Print Account Statement',
                        icon: Printer,
                        divider: true,
                        onClick: () => setIsPrintModalOpen(true),
                      },
                      {
                        label: 'Delete Bank Account',
                        icon: Trash2,
                        variant: 'danger',
                        onClick: () => handleDeleteBankAccount(b.id, b.bankName),
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CASH ⇄ BANK TRANSFERS CONTRA REGISTER VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'TRANSFERS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Cash & Bank Contra Transfers Register
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full chronological ledger of all cash-to-bank deposits and bank-to-cash withdrawals
              </p>
            </div>
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              + Record Transfer
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Transfer Type</th>
                  <th className="py-3 px-4">From Account</th>
                  <th className="py-3 px-4">To Account</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Reference / Slip</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No fund transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => {
                    const isDeposit = t.transferType === CashBankTransferType.CASH_TO_BANK;
                    const isWithdrawal = t.transferType === CashBankTransferType.BANK_TO_CASH;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {new Date(t.createdAt).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase border ${
                              isDeposit
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : isWithdrawal
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                            }`}
                          >
                            {isDeposit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span>
                              {isDeposit ? 'Cash to Bank (Deposit)' : isWithdrawal ? 'Bank to Cash (Withdrawal)' : 'Bank to Bank'}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {t.fromAccountName}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {t.toAccountName}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-sm text-slate-900 dark:text-white">
                          {currencySymbol} {Number(t.amount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {t.referenceNumber || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {t.recordedByName}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={t.notes}>
                          {t.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <ActionMenu
                            items={[
                              {
                                label: 'View Transfer Voucher',
                                icon: Eye,
                                onClick: () => {
                                  setSelectedTransferVoucher(t);
                                  setIsTransferVoucherOpen(true);
                                },
                              },
                              {
                                label: 'Download A4 Voucher (PDF)',
                                icon: Download,
                                onClick: () => {
                                  exportCashBankTransferPdf(
                                    {
                                      name: tenant?.name || 'Restaurant POS',
                                      currencySymbol,
                                      branch: 'Main Branch',
                                    },
                                    t,
                                    { autoPrint: false }
                                  );
                                },
                              },
                              {
                                label: 'Print A4 Voucher',
                                icon: Printer,
                                onClick: () => {
                                  exportCashBankTransferPdf(
                                    {
                                      name: tenant?.name || 'Restaurant POS',
                                      currencySymbol,
                                      branch: 'Main Branch',
                                    },
                                    t,
                                    { autoPrint: true }
                                  );
                                },
                              },
                              {
                                label: 'Reverse & Delete Transfer',
                                icon: Trash2,
                                variant: 'danger',
                                divider: true,
                                onClick: () => handleDeleteTransfer(t.id, t.referenceNumber, Number(t.amount)),
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

      {/* ========================================================================= */}
      {/* MODAL: FUND TRANSFER CONTRA VOUCHER (CASH ⇄ BANK) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Funds (Cash ⇄ Bank Account)"
        maxWidth="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
          {/* Transfer Type Selector */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Transfer Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setTransferForm({ ...transferForm, transferType: CashBankTransferType.CASH_TO_BANK })
                }
                className={`p-3 rounded-xl border flex flex-col items-center justify-center font-bold transition-all ${
                  transferForm.transferType === CashBankTransferType.CASH_TO_BANK
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <ArrowUpRight className="w-5 h-5 mb-1 text-emerald-500" />
                <span>Cash to Bank (Deposit)</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Drawer Cash → Bank Account</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setTransferForm({ ...transferForm, transferType: CashBankTransferType.BANK_TO_CASH })
                }
                className={`p-3 rounded-xl border flex flex-col items-center justify-center font-bold transition-all ${
                  transferForm.transferType === CashBankTransferType.BANK_TO_CASH
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <ArrowDownRight className="w-5 h-5 mb-1 text-amber-500" />
                <span>Bank to Cash (Withdrawal)</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Bank Account → Drawer Cash</span>
              </button>
            </div>
          </div>

          {/* Account Selection */}
          {transferForm.transferType === CashBankTransferType.CASH_TO_BANK ? (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Destination Bank Account *
              </label>
              <select
                value={transferForm.toBankAccountId}
                onChange={(e) => setTransferForm({ ...transferForm, toBankAccountId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                required
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountName} (Balance: {currencySymbol} {Number(b.currentBalance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Source Bank Account *
              </label>
              <select
                value={transferForm.fromBankAccountId}
                onChange={(e) => setTransferForm({ ...transferForm, fromBankAccountId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                required
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountName} (Balance: {currencySymbol} {Number(b.currentBalance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Transfer Amount */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Transfer Amount ({currencySymbol}) *
              </label>
              <span className="text-[11px] text-slate-400">
                Drawer Float: {currencySymbol} {Number(summary?.totalCashInHand || 0).toLocaleString()}
              </span>
            </div>
            <input
              type="number"
              step="any"
              min="1"
              required
              placeholder="e.g. 25000"
              value={transferForm.amount}
              onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
            {/* Quick Amount Pills */}
            <div className="flex items-center space-x-1.5 mt-2">
              {[5000, 10000, 25000, 50000].map((quickAmt) => (
                <button
                  key={quickAmt}
                  type="button"
                  onClick={() => setTransferForm({ ...transferForm, amount: String(quickAmt) })}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300"
                >
                  +{quickAmt.toLocaleString()}
                </button>
              ))}
              {transferForm.transferType === CashBankTransferType.CASH_TO_BANK && Number(summary?.totalCashInHand || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setTransferForm({ ...transferForm, amount: String(summary?.totalCashInHand || 0) })}
                  className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold"
                >
                  All Cash ({Number(summary?.totalCashInHand || 0).toLocaleString()})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Transfer Date *
              </label>
              <input
                type="date"
                required
                value={transferForm.transferDate}
                onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Slip / Cheque / Ref #
              </label>
              <input
                type="text"
                placeholder="e.g. Slip #9821 / ATM-01"
                value={transferForm.referenceNumber}
                onChange={(e) => setTransferForm({ ...transferForm, referenceNumber: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notes & Remarks (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Describe purpose of fund transfer..."
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-extrabold py-3 rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Recording Transfer...' : 'Complete Transfer'}
          </button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT BANK ACCOUNT */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title={accountForm.id ? 'Edit Bank Account' : 'Register New Bank Account'}
        maxWidth="md"
      >
        <form onSubmit={handleAccountSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bank Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Meezan Bank, HBL, MCB, EasyPaisa, JazzCash"
              value={accountForm.bankName}
              onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Account Title / Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Restaurant Operating Account"
              value={accountForm.accountName}
              onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Account Number</label>
              <input
                type="text"
                placeholder="e.g. 02010108928371"
                value={accountForm.accountNumber}
                onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">IBAN</label>
              <input
                type="text"
                placeholder="e.g. PK12MEZN0002010108928371"
                value={accountForm.iban}
                onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {!accountForm.id && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Opening Balance ({currencySymbol})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={accountForm.openingBalance}
                onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={accountForm.isDefault}
              onChange={(e) => setAccountForm({ ...accountForm, isDefault: e.target.checked })}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600"
            />
            <label htmlFor="isDefault" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              Set as Default Bank Account for Non-Cash POS Transactions
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-extrabold py-3 rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Saving Account...' : accountForm.id ? 'Save Changes' : 'Create Bank Account'}
          </button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: TRANSACTION PARTICULARS BREAKDOWN */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isLedgerDetailsOpen}
        onClose={() => setIsLedgerDetailsOpen(false)}
        title="Transaction Details & Particulars"
        maxWidth="md"
      >
        {selectedLedgerItem && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Transaction Category</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {selectedLedgerItem.typeLabel}
                </span>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Ref: {selectedLedgerItem.reference || 'N/A'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Amount</span>
                <span className={`text-base font-black ${selectedLedgerItem.inflow > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedLedgerItem.inflow > 0 ? '+' : '-'} {currencySymbol} {Number(selectedLedgerItem.inflow || selectedLedgerItem.outflow).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl p-3 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Date & Time:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {new Date(selectedLedgerItem.date).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Account / Book:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedLedgerItem.accountName}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Running Balance After:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {currencySymbol} {Number(selectedLedgerItem.runningBalance).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Recorded By:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedLedgerItem.recordedBy || 'System'}
                </span>
              </div>
              {selectedLedgerItem.notes && (
                <div className="py-1">
                  <span className="text-slate-500 font-medium block">Narration / Notes:</span>
                  <p className="text-slate-700 dark:text-slate-300 italic mt-0.5 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                    {selectedLedgerItem.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsLedgerDetailsOpen(false)}
                className="px-4 py-2 border rounded-xl text-slate-600 dark:text-slate-400 text-xs font-bold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setIsLedgerDetailsOpen(false);
                  setIsPrintModalOpen(true);
                }}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Ledger Statement</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: FUND TRANSFER CONTRA VOUCHER DETAILS */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTransferVoucherOpen}
        onClose={() => setIsTransferVoucherOpen(false)}
        title="Fund Transfer Voucher Details"
        maxWidth="md"
      >
        {selectedTransferVoucher && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider block">
                  Contra Voucher # {selectedTransferVoucher.referenceNumber || selectedTransferVoucher.id.slice(0, 8)}
                </span>
                <h3 className="font-black text-lg text-emerald-950 dark:text-emerald-100 mt-0.5">
                  {currencySymbol} {Number(selectedTransferVoucher.amount).toLocaleString()}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-black text-[10px] uppercase">
                {selectedTransferVoucher.transferType?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl p-3 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Transfer Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {new Date(selectedTransferVoucher.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Source Account (From):</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {selectedTransferVoucher.fromAccountName}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Destination Account (To):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedTransferVoucher.toAccountName}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Staff Member:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedTransferVoucher.recordedByName || 'Authorized Staff'}
                </span>
              </div>
              {selectedTransferVoucher.notes && (
                <div className="py-1">
                  <span className="text-slate-500 font-medium block">Narration / Notes:</span>
                  <p className="text-slate-700 dark:text-slate-300 italic mt-0.5 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                    {selectedTransferVoucher.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const t = selectedTransferVoucher;
                  setIsTransferVoucherOpen(false);
                  handleDeleteTransfer(t.id, t.referenceNumber, Number(t.amount));
                }}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-colors"
              >
                Reverse & Delete
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    exportCashBankTransferPdf(
                      {
                        name: tenant?.name || 'Restaurant POS',
                        currencySymbol,
                        branch: 'Main Branch',
                      },
                      selectedTransferVoucher,
                      { autoPrint: false }
                    );
                  }}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download A4 PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportCashBankTransferPdf(
                      {
                        name: tenant?.name || 'Restaurant POS',
                        currencySymbol,
                        branch: 'Main Branch',
                      },
                      selectedTransferVoucher,
                      { autoPrint: true }
                    );
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A4 Voucher</span>
                </button>
                <button
                  onClick={() => setIsTransferVoucherOpen(false)}
                  className="px-4 py-2 border rounded-xl text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: PRINTABLE CASH & BANK STATEMENT */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Cash & Bank Statement (Printable Ledger)"
        maxWidth="2xl"
      >
        <div className="space-y-6 text-xs text-slate-800 dark:text-slate-200">
          <div className="flex justify-between items-start border-b pb-4 border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {tenant?.name || 'Restaurant POS'}
              </h2>
              <p className="text-slate-500 text-[11px]">Official Cash & Bank Working Funds Statement</p>
              <p className="text-slate-400 text-[10px] mt-0.5">Printed on: {new Date().toLocaleString()}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Working Capital</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {currencySymbol} {Number(summary?.totalLiquidFunds || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-500 text-[11px] block font-semibold">Cash in Hand (Drawer):</span>
              <span className="text-base font-black text-slate-900 dark:text-white">
                {currencySymbol} {Number(summary?.totalCashInHand || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block font-semibold">Bank Accounts Total:</span>
              <span className="text-base font-black text-slate-900 dark:text-white">
                {currencySymbol} {Number(summary?.totalBankBalance || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Selected Book Summary</h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl overflow-hidden p-3 bg-slate-50 dark:bg-slate-800/40">
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Account:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedAccountDetails.name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Closing Balance:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {currencySymbol} {selectedAccountDetails.currentBalance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Total Inflow (Credit):</span>
                <span className="font-bold text-emerald-600">
                  + {currencySymbol} {totalInflow.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Total Outflow (Debit):</span>
                <span className="font-bold text-rose-600">
                  - {currencySymbol} {totalOutflow.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download A4 Statement (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print A4 Statement</span>
              </button>
            </div>
            <button
              onClick={() => setIsPrintModalOpen(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
