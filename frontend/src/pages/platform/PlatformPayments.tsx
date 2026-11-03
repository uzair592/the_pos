import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../../components/common/Modal.js';
import { DollarSign, Plus, Search, FileText, CheckCircle2 } from 'lucide-react';
import { SubscriptionPaymentMethod } from '@pos/shared';

export const PlatformPayments: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecordOpen, setIsRecordOpen] = useState(false);

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

  const fetchPayments = async () => {
    try {
      const data = await api.get('/platform/payments');
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
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
    } catch (err) {
      console.error('Failed to load tenants:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, []);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/platform/payments', {
        ...form,
        amount: Number(form.amount),
      });
      setIsRecordOpen(false);
      fetchPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Subscription Invoices & Payments</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track manual subscription collections, bank transfers, and issued invoices
          </p>
        </div>
        <button
          onClick={() => setIsRecordOpen(true)}
          className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Subscription Payment</span>
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Invoice #</th>
                <th className="px-6 py-3.5">Restaurant</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Method / Ref</th>
                <th className="px-6 py-3.5">Coverage Period</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    No payment records found. Click "Record Subscription Payment" to add one.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-brand-600">
                      {p.invoice_number}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {p.tenant_name}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="font-semibold">{p.payment_method}</span>
                      <div className="text-[10px] text-slate-400 font-mono">{p.transaction_reference}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-[11px]">
                      {p.period_start} to {p.period_end}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {p.recorded_by_name || 'Admin'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Record Payment */}
      <Modal isOpen={isRecordOpen} onClose={() => setIsRecordOpen(false)} title="Record Manual Subscription Payment" maxWidth="md">
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Restaurant Customer</label>
            <select
              value={form.tenantId}
              onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.owner_name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount</label>
              <input
                type="number"
                min="1"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency</label>
              <input
                type="text"
                required
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              >
                <option value={SubscriptionPaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                <option value={SubscriptionPaymentMethod.MANUAL_CASH}>Cash</option>
                <option value={SubscriptionPaymentMethod.CHECK}>Cheque</option>
                <option value={SubscriptionPaymentMethod.ONLINE_GATEWAY}>Online Gateway</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transaction Ref #</label>
              <input
                type="text"
                required
                placeholder="TRX-987654"
                value={form.transactionReference}
                onChange={(e) => setForm({ ...form, transactionReference: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Period Start</label>
              <input
                type="date"
                required
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Period End</label>
              <input
                type="date"
                required
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Received via Meezan Bank AC# 1234..."
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2 border-t">
            <button
              type="button"
              onClick={() => setIsRecordOpen(false)}
              className="px-4 py-2 border rounded-lg text-slate-600"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg font-bold">
              Record & Activate Subscription
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
