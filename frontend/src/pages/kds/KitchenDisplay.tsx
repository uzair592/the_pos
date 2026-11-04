import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { PrepStatus, PrepStation } from '@pos/shared';

export const KitchenDisplay: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const url = stationFilter === 'ALL'
        ? '/kds/tickets'
        : `/kds/tickets?station=${stationFilter}`;
      const data = await api.get(url);
      setTickets(data.tickets || []);
    } catch (err) {
      console.error('Failed to load KDS tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 4000);
    return () => clearInterval(interval);
  }, [stationFilter]);

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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* KDS Header */}
      <header className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <Link
            to="/hub"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace Hub</span>
          </Link>
          <div className="flex items-center space-x-2">
            <ChefHat className="w-6 h-6 text-brand-500" />
            <h1 className="text-lg font-black tracking-tight">Kitchen Order Display (KDS)</h1>
          </div>
        </div>

        {/* Station Filters */}
        <div className="flex items-center space-x-2 text-xs font-bold">
          {['ALL', PrepStation.KITCHEN, PrepStation.BBQ, PrepStation.DRINKS, PrepStation.DESSERTS].map((st) => (
            <button
              key={st}
              onClick={() => setStationFilter(st)}
              className={`px-3 py-1.5 rounded-xl transition-colors ${
                stationFilter === st
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={fetchTickets}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg ml-2"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Ticket Board Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading live kitchen orders...</div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500 opacity-60" />
            <p className="text-base font-bold text-slate-300">All orders are cleared!</p>
            <p className="text-xs text-slate-500">New orders placed at the POS will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {tickets.map((t) => {
              const isPending = t.status === PrepStatus.PENDING;
              const isAccepted = t.status === PrepStatus.ACCEPTED;
              const isPreparing = t.status === PrepStatus.PREPARING;
              const isReady = t.status === PrepStatus.READY;

              let statusBg = 'bg-slate-800 border-slate-700';
              let badgeBg = 'bg-slate-700 text-slate-300';

              if (isPending) {
                statusBg = 'bg-slate-800 border-amber-500/50 ring-1 ring-amber-500/30';
                badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
              } else if (isAccepted) {
                statusBg = 'bg-slate-800 border-blue-500/50';
                badgeBg = 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
              } else if (isPreparing) {
                statusBg = 'bg-slate-800 border-orange-500/50';
                badgeBg = 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
              } else if (isReady) {
                statusBg = 'bg-slate-800 border-emerald-500/50 ring-2 ring-emerald-500/40';
                badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
              }

              return (
                <div
                  key={t.id}
                  className={`rounded-2xl border p-4 shadow-lg flex flex-col justify-between transition-all ${statusBg}`}
                >
                  <div>
                    {/* Header: Ticket Number & Elapsed Time */}
                    <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                      <div>
                        <span className="font-mono text-sm font-black text-brand-400">
                          {t.kot_number}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          Order: <span className="text-white font-semibold">{t.order_number}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${badgeBg}`}>
                          {t.status}
                        </span>
                        <div className="text-[10px] text-slate-400 flex items-center justify-end space-x-1 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Meta: Table / Server / Station */}
                    <div className="flex justify-between text-xs text-slate-300 mb-3 bg-slate-900/50 p-2 rounded-xl">
                      <span>Type: <strong className="text-white">{t.order_type}</strong></span>
                      {t.table_number && <span>Table: <strong className="text-white">{t.table_number}</strong></span>}
                      <span>Station: <strong className="text-brand-400">{t.station}</strong></span>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2 text-xs">
                      {t.items?.map((it: any) => (
                        <div key={it.id} className="flex items-start justify-between py-1 border-b border-slate-800/80">
                          <div className="pr-2">
                            <span className="font-extrabold text-white text-sm">
                              {it.quantity}x
                            </span>{' '}
                            <span className="font-bold text-slate-100">{it.product_name}</span>
                            {it.variant_name && (
                              <span className="text-[10px] text-slate-400 block italic">
                                ({it.variant_name})
                              </span>
                            )}
                            {it.notes && (
                              <span className="text-[10px] text-amber-300 block font-semibold mt-0.5">
                                Note: {it.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {t.notes && (
                      <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px]">
                        <strong>Order Note:</strong> {t.notes}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 mt-4 border-t border-slate-700/80">
                    {isPending && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.ACCEPTED)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept Ticket</span>
                      </button>
                    )}

                    {isAccepted && (
                      <button
                        onClick={() => updateTicketStatus(t.id, PrepStatus.PREPARING)}
                        className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {isPreparing && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateTicketStatus(t.id, PrepStatus.READY)}
                          className="flex items-center justify-center space-x-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors"
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
