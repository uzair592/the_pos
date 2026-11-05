import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  Eye,
  FileCode,
  Shield,
  Activity,
} from 'lucide-react';

export const PlatformAuditLogs: React.FC = () => {
  const { error } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected Log Metadata Inspector
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    try {
      let url = '/platform/audit-logs?limit=150&';
      if (actionFilter) url += `action=${encodeURIComponent(actionFilter)}&`;
      if (tenantFilter) url += `tenantId=${encodeURIComponent(tenantFilter)}&`;
      const data = await api.get(url);
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      error(err.message || 'Failed to load security audit logs');
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
    fetchLogs();
    fetchTenants();
  }, [actionFilter, tenantFilter]);

  const filteredLogs = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (l.action && l.action.toLowerCase().includes(s)) ||
      (l.resource_type && l.resource_type.toLowerCase().includes(s)) ||
      (l.tenant_name && l.tenant_name.toLowerCase().includes(s)) ||
      (l.actor_role && l.actor_role.toLowerCase().includes(s))
    );
  });

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Security Audit Logs
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Immutable forensic trail of all platform administrative interventions, restores, credential updates & sessions
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchLogs();
          }}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, actor or tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Action Types</option>
            <option value="TENANT_RESTORED">Tenant Restored</option>
            <option value="UPDATE_TENANT_USER_CREDENTIALS">Credentials Updated</option>
            <option value="TENANT_SUSPENDED">Tenant Suspended</option>
            <option value="DEVICE_SESSION_REVOKED">Device Revoked</option>
            <option value="PLATFORM_LOGIN">Platform Login</option>
            <option value="PLATFORM_PLAN_CREATED">Plan Created</option>
          </select>

          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Action Event</th>
                <th className="px-6 py-3.5">Actor & Role</th>
                <th className="px-6 py-3.5">Target Resource</th>
                <th className="px-6 py-3.5">Restaurant</th>
                <th className="px-6 py-3.5">IP Address</th>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading security audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No security audit logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {l.actor_role}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {l.actor_id ? `${l.actor_id.substring(0, 8)}...` : 'System'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {l.resource_type}: {l.resource_id ? `${l.resource_id.substring(0, 8)}...` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {l.tenant_name ? (
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{l.tenant_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Platform-wide</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500 text-[11px]">
                      {l.ip_address || '127.0.0.1'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: JSON Metadata Inspector */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Event: ${selectedLog.action}`}
          maxWidth="xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Actor Role:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedLog.actor_role}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">IP Address:</span>
                <p className="font-mono font-bold text-slate-800 dark:text-white">{selectedLog.ip_address || '127.0.0.1'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Resource Type:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedLog.resource_type}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Timestamp:</span>
                <p className="font-bold text-slate-800 dark:text-white">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1.5">
                <FileCode className="w-4 h-4 text-brand-500" />
                <span>Forensic Metadata (Payload)</span>
              </label>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                {JSON.stringify(selectedLog.metadata, null, 2) || '{}'}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
