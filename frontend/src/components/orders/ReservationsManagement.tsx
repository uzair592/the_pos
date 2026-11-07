import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../common/Modal.js';
import { ActionMenu } from '../common/ActionMenu.js';
import {
  Calendar,
  Clock,
  Users,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  XCircle,
  Armchair,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  RefreshCw,
  UtensilsCrossed,
  Check,
  ChevronRight,
} from 'lucide-react';
import { ReservationStatus } from '@pos/shared';

interface ReservationItem {
  id: string;
  tenant_id: string;
  branch_id: string;
  table_id: string | null;
  table_number: string | null;
  floor_name: string | null;
  branch_name: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  guest_count: number;
  reservation_date: string;
  reservation_time: string;
  duration_minutes: number;
  status: ReservationStatus;
  special_requests: string | null;
  created_at: string;
}

const formatTodayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ReservationsManagement: React.FC = () => {
  const { tenant, branches, currentBranchId } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || '');
  const [dateFilter, setDateFilter] = useState<string>(formatTodayYMD());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<ReservationItem | null>(null);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsNewModalOpen(true);
    }
  }, [searchParams]);

  // Form states
  const [formData, setFormData] = useState({
    branchId: currentBranchId || '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    guestCount: 2,
    tableId: '',
    reservationDate: formatTodayYMD(),
    reservationTime: '19:00',
    durationMinutes: 90,
    specialRequests: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [seatTableId, setSeatTableId] = useState<string>('');

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

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (branchFilter) params.branchId = branchFilter;
      if (dateFilter && dateFilter !== 'ALL') params.date = dateFilter;
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/reservations?${queryStr}`);
      setReservations(res.reservations || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch reservations');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, dateFilter, statusFilter, searchQuery, toastError]);

  useEffect(() => {
    fetchReservations();
    fetchTables();
  }, [fetchReservations, fetchTables]);

  const handleOpenNew = () => {
    setFormData({
      branchId: branchFilter || branches?.[0]?.id || '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      guestCount: 2,
      tableId: '',
      reservationDate: formatTodayYMD(),
      reservationTime: '19:00',
      durationMinutes: 90,
      specialRequests: '',
    });
    setIsNewModalOpen(true);
  };

  const handleOpenEdit = (res: ReservationItem) => {
    setSelectedRes(res);
    setFormData({
      branchId: res.branch_id,
      customerName: res.customer_name,
      customerPhone: res.customer_phone,
      customerEmail: res.customer_email || '',
      guestCount: res.guest_count,
      tableId: res.table_id || '',
      reservationDate: res.reservation_date.split('T')[0],
      reservationTime: res.reservation_time.slice(0, 5),
      durationMinutes: res.duration_minutes || 90,
      specialRequests: res.special_requests || '',
    });
    setIsEditModalOpen(true);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      toastError('Customer name and phone number are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reservations', {
        branchId: formData.branchId || branches?.[0]?.id,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim() || undefined,
        guestCount: Number(formData.guestCount),
        tableId: formData.tableId || undefined,
        reservationDate: formData.reservationDate,
        reservationTime: formData.reservationTime,
        durationMinutes: Number(formData.durationMinutes),
        specialRequests: formData.specialRequests.trim() || undefined,
      });

      success('Reservation confirmed successfully!');
      setIsNewModalOpen(false);
      fetchReservations();
    } catch (err: any) {
      toastError(err.message || 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRes) return;

    setSubmitting(true);
    try {
      await api.put(`/reservations/${selectedRes.id}`, {
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim() || undefined,
        guestCount: Number(formData.guestCount),
        tableId: formData.tableId || null,
        reservationDate: formData.reservationDate,
        reservationTime: formData.reservationTime,
        durationMinutes: Number(formData.durationMinutes),
        specialRequests: formData.specialRequests.trim() || undefined,
      });

      success('Reservation updated successfully');
      setIsEditModalOpen(false);
      fetchReservations();
    } catch (err: any) {
      toastError(err.message || 'Failed to update reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (res: ReservationItem) => {
    if (!window.confirm(`Are you sure you want to cancel the reservation for ${res.customer_name}?`)) return;
    try {
      await api.post(`/reservations/${res.id}/cancel`, {});
      success('Reservation cancelled');
      fetchReservations();
    } catch (err: any) {
      toastError(err.message || 'Failed to cancel reservation');
    }
  };

  const handleOpenSeatModal = (res: ReservationItem) => {
    setSelectedRes(res);
    setSeatTableId(res.table_id || '');
    setIsSeatModalOpen(true);
  };

  const handleExecuteSeat = async () => {
    if (!selectedRes) return;
    setSubmitting(true);
    try {
      await api.post(`/reservations/${selectedRes.id}/seat`, {
        tableId: seatTableId || undefined,
      });
      success(`Customer ${selectedRes.customer_name} seated successfully!`);
      setIsSeatModalOpen(false);
      fetchReservations();
    } catch (err: any) {
      toastError(err.message || 'Failed to seat customer');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Stats
  const confirmedCount = reservations.filter((r) => r.status === 'CONFIRMED').length;
  const seatedCount = reservations.filter((r) => r.status === 'SEATED').length;
  const cancelledCount = reservations.filter((r) => r.status === 'CANCELLED').length;
  const totalGuests = reservations
    .filter((r) => r.status === 'CONFIRMED' || r.status === 'SEATED')
    .reduce((sum, r) => sum + (r.guest_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirmed</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{confirmedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Seated</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{seatedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expected Covers</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{totalGuests}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cancelled</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{cancelledCount}</p>
          </div>
        </div>
      </div>

      {/* Action and Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-brand-500" />
              <span>Table Reservations Hub</span>
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {reservations.length} records
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchReservations}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Refresh Reservations"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} />
            </button>
            <button
              onClick={handleOpenNew}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Reservation</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search guest, phone, table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* Date Selector */}
          <div className="flex items-center space-x-1.5">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg whitespace-nowrap"
              >
                All Dates
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">Confirmed / Upcoming</option>
              <option value="SEATED">Seated at Table</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
            </select>
          </div>

          {/* Branch Filter */}
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

      {/* Reservations Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Guest Details</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3 text-center">Party Size</th>
                <th className="px-4 py-3">Table Assignment</th>
                <th className="px-4 py-3">Special Requests</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                      <span>Loading reservations...</span>
                    </div>
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Armchair className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No reservations found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Create a new reservation to book tables in advance for your guests
                    </p>
                  </td>
                </tr>
              ) : (
                reservations.map((res) => {
                  const isConfirmed = res.status === 'CONFIRMED';
                  const isSeated = res.status === 'SEATED';
                  const isCancelled = res.status === 'CANCELLED';

                  return (
                    <tr key={res.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 dark:text-white text-xs">{res.customer_name}</p>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{res.customer_phone}</span>
                          </span>
                          {res.customer_email && (
                            <span className="flex items-center space-x-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[120px]">{res.customer_email}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-brand-500" />
                          <span>{res.reservation_date.split('T')[0]}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-[11px] text-slate-500 mt-0.5 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{res.reservation_time.slice(0, 5)}</span>
                          <span className="text-slate-400">({res.duration_minutes || 90}m)</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Users className="w-3 h-3" />
                          <span>{res.guest_count}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {res.table_number ? (
                          <div>
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                              <Armchair className="w-3.5 h-3.5" />
                              <span>Table {res.table_number}</span>
                            </span>
                            {res.floor_name && (
                              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{res.floor_name}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {res.special_requests ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={res.special_requests}>
                            {res.special_requests}
                          </p>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isConfirmed
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : isSeated
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isCancelled
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isConfirmed && (
                            <button
                              onClick={() => handleOpenSeatModal(res)}
                              className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              title="Seat Customer at Table"
                            >
                              <UtensilsCrossed className="w-3 h-3" />
                              <span>Seat</span>
                            </button>
                          )}

                          <ActionMenu
                            items={[
                              {
                                label: 'Edit Reservation',
                                onClick: () => handleOpenEdit(res),
                              },
                              isConfirmed
                                ? {
                                    label: 'Cancel Reservation',
                                    variant: 'danger',
                                    onClick: () => handleCancelReservation(res),
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

      {/* NEW RESERVATION MODAL */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Create New Table Reservation"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateReservation} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Guest Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Khan"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

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
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="sarah@example.com"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Number of Guests (Covers)
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

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reservation Date
              </label>
              <input
                type="date"
                required
                value={formData.reservationDate}
                onChange={(e) => setFormData({ ...formData, reservationDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reservation Time
              </label>
              <input
                type="time"
                required
                value={formData.reservationTime}
                onChange={(e) => setFormData({ ...formData, reservationTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Duration (Minutes)
              </label>
              <select
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value={60}>60 minutes (1 hr)</option>
                <option value={90}>90 minutes (1.5 hrs)</option>
                <option value={120}>120 minutes (2 hrs)</option>
                <option value={180}>180 minutes (3 hrs)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assign Dining Table (Optional)
              </label>
              <select
                value={formData.tableId}
                onChange={(e) => setFormData({ ...formData, tableId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value="">-- Choose Later / Unassigned --</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.table_number} ({t.capacity} seats) {t.floor_name ? `- ${t.floor_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Special Requests & Dietary Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Window side preferred, high chair for toddler, birthday celebration..."
              value={formData.specialRequests}
              onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Confirming...' : 'Save & Confirm Reservation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT RESERVATION MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Reservation Details"
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateReservation} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Guest Name</label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Guest Count</label>
              <input
                type="number"
                min="1"
                value={formData.guestCount}
                onChange={(e) => setFormData({ ...formData, guestCount: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Table Assignment</label>
              <select
                value={formData.tableId}
                onChange={(e) => setFormData({ ...formData, tableId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value="">-- Unassigned --</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.table_number} ({t.capacity} seats) {t.floor_name ? `- ${t.floor_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reservation Date</label>
              <input
                type="date"
                required
                value={formData.reservationDate}
                onChange={(e) => setFormData({ ...formData, reservationDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reservation Time</label>
              <input
                type="time"
                required
                value={formData.reservationTime}
                onChange={(e) => setFormData({ ...formData, reservationTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Special Requests</label>
            <textarea
              rows={2}
              value={formData.specialRequests}
              onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* SEAT CUSTOMER MODAL */}
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
                Seating {selectedRes?.customer_name} ({selectedRes?.guest_count} Guests)
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Marking this reservation as seated will automatically update the table status to OCCUPIED.
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
                  Table {t.table_number} ({t.capacity} seats) - Current Status: {t.status}
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
