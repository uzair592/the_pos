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
const getSettingsSampleReceipt = (currentSettings: any, restaurantName: string = 'DELIGHT PIZZA') => {
  const rSettings = currentSettings?.receipt_settings || {};
  return {
    restaurantName: currentSettings?.name || restaurantName || 'DELIGHT PIZZA',
    restaurantLogo: currentSettings?.logo_url || currentSettings?.logoUrl || rSettings?.logoUrl || null,
    branchName: 'Main Branch',
    branchAddress: currentSettings?.address || 'Street 10, Sector P1, Phase 4, Hayatabad Peshawar',
    branchCity: currentSettings?.city || 'Peshawar',
    branchPhone: currentSettings?.phone || '03342823000 / 0915828000 / 03062823000',
    taxRegistrationNumber: currentSettings?.tax_registration_number || 'TRN-839210-4',
    orderNumber: 'ORD-1048',
    orderType: 'DINE_IN',
    tableNumber: '4',
    floorName: 'Ground Floor',
    coverCount: 3,
    customerName: 'Sarah Khan',
    customerPhone: '03219876543',
    deliveryAddress: 'Street 10, Sector P1, Phase 4, Hayatabad',
    riderName: 'Ali Raza',
    riderPhone: '03334567890',
    cashierName: 'Muhammad Uzair',
    serverName: 'Ahmed Waiter',
    orderNotes: 'Crispy crust and extra cheese',
    date: new Date().toISOString(),
    currencySymbol: currentSettings?.currency_symbol || 'Rs.',
    items: [
      {
        id: 'sample-1',
        productName: 'Chicken Fajita Pizza',
        variantName: 'Large 14"',
        quantity: 1,
        unitPrice: 1650,
        totalPrice: 1650,
        modifiers: [{ name: 'Extra Cheese & Olives', unitPrice: 150 }],
        notes: 'Well baked',
      },
      {
        id: 'sample-2',
        productName: 'Spicy Garlic Wings',
        variantName: '6 Pcs',
        quantity: 1,
        unitPrice: 480,
        totalPrice: 480,
        modifiers: [],
      },
      {
        id: 'sample-3',
        productName: 'Mineral Water / Soft Drink',
        variantName: '1.5 Litre',
        quantity: 2,
        unitPrice: 160,
        totalPrice: 320,
      },
    ],
    subtotal: 2450,
    discount: 245,
    taxPercent: currentSettings?.tax_rate_percent ? Number(currentSettings.tax_rate_percent) : 5,
    taxAmount: 110.25,
    serviceChargeAmount: 0,
    deliveryFee: 0,
    grandTotal: 2315.25,
    paidAmount: 2500,
    changeGiven: 184.75,
    balanceDue: 0,
    payments: [{ method: 'CASH', amount: 2500 }],
    receiptSettings: {
      defaultTemplate: rSettings.defaultTemplate || 'TABLE_GRID',
      paperWidth: rSettings.paperWidth || '80mm',
      showBusinessName: rSettings.showBusinessName !== false,
      businessNameFontSize: rSettings.businessNameFontSize ? Number(rSettings.businessNameFontSize) : 21,
      showPhone: rSettings.showPhone !== false,
      phoneFontSize: rSettings.phoneFontSize ? Number(rSettings.phoneFontSize) : 14,
      showAddress: rSettings.showAddress !== false,
      addressFontSize: rSettings.addressFontSize ? Number(rSettings.addressFontSize) : 14,
      showSlogan: rSettings.showSlogan !== false,
      sloganText: rSettings.sloganText || 'Fresh & Delicious',
      sloganFontSize: rSettings.sloganFontSize ? Number(rSettings.sloganFontSize) : 13,
      showLogo: rSettings.showLogo !== false,
      logoUrl: currentSettings?.logo_url || currentSettings?.logoUrl || rSettings?.logoUrl || '',
      logoSize: rSettings.logoSize || 'XL',
      billFontSize: rSettings.billFontSize ? Number(rSettings.billFontSize) : 15,
      lineSpacing: rSettings.lineSpacing !== undefined ? Number(rSettings.lineSpacing) : 1.25,
      marginLeftMm: rSettings.marginLeftMm !== undefined ? Number(rSettings.marginLeftMm) : 0,
      marginRightMm: rSettings.marginRightMm !== undefined ? Number(rSettings.marginRightMm) : 0,
      spaceAboveMm: rSettings.spaceAboveMm !== undefined ? Number(rSettings.spaceAboveMm) : 0,
      spaceBelowMm: rSettings.spaceBelowMm !== undefined ? Number(rSettings.spaceBelowMm) : 20,
      autoCutReceipt: rSettings.autoCutReceipt !== false,
      receiptCopies: rSettings.receiptCopies || 'CUSTOMER_ONLY',
      desktopCutterCommand: rSettings.desktopCutterCommand || 'FEED_PARTIAL_CUT',
      headerText: rSettings.headerText || 'Fresh & Delicious',
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
    const sample = getSettingsSampleReceipt(settings, tenant?.name);
    import('../../utils/receiptPrinter.js').then(({ executeThermalPrint }) => {
      executeThermalPrint(sample, {
        paperWidth: settings?.receipt_settings?.paperWidth || '80mm',
      });
    }).catch(() => {
      window.print();
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/i)) {
      error('Please select a PNG, JPG, WEBP, or GIF image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      error('Logo size must be under 2MB for fast thermal printing');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      setSettings((prev: any) => ({
        ...prev,
        logo_url: dataUrl,
        receipt_settings: {
          ...prev?.receipt_settings,
          logoUrl: dataUrl,
          showLogo: true,
        },
      }));
      success('Logo updated. Remember to click Save.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBusinessInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/restaurant/settings', {
        name: settings.name,
        phone: settings.phone,
        address: settings.address,
        logoUrl: settings.logo_url || settings.receipt_settings?.logoUrl || '',
        currency: settings.currency,
        currencySymbol: settings.currency_symbol,
        timeZone: settings.time_zone,
        taxRatePercent: Number(settings.tax_rate_percent || 0),
        taxRegistrationNumber: settings.tax_registration_number,
        isTaxInclusive: settings.is_tax_inclusive,
        serviceChargePercent: Number(settings.service_charge_percent || 0),
        receiptSettings: settings.receipt_settings,
      });

      success('🏪 Business Info saved successfully');
      await refreshProfile();
    } catch (err: any) {
      error(err.message || 'Failed to save business info');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/restaurant/settings', {
        name: settings.name,
        phone: settings.phone,
        address: settings.address,
        logoUrl: settings.logo_url || settings.receipt_settings?.logoUrl || '',
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
        <div className="space-y-8">
          {/* =========================================================================
              CARD 1: 🏪 Business Info
             ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>🏪 Business Info</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  The business name appears in the app. Use the checkboxes below to choose whether the name and slogan appear on printed bills. Blank contact details are hidden. Save changes below.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveBusinessInfo} className="space-y-4">
              {/* Business Name Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-7">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Business Name:
                  </label>
                  <input
                    type="text"
                    value={settings?.name || ''}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    placeholder="e.g. DELIGHT PIZZA"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  />
                  <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showBusinessName !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: {
                            ...settings?.receipt_settings,
                            showBusinessName: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      Print business name on bills
                    </span>
                  </label>
                </div>

                <div className="md:col-span-5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Business name text size (px):
                  </label>
                  <input
                    type="number"
                    min="12"
                    max="36"
                    value={settings?.receipt_settings?.businessNameFontSize ?? 21}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        receipt_settings: {
                          ...settings?.receipt_settings,
                          businessNameFontSize: parseInt(e.target.value) || 21,
                        },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Contact Number Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-7">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Number:
                  </label>
                  <input
                    type="text"
                    value={settings?.phone || ''}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="e.g. 03342823000 / 0915828000 / 03062823000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                  <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showPhone !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: {
                            ...settings?.receipt_settings,
                            showPhone: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      Print contact number on bills
                    </span>
                  </label>
                </div>

                <div className="md:col-span-5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact number text size (px):
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="24"
                    value={settings?.receipt_settings?.phoneFontSize ?? 14}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        receipt_settings: {
                          ...settings?.receipt_settings,
                          phoneFontSize: parseInt(e.target.value) || 14,
                        },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Address Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-7">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Address:
                  </label>
                  <input
                    type="text"
                    value={settings?.address || ''}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    placeholder="e.g. Street 10, Sector P1, Phase 4, Hayatabad Peshawar"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                  <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showAddress !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: {
                            ...settings?.receipt_settings,
                            showAddress: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      Print address on bills
                    </span>
                  </label>
                </div>

                <div className="md:col-span-5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Address text size (px):
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="24"
                    value={settings?.receipt_settings?.addressFontSize ?? 14}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        receipt_settings: {
                          ...settings?.receipt_settings,
                          addressFontSize: parseInt(e.target.value) || 14,
                        },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Bill Slogan Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-7">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bill Slogan:
                  </label>
                  <input
                    type="text"
                    value={settings?.receipt_settings?.sloganText ?? 'Fresh & Delicious'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        receipt_settings: {
                          ...settings?.receipt_settings,
                          sloganText: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Fresh & Delicious"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                  <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.receipt_settings?.showSlogan !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receipt_settings: {
                            ...settings?.receipt_settings,
                            showSlogan: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      Print slogan on bills
                    </span>
                  </label>
                </div>

                <div className="md:col-span-5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Slogan text size (px):
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="22"
                    value={settings?.receipt_settings?.sloganFontSize ?? 13}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        receipt_settings: {
                          ...settings?.receipt_settings,
                          sloganFontSize: parseInt(e.target.value) || 13,
                        },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Logo Upload & Size Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="md:col-span-7">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Restaurant Logo (optional):
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/gif"
                      onChange={handleLogoUpload}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 dark:file:bg-brand-950/50 file:text-brand-600 dark:file:text-brand-400 hover:file:bg-brand-100 cursor-pointer"
                    />
                    {(settings?.logo_url || settings?.receipt_settings?.logoUrl) && (
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            logo_url: '',
                            receipt_settings: { ...settings.receipt_settings, logoUrl: '', showLogo: false },
                          })
                        }
                        className="text-rose-500 hover:text-rose-700 font-bold text-[11px] whitespace-nowrap"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    PNG, JPG, WEBP or GIF. The logo is resized for thermal printing.
                  </p>
                </div>

                <div className="md:col-span-5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bill Logo Size:
                  </label>
                  <select
                    value={settings?.receipt_settings?.logoSize || 'XL'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        receipt_settings: {
                          ...settings?.receipt_settings,
                          logoSize: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="S">S (Small - 60px)</option>
                    <option value="M">M (Medium - 90px)</option>
                    <option value="L">L (Large - 130px)</option>
                    <option value="XL">XL (Extra Large - 180px)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-md text-xs transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : '💾 Save Business Info'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* =========================================================================
              CARD 2: 🧾 Thermal Receipt Print Format & Design
             ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>🧾 Thermal Receipt Print Format & Design</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Updated 30 Sep 2026 — single-bill printing and isolated thermal pages. Choose your preferred layout format for thermal receipt printing (80mm / 58mm roll paper). Includes Table-Grid Invoice style.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestPrint}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 hover:bg-brand-100 border border-brand-200 dark:border-brand-800 rounded-xl font-bold transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ Test Print / Cutter</span>
              </button>
            </div>

            {/* Template Selector Cards Grid */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-2.5 text-xs">
                Choose Print Template Style:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {RECEIPT_THEMES.filter(t => ['TABLE_GRID', 'STANDARD_80MM', 'MODERN_DARK_BANNER', 'FORMAL_ELEGANT', 'ECO_SAVE_COMPACT'].includes(t.id)).map((theme) => {
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

            {/* Layout Options Grid + Live Preview Split */}
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left Column: Metrics & Print Layout Controls */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3.5">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-brand-500" />
                      <span>Thermal Format & Layout Metrics</span>
                    </h4>

                    {/* Paper Width */}
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Paper width:
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
                        <option value="80mm">80mm</option>
                        <option value="58mm">58mm</option>
                      </select>
                    </div>

                    {/* Font & Line Spacing */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Bill text size (px)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="22"
                          value={settings?.receipt_settings?.billFontSize ?? 15}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                billFontSize: parseInt(e.target.value) || 15,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Line spacing
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="1"
                          max="2.5"
                          value={settings?.receipt_settings?.lineSpacing ?? 1.25}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                lineSpacing: parseFloat(e.target.value) || 1.25,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                    </div>

                    {/* Margins */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Left margin (mm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={settings?.receipt_settings?.marginLeftMm ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                marginLeftMm: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Right margin (mm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={settings?.receipt_settings?.marginRightMm ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                marginRightMm: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Space Above / Below */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Space above bill (mm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={settings?.receipt_settings?.spaceAboveMm ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                spaceAboveMm: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Space below bill (mm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={settings?.receipt_settings?.spaceBelowMm ?? 20}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                spaceBelowMm: parseInt(e.target.value) || 20,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-[10px] text-amber-900 dark:text-amber-200 leading-relaxed">
                      <strong>Browser:</strong> select matching roll paper, scale 100%, margins None, and turn headers/footers off. <strong>Desktop ESC/POS:</strong> text size selects nearest built-in printer font; spacing and margins assume a 203dpi printer.
                    </div>

                    {/* Auto-cut & Copies */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings?.receipt_settings?.autoCutReceipt !== false}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                autoCutReceipt: e.target.checked,
                              },
                            })
                          }
                          className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Auto-cut each receipt (ESC/POS desktop printer)
                        </span>
                      </label>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Receipt copies
                        </label>
                        <select
                          value={settings?.receipt_settings?.receiptCopies || 'CUSTOMER_ONLY'}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                receiptCopies: e.target.value as any,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                        >
                          <option value="CUSTOMER_ONLY">Customer only — one bill</option>
                          <option value="CUSTOMER_AND_KITCHEN">Customer + Kitchen</option>
                          <option value="TWO_CUSTOMER_COPIES">Two customer copies</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Desktop cutter command
                        </label>
                        <select
                          value={settings?.receipt_settings?.desktopCutterCommand || 'FEED_PARTIAL_CUT'}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              receipt_settings: {
                                ...settings.receipt_settings,
                                desktopCutterCommand: e.target.value as any,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                        >
                          <option value="FEED_PARTIAL_CUT">Feed + partial cut (recommended)</option>
                          <option value="FEED_FULL_CUT">Feed + full cut</option>
                          <option value="NO_CUT">No cut</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Interactive Receipt Preview */}
                <div className="lg:col-span-7 flex flex-col">
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <Eye className="w-4 h-4 text-brand-500" />
                      <span>👁️ Live Preview Design</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {activeTemplateId} • {settings?.receipt_settings?.paperWidth || '80mm'}
                    </span>
                  </div>

                  <div className="flex-1 bg-slate-200/80 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 flex justify-center items-start overflow-y-auto max-h-[580px] shadow-inner">
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-md text-xs transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : '💾 Save Receipt Settings'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
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
