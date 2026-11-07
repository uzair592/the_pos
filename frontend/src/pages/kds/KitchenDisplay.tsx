import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  ChefHat,
  Clock,
  CheckCircle,
  Play,
  Check,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Volume2,
  VolumeX,
  Flame,
  AlertTriangle,
  Utensils,
  BellRing,
  Search,
  Filter,
  ArrowDownUp,
  Calendar,
  Trash2,
  Phone,
  MapPin,
  User,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { PrepStatus, PrepStation } from '@pos/shared';

export const KitchenDisplay: React.FC = () => {
  const { user, tenant, currentBranchId, branches } = useAuth();
  const { success, error, info } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'SERVED' | 'ALL'>('ACTIVE');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [isClearingStale, setIsClearingStale] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const [entitlementError, setEntitlementError] = useState<string | null>(null);

  const prevTicketIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Web Audio API Order Chime
  const playNewOrderChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const startTime = ctx.currentTime;

      // Note 1: High crisp ding (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, startTime);
      gain1.gain.setValueAtTime(0.3, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(startTime);
      osc1.stop(startTime + 0.35);

      // Note 2: Harmonic pleasant chime (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, startTime + 0.12);
      gain2.gain.setValueAtTime(0.35, startTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(startTime + 0.12);
      osc2.stop(startTime + 0.65);
    } catch (e) {
      console.log('Web Audio notification not active:', e);
    }
  };

  const fetchTickets = async () => {
    try {
      let url = '/kds/tickets';
      const params = new URLSearchParams();
      if (stationFilter !== 'ALL') params.append('station', stationFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (selectedBranchId && selectedBranchId !== 'ALL') params.append('branchId', selectedBranchId);
      if (sortOrder) params.append('sort', sortOrder);
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;

      const data = await api.get(url);
      const newTickets: any[] = data.tickets || [];

      // Check if any new pending ticket arrived
      if (!isFirstLoadRef.current) {
        const hasNewTicket = newTickets.some((t) => !prevTicketIdsRef.current.has(t.id));
        if (hasNewTicket) {
          playNewOrderChime();
        }
      } else {
        isFirstLoadRef.current = false;
      }

      prevTicketIdsRef.current = new Set(newTickets.map((t) => t.id));
      setTickets(newTickets);
      setEntitlementError(null);
    } catch (err: any) {
      if (err?.code === 'FEATURE_NOT_ENTITLED' || err?.status === 403 || err?.message?.includes('Feature') || err?.message?.includes('subscription')) {
        setEntitlementError(err.message || 'Kitchen Display System (KDS) is not included in the current subscription plan.');
      } else {
        console.error('Failed to load KDS tickets:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const pollInterval = setInterval(fetchTickets, 3500);
    const clockInterval = setInterval(() => setNow(Date.now()), 5000);

    // Instant multi-tab / same-browser synchronization listeners
    const handleOrderUpdate = () => {
      fetchTickets();
    };
    window.addEventListener('pos_order_updated', handleOrderUpdate);

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === 'pos_last_order_at') {
        fetchTickets();
      }
    };
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
      window.removeEventListener('pos_order_updated', handleOrderUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [stationFilter, statusFilter, selectedBranchId, sortOrder, dateFilter, searchQuery, soundEnabled]);

  const updateTicketStatus = async (ticketId: string, nextStatus: PrepStatus) => {
    try {
      await api.put(`/kds/tickets/${ticketId}/status`, { status: nextStatus });
      success(`Ticket status updated to ${nextStatus}`);
      fetchTickets();

      // Trigger instant real-time sync for Dashboard and other tabs
      window.dispatchEvent(new CustomEvent('pos_order_updated', { detail: { ticketId, status: nextStatus } }));
      try {
        localStorage.setItem('pos_last_order_at', Date.now().toString());
      } catch (_) {}
    } catch (err: any) {
      error(err.message || 'Failed to update ticket status');
    }
  };

  const handleClearStale = async () => {
    if (!window.confirm('Mark all active tickets older than 24 hours as SERVED to clean up the kitchen board?')) {
      return;
    }
    setIsClearingStale(true);
    try {
      const res = await api.post('/kds/tickets/clear-stale', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        hours: 24,
      });
      success(`Cleaned up ${res.clearedCount} stale ticket(s) from active kitchen board.`);
      fetchTickets();
    } catch (err: any) {
      error(err.message || 'Failed to clear stale tickets');
    } finally {
      setIsClearingStale(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col font-sans select-none">
      {/* KDS Top Header */}
      <header className="bg-[#0c101d] px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/hub"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace Hub</span>
          </Link>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center text-white shadow-md">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight">Kitchen Order Display (KDS)</h1>
              <p className="text-[10px] text-slate-400">
                {tenant?.name || 'Kitchen Operations'} • Live Kitchen Operations Hub
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {/* Branch Selector */}
          {branches && branches.length > 0 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-slate-900/90 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:border-brand-500"
              title="Filter tickets by branch"
            >
              <option value="ALL">🌐 All Branches ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Quick Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Order # or Table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded-xl w-36 sm:w-48 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title={`Current sort: ${sortOrder === 'DESC' ? 'Newest orders first' : 'Oldest prep orders first'}`}
          >
            <ArrowDownUp className="w-3.5 h-3.5 text-brand-400" />
            <span>{sortOrder === 'DESC' ? '🔥 Newest First' : '⏱️ Oldest First'}</span>
          </button>

          {/* Date Filter Toggle */}
          <button
            onClick={() => setDateFilter(dateFilter === 'TODAY' ? 'ALL' : 'TODAY')}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border transition-all ${
              dateFilter === 'TODAY'
                ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle between Today's live orders and all historical orders"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateFilter === 'TODAY' ? "Today's Orders" : 'All Dates'}</span>
          </button>

          {/* Clean Up Stale Tickets (>24h) */}
          <button
            onClick={handleClearStale}
            disabled={isClearingStale}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 transition-colors disabled:opacity-50"
            title="Clear all active tickets older than 24 hours that were left pending"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline">Clear Stale (&gt;24h)</span>
          </button>

          {/* Sound Chime Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playNewOrderChime();
            }}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-emerald-400'
                : 'bg-slate-900/50 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Audio alert active on new orders' : 'Audio alert muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound' : 'Muted'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchTickets}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Secondary Bar: Status Filters & Stations */}
      <div className="bg-[#090d18] px-4 sm:px-6 py-2.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Status Mode Tabs */}
        <div className="flex items-center space-x-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          {[
            { id: 'ACTIVE', label: '🔥 Active Cooking' },
            { id: 'SERVED', label: '✅ Served' },
            { id: 'ALL', label: '📋 All Tickets' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === tab.id
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Station Tabs */}
        <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-bold overflow-x-auto max-w-full">
          {['ALL', PrepStation.KITCHEN, PrepStation.BBQ, PrepStation.DRINKS, PrepStation.DESSERTS, 'GRILL', 'BAR'].map((st) => (
            <button
              key={st}
              onClick={() => setStationFilter(st)}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                stationFilter === st
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Live Active Tickets Counter */}
        <div className="text-[11px] text-slate-400 font-bold flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{tickets.length} Ticket{tickets.length === 1 ? '' : 's'} on Screen</span>
        </div>
      </div>

      {/* Ticket Board Grid */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {loading ? (
          <div className="text-center py-24 text-slate-400 text-xs">Loading live kitchen orders...</div>
        ) : entitlementError ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white text-center">Kitchen Display System Not Included</h3>
            <p className="text-xs text-slate-400 max-w-md text-center leading-relaxed">
              {entitlementError}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Link
                to="/app/settings"
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-500/20"
              >
                Upgrade to Growth Plan
              </Link>
              <button
                onClick={fetchTickets}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-24">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-slate-200">All kitchen orders are cleared!</p>
            <p className="text-xs text-slate-500 max-w-md text-center">
              {dateFilter === 'TODAY'
                ? "No active orders for today yet. Any new order placed from the POS terminal will appear here instantly."
                : "No matching tickets found. New orders submitted by POS cashiers or waiter tablets appear here with an audio chime."}
            </p>
            {dateFilter === 'TODAY' && (
              <button
                onClick={() => setDateFilter('ALL')}
                className="mt-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white"
              >
                View All Historical Dates
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {tickets.map((t) => {
              const isPending = t.status === PrepStatus.PENDING;
              const isAccepted = t.status === PrepStatus.ACCEPTED;
              const isPreparing = t.status === PrepStatus.PREPARING;
              const isReady = t.status === PrepStatus.READY;
              const isServed = t.status === PrepStatus.SERVED;

              // Compute elapsed prep minutes
              const elapsedMinutes = Math.floor((now - new Date(t.created_at).getTime()) / 60000);
              const isUrgent = elapsedMinutes >= 10 && elapsedMinutes < 20;
              const isDelayedWarning = elapsedMinutes >= 20;

              let statusBorder = 'border-slate-800';
              let badgeBg = 'bg-slate-800 text-slate-300';

              if (isDelayedWarning && !isServed) {
                statusBorder = 'border-rose-500 ring-2 ring-rose-500/50';
              } else if (isPending) {
                statusBorder = 'border-amber-500/60 ring-1 ring-amber-500/30';
                badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
              } else if (isAccepted) {
                statusBorder = 'border-blue-500/60';
                badgeBg = 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
              } else if (isPreparing) {
                statusBorder = 'border-orange-500/60';
                badgeBg = 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
              } else if (isReady) {
                statusBorder = 'border-emerald-500 ring-2 ring-emerald-500/40';
                badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
              } else if (isServed) {
                statusBorder = 'border-slate-800/80 opacity-75';
                badgeBg = 'bg-slate-800 text-slate-400';
              }

              return (
                <div
                  key={t.id}
                  className={`bg-[#0f1423] rounded-2xl border p-4 shadow-xl flex flex-col justify-between transition-all ${statusBorder}`}
                >
                  <div>
                    {/* Header: Ticket Number & Elapsed Time */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2.5">
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-mono text-base font-black text-brand-400">
                            {t.kot_number}
                          </span>
                          {t.branch_name && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold uppercase">
                              {t.branch_name}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5">
                          <span>Order:</span>
                          <span className="text-white font-black">#{t.order_number || t.live_order_number}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeBg}`}>
                          {t.status}
                        </span>

                        {/* Live Timer with Warning Colors */}
                        <div className="flex items-center justify-end space-x-1 mt-1 text-[11px] font-bold">
                          <Clock className={`w-3.5 h-3.5 ${
                            isServed
                              ? 'text-slate-500'
                              : isDelayedWarning
                              ? 'text-rose-400'
                              : isUrgent
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`} />
                          <span className={`${
                            isServed
                              ? 'text-slate-400'
                              : isDelayedWarning
                              ? 'text-rose-400 font-black'
                              : isUrgent
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }`}>
                            {elapsedMinutes}m elapsed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delayed Warning Banner */}
                    {isDelayedWarning && !isServed && (
                      <div className="mb-2.5 px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center space-x-1.5 text-rose-300 text-[10px] font-black uppercase tracking-wider">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>DELAYED ORDER: Kitchen Attention Needed!</span>
                      </div>
                    )}

                    {/* Operational Meta: Order Type, Table, Station & Payment Status */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between items-center text-xs text-slate-300 bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-800/80">
                        <span className="flex items-center space-x-1">
                          <span className="text-slate-400">Type:</span>
                          <strong className="text-white uppercase">{t.order_type}</strong>
                        </span>
                        {t.table_number && (
                          <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-extrabold border border-brand-500/30">
                            Table {t.table_number}
                          </span>
                        )}
                        <span>Station: <strong className="text-brand-400">{t.station}</strong></span>
                      </div>

                      {/* Payment & Customer Information Bar */}
                      <div className="flex items-center justify-between px-2.5 py-1 bg-slate-900/40 rounded-lg text-[11px] border border-slate-800/50">
                        <div className="flex items-center space-x-1.5 truncate">
                          {t.payment_status === 'PAID' ? (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] flex items-center space-x-1">
                              <CheckCircle className="w-2.5 h-2.5" />
                              <span>PAID</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px] flex items-center space-x-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>UNPAID</span>
                            </span>
                          )}
                          {t.customer_name && (
                            <span className="text-slate-300 font-bold truncate max-w-[120px]">
                              {t.customer_name}
                            </span>
                          )}
                        </div>
                        {t.grand_total && (
                          <span className="text-slate-400 font-mono font-bold text-[10px]">
                            PKR {Number(t.grand_total).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Delivery address if applicable */}
                      {t.delivery_address && (
                        <div className="px-2.5 py-1 bg-blue-950/30 border border-blue-900/50 rounded-lg text-[10px] text-blue-300 flex items-center space-x-1 truncate">
                          <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                          <span className="truncate">{t.delivery_address}</span>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-2 text-xs">
                      {t.items?.map((it: any) => (
                        <div key={it.id} className="py-1.5 border-b border-slate-800/70">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-black text-white text-sm mr-1.5 text-brand-400">
                                {it.quantity}x
                              </span>
                              <span className="font-bold text-slate-100">{it.product_name}</span>
                              {it.variant_name && (
                                <span className="text-[10px] text-slate-400 block italic">
                                  ({it.variant_name})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Modifiers & Addons Summary */}
                          {it.modifiers_summary && (
                            <div className="mt-1 flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                              <span>⚡ Addons: {it.modifiers_summary}</span>
                            </div>
                          )}

                          {/* Cooking Notes / Special Instructions */}
                          {it.notes && (
                            <div className="mt-1 flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                              <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Instruction: {it.notes}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Whole Order Note */}
                    {t.notes && (
                      <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] font-medium">
                        <strong className="text-amber-200">Special Cooking Note:</strong> {t.notes}
                      </div>
                    )}
                  </div>

                  {/* Status Action Buttons */}
                  <div className="pt-3.5 mt-3 border-t border-slate-800">
                    {isPending && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.ACCEPTED)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md active:scale-[0.98]"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept Kitchen Ticket</span>
                      </button>
                    )}

                    {isAccepted && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.PREPARING)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md active:scale-[0.98]"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {isPreparing && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateTicketStatus(t.id, PrepStatus.READY)}
                          className="flex items-center justify-center space-x-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md active:scale-[0.98]"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Mark Ready</span>
                        </button>
                        <button
                          onClick={() => updateTicketStatus(t.id, PrepStatus.SERVED)}
                          className="flex items-center justify-center space-x-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-xl text-xs transition-colors shadow-md active:scale-[0.98]"
                        >
                          <Check className="w-4 h-4" />
                          <span>Mark Served</span>
                        </button>
                      </div>
                    )}

                    {isReady && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.SERVED)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-xl text-xs transition-colors shadow-lg active:scale-[0.98]"
                      >
                        <Check className="w-4 h-4" />
                        <span>Mark Served ✓</span>
                      </button>
                    )}

                    {isServed && (
                      <div className="text-center py-1.5 text-xs font-bold text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800/80">
                        ✓ Served to Customer
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
