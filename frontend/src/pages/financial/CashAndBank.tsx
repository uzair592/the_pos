import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { StatCard } from '../../components/common/StatCard.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import {
  Landmark,
  Wallet,
  Edit2,
  Eye,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Printer,
  Calendar,
  CheckCircle2,
  Building2,
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  FileText,
  Search,
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

  // Filter States
  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'TRANSFERS' | 'LEDGER'>('ACCOUNTS');
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState<string>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Modal States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    transferType: CashBankTransferType.CASH_TO_BANK,
    fromBankAccountId: '',
    toBankAccountId: '',
    amount: '',
    transferDate: dateFilter,
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
      const [sumRes, accRes, trRes, ledRes] = await Promise.all([
        api.get(`/financial/cash-bank/summary?date=${dateFilter}`),
        api.get('/financial/bank-accounts'),
        api.get('/financial/cash-bank/transfers'),
        api.get(`/financial/cash-bank/ledger?accountId=${ledgerAccountFilter}`),
      ]);

      setSummary(sumRes.summary);
      setBankAccounts(accRes.bankAccounts || []);
      setTransfers(trRes.transfers || []);
      setLedger(ledRes.ledger || []);

      // Pre-select default bank account in transfer form
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
  }, [dateFilter, ledgerAccountFilter]);

  // Handle Internal Fund Transfer Submit
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
      (!transferForm.fromBankAccountId || !transferForm.toBankAccountId || transferForm.fromBankAccountId === transferForm.toBankAccountId)
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
        transferDate: dateFilter,
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

  // Filtered Ledger List
  const filteredLedger = ledger.filter((item) => {
    if (!ledgerSearch.trim()) return true;
    const term = ledgerSearch.toLowerCase();
    return (
      item.typeLabel.toLowerCase().includes(term) ||
      item.accountName.toLowerCase().includes(term) ||
      (item.reference && item.reference.toLowerCase().includes(term)) ||
      (item.notes && item.notes.toLowerCase().includes(term)) ||
      (item.recordedBy && item.recordedBy.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400">Loading Cash & Bank Accounts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header and Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Cash & Bank Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time drawer cash, bank accounts balance, cash-to-bank transfers, and fund reconciliation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setIsTransferModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer Cash ⇄ Bank</span>
          </button>

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
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-500" />
            <span>Add Bank Account</span>
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Print Cash & Bank Statement"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Print Statement</span>
          </button>

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

      {/* Top 4 Financial Metric Cards */}
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

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('ACCOUNTS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'ACCOUNTS'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4 text-brand-500" />
          <span>Bank Accounts ({bankAccounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('TRANSFERS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'TRANSFERS'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 text-blue-500" />
          <span>Cash ⇄ Bank Transfers ({transfers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'LEDGER'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-500" />
          <span>Full Cash & Bank Ledger ({ledger.length})</span>
        </button>
      </div>

      {/* TAB 1: BANK ACCOUNTS & BALANCES */}
      {activeTab === 'ACCOUNTS' && (
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
                      Default
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
                        label: 'View Account Ledger',
                        icon: Eye,
                        onClick: () => {
                          setLedgerAccountFilter(b.id);
                          setActiveTab('LEDGER');
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
                        label: 'Deposit Cash (+ Cash to Bank)',
                        icon: ArrowDownRight,
                        variant: 'success',
                        onClick: () => {
                          setTransferForm({
                            transferType: CashBankTransferType.CASH_TO_BANK,
                            fromBankAccountId: '',
                            toBankAccountId: b.id,
                            amount: '',
                            transferDate: dateFilter,
                            referenceNumber: '',
                            notes: `Deposit to ${b.bankName}`,
                          });
                          setIsTransferModalOpen(true);
                        },
                      },
                      {
                        label: 'Withdraw Float (- Bank to Cash)',
                        icon: ArrowUpRight,
                        variant: 'warning',
                        onClick: () => {
                          setTransferForm({
                            transferType: CashBankTransferType.BANK_TO_CASH,
                            fromBankAccountId: b.id,
                            toBankAccountId: '',
                            amount: '',
                            transferDate: dateFilter,
                            referenceNumber: '',
                            notes: `Withdrawal from ${b.bankName}`,
                          });
                          setIsTransferModalOpen(true);
                        },
                      },
                      {
                        label: 'Print Account Statement',
                        icon: Printer,
                        divider: true,
                        onClick: () => setIsPrintModalOpen(true),
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CASH ⇄ BANK TRANSFERS LOG */}
      {activeTab === 'TRANSFERS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Cash & Bank Fund Transfers History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every cash-to-bank deposit and bank-to-cash withdrawal executed in the system
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No fund transfers recorded yet. Click "Transfer Cash ⇄ Bank" to record your first deposit or withdrawal.
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FULL CASH & BANK LEDGER STATEMENT */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search ledger by order, reference, notes..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 w-64"
                />
              </div>

              <select
                value={ledgerAccountFilter}
                onChange={(e) => setLedgerAccountFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Accounts (Cash & All Banks)</option>
                <option value="CASH">💵 Cash in Hand (Drawer)</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    🏦 {b.bankName} - {b.accountName}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors self-start sm:self-auto"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Ledger</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Transaction Details</th>
                  <th className="py-3 px-4">Account Affected</th>
                  <th className="py-3 px-4 text-right">Inflow (Credit +)</th>
                  <th className="py-3 px-4 text-right">Outflow (Debit -)</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Staff</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No ledger transactions found matching the filter.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {new Date(row.date).toLocaleString([], {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {row.typeLabel}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {row.accountName}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {row.inflow > 0 ? `+ ${currencySymbol} ${row.inflow.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                        {row.outflow > 0 ? `- ${currencySymbol} ${row.outflow.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {row.reference || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {row.recordedBy}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={row.notes}>
                        {row.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FUND TRANSFER (CASH ⇄ BANK) */}
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
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Transfer Type</label>
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
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Transfer Amount ({currencySymbol}) *
            </label>
            <input
              type="number"
              step="any"
              min="1"
              required
              placeholder="e.g. 50000"
              value={transferForm.amount}
              onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
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
              placeholder="e.g. Meezan Bank, HBL, MCB, EasyPaisa"
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
            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Bank Accounts Summary</h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl overflow-hidden">
              {bankAccounts.map((b) => (
                <div key={b.id} className="p-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{b.bankName}</span>
                    <span className="text-slate-400 text-[11px] block">{b.accountName} • {b.accountNumber}</span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white">
                    {currencySymbol} {Number(b.currentBalance).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setIsPrintModalOpen(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => window.print()}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print Statement</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

