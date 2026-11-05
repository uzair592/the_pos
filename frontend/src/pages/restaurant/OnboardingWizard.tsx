import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Sparkles,
  Building,
  Receipt,
  Store,
  ArrowRight,
  CheckCircle2,
  Percent,
} from 'lucide-react';

export const OnboardingWizard: React.FC = () => {
  const { tenant, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    legalName: tenant?.name || '',
    phone: tenant?.phone || '',
    address: 'Main Commercial Avenue',
    city: 'Karachi',
    currency: 'PKR',
    currencySymbol: 'Rs.',
    timeZone: 'Asia/Karachi',
    taxRatePercent: 16.0,
    taxRegistrationNumber: '',
    isTaxInclusive: false,
    serviceChargePercent: 0.0,
    initialBranchName: 'Main Branch',
    receiptSettings: {
      headerText: 'Welcome to our restaurant',
      footerText: 'Thank you for dining with us!',
      showLogo: true,
      paperWidth: '80mm' as '58mm' | '80mm' | 'A4',
      showTaxBreakdown: true,
      showCashierName: true,
      showCustomerDetails: true,
      bilingualUrduEnglish: false,
    },
  });

  const handleFinish = async () => {
    setLoading(true);
    try {
      await api.post('/restaurant/onboarding', form);
      await refreshProfile();
      navigate('/app');
    } catch (err: any) {
      alert(err.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-brand-50 border border-brand-200/80 text-brand-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to Your POS SaaS</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Let's Set Up {tenant?.name || 'Your Restaurant'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure your local taxes, receipt design, and initial branch in 3 simple steps
          </p>
        </div>

        {/* Steps Tracker */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[
            { num: 1, title: 'Business Profile', icon: Building },
            { num: 2, title: 'Taxes & Currency', icon: Percent },
            { num: 3, title: 'Receipt Design', icon: Receipt },
          ].map((s) => {
            const Icon = s.icon;
            const isDone = step > s.num;
            const isCurrent = step === s.num;

            return (
              <div key={s.num} className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-brand-500 text-white ring-4 ring-brand-100'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-xs font-semibold ${isCurrent ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          {step === 1 && (
            <div className="space-y-4 text-xs">
              <h3 className="text-base font-bold text-slate-900 mb-2">Step 1: Business Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Legal / Company Name</label>
                  <input
                    type="text"
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Contact Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Physical Street Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Main Branch Name</label>
                  <input
                    type="text"
                    value={form.initialBranchName}
                    onChange={(e) => setForm({ ...form, initialBranchName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 text-xs">
              <h3 className="text-base font-bold text-slate-900 mb-2">Step 2: Taxes & Financial Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency Code</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={form.currencySymbol}
                    onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sales Tax % (GST/SST/VAT)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.taxRatePercent}
                    onChange={(e) => setForm({ ...form, taxRatePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax Reg # (STRN / NTN)</label>
                  <input
                    type="text"
                    placeholder="e.g. 12-34-5678-9"
                    value={form.taxRegistrationNumber}
                    onChange={(e) => setForm({ ...form, taxRegistrationNumber: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service Charge %</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.serviceChargePercent}
                    onChange={(e) => setForm({ ...form, serviceChargePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isTaxInclusive}
                      onChange={(e) => setForm({ ...form, isTaxInclusive: e.target.checked })}
                      className="rounded text-brand-500 focus:ring-brand-500"
                    />
                    <span className="font-semibold text-slate-700">Menu prices already include tax</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-xs">
              <h3 className="text-base font-bold text-slate-900 mb-2">Step 3: Receipt & Print Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Paper Roll Width</label>
                  <select
                    value={form.receiptSettings.paperWidth}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        receiptSettings: { ...form.receiptSettings, paperWidth: e.target.value as any },
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="80mm">80mm Standard POS Thermal Paper</option>
                    <option value="58mm">58mm Compact POS Thermal Paper</option>
                    <option value="A4">A4 Full Page Invoice</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt English Header</label>
                  <input
                    type="text"
                    value={form.receiptSettings.headerText}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        receiptSettings: { ...form.receiptSettings, headerText: e.target.value },
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 border rounded-lg font-semibold text-slate-600 hover:bg-slate-50 text-xs"
              >
                Back
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 py-2 rounded-lg text-xs"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinish}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg text-xs shadow-md"
              >
                <span>{loading ? 'Finalizing Setup...' : 'Complete & Launch Dashboard'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
