import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Monitor,
  Search,
  RefreshCw,
  Building2,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  LogOut,
  Smartphone,
  Laptop,
  Tablet,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const PlatformDevices: React.FC = () => {
  const { success, error, info } = useToast();
  const [devices, setDevices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      let url = '/platform/devices?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (tenantFilter) url += `tenantId=${encodeURIComponent(tenantFilter)}&`;
      const data = await api.get(url);
      setDevices(data.devices || []);
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      error(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await api.get('/platform/tenants');
      setTenants(data.tenants || []);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchTenants();

    // Auto-refresh every 15 seconds to keep heartbeat indicators live
    const interval = setInterval(() => {
      fetchDevices();
    }, 15000);
    return () => clearInterval(interval);
  }, [search, tenantFilter]);

  const handleRevokeSession = async (sessionId: string, deviceName: string) => {
    if (!sessionId) return;
    setRevokingId(sessionId);
    try {
      await api.post(`/platform/devices/sessions/${sessionId}/revoke`, {});
      success(`Session revoked for "${deviceName}". The terminal was signed out.`);
      fetchDevices();
    } catch (err: any) {
      error(err.message || 'Failed to revoke device session');
    } finally {
      setRevokingId(null);
    }
  };

  const totalRegistered = devices.length;
  const onlineCount = devices.filter((d) => d.live_connection_status === 'ONLINE').length;
  const idleCount = devices.filter((d) => d.live_connection_status === 'IDLE').length;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Devices & Concurrent Sessions
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live heartbeat monitor, multi-device sessions, and remote session termination without permanent hardware locks
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchDevices();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Currently Connected</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{onlineCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Active POS heartbeats &lt; 3 mins</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Wifi className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Idle Terminals</p>
            <p className="text-2xl font-black text-amber-500 mt-1">{idleCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Last active 3 to 15 mins ago</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Registered Hardware</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalRegistered}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Known terminals across platform</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Info Banner about Dynamic Concurrency */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 rounded-2xl border border-blue-100 dark:border-slate-700 text-xs flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-900 dark:text-white">
            Dynamic Concurrent Session Architecture (No Permanent Hardware Lock)
          </p>
          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5 leading-relaxed">
            Restaurants are allowed up to their configured plan concurrent terminals (e.g. 4/4 connected). Devices dynamically establish sessions via real-time heartbeats. If a fifth device logs in, existing sessions can be revoked or will time out automatically, preventing staff lockout due to hardware replacement.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by device name, fingerprint or restaurant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Restaurants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Device & Fingerprint</th>
                <th className="px-6 py-3.5">Restaurant & Branch</th>
                <th className="px-6 py-3.5">Hardware / OS</th>
                <th className="px-6 py-3.5">Network & IP</th>
                <th className="px-6 py-3.5">Live Status</th>
                <th className="px-6 py-3.5">Last Heartbeat</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                    Monitoring active device sessions...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No active or registered devices found.
                  </td>
                </tr>
              ) : (
                devices.map((d) => {
                  const isOnline = d.live_connection_status === 'ONLINE';
                  const isIdle = d.live_connection_status === 'IDLE';

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5">
                          <Monitor className="w-4 h-4 text-slate-500" />
                          <span>{d.device_name || 'POS Terminal'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]" title={d.device_fingerprint}>
                          FP: {d.device_fingerprint}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{d.tenant_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{d.branch_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        <div className="font-semibold">{d.os_info || d.device_type || 'Desktop Terminal'}</div>
                        <div className="text-[10px] text-slate-400">App: {d.app_version || 'v2.4.0'}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">
                        <div>{d.ip_address || '127.0.0.1'}</div>
                        {d.active_user_name && (
                          <div className="text-[10px] text-brand-600 dark:text-brand-400">
                            User: {d.active_user_name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isOnline
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isIdle
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-500 animate-pulse' : isIdle ? 'bg-amber-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{d.live_connection_status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {d.last_heartbeat_at ? new Date(d.last_heartbeat_at).toLocaleTimeString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {d.session_id ? (
                          <button
                            onClick={() => handleRevokeSession(d.session_id, d.device_name || 'Terminal')}
                            disabled={revokingId === d.session_id}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-[11px] rounded-lg transition-colors border border-rose-200/50 dark:border-rose-900/50"
                            title="Force logout this device session"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>{revokingId === d.session_id ? 'Revoking...' : 'Revoke Session'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No Active Session</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
