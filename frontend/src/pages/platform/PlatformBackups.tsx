import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  RefreshCw,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  ShieldCheck,
  HardDrive,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const PlatformBackups: React.FC = () => {
  const { success, error, info } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [restorations, setRestorations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Export Section State
  const [selectedExportTenantId, setSelectedExportTenantId] = useState('');
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Restore Section State
  const [selectedRestoreTenantId, setSelectedRestoreTenantId] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePackage, setRestorePackage] = useState<any | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'FULL' | 'SELECTIVE' | 'MERGE'>('FULL');
  const [selectedModules, setSelectedModules] = useState<string[]>(['menu', 'inventory', 'customers', 'sales']);

  const fetchData = async () => {
    try {
      const [tenantsRes, restorationsRes] = await Promise.all([
        api.get('/platform/tenants'),
        api.get('/platform/backups/restorations'),
      ]);
      setTenants(tenantsRes.tenants || []);
      setRestorations(restorationsRes.restorations || []);
      if (tenantsRes.tenants?.length > 0 && !selectedExportTenantId) {
        setSelectedExportTenantId(tenantsRes.tenants[0].id);
        setSelectedRestoreTenantId(tenantsRes.tenants[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load backup data:', err);
      error(err.message || 'Failed to load backup and restore hub');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadBackup = async (format: 'json' | 'excel') => {
    if (!selectedExportTenantId) {
      error('Please select a restaurant to export');
      return;
    }
    const tenant = tenants.find((t) => t.id === selectedExportTenantId);
    const tenantName = tenant?.name || 'restaurant';

    if (format === 'json') setExportingJson(true);
    else setExportingExcel(true);

    try {
      info(`Generating ${format.toUpperCase()} export for "${tenantName}"...`);
      const token = localStorage.getItem('pos_token') || sessionStorage.getItem('pos_token');
      const url = `/api/platform/tenants/${selectedExportTenantId}/backup/${format}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errJson.error || 'Failed to download backup');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      let filename = `${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_backup.${format === 'json' ? 'json' : 'xlsx'}`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      success(`${format.toUpperCase()} package generated and downloaded!`);
    } catch (err: any) {
      error(err.message || `Failed to download ${format} backup`);
    } finally {
      if (format === 'json') setExportingJson(false);
      else setExportingExcel(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setRestorePackage(json);
        setValidating(true);
        const res = await api.post('/platform/backups/validate', {
          backupPackage: json,
          targetTenantId: selectedRestoreTenantId,
        });
        setValidationResult(res);
        if (res.valid) {
          success('Backup structure validated! Safe to restore.');
        } else {
          error(`Validation warnings: ${res.errors?.join(', ') || 'Invalid format'}`);
        }
      } catch (err: any) {
        error('Invalid JSON file format: ' + err.message);
      } finally {
        setValidating(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!selectedRestoreTenantId || !restorePackage) {
      error('Please select a target restaurant and a valid backup file');
      return;
    }
    const tenant = tenants.find((t) => t.id === selectedRestoreTenantId);
    if (!confirm(`Are you sure you want to execute ${restoreMode} restore on "${tenant?.name}"? A safety backup will be created automatically.`)) {
      return;
    }

    setRestoring(true);
    try {
      const res = await api.post(`/platform/tenants/${selectedRestoreTenantId}/restore`, {
        backupPackage: restorePackage,
        mode: restoreMode,
        selectedModules,
      });
      success(`Restoration completed successfully! ${res.recordsRestored || 0} records restored.`);
      setRestorePackage(null);
      setRestoreFile(null);
      setValidationResult(null);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Restoration failed');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Data Backup & Restoration Hub
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Download complete restaurant data in JSON & Multi-Sheet Excel, with transactional point-in-time recovery
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Two-Column Layout: Export Hub & Restore Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Data Export & Download */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Download className="w-5 h-5 text-emerald-500" />
              <h2 className="font-extrabold text-slate-900 dark:text-white text-base">
                Download Restaurant Data Backup
              </h2>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1.5">
                Select Restaurant Tenant
              </label>
              <select
                value={selectedExportTenantId}
                onChange={(e) => setSelectedExportTenantId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-medium"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.city || 'Pakistan'} • {t.owner_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Option A: Full JSON Restoration Format */}
              <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
                    <FileJson className="w-4 h-4" />
                    <span>JSON Archive</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Full-fidelity relational database export containing all 34 tables, recipes, inventory batches, and sales history. Used for restoration.
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadBackup('json')}
                  disabled={exportingJson}
                  className="mt-4 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingJson ? 'Generating JSON...' : 'Download JSON (.json)'}</span>
                </button>
              </div>

              {/* Option B: Multi-Sheet Excel Format */}
              <div className="p-4 rounded-xl border border-teal-200/60 dark:border-teal-900/40 bg-teal-50/30 dark:bg-teal-950/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 text-teal-700 dark:text-teal-400 font-bold text-xs mb-1">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel Workbook</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Formatted multi-sheet .xlsx workbook for owners and auditors. Includes sheets for Overview, Staff, Menu, Recipes, Stock, and Sales.
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadBackup('excel')}
                  disabled={exportingExcel}
                  className="mt-4 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingExcel ? 'Generating Excel...' : 'Download Excel (.xlsx)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Secure Database Restoration Portal */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Upload className="w-5 h-5 text-indigo-500" />
            <h2 className="font-extrabold text-slate-900 dark:text-white text-base">
              Transactional Database Restore Portal
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Restaurant
              </label>
              <select
                value={selectedRestoreTenantId}
                onChange={(e) => setSelectedRestoreTenantId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select JSON Backup Package
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-500 file:text-white hover:file:bg-brand-600"
              />
            </div>
          </div>

          {validating && (
            <div className="py-2 text-center text-slate-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-brand-500" />
              Validating SHA-256 checksum and schema...
            </div>
          )}

          {/* Validation Result Box */}
          {validationResult && (
            <div className={`p-3.5 rounded-xl border text-xs ${
              validationResult.valid
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
                {validationResult.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                <span>{validationResult.valid ? 'Pre-Validation Passed' : 'Validation Issues Detected'}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Export Source: {validationResult.metadata?.tenantName || 'N/A'} • Export Date: {new Date(validationResult.metadata?.exportedAt).toLocaleString()}
              </p>
              {validationResult.summary && (
                <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                  <div>Branches: <strong>{validationResult.summary.branches || 0}</strong></div>
                  <div>Menu Items: <strong>{validationResult.summary.products || 0}</strong></div>
                  <div>Stock Items: <strong>{validationResult.summary.ingredients || 0}</strong></div>
                  <div>Orders: <strong>{validationResult.summary.orders || 0}</strong></div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
              Restoration Mode
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'FULL', title: 'Full Replace', desc: 'Truncate and rewrite exact snapshot' },
                { id: 'MERGE', title: 'Safe Merge', desc: 'Upsert records preserving new entries' },
                { id: 'SELECTIVE', title: 'Selective', desc: 'Only restore chosen core modules' },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setRestoreMode(m.id as any)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    restoreMode === m.id
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="font-bold text-slate-800 dark:text-white text-[11px]">{m.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleExecuteRestore}
            disabled={!validationResult?.valid || restoring}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{restoring ? 'Restoring Database...' : 'Execute Transactional Restore'}</span>
          </button>
        </div>
      </div>

      {/* Restoration Audit History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Restoration Audit History</h3>
          </div>
          <span className="text-xs text-slate-400">{restorations.length} restore events logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Restaurant</th>
                <th className="px-6 py-3.5">Backup Archive File</th>
                <th className="px-6 py-3.5">Mode</th>
                <th className="px-6 py-3.5">Records Restored</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Restored By</th>
                <th className="px-6 py-3.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading restoration history...
                  </td>
                </tr>
              ) : restorations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No restore events recorded.
                  </td>
                </tr>
              ) : (
                restorations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                      {r.tenant_name || 'All'}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {r.backup_file_name}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                      {r.mode}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                      {r.records_restored?.toLocaleString() || 0} records
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {r.restored_by_name || 'Super Admin'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-right text-[11px]">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
