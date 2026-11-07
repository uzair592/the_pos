import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { FloorTableManagement } from '../../components/restaurant/FloorTableManagement.js';
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
  Printer,
  Receipt,
  Eye,
  Sliders,
  Sparkles,
  Armchair,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ReceiptPreview,
  RECEIPT_THEMES,
} from '../../components/common/ReceiptModal.js';
import { ReceiptTemplateType } from '@pos/shared';

// Helper to provide realistic preview data in Restaurant Settings
const getSettingsSampleReceipt = (currentSettings: any, restaurantName: string = 'The Grand Dine') => {
  const rSettings = currentSettings?.receipt_settings || {};
  return {
    restaurantName: restaurantName || 'The Grand Dine',
    restaurantLogo: null,
    branchName: 'Main Branch - Commercial Block',
    branchAddress: 'Gulberg III, Main Boulevard',
    branchCity: 'Lahore',
    branchPhone: '+92 300 1234567',
    taxRegistrationNumber: currentSettings?.tax_registration_number || 'TRN-839210-4',
    orderNumber: 'ORD-1048',
    orderType: 'DINE_IN',
    tableNumber: '4',
    floorName: 'Ground Floor',
    coverCount: 3,
    customerName: 'Sarah Khan',
    customerPhone: '+92 321 9876543',
    deliveryAddress: 'House 14, Street 2, Phase 5',
    riderName: 'Ali Raza',
    riderPhone: '+92 333 4567890',
    cashierName: 'Muhammad Uzair',
    serverName: 'Ahmed Waiter',
    orderNotes: 'Less spicy on karahi please',
    date: new Date().toISOString(),
    currencySymbol: currentSettings?.currency_symbol || 'Rs.',
    items: [
      {
        id: 'sample-1',
        productName: 'Mutton Karahi Special',
        variantName: 'Half Handi',
        quantity: 1,
        unitPrice: 1850,
        totalPrice: 1850,
        modifiers: [{ name: 'Extra Ginger & Desi Ghee', unitPrice: 50 }],
        notes: 'Mild spicy',
      },
      {
        id: 'sample-2',
        productName: 'Chicken Biryani Double',
        variantName: 'Full Platter',
        quantity: 2,
        unitPrice: 550,
        totalPrice: 1100,
        modifiers: [],
      },
      {
        id: 'sample-3',
        productName: 'Roghni Naan Fresh',
        variantName: 'Tandoori',
        quantity: 4,
        unitPrice: 80,
        totalPrice: 320,
      },
      {
        id: 'sample-4',
        productName: 'Mint Lemonade Chilled',
        variantName: '500ml',
        quantity: 2,
        unitPrice: 220,
        totalPrice: 440,
      },
    ],
    subtotal: 3760,
    discount: 376,
    taxPercent: currentSettings?.tax_rate_percent ? Number(currentSettings.tax_rate_percent) : 5,
    taxAmount: 169.2,
    serviceChargeAmount: currentSettings?.service_charge_percent ? 100 : 0,
    deliveryFee: 0,
    grandTotal: 3653.2,
    paidAmount: 4000,
    changeGiven: 346.8,
    balanceDue: 0,
    payments: [{ method: 'CASH', amount: 4000 }],
    receiptSettings: {
      defaultTemplate: rSettings.defaultTemplate || 'STANDARD_80MM',
      paperWidth: rSettings.paperWidth || '80mm',
      headerText: rSettings.headerText || 'Welcome to our Restaurant & Grill',
      footerText: rSettings.footerText || 'Thank you for dining with us! Please visit again.',
      showQrCode: rSettings.showQrCode !== false,
      showTaxBreakdown: rSettings.showTaxBreakdown !== false,
      showCustomerDetails: rSettings.showCustomerDetails !== false,
      showTipGuide: rSettings.showTipGuide !== false,
    },
  };
};

export const RestaurantSettings: React.FC = () => {
  const { tenant, refreshProfile } = useAuth();
  const { success, error, info } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [settings, setSettings] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

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
      if (setRes.settings?.receipt_settings?.defaultTemplate) {
        localStorage.setItem('pos_default_receipt_template', setRes.settings.receipt_settings.defaultTemplate);
      }
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

  const handleSelectTemplate = (templateId: ReceiptTemplateType) => {
    const paperWidth = templateId === 'COMPACT_58MM' ? '58mm' : templateId === 'TAX_INVOICE_A4' ? 'A4' : '80mm';
    setSettings((prev: any) => ({
      ...prev,
      receipt_settings: {
        ...prev?.receipt_settings,
        defaultTemplate: templateId,
        paperWidth: prev?.receipt_settings?.paperWidth || paperWidth,
      },
    }));
    localStorage.setItem('pos_default_receipt_template', templateId);
  };

  const handleTestPrint = () => {
    window.print();
  };

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

      if (settings.receipt_settings?.defaultTemplate) {
        localStorage.setItem('pos_default_receipt_template', settings.receipt_settings.defaultTemplate);
      }

      setSaveSuccess(true);
      success('Restaurant configuration and print themes saved successfully');
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
    e.target.value = '';
  };

  // 3. Execute Restore
  const handleExecuteRestore = async () => {
    if (!restorePayload) return;
    setRestoring(true);
    try {
      const res = await api.post('/restaurant/backups/restore', restorePayload);
      success(res.message || 'Database snapshot restored successfully!');
      setIsRestoreModalOpen(false);
      setRestorePayload(null);
      await fetchData();
      await refreshProfile();
    } catch (err: any) {
      error(err.message || 'Failed to restore database from backup');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  const activeTemplateId: ReceiptTemplateType =
    settings?.receipt_settings?.defaultTemplate || 'STANDARD_80MM';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Settings className="w-6 h-6 text-brand-500" />
            <span>Store & POS Settings</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage tax rates, currency, billing templates, print themes, floor tables, device terminals, and disaster recovery
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-0.5">
        {[
          { id: 'general', label: 'Financial & Store', icon: Settings },
          { id: 'tables', label: 'Floor & Table Management', icon: Armchair },
          { id: 'printing', label: 'Print Themes & Receipt Designer', icon: Printer },
          { id: 'devices', label: 'Device Terminals', icon: Smartphone },
          { id: 'backups', label: 'Backup & Recovery', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap rounded-t-xl ${
                isActive
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50/40 dark:bg-brand-950/30'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FINANCIAL & GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              Financial & Tax Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-md text-xs transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Financial Settings'}</span>
          </button>
        </form>
      )}

      {/* TAB 2: FLOOR & TABLE MANAGEMENT */}
      {activeTab === 'tables' && (
        <FloorTableManagement />
      )}

      {/* TAB 3: PRINT THEMES & RECEIPT DESIGNER */}
      {activeTab === 'printing' && (
        <form onSubmit={handleSave} className="space-y-6">

        {/* ==================== PRINT THEMES & RECEIPT DESIGNER ==================== */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>Print Themes & Receipt Designer</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-bold border border-brand-200 dark:border-brand-800">
                    5 Formats Available
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select your default bill theme, configure receipt headers/footers, and test print directly
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestPrint}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 text-brand-500" />
              <span>Test Print Sample</span>
            </button>
          </div>

          {/* Visual Theme Selection Cards Grid */}
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-2.5 text-xs">
              Select Default Print Theme:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {RECEIPT_THEMES.map((theme) => {
                const isSelected = activeTemplateId === theme.id;
                return (
                  <div
                    key={theme.id}
                    onClick={() => handleSelectTemplate(theme.id)}
                    className={`cursor-pointer rounded-2xl p-3.5 border transition-all flex flex-col justify-between select-none relative ${
                      isSelected
                        ? 'bg-brand-50/40 dark:bg-brand-950/30 border-brand-500 shadow-md ring-2 ring-brand-500/40'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                      </span>
                    )}

                    <div>
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span className="text-xl">{theme.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {theme.badge}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight">
                        {theme.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {theme.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 dark:text-slate-500 font-mono">{theme.hardware}</span>
                      <span className={`font-bold ${isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
                        {isSelected ? '✓ Default' : 'Select'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customization Controls & Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            {/* Left Column: Form Controls */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3.5">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-brand-500" />
                  <span>Receipt Layout & Content Options</span>
                </h4>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Paper Roll Width
                  </label>
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
                    <option value="80mm">80mm Standard POS Thermal Paper (3-Inch)</option>
                    <option value="58mm">58mm Compact Mobile Paper (2-Inch)</option>
                    <option value="A4">A4 Full Page Commercial Document</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Header Greeting / Tagline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Welcome to Royal Dine & Grill"
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
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Footer Thank-You Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Thank you for dining with us! Please visit again."
                    value={settings?.receipt_settings?.footerText || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        receipt_settings: { ...settings.receipt_settings, footerText: e.target.value },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                {/* Toggles */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showQrCode !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: { ...settings.receipt_settings, showQrCode: e.target.checked },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Print QR Code for Digital E-Receipt & Feedback
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showTaxBreakdown !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: { ...settings.receipt_settings, showTaxBreakdown: e.target.checked },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Print STRN / NTN Tax Registration Number
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showCustomerDetails !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: { ...settings.receipt_settings, showCustomerDetails: e.target.checked },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Print Customer Name & Contact Information
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showTipGuide !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: { ...settings.receipt_settings, showTipGuide: e.target.checked },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Show Gratuity Guide (Fine Dining Guest Check)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column: Live Real-Time Interactive Receipt Preview */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex items-center justify-between pb-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <Eye className="w-4 h-4 text-brand-500" />
                  <span>Live Interactive Print Preview (Real-Time)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {activeTemplateId} • {settings?.receipt_settings?.paperWidth || '80mm'}
                </span>
              </div>

              <div className="flex-1 bg-slate-200/80 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 flex justify-center items-start overflow-y-auto max-h-[520px] shadow-inner">
                <ReceiptPreview
                  template={activeTemplateId}
                  receiptData={getSettingsSampleReceipt(settings, tenant?.name)}
                  showQrCode={settings?.receipt_settings?.showQrCode !== false}
                  showTaxDetails={settings?.receipt_settings?.showTaxBreakdown !== false}
                  showCustomer={settings?.receipt_settings?.showCustomerDetails !== false}
                  showTipGuide={settings?.receipt_settings?.showTipGuide !== false}
                  isPrintable={false}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-md text-xs transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Print Settings'}</span>
        </button>
      </form>
      )}

      {/* TAB 4: BACKUP & RESTORE SECTION */}
      {activeTab === 'backups' && (
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
      )}

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

      {/* TAB 5: Registered Multi-Device Terminals Management */}
      {activeTab === 'devices' && (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registered Multi-Device Terminals</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Track waiter tablets, cashier terminals, kitchen screens, and manage active hardware sessions
              </p>
            </div>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {devices.length} Terminal(s) Bound
          </span>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Device Name & Type</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Default Workspace</th>
                  <th className="px-4 py-3">Last Logged Staff</th>
                  <th className="px-4 py-3">Last Active</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                      No terminal devices registered yet. Devices register automatically upon first terminal login.
                    </td>
                  </tr>
                ) : (
                  devices.map((d) => {
                    const isActive = d.is_active !== false;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{d.device_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                            {d.device_fingerprint}
                          </p>
                          <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-black">
                            {d.device_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {d.branch_name || 'Main Branch'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            {d.default_workspace || 'POS_TERMINAL'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{d.last_user_name || 'Staff'}</p>
                          <p className="text-[10px] text-slate-400">{d.last_user_email || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {d.last_active_at ? new Date(d.last_active_at).toLocaleString() : 'Just now'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200'
                            }`}
                          >
                            {isActive ? 'ONLINE / AUTHORIZED' : 'REVOKED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isActive ? (
                            <button
                              onClick={() => handleDeactivateDevice(d.id)}
                              className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs font-bold transition-colors"
                              title="Revoke / Deactivate Terminal Device"
                            >
                              Revoke
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Deactivated</span>
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
      )}
    </div>
  );
};
