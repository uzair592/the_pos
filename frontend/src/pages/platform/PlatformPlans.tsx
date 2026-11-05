import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  CreditCard,
  Plus,
  Check,
  X,
  Shield,
  Sparkles,
  Edit3,
  Trash2,
  RefreshCw,
  Users,
  Building2,
  Monitor,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { FeatureKey } from '@pos/shared';

export const PlatformPlans: React.FC = () => {
  const { success, error, info } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

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
    maxDevices: 4,
    isActive: true,
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
    } catch (err: any) {
      console.error('Failed to load plans:', err);
      error(err.message || 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreateModal = () => {
    setForm({
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
      maxDevices: 4,
      isActive: true,
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
    setIsCreateOpen(true);
  };

  const openEditModal = (p: any) => {
    setSelectedPlan(p);
    const ent = p.entitlements || {};
    const feats = ent.features || {};

    setForm({
      name: p.name,
      code: p.code,
      description: p.description || '',
      monthlyPrice: Number(p.monthly_price) || 0,
      annualPrice: Number(p.annual_price) || 0,
      currency: p.currency || 'PKR',
      trialDays: Number(p.trial_days) || 14,
      gracePeriodDays: Number(p.grace_period_days) || 3,
      maxBranches: ent.maxBranches !== undefined ? ent.maxBranches : 1,
      maxStaff: ent.maxStaff !== undefined ? ent.maxStaff : 5,
      maxDevices: ent.maxDevices !== undefined ? ent.maxDevices : 4,
      isActive: p.is_active !== false,
      features: {
        [FeatureKey.INVENTORY]: !!feats[FeatureKey.INVENTORY],
        [FeatureKey.KDS]: !!feats[FeatureKey.KDS],
        [FeatureKey.ADVANCED_REPORTS]: !!feats[FeatureKey.ADVANCED_REPORTS],
        [FeatureKey.MULTI_BRANCH]: !!feats[FeatureKey.MULTI_BRANCH],
        [FeatureKey.CUSTOMER_MANAGEMENT]: !!feats[FeatureKey.CUSTOMER_MANAGEMENT],
        [FeatureKey.DATA_EXPORT]: !!feats[FeatureKey.DATA_EXPORT],
        [FeatureKey.ADVANCED_PERMISSIONS]: !!feats[FeatureKey.ADVANCED_PERMISSIONS],
      },
    });
    setIsEditOpen(true);
  };

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
      success(`Subscription plan "${form.name}" created successfully`);
      setIsCreateOpen(false);
      fetchPlans();
    } catch (err: any) {
      error(err.message || 'Failed to create plan');
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    try {
      await api.put(`/platform/plans/${selectedPlan.id}`, {
        name: form.name,
        description: form.description,
        monthlyPrice: Number(form.monthlyPrice),
        annualPrice: Number(form.annualPrice),
        trialDays: Number(form.trialDays),
        gracePeriodDays: Number(form.gracePeriodDays),
        isActive: form.isActive,
        entitlements: {
          maxBranches: Number(form.maxBranches),
          maxStaff: Number(form.maxStaff),
          maxDevices: Number(form.maxDevices),
          features: form.features,
        },
      });
      success(`Plan "${form.name}" updated successfully`);
      setIsEditOpen(false);
      fetchPlans();
    } catch (err: any) {
      error(err.message || 'Failed to update plan');
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    try {
      await api.delete(`/platform/plans/${selectedPlan.id}`);
      success(`Plan "${selectedPlan.name}" removed successfully`);
      setIsDeleteOpen(false);
      fetchPlans();
    } catch (err: any) {
      error(err.message || 'Failed to delete plan');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Subscription Plans</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure SaaS subscription tiers, pricing, limits, and server-enforced entitlements
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchPlans();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Plan</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-16 text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
            Loading subscription tiers...
          </div>
        ) : plans.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            No subscription plans created yet. Click "Create Custom Plan" to add your first tier.
          </div>
        ) : (
          plans.map((p) => {
            const ent = p.entitlements || {};
            const feats = ent.features || {};
            const subscribersCount = Number(p.active_subscribers_count) || 0;

            return (
              <div
                key={p.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border ${
                  p.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-rose-200 dark:border-rose-900/50 opacity-75'
                } p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wide">
                      {p.code}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {p.trial_days} days trial
                      </span>
                      {!p.is_active && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-700 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-3">{p.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[36px]">{p.description}</p>

                  <div className="mt-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-baseline">
                      <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{p.currency}</span>
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        {Number(p.monthly_price).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">/ month</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      or {p.currency} {Number(p.annual_price).toLocaleString()} billed annually
                    </p>
                  </div>

                  {/* Active Subscribers Pill */}
                  <div className="mt-3.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Active Subscribers</span>
                    <span className="font-extrabold text-brand-600 dark:text-brand-400">
                      {subscribersCount} restaurant{subscribersCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Entitlement Limits */}
                  <div className="mt-4 space-y-2 text-xs">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account Limits</p>
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center space-x-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Max Branches:</span>
                      </span>
                      <span className="font-bold">
                        {ent.maxBranches === -1 ? 'Unlimited' : ent.maxBranches}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Max Staff Accounts:</span>
                      </span>
                      <span className="font-bold">
                        {ent.maxStaff === -1 ? 'Unlimited' : ent.maxStaff}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center space-x-1">
                        <Monitor className="w-3.5 h-3.5 text-slate-400" />
                        <span>Max Devices / Sessions:</span>
                      </span>
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
                            <X className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className={enabled ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Plan Card Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <button
                    onClick={() => openEditModal(p)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Tier</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPlan(p);
                      setIsDeleteOpen(true);
                    }}
                    disabled={subscribersCount > 0}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={subscribersCount > 0 ? 'Cannot delete plan with active subscribers' : 'Delete plan'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Plan Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Professional Cloud"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unique Plan Code *</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. PRO_CLOUD"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description of plan features and target restaurant profile"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Monthly Price ({form.currency})</label>
              <input
                type="number"
                min="0"
                required
                value={form.monthlyPrice}
                onChange={(e) => setForm({ ...form, monthlyPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Annual Price ({form.currency})</label>
              <input
                type="number"
                min="0"
                required
                value={form.annualPrice}
                onChange={(e) => setForm({ ...form, annualPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Trial Period (Days)</label>
              <input
                type="number"
                min="0"
                value={form.trialDays}
                onChange={(e) => setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Grace Period (Days)</label>
              <input
                type="number"
                min="0"
                value={form.gracePeriodDays}
                onChange={(e) => setForm({ ...form, gracePeriodDays: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Entitlement Limits (-1 for unlimited)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Branches</label>
                <input
                  type="number"
                  value={form.maxBranches}
                  onChange={(e) => setForm({ ...form, maxBranches: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Staff Users</label>
                <input
                  type="number"
                  value={form.maxStaff}
                  onChange={(e) => setForm({ ...form, maxStaff: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Concurrent Devices</label>
                <input
                  type="number"
                  value={form.maxDevices}
                  onChange={(e) => setForm({ ...form, maxDevices: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Enable Feature Modules</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries({
                [FeatureKey.INVENTORY]: 'Recipe & Stock Management',
                [FeatureKey.KDS]: 'Kitchen Display System (KDS)',
                [FeatureKey.ADVANCED_REPORTS]: 'Advanced Financial Reports',
                [FeatureKey.MULTI_BRANCH]: 'Multi-Branch Consolidation',
                [FeatureKey.CUSTOMER_MANAGEMENT]: 'Customer Loyalty Profiles',
                [FeatureKey.DATA_EXPORT]: 'CSV & Excel Export',
                [FeatureKey.ADVANCED_PERMISSIONS]: 'Custom Staff Permissions',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={!!(form.features as any)[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        features: {
                          ...form.features,
                          [key]: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
            >
              Create Plan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Plan */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Edit Plan: ${selectedPlan?.name}`} maxWidth="xl">
        <form onSubmit={handleUpdatePlan} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Plan Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setForm({ ...form, isActive: e.target.value === 'ACTIVE' })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="ACTIVE">Active (Available for subscription)</option>
                <option value="INACTIVE">Inactive (Archived tier)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Monthly Price ({form.currency})</label>
              <input
                type="number"
                min="0"
                required
                value={form.monthlyPrice}
                onChange={(e) => setForm({ ...form, monthlyPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Annual Price ({form.currency})</label>
              <input
                type="number"
                min="0"
                required
                value={form.annualPrice}
                onChange={(e) => setForm({ ...form, annualPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Trial Period (Days)</label>
              <input
                type="number"
                min="0"
                value={form.trialDays}
                onChange={(e) => setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Grace Period (Days)</label>
              <input
                type="number"
                min="0"
                value={form.gracePeriodDays}
                onChange={(e) => setForm({ ...form, gracePeriodDays: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Entitlement Limits</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Branches</label>
                <input
                  type="number"
                  value={form.maxBranches}
                  onChange={(e) => setForm({ ...form, maxBranches: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Staff Users</label>
                <input
                  type="number"
                  value={form.maxStaff}
                  onChange={(e) => setForm({ ...form, maxStaff: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Concurrent Devices</label>
                <input
                  type="number"
                  value={form.maxDevices}
                  onChange={(e) => setForm({ ...form, maxDevices: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Enable Feature Modules</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries({
                [FeatureKey.INVENTORY]: 'Recipe & Stock Management',
                [FeatureKey.KDS]: 'Kitchen Display System (KDS)',
                [FeatureKey.ADVANCED_REPORTS]: 'Advanced Financial Reports',
                [FeatureKey.MULTI_BRANCH]: 'Multi-Branch Consolidation',
                [FeatureKey.CUSTOMER_MANAGEMENT]: 'Customer Loyalty Profiles',
                [FeatureKey.DATA_EXPORT]: 'CSV & Excel Export',
                [FeatureKey.ADVANCED_PERMISSIONS]: 'Custom Staff Permissions',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={!!(form.features as any)[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        features: {
                          ...form.features,
                          [key]: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Safeguard Confirmation */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title={`Delete Plan: ${selectedPlan?.name}`} maxWidth="md">
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 flex items-start space-x-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Permanently Remove Plan</p>
              <p className="text-[11px] mt-0.5">
                Are you sure you want to delete this subscription plan tier? This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeletePlan}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md"
            >
              Delete Plan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
