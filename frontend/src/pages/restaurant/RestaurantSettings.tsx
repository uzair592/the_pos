import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Settings,
  Save,
  Smartphone,
  Trash2,
  CheckCircle2,
  Database,
  Download,
  Upload,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const RestaurantSettings: React.FC = () => {
  const { tenant, refreshProfile } = useAuth();
  const { success, error, info } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Backup & Restore states
  const [generatingBackup, setGeneratingBackup] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restorePayload, setRestorePayload] = useState<any | null>(null);
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const fetchData = async () => {
    try {
      const [setRes, devRes, backupRes] = await Promise.all([
        api.get('/restaurant/settings'),
        api.get('/restaurant/devices'),
        api.get('/restaurant/backups'),
      ]);
      setSettings(setRes.settings);
      setDevices(devRes.devices || []);
      setBackups(backupRes.backups || []);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      error(err.message || 'Failed to load restaurant settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/restaurant/settings', {
        currency: settings.currency,
        currencySymbol: settings.currency_symbol,
        timeZone: settings.time_zone,
        taxRatePercent: Number(settings.tax_rate_percent),
        taxRegistrationNumber: settings.tax_registration_number,
        isTaxInclusive: settings.is_tax_inclusive,
        serviceChargePercent: Number(settings.service_charge_percent),
        receiptSettings: settings.receipt_settings,
      });
      setSaveSuccess(true);
      success('Restaurant configuration saved successfully');
      await refreshProfile();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateDevice = async (id: string) => {
    if (!window.confirm('Deactivate this POS terminal? It will free up device capacity.')) return;
    try {
      await api.delete(`/restaurant/devices/${id}`);
      success('Terminal deactivated');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to deactivate device');
    }
  };

  // 1. Generate and Download Backup
  const handleGenerateBackup = async () => {
    setGeneratingBackup(true);
    try {
      const res = await api.post('/restaurant/backups/generate', {});
      const backupData = res.backup;

      // Trigger client-side file download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${tenant?.name?.replace(/\s+/g, '_') || 'restaurant'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Backup snapshot generated and downloaded successfully!');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to generate backup');
    } finally {
      setGeneratingBackup(false);
    }
  };

  // 2. Select file for restore
  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.version || !json.data) {
          throw new Error('Invalid backup file format. Missing version or data block.');
        }
        setRestorePayload(json);
        setRestoreConfirmationText('');
        setIsRestoreModalOpen(true);
      } catch (err: any) {
        error(`Failed to parse backup file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    // Reset file input so user can choose again if cancelled
    e.target.value = '';
  };

  // 3. Confirm and Execute Transactional Restore
  const handleExecuteRestore = async () => {
    if (restoreConfirmationText.trim().toUpperCase() !== 'CONFIRM') {
      error('Please type CONFIRM to authorize the database restore');
      return;
    }
    setRestoring(true);
    try {
      const res = await api.post('/restaurant/backups/restore', restorePayload);
      success(`Database restored successfully! ${res.restoredTables?.join(', ') || ''}`);
      setIsRestoreModalOpen(false);
      setRestorePayload(null);
      await fetchData();
      await refreshProfile();
    } catch (err: any) {
      error(err.message || 'Restore failed. All changes safely rolled back.');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading restaurant settings...</div>;
  }

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Restaurant Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure local taxes, thermal receipt design, multi-device terminals, and database backups
          </p>
        </div>
        {saveSuccess && (
          <div className="flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
            <span>Saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Taxes & Financials */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
            Taxes & Currency Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Currency Code</label>
              <input
                type="text"
                value={settings?.currency || 'PKR'}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={settings?.currency_symbol || 'Rs.'}
                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Sales Tax %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings?.tax_rate_percent ?? 16}
                onChange={(e) => setSettings({ ...settings, tax_rate_percent: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">STRN / NTN Tax Reg #</label>
              <input
                type="text"
                placeholder="12-34-5678-9"
                value={settings?.tax_registration_number || ''}
                onChange={(e) => setSettings({ ...settings, tax_registration_number: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Charge %</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={settings?.service_charge_percent ?? 0}
                onChange={(e) => setSettings({ ...settings, service_charge_percent: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings?.is_tax_inclusive}
                  onChange={(e) => setSettings({ ...settings, is_tax_inclusive: e.target.checked })}
                  className="rounded text-brand-500 focus:ring-brand-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Menu prices already include tax</span>
              </label>
            </div>
          </div>
        </div>

        {/* Receipt Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
            Thermal Receipt Printing Settings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Paper Roll Width</label>
              <select
                value={settings?.receipt_settings?.paperWidth || '80mm'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    receipt_settings: { ...settings.receipt_settings, paperWidth: e.target.value },
                  })
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="80mm">80mm Standard POS Thermal Paper</option>
                <option value="58mm">58mm Compact Mobile POS Paper</option>
                <option value="A4">A4 Full Page Invoice</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Receipt English Header</label>
              <input
                type="text"
                value={settings?.receipt_settings?.headerText || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    receipt_settings: { ...settings.receipt_settings, headerText: e.target.value },
                  })
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Custom Urdu Header (اردو ہیڈر)</label>
              <input
                type="text"
                dir="rtl"
                value={settings?.receipt_settings?.customUrduHeader || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    receipt_settings: { ...settings.receipt_settings, customUrduHeader: e.target.value },
                  })
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-urdu text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Custom Urdu Footer (اردو اختتامیہ)</label>
              <input
                type="text"
                dir="rtl"
                value={settings?.receipt_settings?.customUrduFooter || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    receipt_settings: { ...settings.receipt_settings, customUrduFooter: e.target.value },
                  })
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-urdu text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-md text-xs transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </form>

      {/* ==================== BACKUP & RESTORE SECTION ==================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <Database className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Database Backup & Disaster Recovery</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Generate complete cryptographic snapshot backups or restore your restaurant database
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateBackup}
              disabled={generatingBackup}
              className="flex items-center space-x-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{generatingBackup ? 'Generating Backup...' : 'Create & Download Backup Now'}</span>
            </button>

            <label className="flex items-center space-x-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-100 px-4 py-2 rounded-xl font-bold text-xs cursor-pointer transition-all">
              <Upload className="w-4 h-4" />
              <span>Restore from Backup File</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileSelectForRestore}
              />
            </label>
          </div>
        </div>

        {/* Backup History Table */}
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Previous Backup History</h4>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">File / Type</th>
                  <th className="px-4 py-2.5">SHA-256 Checksum</th>
                  <th className="px-4 py-2.5 text-right">Size</th>
                  <th className="px-4 py-2.5">Triggered By</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No backups generated yet. Click "Create & Download Backup Now" to safeguard your data.
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-medium">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {b.filename || b.backup_type}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                        {b.checksum || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                        {Math.round((b.size_bytes || 0) / 1024)} KB
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {b.triggered_by_email || 'Owner'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Safety Modal */}
      <Modal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        title="Confirm Database Restore"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start space-x-3 text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">CRITICAL WARNING: Overwrite Existing Data</p>
              <p className="text-[11px] mt-1 text-rose-700 dark:text-rose-300">
                Restoring will replace all current menu products, categories, ingredients, FIFO batches, and orders with the records from this backup file.
              </p>
            </div>
          </div>

          {restorePayload && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[11px]">
              <p><span className="text-slate-500">Backup Schema Version:</span> {restorePayload.version}</p>
              <p><span className="text-slate-500">Created At:</span> {new Date(restorePayload.createdAt).toLocaleString()}</p>
              <p><span className="text-slate-500">Checksum:</span> {restorePayload.checksum?.substring(0, 16)}...</p>
              <p><span className="text-slate-500">Tables in Snapshot:</span> {Object.keys(restorePayload.data || {}).length}</p>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              To proceed, please type <span className="font-mono text-rose-600">CONFIRM</span> below:
            </label>
            <input
              type="text"
              value={restoreConfirmationText}
              onChange={(e) => setRestoreConfirmationText(e.target.value)}
              placeholder="CONFIRM"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRestoreModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteRestore}
              disabled={restoring || restoreConfirmationText.trim().toUpperCase() !== 'CONFIRM'}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-40"
            >
              {restoring ? 'Restoring Database...' : 'Restore Database Now'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Registered Devices Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registered Multi-Device Terminals</h3>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
            {devices.length} registered terminal(s)
          </span>
        </div>

        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{d.device_name}</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">{d.device_fingerprint}</p>
                <p className="text-slate-400 dark:text-slate-500 text-[10px]">
                  Branch: {d.branch_name} • Last active: {new Date(d.last_active_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDeactivateDevice(d.id)}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                title="Revoke / Deactivate Terminal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
