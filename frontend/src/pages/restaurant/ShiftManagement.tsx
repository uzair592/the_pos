import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Modal } from '../../components/common/Modal.js';
import { Clock, Plus, Minus, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { CashMovementType } from '@pos/shared';

export const ShiftManagement: React.FC = () => {
  const { tenant } = useAuth();
  const [currentShift, setCurrentShift] = useState<any | null>(null);
  const [pastShifts, setPastShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCashMoveOpen, setIsCashMoveOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);

  // Forms
  const [cashMoveForm, setCashMoveForm] = useState({
    movementType: CashMovementType.CASH_IN,
    amount: 500,
    reason: 'Petty cash added',
  });

  const [closeForm, setCloseForm] = useState({
    actualCash: 0,
    closingNotes: '',
  });

  const currency = tenant?.currency || 'PKR';
  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const fetchData = async () => {
    try {
      const [curRes, pastRes] = await Promise.all([
        api.get('/financial/shifts/current'),
        api.get('/financial/shifts'),
      ]);
      setCurrentShift(curRes.shift || null);
      setPastShifts(pastRes.shifts || []);
      if (curRes.shift) {
        setCloseForm((prev) => ({ ...prev, actualCash: Number(curRes.shift.expected_cash) }));
      }
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    try {
      await api.post('/financial/shifts/cash-movement', {
        shiftId: currentShift.id,
        movementType: cashMoveForm.movementType,
        amount: Number(cashMoveForm.amount),
        reason: cashMoveForm.reason,
      });
      setIsCashMoveOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to record cash movement');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    try {
      await api.post(`/financial/shifts/close?shiftId=${currentShift.id}`, {
        actualCash: Number(closeForm.actualCash),
        closingNotes: closeForm.closingNotes,
      });
      setIsCloseShiftOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to close shift');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Register & Shift Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Cash drawer tracking, cash movements, reconciliation, and shift closing reports
          </p>
        </div>
      </div>

      {/* Active Shift Card */}
      {currentShift ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-sm font-bold text-slate-900">
                Active Shift: {currentShift.register_name}
              </h3>
              <span className="text-xs text-slate-400">
                Opened at {new Date(currentShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsCashMoveOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors"
              >
                Cash In / Out
              </button>
              <button
                onClick={() => setIsCloseShiftOpen(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Close Shift & Reconcile
              </button>
            </div>
          </div>

          {/* Shift Drawer Calculation Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Opening Cash</p>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {currencySymbol} {Number(currentShift.opening_cash).toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">+ Cash Sales</p>
              <p className="text-sm font-bold text-emerald-600 mt-1">
                +{currencySymbol} {Number(currentShift.total_cash_sales).toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">- Cash Refunds</p>
              <p className="text-sm font-bold text-rose-600 mt-1">
                -{currencySymbol} {Number(currentShift.total_cash_refunds).toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Net Cash In/Out</p>
              <p className="text-sm font-bold text-slate-700 mt-1">
                {currencySymbol} {(Number(currentShift.total_cash_in) - Number(currentShift.total_cash_out)).toLocaleString()}
              </p>
            </div>
            <div className="bg-brand-50 p-3 rounded-xl border border-brand-200 col-span-2 sm:col-span-1">
              <p className="text-brand-700 font-bold uppercase text-[10px]">Expected Cash in Drawer</p>
              <p className="text-base font-black text-brand-900 mt-0.5">
                {currencySymbol} {Number(currentShift.expected_cash).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-xs text-amber-900">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold">No Active Shift Opened</h3>
          <p className="text-amber-700 mt-1">
            Open a register shift before processing sales orders in the POS terminal.
          </p>
        </div>
      )}

      {/* Historical Shifts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Closed Shift Reconciliation History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Opened / Closed</th>
                <th className="px-6 py-3.5">Register / Branch</th>
                <th className="px-6 py-3.5">Cashier</th>
                <th className="px-6 py-3.5">Opening Cash</th>
                <th className="px-6 py-3.5">Expected Cash</th>
                <th className="px-6 py-3.5">Actual Cash</th>
                <th className="px-6 py-3.5">Variance</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pastShifts.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3.5 text-slate-600">
                    <div>{new Date(s.opened_at).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-800">
                    {s.register_name}
                    <div className="text-[10px] text-slate-400">{s.branch_name}</div>
                  </td>
                  <td className="px-6 py-3.5 text-slate-700">{s.cashier_name}</td>
                  <td className="px-6 py-3.5 text-slate-700">
                    {currencySymbol} {Number(s.opening_cash).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">
                    {currencySymbol} {Number(s.expected_cash).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">
                    {s.actual_cash !== null ? `${currencySymbol} ${Number(s.actual_cash).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-6 py-3.5">
                    {s.cash_variance !== null ? (
                      <span className={`font-bold ${Number(s.cash_variance) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {Number(s.cash_variance) >= 0 ? '+' : ''}{currencySymbol} {Number(s.cash_variance).toLocaleString()}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === 'CLOSED' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cash In / Out */}
      <Modal isOpen={isCashMoveOpen} onClose={() => setIsCashMoveOpen(false)} title="Record Cash Movement" maxWidth="sm">
        <form onSubmit={handleCashMovement} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Movement Type</label>
            <select
              value={cashMoveForm.movementType}
              onChange={(e) => setCashMoveForm({ ...cashMoveForm, movementType: e.target.value as any })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            >
              <option value={CashMovementType.CASH_IN}>Cash In (Add to Drawer)</option>
              <option value={CashMovementType.CASH_OUT}>Cash Out (Withdraw from Drawer)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Amount ({currency})</label>
            <input
              type="number"
              min="1"
              required
              value={cashMoveForm.amount}
              onChange={(e) => setCashMoveForm({ ...cashMoveForm, amount: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason / Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Petty cash for dairy purchase"
              value={cashMoveForm.reason}
              onChange={(e) => setCashMoveForm({ ...cashMoveForm, reason: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <button type="submit" className="w-full bg-brand-500 text-white font-bold py-2 rounded-lg">
            Record Movement
          </button>
        </form>
      </Modal>

      {/* Modal: Close Shift */}
      <Modal isOpen={isCloseShiftOpen} onClose={() => setIsCloseShiftOpen(false)} title="Close Shift & Cash Reconciliation" maxWidth="md">
        <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Expected Cash in Drawer:</span>
              <span className="font-bold text-slate-900">
                {currencySymbol} {Number(currentShift?.expected_cash || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Actual Cash Counted in Drawer ({currency})
            </label>
            <input
              type="number"
              min="0"
              required
              value={closeForm.actualCash}
              onChange={(e) => setCloseForm({ ...closeForm, actualCash: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2.5 text-base font-black text-slate-900"
            />
          </div>

          <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-100 font-bold">
            <span>Reconciliation Variance:</span>
            <span
              className={`text-sm ${
                closeForm.actualCash - Number(currentShift?.expected_cash || 0) >= 0
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}
            >
              {closeForm.actualCash - Number(currentShift?.expected_cash || 0) >= 0 ? '+' : ''}
              {currencySymbol} {(closeForm.actualCash - Number(currentShift?.expected_cash || 0)).toLocaleString()}
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Closing Notes / Discrepancy Reason</label>
            <textarea
              rows={2}
              value={closeForm.closingNotes}
              onChange={(e) => setCloseForm({ ...closeForm, closingNotes: e.target.value })}
              placeholder="e.g. Drawer verified by manager..."
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-lg"
          >
            Confirm & Finalize Shift Closure
          </button>
        </form>
      </Modal>
    </div>
  );
};
