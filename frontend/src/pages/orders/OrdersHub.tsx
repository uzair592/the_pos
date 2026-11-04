import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { PaymentMethod } from '@pos/shared';
import {
  ShoppingBag,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Printer,
  RotateCcw,
  Eye,
  UtensilsCrossed,
  Truck,
  Armchair,
  Flame,
  Check,
  X,
  RefreshCw,
  DollarSign,
  Calendar,
  CalendarDays,
  CalendarRange,
  Layers,
  Boxes,
  CreditCard,
  Wallet,
  Receipt,
} from 'lucide-react';

// Format date to local YYYY-MM-DD
const formatLocalYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Format YYYY-MM-DD to human friendly date string
const formatDisplayDate = (ymd: string): string => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

import { ReceiptModal } from '../../components/common/ReceiptModal.js';

export const OrdersHub: React.FC = () => {
  const { user, tenant, currentBranchId, branches } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [activeStageFilter, setActiveStageFilter] = useState<'ALL' | 'UNPAID_SERVED' | 'KITCHEN' | 'DINING' | 'DELIVERY'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || '');

  // Keep branchFilter aligned with global branch switch
  useEffect(() => {
    if (currentBranchId) {
      setBranchFilter(currentBranchId);
    }
  }, [currentBranchId]);

  // Active Orders state
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loadingActive, setLoadingActive] = useState<boolean>(true);

  // History Orders state
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('TODAY');
  const [specificDate, setSpecificDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [customStartDate, setCustomStartDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [historySummary, setHistorySummary] = useState<{
    totalOrders: number;
    totalAmount: number;
    totalCompletedAmount: number;
    completedCount: number;
    cancelledCount: number;
  } | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Selected Order for Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  // Settle Payment Modal state
  const [settleOrder, setSettleOrder] = useState<any | null>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [settleCashTendered, setSettleCashTendered] = useState<number>(0);
  const [settleSubmitting, setSettleSubmitting] = useState<boolean>(false);

  // Sync Timestamp for Multi-device live sync
  const lastSyncTimeRef = useRef<string>(new Date().toISOString());

  // Fetch Active Orders
  const fetchActiveOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingActive(true);
    try {
      const queryStr = branchFilter ? `?branchId=${branchFilter}` : '';
      const data = await api.get(`/orders/active${queryStr}`);
      setActiveOrders(data.orders || []);
    } catch (err: any) {
      if (!isBackground) toastError(err.message || 'Failed to load active orders');
    } finally {
      if (!isBackground) setLoadingActive(false);
    }
  }, [branchFilter, toastError]);

  // Fetch History Orders with Custom Specific Date and Range support
  const fetchHistoryOrders = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (dateRange === 'TODAY') {
        const todayYmd = formatLocalYMD(new Date());
        const [y, m, d] = todayYmd.split('-').map(Number);
        startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
      } else if (dateRange === 'YESTERDAY') {
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        const yestYmd = formatLocalYMD(yest);
        const [y, m, d] = yestYmd.split('-').map(Number);
        startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
      } else if (dateRange === 'SPECIFIC_DATE') {
        if (specificDate) {
          const [y, m, d] = specificDate.split('-').map(Number);
          startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
          endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        }
      } else if (dateRange === 'CUSTOM_RANGE') {
        if (customStartDate) {
          const [y, m, d] = customStartDate.split('-').map(Number);
          startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        }
        if (customEndDate) {
          const [y, m, d] = customEndDate.split('-').map(Number);
          endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        }
      } else if (dateRange === '7DAYS') {
        const past = new Date();
        past.setDate(past.getDate() - 7);
        startDate = new Date(past.getFullYear(), past.getMonth(), past.getDate(), 0, 0, 0, 0).toISOString();
        endDate = new Date().toISOString();
      } else if (dateRange === '30DAYS') {
        const past = new Date();
        past.setDate(past.getDate() - 30);
        startDate = new Date(past.getFullYear(), past.getMonth(), past.getDate(), 0, 0, 0, 0).toISOString();
        endDate = new Date().toISOString();
      }

      const params: any = {
        page,
        limit: 15,
      };
      if (branchFilter) params.branchId = branchFilter;
      if (searchQuery) params.search = searchQuery;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.orderType = typeFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const queryStr = new URLSearchParams(params).toString();
      const data = await api.get(`/orders?${queryStr}`);
      setHistoryOrders(data.orders || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
      if (data.summary) {
        setHistorySummary(data.summary);
      } else {
        setHistorySummary(null);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to load orders history');
    } finally {
      setLoadingHistory(false);
    }
  }, [dateRange, specificDate, customStartDate, customEndDate, branchFilter, page, searchQuery, statusFilter, typeFilter, toastError]);

  // Day navigation handlers for Specific Date picker
  const handlePrevDay = () => {
    const [y, m, d] = specificDate.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 1);
    setSpecificDate(formatLocalYMD(prev));
    setPage(1);
  };

  const handleNextDay = () => {
    const [y, m, d] = specificDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    setSpecificDate(formatLocalYMD(next));
    setPage(1);
  };

  const handleJumpToday = () => {
    setSpecificDate(formatLocalYMD(new Date()));
    setPage(1);
  };

  // Initial fetch and auto-polling for Multi-Device synchronization
  useEffect(() => {
    if (activeTab === 'active') {
      fetchActiveOrders();
    } else {
      fetchHistoryOrders();
    }
  }, [activeTab, fetchActiveOrders, fetchHistoryOrders]);

  // Multi-device sync polling every 3 seconds for active operations
  useEffect(() => {
    if (activeTab !== 'active') return;

    const interval = setInterval(async () => {
      try {
        const syncData = await api.get(`/sync/events?since=${encodeURIComponent(lastSyncTimeRef.current)}`);
        if (syncData.events && syncData.events.length > 0) {
          lastSyncTimeRef.current = syncData.serverTime || new Date().toISOString();
          fetchActiveOrders(true);
        }
      } catch (e) {
        // quiet background sync fail
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab, fetchActiveOrders]);

  // Handle Settle Order Checkout
  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleOrder) return;
    setSettleSubmitting(true);
    try {
      const grandTotalNum = Number(settleOrder.grand_total);
      const isCash = settlePaymentMethod === PaymentMethod.CASH;
      const tendered = isCash ? Math.max(grandTotalNum, Number(settleCashTendered) || 0) : grandTotalNum;
      const changeGiven = isCash ? Math.max(0, tendered - grandTotalNum) : 0;

      await api.post(`/orders/${settleOrder.id}/checkout`, {
        payments: [
          {
            method: settlePaymentMethod,
            amount: grandTotalNum,
          },
        ],
        changeGiven,
      });

      success(`Payment settled for Order #${settleOrder.order_number}! Completed.`);
      setReceiptOrder(settleOrder);
      setSettleOrder(null);
      fetchActiveOrders(true);
    } catch (err: any) {
      toastError(err.message || 'Failed to settle payment');
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Status advance action
  const handleAdvanceStatus = async (order: any, nextStatus: string) => {
    try {
      await api.patch(`/orders/${order.id}/status`, { status: nextStatus });
      success(`Order #${order.order_number} moved to ${nextStatus.replace('_', ' ')}`);
      fetchActiveOrders(true);
      if (selectedOrder?.id === order.id) {
        openOrderDetails(order.id);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update order status');
    }
  };

  // Open Full Details Modal
  const openOrderDetails = async (orderId: string) => {
    setLoadingDetails(true);
    try {
      const data = await api.get(`/orders/${orderId}`);
      setSelectedOrder(data.order);
    } catch (err: any) {
      toastError(err.message || 'Failed to load order details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Filter Active Orders by Operational Stage
  const filteredActiveOrders = activeOrders.filter((order) => {
    if (activeStageFilter === 'UNPAID_SERVED') {
      return order.status === 'SERVED' || order.payment_status === 'PENDING';
    }
    if (activeStageFilter === 'KITCHEN') {
      return ['PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY'].includes(order.status);
    }
    if (activeStageFilter === 'DINING') {
      return order.order_type === 'DINE_IN' && ['SERVED', 'READY', 'PREPARING'].includes(order.status);
    }
    if (activeStageFilter === 'DELIVERY') {
      return order.order_type === 'DELIVERY' || order.status === 'OUT_FOR_DELIVERY';
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-brand-500" />
            Orders Management Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time live operational queue, kitchen tracking, table service & historical audit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {branches && branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 shadow-sm focus:ring-2 focus:ring-brand-500"
            >
              <option value="">🏢 All Branches (Consolidated)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  📍 {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'active'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Live Active Orders</span>
            {activeOrders.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-brand-500 text-white">
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All Orders History</span>
          </button>
        </div>
        </div>
      </div>

      {/* VIEW 1: LIVE ACTIVE ORDERS */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          {/* Operational Stage Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Stage:
              </span>
              {[
                { id: 'ALL', label: 'All Active', count: activeOrders.length },
                {
                  id: 'UNPAID_SERVED',
                  label: '🍽️ Food Served / Unpaid',
                  icon: DollarSign,
                  count: activeOrders.filter((o) => o.status === 'SERVED' || o.payment_status === 'PENDING').length,
                  highlight: true,
                },
                {
                  id: 'KITCHEN',
                  label: 'Preparing / Kitchen',
                  icon: Flame,
                  count: activeOrders.filter((o) => ['PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length,
                },
                {
                  id: 'DINING',
                  label: 'Dine-In / Seated',
                  icon: Armchair,
                  count: activeOrders.filter((o) => o.order_type === 'DINE_IN' && ['SERVED', 'READY', 'PREPARING'].includes(o.status)).length,
                },
                {
                  id: 'DELIVERY',
                  label: 'Out for Delivery',
                  icon: Truck,
                  count: activeOrders.filter((o) => o.order_type === 'DELIVERY' || o.status === 'OUT_FOR_DELIVERY').length,
                },
              ].map((stage: any) => {
                const isSelected = activeStageFilter === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => setActiveStageFilter(stage.id)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-brand-500 text-white shadow-sm'
                        : stage.highlight && stage.count > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-black'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {stage.icon && <stage.icon className="w-3.5 h-3.5" />}
                    <span>{stage.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/30 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                      {stage.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => fetchActiveOrders()}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingActive ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {/* Active Orders Grid */}
          {loadingActive ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800/40 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredActiveOrders.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Active Queue is Clear</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No active orders currently awaiting preparation or delivery in this filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredActiveOrders.map((order) => {
                const elapsedMin = Math.round(Number(order.elapsed_minutes || 0));
                const isUrgent = elapsedMin > 25;
                const isWarning = elapsedMin > 15;

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Order Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-base font-black text-slate-900 dark:text-white">
                              #{order.order_number}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                order.order_type === 'DINE_IN'
                                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
                                  : order.order_type === 'DELIVERY'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {order.order_type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {order.table_number ? `Table ${order.table_number}` : order.customer_name || 'Walk-in'} • {order.branch_name}
                          </p>
                        </div>

                        {/* Elapsed Timer Badge */}
                        <div
                          className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-black ${
                            isUrgent
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse'
                              : isWarning
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{elapsedMin}m</span>
                        </div>
                      </div>

                      {/* Items Summary */}
                      <div className="space-y-2 mb-4">
                        {(order.items || []).map((it: any) => (
                          <div key={it.id} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              <span className="font-black text-brand-600 dark:text-brand-400 mr-1.5">
                                {it.quantity}x
                              </span>
                              {it.product_name}
                              {it.variant_name && <span className="text-slate-400 text-[10px] ml-1">({it.variant_name})</span>}
                            </span>
                            <span className="text-slate-500 font-semibold">{tenant?.currency || 'PKR'} {Number(it.total_price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      {order.order_notes && (
                        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-2 text-[11px] text-amber-800 dark:text-amber-300 mb-3">
                          <span className="font-bold">Note: </span>
                          {order.order_notes}
                        </div>
                      )}

                      {order.status === 'SERVED' && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-2.5 text-xs text-emerald-800 dark:text-emerald-300 mb-3 flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Food Served • Unpaid Bill
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-black">
                            {tenant?.currency || 'PKR'} {Number(order.grand_total).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Status & Quick Action Pipeline */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-bold text-slate-400">Current Status:</span>
                        <span className="font-extrabold text-brand-600 dark:text-brand-400">
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Status Pipeline Advancer */}
                        {['PENDING', 'CONFIRMED', 'ACCEPTED'].includes(order.status) && (
                          <button
                            onClick={() => handleAdvanceStatus(order, 'PREPARING')}
                            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <Flame className="w-3.5 h-3.5" />
                            <span>Start Prep</span>
                          </button>
                        )}
                        {order.status === 'PREPARING' && (
                          <button
                            onClick={() => handleAdvanceStatus(order, 'READY')}
                            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Ready</span>
                          </button>
                        )}
                        {order.status === 'READY' && order.order_type === 'DINE_IN' && (
                          <button
                            onClick={() => handleAdvanceStatus(order, 'SERVED')}
                            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <Armchair className="w-3.5 h-3.5" />
                            <span>Mark Served</span>
                          </button>
                        )}
                        {order.status === 'READY' && order.order_type === 'DELIVERY' && (
                          <button
                            onClick={() => handleAdvanceStatus(order, 'OUT_FOR_DELIVERY')}
                            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dispatch</span>
                          </button>
                        )}
                        {order.status === 'SERVED' && order.payment_status !== 'PAID' && (
                          <button
                            onClick={() => {
                              setSettleOrder(order);
                              setSettleCashTendered(Number(order.grand_total));
                              setSettlePaymentMethod(PaymentMethod.CASH);
                            }}
                            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm shadow-emerald-500/20"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Take Payment</span>
                          </button>
                        )}
                        {((order.status === 'SERVED' && order.payment_status === 'PAID') || order.status === 'OUT_FOR_DELIVERY' || (order.status === 'READY' && order.order_type === 'TAKEAWAY')) && (
                          <button
                            onClick={() => handleAdvanceStatus(order, 'COMPLETED')}
                            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                        )}

                        {/* View Details / Receipt Button */}
                        <button
                          onClick={() => openOrderDetails(order.id)}
                          className="w-full flex items-center justify-center space-x-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ALL ORDERS HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Order #, customer, table..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REFUNDED">Refunded</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY">Ready</option>
                <option value="SERVED">Served</option>
              </select>

              {/* Order Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">All Order Types</option>
                <option value="DINE_IN">Dine-In</option>
                <option value="TAKEAWAY">Takeaway</option>
                <option value="DELIVERY">Delivery</option>
                <option value="COUNTER">Counter</option>
              </select>

              {/* Date Filter Dropdown */}
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="TODAY">Today's Orders</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="SPECIFIC_DATE">Specific Date (Calendar 📅)</option>
                <option value="CUSTOM_RANGE">Custom Date Range (📆)</option>
                <option value="7DAYS">Last 7 Days</option>
                <option value="30DAYS">Last 30 Days</option>
                <option value="ALL">All Time</option>
              </select>
            </div>

            {/* Quick Date Presets Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date:
                </span>
                {[
                  { id: 'TODAY', label: "Today" },
                  { id: 'YESTERDAY', label: "Yesterday" },
                  { id: 'SPECIFIC_DATE', label: "Specific Date 📅" },
                  { id: 'CUSTOM_RANGE', label: "Custom Range 📆" },
                  { id: '7DAYS', label: "7 Days" },
                  { id: '30DAYS', label: "30 Days" },
                  { id: 'ALL', label: "All Time" },
                ].map((preset) => {
                  const isSelected = dateRange === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setDateRange(preset.id);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-brand-500 text-white shadow-sm ring-2 ring-brand-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => fetchHistoryOrders()}
                className="flex items-center space-x-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* SPECIFIC DATE SELECTOR PANEL */}
            {dateRange === 'SPECIFIC_DATE' && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900/60 rounded-2xl animate-in fade-in">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 block">
                      Specific Date Selected
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {formatDisplayDate(specificDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={handlePrevDay}
                    title="Jump to Previous Day"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-sm"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev Day</span>
                  </button>

                  <div className="relative">
                    <input
                      type="date"
                      value={specificDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSpecificDate(e.target.value);
                          setPage(1);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 shadow-sm cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleNextDay}
                    title="Jump to Next Day"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-sm"
                  >
                    <span>Next Day</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {specificDate !== formatLocalYMD(new Date()) && (
                    <button
                      onClick={handleJumpToday}
                      className="px-3 py-1.5 text-xs font-black rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-sm transition-all"
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CUSTOM RANGE SELECTOR PANEL */}
            {dateRange === 'CUSTOM_RANGE' && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900/60 rounded-2xl animate-in fade-in">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                    <CalendarRange className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 block">
                      Custom Date Range
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {formatDisplayDate(customStartDate)} → {formatDisplayDate(customEndDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-500">From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setPage(1);
                      }}
                      className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 shadow-sm"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-500">To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setPage(1);
                      }}
                      className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 shadow-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Orders Aggregate Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                {dateRange === 'SPECIFIC_DATE' ? `Orders on ${formatDisplayDate(specificDate)}` : 'Filtered Orders'}
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
                {historySummary?.totalOrders ?? totalCount}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Total Revenue
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {tenant?.currency || 'PKR'} {Number(historySummary?.totalAmount || 0).toLocaleString()}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Completed Sales
              </span>
              <span className="text-lg font-black text-sky-600 dark:text-sky-400 mt-0.5 block">
                {historySummary?.completedCount ?? historyOrders.filter((o) => o.status === 'COMPLETED').length} orders
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Cancelled / Refunded
              </span>
              <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
                {historySummary?.cancelledCount ?? historyOrders.filter((o) => ['CANCELLED', 'REFUNDED'].includes(o.status)).length} orders
              </span>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Order #</th>
                    <th className="px-4 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Type & Table</th>
                    <th className="px-4 py-3.5">Items</th>
                    <th className="px-4 py-3.5 text-right">Grand Total</th>
                    <th className="px-4 py-3.5 text-right">FIFO COGS</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-slate-400 animate-pulse">
                        Loading order records...
                      </td>
                    </tr>
                  ) : historyOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        No orders matching criteria
                      </td>
                    </tr>
                  ) : (
                    historyOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-black text-slate-900 dark:text-white">
                          #{ord.order_number}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {new Date(ord.created_at).toLocaleDateString()}{' '}
                          <span className="text-[10px] text-slate-400">
                            {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {ord.order_type.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {ord.table_number ? `Table ${ord.table_number}` : ord.customer_name || 'Walk-in'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          {ord.item_count} items
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-white">
                          {tenant?.currency || 'PKR'} {Number(ord.grand_total).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {tenant?.currency || 'PKR'} {Number(ord.total_cogs || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              ord.status === 'COMPLETED'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : ord.status === 'CANCELLED'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                : 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                            }`}
                          >
                            {ord.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => openOrderDetails(ord.id)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg transition-colors"
                            title="View Full Order Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setReceiptOrder(ord)}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition-colors"
                            title="Reprint Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500">
                  Showing page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages}</span> ({totalCount} total orders)
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 text-xs font-bold"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 text-xs font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL ORDER DETAILS MODAL (WITH EXACT FIFO BATCH & PROFIT MARGINS) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Order #{selectedOrder.order_number}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                    {selectedOrder.status}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Placed on {new Date(selectedOrder.created_at).toLocaleString()} by Cashier {selectedOrder.cashier_name || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Order Items</h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedOrder.items || []).map((it: any) => (
                    <div key={it.id} className="p-3 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white">
                          {it.quantity}x {it.product_name}
                        </span>
                        {it.variant_name && <span className="text-slate-400 text-[10px] ml-1">({it.variant_name})</span>}
                        {it.cogs > 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 ml-2">
                            • FIFO COGS: {tenant?.currency || 'PKR'} {Number(it.cogs).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {tenant?.currency || 'PKR'} {Number(it.total_price).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* FIFO Batch Consumptions Details (If Available) */}
              {selectedOrder.batchConsumptions && selectedOrder.batchConsumptions.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-brand-500" />
                    Exact FIFO Batch Stock Deductions
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    {selectedOrder.batchConsumptions.map((bc: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>
                          {bc.ingredient_name || 'Ingredient'}: {bc.quantity} {bc.ingredient_unit} consumed @ unit cost {tenant?.currency || 'PKR'} {Number(bc.unit_cost).toFixed(2)}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {tenant?.currency || 'PKR'} {Number(bc.total_cost).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Totals & Margins */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>{tenant?.currency || 'PKR'} {Number(selectedOrder.subtotal).toLocaleString()}</span>
                </div>
                {Number(selectedOrder.total_discount) > 0 && (
                  <div className="flex justify-between text-rose-500">
                    <span>Discount:</span>
                    <span>- {tenant?.currency || 'PKR'} {Number(selectedOrder.total_discount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Tax:</span>
                  <span>{tenant?.currency || 'PKR'} {Number(selectedOrder.tax_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-base text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Grand Total:</span>
                  <span>{tenant?.currency || 'PKR'} {Number(selectedOrder.grand_total).toLocaleString()}</span>
                </div>
                {selectedOrder.totalCogs > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                    <span>Gross Profit (FIFO):</span>
                    <span>
                      {tenant?.currency || 'PKR'} {Number(selectedOrder.grossProfit).toFixed(2)}
                      {' '}({((Number(selectedOrder.grossProfit) / (Number(selectedOrder.subtotal) || 1)) * 100).toFixed(1)}% margin)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2.5">
              <button
                onClick={() => {
                  setReceiptOrder(selectedOrder);
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Reprint Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SETTLE PAYMENT MODAL */}
      {settleOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  <span>Settle Bill & Complete Order</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Order #{settleOrder.order_number} • {settleOrder.table_number ? `Table ${settleOrder.table_number}` : settleOrder.customer_name || 'Walk-in'}
                </p>
              </div>
              <button
                onClick={() => setSettleOrder(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="p-6 space-y-5">
              {/* Grand Total Callout */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Total Amount Due</span>
                  <p className="text-2xl font-black text-emerald-900 dark:text-white">
                    {tenant?.currency || 'PKR'} {Number(settleOrder.grand_total).toLocaleString()}
                  </p>
                </div>
                <div className="text-right text-xs text-emerald-700 dark:text-emerald-400">
                  <span>{settleOrder.items?.length || 0} items ordered</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: PaymentMethod.CASH, label: 'Cash', icon: DollarSign },
                    { id: PaymentMethod.CARD, label: 'Credit / Debit Card', icon: CreditCard },
                    { id: PaymentMethod.DIGITAL_WALLET, label: 'Digital Wallet', icon: Wallet },
                    { id: PaymentMethod.BANK_TRANSFER, label: 'Bank Transfer', icon: Receipt },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettlePaymentMethod(m.id as PaymentMethod)}
                      className={`flex items-center space-x-2.5 p-3 rounded-2xl border text-xs font-bold transition-all ${
                        settlePaymentMethod === m.id
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <m.icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Tendered & Change Calculation */}
              {settlePaymentMethod === PaymentMethod.CASH && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Cash Received from Customer:
                    </label>
                    <div className="flex gap-1.5">
                      {[100, 500, 1000, 5000].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setSettleCashTendered((prev) => (Number(prev) || 0) + inc)}
                          className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                        >
                          +{inc}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={settleCashTendered || ''}
                    onChange={(e) => setSettleCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    placeholder="Enter cash received"
                  />
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">Change Due to Customer:</span>
                    <span className="font-black text-sm text-brand-600 dark:text-brand-400">
                      {tenant?.currency || 'PKR'}{' '}
                      {Math.max(0, (Number(settleCashTendered) || 0) - Number(settleOrder.grand_total)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSettleOrder(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleSubmitting}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{settleSubmitting ? 'Processing Payment...' : 'Receive Payment & Complete Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptOrder && (
        <ReceiptModal
          isOpen={!!receiptOrder}
          receiptData={receiptOrder}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
};

