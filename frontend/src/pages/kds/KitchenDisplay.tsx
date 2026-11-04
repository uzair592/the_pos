import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { BranchSelector } from '../../components/common/BranchSelector.js';
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
} from 'lucide-react';
import { PrepStatus, PrepStation } from '@pos/shared';

export const KitchenDisplay: React.FC = () => {
  const { user, currentBranchId, currentBranch } = useAuth();
  const { success, error } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'SERVED' | 'ALL'>('ACTIVE');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

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
      if (currentBranchId) params.append('branchId', currentBranchId);
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
    } catch (err) {
      console.error('Failed to load KDS tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const pollInterval = setInterval(fetchTickets, 3500);
    const clockInterval = setInterval(() => setNow(Date.now()), 5000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
    };
  }, [stationFilter, statusFilter, currentBranchId, soundEnabled]);

  const updateTicketStatus = async (ticketId: string, nextStatus: PrepStatus) => {
    try {
      await api.put(`/kds/tickets/${ticketId}/status`, { status: nextStatus });
      success(`Ticket status updated to ${nextStatus}`);
      fetchTickets();
    } catch (err: any) {
      error(err.message || 'Failed to update ticket status');
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col font-sans select-none">
      {/* KDS Header */}
      <header className="bg-[#0c101d] px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-4">
          <Link
            to="/hub"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace Hub</span>
          </Link>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center text-white shadow-md">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight">Kitchen Order Display (KDS)</h1>
              <p className="text-[11px] text-slate-400">
                {currentBranch?.name || 'All Branches'} • Real-Time Kitchen Operations
              </p>
            </div>
          </div>
        </div>

        {/* Branch Selector, Station Filter & Sound Toggle */}
        <div className="flex items-center space-x-2.5 text-xs font-bold">
          <BranchSelector variant="hub" />

          {/* Sound Notification Chime Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playNewOrderChime();
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-emerald-400'
                : 'bg-slate-900/50 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Chime sound is active on new orders' : 'Chime muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          {/* Status Mode Filters */}
          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'ACTIVE', label: '🔥 Active Cooking' },
              { id: 'SERVED', label: '✅ Served / Unpaid' },
              { id: 'ALL', label: '📋 All Tickets' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Station Filters */}
          <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            {['ALL', PrepStation.KITCHEN, PrepStation.BBQ, PrepStation.DRINKS, PrepStation.DESSERTS].map((st) => (
              <button
                key={st}
                onClick={() => setStationFilter(st)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  stationFilter === st
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={fetchTickets}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Ticket Board Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-xs">Loading live kitchen orders...</div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-24">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-slate-200">All kitchen orders are cleared!</p>
            <p className="text-xs text-slate-500 max-w-sm text-center">
              New orders submitted by waiter tablets or POS cashiers will appear here with an audio alert.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {tickets.map((t) => {
              const isPending = t.status === PrepStatus.PENDING;
              const isAccepted = t.status === PrepStatus.ACCEPTED;
              const isPreparing = t.status === PrepStatus.PREPARING;
              const isReady = t.status === PrepStatus.READY;

              // Compute elapsed prep minutes
              const elapsedMinutes = Math.floor((now - new Date(t.created_at).getTime()) / 60000);
              const isUrgent = elapsedMinutes >= 10 && elapsedMinutes < 20;
              const isDelayedWarning = elapsedMinutes >= 20;

              let statusBorder = 'border-slate-800';
              let badgeBg = 'bg-slate-800 text-slate-300';

              if (isDelayedWarning) {
                statusBorder = 'border-rose-500 ring-2 ring-rose-500/50 animate-pulse';
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
              }

              return (
                <div
                  key={t.id}
                  className={`bg-[#0f1423] rounded-2xl border p-4 shadow-xl flex flex-col justify-between transition-all ${statusBorder}`}
                >
                  <div>
                    {/* Header: Ticket Number & Elapsed Time Warning */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-base font-black text-brand-400">
                            {t.kot_number}
                          </span>
                          {t.branch_name && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-bold uppercase">
                              {t.branch_name}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Order: <span className="text-white font-bold">#{t.order_number}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeBg}`}>
                          {t.status}
                        </span>

                        {/* Live Timer with Warning Colors */}
                        <div className="flex items-center justify-end space-x-1 mt-1 text-[11px] font-bold">
                          <Clock className={`w-3.5 h-3.5 ${
                            isDelayedWarning
                              ? 'text-rose-400 animate-spin'
                              : isUrgent
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`} />
                          <span className={`${
                            isDelayedWarning
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
                    {isDelayedWarning && (
                      <div className="mb-3 px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center space-x-1.5 text-rose-300 text-[10px] font-black uppercase tracking-wider">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>DELAYED ORDER: Kitchen Attention Needed!</span>
                      </div>
                    )}

                    {/* Meta: Table / Station / Waiter */}
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-3 bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-800/80">
                      <span>Type: <strong className="text-white">{t.order_type}</strong></span>
                      {t.table_number && (
                        <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-extrabold border border-brand-500/30">
                          Table {t.table_number}
                        </span>
                      )}
                      <span>Station: <strong className="text-brand-400">{t.station}</strong></span>
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
                  <div className="pt-4 mt-4 border-t border-slate-800">
                    {isPending && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.ACCEPTED)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept Kitchen Ticket</span>
                      </button>
                    )}

                    {isAccepted && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.PREPARING)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {isPreparing && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateTicketStatus(t.id, PrepStatus.READY)}
                          className="flex items-center justify-center space-x-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Mark Ready</span>
                        </button>
                        <button
                          onClick={() => updateTicketStatus(t.id, PrepStatus.SERVED)}
                          className="flex items-center justify-center space-x-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-xl text-xs transition-colors shadow-md"
                        >
                          <Check className="w-4 h-4" />
                          <span>Mark Served</span>
                        </button>
                      </div>
                    )}

                    {isReady && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.SERVED)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-xl text-xs transition-colors shadow-lg"
                      >
                        <Check className="w-4 h-4" />
                        <span>Mark Served → Send to Unpaid Bills</span>
                      </button>
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
