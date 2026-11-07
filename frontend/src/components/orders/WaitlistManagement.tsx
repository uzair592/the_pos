import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../common/Modal.js';
import { ActionMenu } from '../common/ActionMenu.js';
import {
  Users,
  Clock,
  Phone,
  Plus,
  Bell,
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Armchair,
  Search,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Check,
} from 'lucide-react';
import { WaitlistStatus } from '@pos/shared';

interface WaitlistEntryItem {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  queue_number: number;
  estimated_wait_minutes: number;
  status: WaitlistStatus;
  assigned_table_id: string | null;
  assigned_table_number: string | null;
  floor_name: string | null;
  branch_name: string | null;
  notes: string | null;
  notified_at: string | null;
  seated_at: string | null;
  created_at: string;
  waiting_minutes?: number;
}

export const WaitlistManagement: React.FC = () => {
  const { tenant, branches, currentBranchId } = useAuth();
  const { success, error: toastError } = useToast();

  const [waitlist, setWaitlist] = useState<WaitlistEntryItem[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || '');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE'); // ACTIVE = WAITING + NOTIFIED
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntryItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    branchId: currentBranchId || '',
    customerName: '',
    customerPhone: '',
    guestCount: 2,
    estimatedWaitMinutes: 15,
    assignedTableId: '',
    notes: '',
  });
  const [seatTableId, setSeatTableId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (currentBranchId) {
      setBranchFilter(currentBranchId);
      setFormData((prev) => ({ ...prev, branchId: currentBranchId }));
    }
  }, [currentBranchId]);

  const fetchTables = useCallback(async () => {
    try {
      const activeBranch = branchFilter || currentBranchId;
      const queryStr = activeBranch ? `?branchId=${encodeURIComponent(activeBranch)}` : '';
      const res = await api.get(`/restaurant/tables${queryStr}`);
      setTables(res.tables || []);
    } catch (err: any) {
      console.error('Failed to load tables:', err);
    }
  }, [branchFilter, currentBranchId]);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (branchFilter) params.branchId = branchFilter;
      if (statusFilter !== 'ACTIVE') {
        params.status = statusFilter;
      }
      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/waitlist?${queryStr}`);
      let list = res.waitlist || [];
      if (statusFilter === 'ACTIVE') {
        list = list.filter((w: WaitlistEntryItem) => w.status === 'WAITING' || w.status === 'NOTIFIED');
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(
          (w: WaitlistEntryItem) =>
            w.customer_name.toLowerCase().includes(q) ||
            w.customer_phone.includes(q) ||
            String(w.queue_number).includes(q)
        );
      }
      setWaitlist(list);
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch waitlist');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, statusFilter, searchQuery, toastError]);

  useEffect(() => {
    fetchWaitlist();
    fetchTables();
  }, [fetchWaitlist, fetchTables]);

  const handleOpenAdd = () => {
    setFormData({
      branchId: branchFilter || branches?.[0]?.id || '',
      customerName: '',
      customerPhone: '',
      guestCount: 2,
      estimatedWaitMinutes: 15,
      assignedTableId: '',
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const handleAddWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      toastError('Customer name and phone number are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/waitlist', {
        branchId: formData.branchId || branches?.[0]?.id,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        guestCount: Number(formData.guestCount),
        estimatedWaitMinutes: Number(formData.estimatedWaitMinutes),
        assignedTableId: formData.assignedTableId || undefined,
        notes: formData.notes.trim() || undefined,
      });

      success('Customer added to waitlist queue!');
      setIsAddModalOpen(false);
      fetchWaitlist();
    } catch (err: any) {
      toastError(err.message || 'Failed to add to waitlist');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotifyCustomer = async (entry: WaitlistEntryItem) => {
    try {
      await api.post(`/waitlist/${entry.id}/notify`, {});
      success(`Customer ${entry.customer_name} marked as NOTIFIED (Table Ready)!`);
      fetchWaitlist();
    } catch (err: any) {
      toastError(err.message || 'Failed to notify customer');
    }
  };

  const handleOpenSeat = (entry: WaitlistEntryItem) => {
    setSelectedEntry(entry);
    setSeatTableId(entry.assigned_table_id || '');
    setIsSeatModalOpen(true);
  };

  const handleExecuteSeat = async () => {
    if (!selectedEntry) return;
    setSubmitting(true);
    try {
      await api.post(`/waitlist/${selectedEntry.id}/seat`, {
        tableId: seatTableId || undefined,
      });
      success(`Customer ${selectedEntry.customer_name} seated at table!`);
      setIsSeatModalOpen(false);
      fetchWaitlist();
    } catch (err: any) {
      toastError(err.message || 'Failed to seat customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWaitlist = async (entry: WaitlistEntryItem) => {
    if (!window.confirm(`Remove ${entry.customer_name} from the waitlist?`)) return;
    try {
      await api.delete(`/waitlist/${entry.id}`);
      success('Customer removed from waitlist');
      fetchWaitlist();
    } catch (err: any) {
      toastError(err.message || 'Failed to remove from waitlist');
    }
  };

  // KPIs
  const waitingCount = waitlist.filter((w) => w.status === 'WAITING').length;
  const notifiedCount = waitlist.filter((w) => w.status === 'NOTIFIED').length;
  const availableTablesCount = tables.filter((t) => t.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      {/* Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Currently Waiting</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{waitingCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Notified (Ready)</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{notifiedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Armchair className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Available Tables</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{availableTablesCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total in Queue</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{waitlist.length}</p>
          </div>
        </div>
      </div>

      {/* Action and Filter Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-brand-500" />
              <span>Live Guest Waitlist Queue</span>
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {waitlist.length} parties
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchWaitlist}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Refresh Waitlist"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} />
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Walk-in to Waitlist</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or token #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            >
              <option value="ACTIVE">Active Queue (Waiting & Notified)</option>
              <option value="ALL">All History Records</option>
              <option value="WAITING">Waiting Only</option>
              <option value="NOTIFIED">Notified (Ready)</option>
              <option value="SEATED">Seated</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {branches && branches.length > 1 && (
            <div>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Waitlist Queue Cards / Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-center">Token / Queue</th>
                <th className="px-4 py-3">Guest Details</th>
                <th className="px-4 py-3 text-center">Party Size</th>
                <th className="px-4 py-3">Wait Duration</th>
                <th className="px-4 py-3">Target Table / Notes</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                      <span>Loading waitlist queue...</span>
                    </div>
                  </td>
                </tr>
              ) : waitlist.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">Waitlist is currently empty</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      When dine-in capacity is full, add arriving walk-in guests to manage the queue smoothly
                    </p>
                  </td>
                </tr>
              ) : (
                waitlist.map((entry) => {
                  const isWaiting = entry.status === 'WAITING';
                  const isNotified = entry.status === 'NOTIFIED';
                  const isSeated = entry.status === 'SEATED';
                  const elapsedMins = entry.waiting_minutes ? Math.round(entry.waiting_minutes) : 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 font-extrabold text-base shadow-sm">
                          <span>#{entry.queue_number}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 dark:text-white text-xs">{entry.customer_name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{entry.customer_phone}</span>
                        </p>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Users className="w-3 h-3" />
                          <span>{entry.guest_count}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Waiting: ~{elapsedMins} mins</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Est. wait was: {entry.estimated_wait_minutes || 15} mins
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {entry.assigned_table_number ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            <Armchair className="w-3 h-3" />
                            <span>Pref: Table {entry.assigned_table_number}</span>
                          </span>
                        ) : null}
                        {entry.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 truncate max-w-[180px]">
                            {entry.notes}
                          </p>
                        )}
                        {!entry.assigned_table_number && !entry.notes && (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isWaiting
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : isNotified
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-pulse'
                              : isSeated
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isNotified && <Bell className="w-3 h-3" />}
                          <span>{entry.status}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isWaiting && (
                            <button
                              onClick={() => handleNotifyCustomer(entry)}
                              className="flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              title="Notify Guest Table is Ready"
                            >
                              <Bell className="w-3 h-3" />
                              <span>Notify</span>
                            </button>
                          )}

                          {(isWaiting || isNotified) && (
                            <button
                              onClick={() => handleOpenSeat(entry)}
                              className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              title="Seat Customer at Table"
                            >
                              <UtensilsCrossed className="w-3 h-3" />
                              <span>Seat</span>
                            </button>
                          )}

                          <ActionMenu
                            items={[
                              (isWaiting || isNotified)
                                ? {
                                    label: 'Cancel & Remove',
                                    variant: 'danger',
                                    onClick: () => handleCancelWaitlist(entry),
                                  }
                                : false,
                            ]}
                          />
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

      {/* ADD TO WAITLIST MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Walk-In Guest to Waitlist"
        maxWidth="md"
      >
        <form onSubmit={handleAddWaitlist} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Guest Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Asad Bilal"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +92 300 1234567"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Party Size (Covers)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.guestCount}
                onChange={(e) => setFormData({ ...formData, guestCount: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estimated Wait (Mins)
              </label>
              <select
                value={formData.estimatedWaitMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedWaitMinutes: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Table (Optional)
              </label>
              <select
                value={formData.assignedTableId}
                onChange={(e) => setFormData({ ...formData, assignedTableId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value="">-- No preference --</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.table_number} ({t.capacity} seats)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Seating Preferences / Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Toddler high chair needed, outdoor patio preferred..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add to Waitlist'}
            </button>
          </div>
        </form>
      </Modal>

      {/* SEAT FROM WAITLIST MODAL */}
      <Modal
        isOpen={isSeatModalOpen}
        onClose={() => setIsSeatModalOpen(false)}
        title="Seat Guest at Table"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-brand-50 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-900 flex items-start space-x-3">
            <UtensilsCrossed className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Seating Queue #{selectedEntry?.queue_number} - {selectedEntry?.customer_name} ({selectedEntry?.guest_count} Guests)
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Assigning a table will mark this party as SEATED and update table status to OCCUPIED.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Select Dining Table:
            </label>
            <select
              value={seatTableId}
              onChange={(e) => setSeatTableId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="">-- Choose Table --</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.table_number} ({t.capacity} seats) - Status: {t.status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSeatModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteSeat}
              disabled={submitting || !seatTableId}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Seating...' : 'Confirm & Seat Customer'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
