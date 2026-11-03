import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Settings, Save, Smartphone, Trash2, CheckCircle2 } from 'lucide-react';

export const RestaurantSettings: React.FC = () => {
  const { tenant, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = async () => {
    try {
      const [setRes, devRes] = await Promise.all([
        api.get('/restaurant/settings'),
        api.get('/restaurant/devices'),
      ]);
      setSettings(setRes.settings);
      setDevices(devRes.devices || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
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
      await refreshProfile();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateDevice = async (id: string) => {
    if (!confirm('Deactivate this terminal? It will free up device capacity in your plan.')) return;
    try {
      await api.delete(`/restaurant/devices/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate device');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading settings...</div>;
  }

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Restaurant Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure local taxes, receipt format, timezones, and registered POS terminals
          </p>
        </div>
        {saveSuccess && (
          <div className="flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
            <span>Saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Taxes & Financials */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Taxes & Currency Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Code</label>
              <input
                type="text"
                value={settings?.currency || 'PKR'}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={settings?.currency_symbol || 'Rs.'}
                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sales Tax %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings?.tax_rate_percent ?? 16}
                onChange={(e) => setSettings({ ...settings, tax_rate_percent: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">STRN / NTN Tax Reg #</label>
              <input
                type="text"
                placeholder="12-34-5678-9"
                value={settings?.tax_registration_number || ''}
                onChange={(e) => setSettings({ ...settings, tax_registration_number: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Service Charge %</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={settings?.service_charge_percent ?? 0}
                onChange={(e) => setSettings({ ...settings, service_charge_percent: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
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
                <span className="font-semibold text-slate-700">Menu prices already include tax</span>
              </label>
            </div>
          </div>
        </div>

        {/* Receipt Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Thermal Receipt Printing Settings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Paper Roll Width</label>
              <select
                value={settings?.receipt_settings?.paperWidth || '80mm'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    receipt_settings: { ...settings.receipt_settings, paperWidth: e.target.value },
                  })
                }
                className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
              >
                <option value="80mm">80mm Standard POS Thermal Paper</option>
                <option value="58mm">58mm Compact Mobile POS Paper</option>
                <option value="A4">A4 Full Page Invoice</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Receipt English Header</label>
              <input
                type="text"
                value={settings?.receipt_settings?.headerText || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    receipt_settings: { ...settings.receipt_settings, headerText: e.target.value },
                  })
                }
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Custom Urdu Header (اردو ہیڈر)</label>
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
                className="w-full border rounded-lg px-3 py-2 text-xs font-urdu"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Custom Urdu Footer (اردو اختتامیہ)</label>
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
                className="w-full border rounded-lg px-3 py-2 text-xs font-urdu"
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

      {/* Registered Devices Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Registered POS Terminals</h3>
          </div>
          <span className="text-slate-500 text-[11px] font-semibold">
            {devices.length} registered terminal(s)
          </span>
        </div>

        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{d.device_name}</p>
                <p className="text-slate-500 text-[11px] font-mono">{d.device_fingerprint}</p>
                <p className="text-slate-400 text-[10px]">
                  Branch: {d.branch_name} • Last active: {new Date(d.last_active_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDeactivateDevice(d.id)}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
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
