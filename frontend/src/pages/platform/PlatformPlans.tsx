import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../../components/common/Modal.js';
import { CreditCard, Plus, Check, X, Shield, Sparkles } from 'lucide-react';
import { FeatureKey } from '@pos/shared';

export const PlatformPlans: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    monthlyPrice: 5000,
    annualPrice: 50000,
    currency: 'PKR',
    trialDays: 14,
    gracePeriodDays: 3,
    maxBranches: 1,
    maxStaff: 5,
    maxDevices: 2,
    features: {
      [FeatureKey.INVENTORY]: true,
      [FeatureKey.KDS]: false,
      [FeatureKey.ADVANCED_REPORTS]: false,
      [FeatureKey.MULTI_BRANCH]: false,
      [FeatureKey.CUSTOMER_MANAGEMENT]: true,
      [FeatureKey.DATA_EXPORT]: false,
      [FeatureKey.ADVANCED_PERMISSIONS]: false,
    },
  });

  const fetchPlans = async () => {
    try {
      const data = await api.get('/platform/plans');
      setPlans(data.plans || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/platform/plans', {
        name: form.name,
        code: form.code.toUpperCase(),
        description: form.description,
        monthlyPrice: Number(form.monthlyPrice),
        annualPrice: Number(form.annualPrice),
        currency: form.currency,
        trialDays: Number(form.trialDays),
        gracePeriodDays: Number(form.gracePeriodDays),
        entitlements: {
          maxBranches: Number(form.maxBranches),
          maxStaff: Number(form.maxStaff),
          maxDevices: Number(form.maxDevices),
          features: form.features,
        },
      });
      setIsCreateOpen(false);
      fetchPlans();
    } catch (err: any) {
      alert(err.message || 'Failed to create plan');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Subscription Plans</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure SaaS tiers, pricing, limits, and server-enforced entitlements
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Custom Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-400 text-xs">
            Loading plans...
          </div>
        ) : (
          plans.map((p) => {
            const ent = p.entitlements || {};
            const feats = ent.features || {};

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wide">
                      {p.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{p.trial_days} days trial</span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 mt-3">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{p.description}</p>

                  <div className="mt-4 pb-4 border-b border-slate-100">
                    <div className="flex items-baseline">
                      <span className="text-xs text-slate-500 mr-1">{p.currency}</span>
                      <span className="text-3xl font-black text-slate-900">
                        {Number(p.monthly_price).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">/ month</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      or {p.currency} {Number(p.annual_price).toLocaleString()} billed annually
                    </p>
                  </div>

                  {/* Limits */}
                  <div className="mt-4 space-y-2 text-xs">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account Limits</p>
                    <div className="flex justify-between text-slate-700">
                      <span>Max Branches:</span>
                      <span className="font-bold">
                        {ent.maxBranches === -1 ? 'Unlimited' : ent.maxBranches}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Max Staff Accounts:</span>
                      <span className="font-bold">
                        {ent.maxStaff === -1 ? 'Unlimited' : ent.maxStaff}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Max Devices / Terminals:</span>
                      <span className="font-bold">
                        {ent.maxDevices === -1 ? 'Unlimited' : ent.maxDevices}
                      </span>
                    </div>
                  </div>

                  {/* Feature Flags */}
                  <div className="mt-5 space-y-2 text-xs">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Included Features</p>
                    {Object.entries({
                      [FeatureKey.INVENTORY]: 'Recipe & Stock Management',
                      [FeatureKey.KDS]: 'Kitchen Display System (KDS)',
                      [FeatureKey.ADVANCED_REPORTS]: 'Advanced Financial Reports',
                      [FeatureKey.MULTI_BRANCH]: 'Multi-Branch Consolidation',
                      [FeatureKey.CUSTOMER_MANAGEMENT]: 'Customer Profiles & Loyalty',
                      [FeatureKey.DATA_EXPORT]: 'CSV & Excel Export',
                      [FeatureKey.ADVANCED_PERMISSIONS]: 'Custom Staff Permissions',
                    }).map(([key, label]) => {
                      const enabled = !!feats[key];
                      return (
                        <div key={key} className="flex items-center space-x-2">
                          {enabled ? (
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <span className={enabled ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Plan */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Subscription Plan" maxWidth="xl">
        <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Plan Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Pro franchise"
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Plan Code (Unique ID)</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PRO_FRANCHISE"
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Monthly Price (PKR)</label>
              <input
                type="number"
                min="0"
                value={form.monthlyPrice}
                onChange={(e) => setForm({ ...form, monthlyPrice: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Annual Price (PKR)</label>
              <input
                type="number"
                min="0"
                value={form.annualPrice}
                onChange={(e) => setForm({ ...form, annualPrice: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trial Days</label>
              <input
                type="number"
                min="0"
                value={form.trialDays}
                onChange={(e) => setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Grace Period Days</label>
              <input
                type="number"
                min="0"
                value={form.gracePeriodDays}
                onChange={(e) => setForm({ ...form, gracePeriodDays: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t">
            <h4 className="font-bold text-slate-800 mb-2">Entitlement Limits (-1 for unlimited)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Max Branches</label>
                <input
                  type="number"
                  value={form.maxBranches}
                  onChange={(e) => setForm({ ...form, maxBranches: parseInt(e.target.value) || 1 })}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Max Staff</label>
                <input
                  type="number"
                  value={form.maxStaff}
                  onChange={(e) => setForm({ ...form, maxStaff: parseInt(e.target.value) || 5 })}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Max Devices</label>
                <input
                  type="number"
                  value={form.maxDevices}
                  onChange={(e) => setForm({ ...form, maxDevices: parseInt(e.target.value) || 2 })}
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t">
            <h4 className="font-bold text-slate-800 mb-2">Feature Entitlements</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries({
                [FeatureKey.INVENTORY]: 'Inventory & Recipes',
                [FeatureKey.KDS]: 'Kitchen Display System',
                [FeatureKey.ADVANCED_REPORTS]: 'Advanced Financial Reports',
                [FeatureKey.MULTI_BRANCH]: 'Multi-Branch Support',
                [FeatureKey.CUSTOMER_MANAGEMENT]: 'Customer Management',
                [FeatureKey.DATA_EXPORT]: 'Data Export',
                [FeatureKey.ADVANCED_PERMISSIONS]: 'Advanced Permissions',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center space-x-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form.features[key as FeatureKey]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        features: {
                          ...form.features,
                          [key as FeatureKey]: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-brand-500 focus:ring-brand-500"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border rounded-lg text-slate-600"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg font-bold">
              Save Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
