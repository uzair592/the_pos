import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Activity,
  Database,
  Cpu,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';

export const PlatformSystemHealth: React.FC = () => {
  const { error } = useToast();
  const [health, setHealth] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = async () => {
    try {
      const data = await api.get('/platform/system-health');
      setHealth(data);
    } catch (err: any) {
      console.error('Failed to load system health:', err);
      error(err.message || 'Failed to query system health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-md">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              System Health & Infrastructure
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live telemetry monitoring database connection pools, memory heaps, node latency, and 24h incidents
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Auto-refresh (10s)</span>
          </label>
          <button
            onClick={() => {
              setLoading(true);
              fetchHealth();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading && !health ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
          Querying infrastructure status...
        </div>
      ) : (
        <>
          {/* Status Top Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Platform API</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {health?.apiStatus || 'OPERATIONAL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Uptime: {formatUptime(health?.uptimeSeconds || 0)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Database Latency</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-2xl font-black text-brand-600 dark:text-brand-400">
                    {health?.database?.latencyMs || 0} ms
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Status: {health?.database?.status || 'HEALTHY'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Node.js Memory (RSS)</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {health?.system?.memoryUsageMb || 0} MB
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Heap Used: {health?.system?.heapUsedMb || 0} MB</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">24h Error Incidents</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-2xl font-black ${
                    (health?.incidents24h || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {health?.incidents24h || 0}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Audit log security alerts</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Deep Pool & Host Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database Connection Pool Diagnostics */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    PostgreSQL Connection Pool Status
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  Healthy
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Total Pool Connections:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {health?.database?.activePoolClients || 0} clients
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Idle Available Connections:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {health?.database?.idlePoolClients || 0} idle
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Waiting Client Requests:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {health?.database?.waitingClients || 0} queued
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500 dark:text-slate-400">Database Engine:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">PostgreSQL (Multi-tenant RLS Ready)</span>
                </div>
              </div>
            </div>

            {/* Host Runtime & Machine Specs */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    Host Environment & Server Specs
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">{health?.system?.platform}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Node Runtime:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {health?.system?.nodeVersion}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Available CPU Cores:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {health?.system?.cpuCount} Cores
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Host Free / Total Memory:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {health?.system?.systemFreeMemMb} MB / {health?.system?.systemTotalMemMb} MB
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500 dark:text-slate-400">Server Clock Timestamp:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {new Date(health?.serverTime).toUTCString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
