import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  DollarSign,
  Plus,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  RefreshCw,
  Building2,
  Calendar,
  AlertTriangle,
  Check,
  CreditCard,
} from 'lucide-react';
import { SubscriptionPaymentMethod } from '@pos/shared';

export const PlatformPayments: React.FC = () => {
  const { success, error, info } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown & Action states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modals
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('Payment receipt unverified or bounced');

  const [form, setForm] = useState({
    tenantId: '',
    amount: 12000,
    currency: 'PKR',
    paymentMethod: SubscriptionPaymentMethod.BANK_TRANSFER,
    transactionReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });

  // Close three-dot menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPayments = async () => {
    try {
      let url = '/platform/payments?';
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      const data = await api.get(url);
      setPayments(data.payments || []);
    } catch (err: any) {
      console.error('Failed to load payments:', err);
      error(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await api.get('/platform/tenants');
      setTenants(data.tenants || []);
      if (data.tenants?.length > 0 && !form.tenantId) {
        setForm((prev) => ({ ...prev, tenantId: data.tenants[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, [statusFilter]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/platform/payments', {
        ...form,
        amount: Number(form.amount),
      });
      success('Subscription payment recorded and tenant billing period extended');
      setIsRecordOpen(false);
      fetchPayments();
    } catch (err: any) {
      error(err.message || 'Failed to record payment');
    }
  };

  const handleVerifyPayment = async (paymentId: string) => {
    try {
      await api.post(`/platform/payments/${paymentId}/verify`, {});
      success('Payment approved and marked as COMPLETED');
      setActiveMenuId(null);
      fetchPayments();
    } catch (err: any) {
      error(err.message || 'Failed to approve payment');
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment) return;
    try {
      await api.post(`/platform/payments/${selectedPayment.id}/reject`, {
        reason: rejectReason,
      });
      success('Payment marked as REJECTED');
      setIsRejectOpen(false);
      fetchPayments();
    } catch (err: any) {
      error(err.message || 'Failed to reject payment');
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.invoice_number && p.invoice_number.toLowerCase().includes(s)) ||
      (p.tenant_name && p.tenant_name.toLowerCase().includes(s)) ||
      (p.transaction_reference && p.transaction_reference.toLowerCase().includes(s))
    );
  });

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Subscription Invoices & Payments
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track manual subscription billing collections, bank transfers, approvals, and issued tax invoices
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchPayments();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsRecordOpen(true)}
            className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Subscription Payment</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice #, restaurant or ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Payment Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending Approval</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Invoice #</th>
                <th className="px-6 py-3.5">Restaurant</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Method / Ref</th>
                <th className="px-6 py-3.5">Coverage Period</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading payment records...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No payment records found. Click "Record Subscription Payment" to add one.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isMenuOpen = activeMenuId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {p.invoice_number || 'INV-PENDING'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {p.tenant_name}
                      </td>
                      <td className="px-6 py-4 font-black text-slate-900 dark:text-white text-sm">
                        {p.currency} {Number(p.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        <div className="font-semibold">{p.payment_method?.replace('_', ' ')}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.transaction_reference ? `Ref: ${p.transaction_reference}` : 'No Ref'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {new Date(p.period_start).toLocaleDateString()} to{' '}
                        {new Date(p.period_end).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'COMPLETED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : p.status === 'PENDING'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(p.payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right relative">
                        {/* Three-Dot Action Trigger */}
                        <div className="inline-block text-left" ref={isMenuOpen ? menuRef : undefined}>
                          <button
                            onClick={() => setActiveMenuId(isMenuOpen ? null : p.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Payment actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Action Dropdown */}
                          {isMenuOpen && (
                            <div className="origin-top-right absolute right-6 mt-1 w-48 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 z-50 focus:outline-none text-left animate-in fade-in zoom-in-95 duration-100">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSelectedPayment(p);
                                    setIsDetailsOpen(true);
                                  }}
                                  className="w-full flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                                  <span>View Invoice Details</span>
                                </button>
                              </div>

                              {p.status === 'PENDING' && (
                                <div className="py-1">
                                  <button
                                    onClick={() => handleVerifyPayment(p.id)}
                                    className="w-full flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve Payment</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      setSelectedPayment(p);
                                      setIsRejectOpen(true);
                                    }}
                                    className="w-full flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject Payment</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Record Payment */}
      <Modal isOpen={isRecordOpen} onClose={() => setIsRecordOpen(false)} title="Record Subscription Payment" maxWidth="xl">
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Restaurant Tenant *</label>
              <select
                required
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.owner_name} • {t.city || 'HQ'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount *</label>
              <input
                type="number"
                min="1"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Currency</label>
              <input
                type="text"
                required
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value={SubscriptionPaymentMethod.BANK_TRANSFER}>Bank Wire / IBFT</option>
                <option value={SubscriptionPaymentMethod.MANUAL_CASH}>Cash Collection</option>
                <option value={SubscriptionPaymentMethod.ONLINE_GATEWAY}>Online Payment Gateway</option>
                <option value={SubscriptionPaymentMethod.CHECK}>Bank Cheque</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Transaction Ref / Cheque #</label>
              <input
                type="text"
                value={form.transactionReference}
                onChange={(e) => setForm({ ...form, transactionReference: e.target.value })}
                placeholder="e.g. PK-IBFT-948291"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Coverage Start Date</label>
              <input
                type="date"
                required
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Coverage End Date</label>
              <input
                type="date"
                required
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional billing details or remarks..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRecordOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
            >
              Record & Extend Subscription
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Invoice Details */}
      {selectedPayment && (
        <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title={`Invoice: ${selectedPayment.invoice_number}`} maxWidth="md">
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Restaurant:</span>
                <span className="font-bold text-slate-800 dark:text-white">{selectedPayment.tenant_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice Amount:</span>
                <span className="font-black text-slate-900 dark:text-white text-sm">
                  {selectedPayment.currency} {Number(selectedPayment.amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedPayment.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Method:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedPayment.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction Reference:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{selectedPayment.transaction_reference || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coverage Window:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(selectedPayment.period_start).toLocaleDateString()} - {new Date(selectedPayment.period_end).toLocaleDateString()}
                </span>
              </div>
              {selectedPayment.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block mb-0.5">Notes:</span>
                  <p className="text-slate-700 dark:text-slate-300 italic">{selectedPayment.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
              >
                Close Invoice
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Reject Payment */}
      <Modal isOpen={isRejectOpen} onClose={() => setIsRejectOpen(false)} title="Reject Payment Submission" maxWidth="md">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reason for Rejection *</label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRejectOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRejectPayment}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
