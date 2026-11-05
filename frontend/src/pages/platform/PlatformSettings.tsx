import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Settings,
  Shield,
  Key,
  Globe,
  Bell,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';

export const PlatformSettings: React.FC = () => {
  const { success, error, info } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({
    platformName: 'CloudPOS Platform',
    supportEmail: 'support@cloudpos.pk',
    supportPhone: '+92 300 0000000',
    defaultCurrency: 'PKR',
    defaultTimezone: 'Asia/Karachi',
    trialDays: 14,
    gracePeriodDays: 3,
    defaultMaxDevices: 4,
    maintenanceMode: false,
    minSupportedAppVersion: '2.0.0',
    currentPlatformVersion: '2.5.0',
    announcementBanner: '',
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchSettings = async () => {
    try {
      const [settingsRes, keysRes] = await Promise.all([
        api.get('/platform/settings'),
        api.get('/platform/api-keys'),
      ]);

      const s = settingsRes.settings || {};
      setForm({
        platformName: s.platform_name || 'CloudPOS Platform',
        supportEmail: s.support_email || 'support@cloudpos.pk',
        supportPhone: s.support_phone || '+92 300 0000000',
        defaultCurrency: s.default_currency || 'PKR',
        defaultTimezone: s.default_timezone || 'Asia/Karachi',
        trialDays: Number(s.trial_days) || 14,
        gracePeriodDays: Number(s.grace_period_days) || 3,
        defaultMaxDevices: Number(s.default_max_devices) || 4,
        maintenanceMode: !!s.maintenance_mode,
        minSupportedAppVersion: s.min_supported_app_version || '2.0.0',
        currentPlatformVersion: s.current_platform_version || '2.5.0',
        announcementBanner: s.announcement_banner || '',
      });
      setApiKeys(keysRes.apiKeys || []);
    } catch (err: any) {
      console.error('Failed to load platform settings:', err);
      error(err.message || 'Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/platform/settings', form);
      success('Platform global configuration updated successfully');
      fetchSettings();
    } catch (err: any) {
      error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post('/platform/api-keys', {
        name: newKeyName.trim(),
      });
      setGeneratedKey(res.secretKey);
      setNewKeyName('');
      success('API Key generated! Copy it now.');
      fetchSettings();
    } catch (err: any) {
      error(err.message || 'Failed to generate API Key');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      await api.delete(`/platform/api-keys/${id}`);
      success('API Key revoked');
      fetchSettings();
    } catch (err: any) {
      error(err.message || 'Failed to revoke API Key');
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    info('Copied secret key to clipboard');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white shadow-md">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Platform Global Settings
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure system branding, access defaults, maintenance mode, POS version limits, and API keys
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchSettings();
          }}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
          Loading platform configurations...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings Form */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
              {/* Platform Branding & Identity */}
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm mb-3 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-brand-500" />
                  <span>Branding & Official Support Contact</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Platform Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.platformName}
                      onChange={(e) => setForm({ ...form, platformName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Support Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={form.supportEmail}
                      onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Support Phone Number
                    </label>
                    <input
                      type="text"
                      value={form.supportPhone}
                      onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Currency
                    </label>
                    <input
                      type="text"
                      value={form.defaultCurrency}
                      onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* SaaS Defaults & Multi-Device Access */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm mb-3 flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-purple-500" />
                  <span>SaaS Provisioning Defaults</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Free Trial (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.trialDays}
                      onChange={(e) => setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Grace Period (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.gracePeriodDays}
                      onChange={(e) => setForm({ ...form, gracePeriodDays: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Max Concurrent Devices
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.defaultMaxDevices}
                      onChange={(e) => setForm({ ...form, defaultMaxDevices: parseInt(e.target.value) || 4 })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Version Enforcements & Maintenance Mode */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm mb-3 flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-cyan-500" />
                  <span>Version Gates & Maintenance Mode</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Platform Version
                    </label>
                    <input
                      type="text"
                      value={form.currentPlatformVersion}
                      onChange={(e) => setForm({ ...form, currentPlatformVersion: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Minimum Supported POS Terminal Version
                    </label>
                    <input
                      type="text"
                      value={form.minSupportedAppVersion}
                      onChange={(e) => setForm({ ...form, minSupportedAppVersion: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.maintenanceMode}
                      onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">Enable Platform Maintenance Mode</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        When enabled, non-super-admin users are shown a temporary maintenance banner.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Global Announcement Banner */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm mb-2 flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span>Broadcast System Notice</span>
                </h3>
                <textarea
                  rows={2}
                  value={form.announcementBanner}
                  onChange={(e) => setForm({ ...form, announcementBanner: e.target.value })}
                  placeholder="Optional broadcast banner visible to all logged-in restaurant cashiers and managers..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving Settings...' : 'Save All Settings'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Side Panel: API Keys Management */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  External API Keys
                </h3>
              </div>
              <button
                onClick={() => {
                  setGeneratedKey(null);
                  setNewKeyName('');
                  setIsKeyModalOpen(true);
                }}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                title="Create API Key"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Manage secure REST integration tokens for webhooks, custom aggregators, and accounting bridges.
            </p>

            <div className="space-y-2">
              {apiKeys.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No API Keys created yet.</div>
              ) : (
                apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white text-xs">{k.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{k.key_prefix}...</p>
                    </div>
                    <button
                      onClick={() => handleDeleteApiKey(k.id)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Revoke API key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create API Key */}
      <Modal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} title="Generate Integration API Key" maxWidth="md">
        {!generatedKey ? (
          <form onSubmit={handleCreateApiKey} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Key Name / Client *</label>
              <input
                type="text"
                required
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Accounting ERP Sync Token"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
              >
                Generate Token
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300">
              <p className="font-bold">Copy Your Secret Key</p>
              <p className="text-[11px] mt-0.5">
                This secret key will never be shown again. Store it securely.
              </p>
            </div>
            <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] break-all border border-slate-800 select-all">
              {generatedKey}
            </div>
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleCopyKey}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 rounded-lg flex items-center space-x-1.5"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneratedKey(null);
                  setIsKeyModalOpen(false);
                }}
                className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
