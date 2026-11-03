import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const PlatformTenants: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    legalName: '',
    ownerName: '',
    email: '',
    phone: '',
    country: 'Pakistan',
    currency: 'PKR',
    timeZone: 'Asia/Karachi',
    businessType: 'CAFE',
    planId: '',
    initialAdminPassword: 'Password123!',
    trialDays: 14,
  });

  const [planForm, setPlanForm] = useState({
    planId: '',
    extendDays: 30,
  });

  const fetchTenants = async () => {
    try {
      let url = '/platform/tenants?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      const data = await api.get(url);
      setTenants(data.tenants || []);
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const data = await api.get('/platform/plans');
      setPlans(data.plans || []);
      if (data.plans?.length > 0 && !createForm.planId) {
        setCreateForm((prev) => ({ ...prev, planId: data.plans[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchPlans();
  }, [search, statusFilter]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/platform/tenants', createForm);
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        legalName: '',
        ownerName: '',
        email: '',
        phone: '',
        country: 'Pakistan',
        currency: 'PKR',
        timeZone: 'Asia/Karachi',
        businessType: 'CAFE',
        planId: plans[0]?.id || '',
        initialAdminPassword: 'Password123!',
        trialDays: 14,
      });
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Failed to create restaurant');
    }
  };

  const handleToggleStatus = async (tenantId: string, currentActive: boolean) => {
    const reason = !currentActive
      ? prompt('Reason for suspension:') || 'Suspended by platform administrator'
      : undefined;

    if (!currentActive && !reason) return;

    try {
      await api.put(`/platform/tenants/${tenantId}/status`, {
        isActive: !currentActive,
        reason,
      });
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Failed to update restaurant status');
    }
  };

  const handleChangePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    try {
      await api.put(`/platform/tenants/${selectedTenant.id}/plan`, {
        planId: planForm.planId,
        extendDays: planForm.extendDays,
      });
      setIsPlanModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Failed to change plan');
    }
  };

  const viewTenantDetails = async (id: string) => {
    try {
      const data = await api.get(`/platform/tenants/${id}`);
      setSelectedTenant(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load details');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Restaurant Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Register and manage customer restaurant accounts and subscriptions
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register Restaurant</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by restaurant or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Subscription Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Restaurant</th>
                <th className="px-6 py-3.5">Owner / Contact</th>
                <th className="px-6 py-3.5">Plan</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Branches / Users</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    Loading restaurants...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No restaurants found. Click "Register Restaurant" to add your first customer.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.city}, {t.country}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{t.owner_name}</div>
                      <div className="text-slate-500">{t.email}</div>
                      <div className="text-slate-400 text-[10px]">{t.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">{t.plan_name || 'No Plan'}</span>
                      {t.current_period_end && (
                        <div className="text-[10px] text-slate-400">
                          Renews: {new Date(t.current_period_end).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.subscription_status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.subscription_status === 'TRIAL'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.is_active ? t.subscription_status || 'UNKNOWN' : 'SUSPENDED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span>{t.branch_count} branch(es)</span> • <span>{t.user_count} staff</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedTenant(t);
                          setPlanForm({ planId: t.plan_id || plans[0]?.id || '', extendDays: 30 });
                          setIsPlanModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
                      >
                        Change Plan
                      </button>
                      <button
                        onClick={() => handleToggleStatus(t.id, t.is_active)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                          t.is_active
                            ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                            : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {t.is_active ? 'Suspend' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => viewTenantDetails(t.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Restaurant */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Register Restaurant (Tenant)" maxWidth="xl">
        <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Restaurant Name</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Royal Spice Cafe"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Type</label>
              <select
                value={createForm.businessType}
                onChange={(e) => setCreateForm({ ...createForm, businessType: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="CAFE">Café / Coffee Shop</option>
                <option value="FAST_FOOD">Fast Food / Burger Joint</option>
                <option value="FINE_DINE">Fine Dine Restaurant</option>
                <option value="TAKEAWAY">Takeaway / Delivery Outlet</option>
                <option value="BAKERY">Bakery & Sweets</option>
                <option value="FOOD_TRUCK">Food Truck</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Owner Full Name</label>
              <input
                type="text"
                required
                value={createForm.ownerName}
                onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                placeholder="e.g. Tariq Mehmood"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Owner Email (Login)</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="owner@royalspice.com"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                required
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="03001234567"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Initial Owner Password</label>
              <input
                type="password"
                required
                value={createForm.initialAdminPassword}
                onChange={(e) => setCreateForm({ ...createForm, initialAdminPassword: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Subscription Plan</label>
              <select
                value={createForm.planId}
                onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (PKR {Number(p.monthly_price).toLocaleString()}/mo)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trial Days</label>
              <input
                type="number"
                min="0"
                value={createForm.trialDays}
                onChange={(e) => setCreateForm({ ...createForm, trialDays: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg"
            >
              Register & Initialize Restaurant
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Change Subscription Plan */}
      <Modal isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} title="Change Subscription Plan" maxWidth="md">
        <form onSubmit={handleChangePlan} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select New Plan</label>
            <select
              value={planForm.planId}
              onChange={(e) => setPlanForm({ ...planForm, planId: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency} {Number(p.monthly_price).toLocaleString()}/mo)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Extend Period (Days)</label>
            <input
              type="number"
              min="1"
              value={planForm.extendDays}
              onChange={(e) => setPlanForm({ ...planForm, extendDays: parseInt(e.target.value) || 30 })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsPlanModalOpen(false)}
              className="px-4 py-2 border rounded-lg text-slate-600"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg font-bold">
              Update Plan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Details */}
      {selectedTenant?.tenant && (
        <Modal isOpen={!!selectedTenant} onClose={() => setSelectedTenant(null)} title={`${selectedTenant.tenant.name} - Overview`} maxWidth="2xl">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <p className="text-slate-500">Owner Name</p>
                <p className="font-bold text-slate-800">{selectedTenant.tenant.owner_name}</p>
              </div>
              <div>
                <p className="text-slate-500">Contact Email</p>
                <p className="font-bold text-slate-800">{selectedTenant.tenant.email}</p>
              </div>
              <div>
                <p className="text-slate-500">Currency & Timezone</p>
                <p className="font-bold text-slate-800">{selectedTenant.tenant.currency} ({selectedTenant.tenant.time_zone})</p>
              </div>
              <div>
                <p className="text-slate-500">Tax Settings</p>
                <p className="font-bold text-slate-800">{selectedTenant.tenant.tax_rate_percent}% (Tax Inclusive: {selectedTenant.tenant.is_tax_inclusive ? 'Yes' : 'No'})</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Branches ({selectedTenant.branches?.length || 0})</h4>
              <div className="space-y-1">
                {selectedTenant.branches?.map((b: any) => (
                  <div key={b.id} className="p-2 border rounded-lg flex justify-between bg-white">
                    <span className="font-semibold">{b.name} ({b.code})</span>
                    <span className="text-slate-500">{b.city}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Registered Users ({selectedTenant.users?.length || 0})</h4>
              <div className="space-y-1">
                {selectedTenant.users?.map((u: any) => (
                  <div key={u.id} className="p-2 border rounded-lg flex justify-between bg-white">
                    <span>{u.full_name} ({u.email})</span>
                    <span className="font-bold text-slate-700">{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
