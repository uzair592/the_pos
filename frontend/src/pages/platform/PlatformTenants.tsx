import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
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
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  UserCheck,
} from 'lucide-react';

export const PlatformTenants: React.FC = () => {
  const { success, error, info } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Credential Management Modal State
  const [isCredModalOpen, setIsCredModalOpen] = useState(false);
  const [credTenant, setCredTenant] = useState<any | null>(null);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credUpdating, setCredUpdating] = useState(false);

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
    } catch (err: any) {
      console.error('Failed to fetch tenants:', err);
      error(err.message || 'Failed to fetch restaurants');
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
    } catch (err: any) {
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
      success(`Restaurant "${createForm.name}" created and initialized`);
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
      error(err.message || 'Failed to create restaurant');
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
      success(`Restaurant status updated`);
      fetchTenants();
    } catch (err: any) {
      error(err.message || 'Failed to update restaurant status');
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
      success('Subscription plan updated');
      setIsPlanModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      error(err.message || 'Failed to change plan');
    }
  };

  const viewTenantDetails = async (id: string) => {
    try {
      const data = await api.get(`/platform/tenants/${id}`);
      setSelectedTenant(data);
    } catch (err: any) {
      error(err.message || 'Failed to load details');
    }
  };

  // Credential Management Modal Handler
  const openCredentialsModal = async (tenant: any) => {
    setCredTenant(tenant);
    setIsCredModalOpen(true);
    setCredLoading(true);
    setSelectedUser(null);
    setNewPassword('');
    setShowPassword(false);
    try {
      const data = await api.get(`/platform/tenants/${tenant.id}/users`);
      setTenantUsers(data.users || []);
      if (data.users?.length > 0) {
        setSelectedUser(data.users[0]);
        setUserEmail(data.users[0].email);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load tenant users');
    } finally {
      setCredLoading(false);
    }
  };

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 14; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setShowPassword(true);
    info('Generated strong secure password');
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credTenant || !selectedUser) return;
    setCredUpdating(true);
    try {
      const payload: any = {};
      if (userEmail && userEmail !== selectedUser.email) {
        payload.email = userEmail;
      }
      if (newPassword) {
        payload.password = newPassword;
      }
      if (Object.keys(payload).length === 0) {
        info('No credential changes entered');
        setCredUpdating(false);
        return;
      }
      await api.patch(`/platform/tenants/${credTenant.id}/users/${selectedUser.id}/credentials`, payload);
      success(`Credentials updated for ${selectedUser.full_name}. Active sessions invalidated.`);
      setNewPassword('');
      // Reload users
      const data = await api.get(`/platform/tenants/${credTenant.id}/users`);
      setTenantUsers(data.users || []);
      const updated = (data.users || []).find((u: any) => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      error(err.message || 'Failed to update credentials');
    } finally {
      setCredUpdating(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Restaurant Management</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Register and manage customer restaurant accounts, credentials, and subscriptions
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
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by restaurant or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Restaurant</th>
                <th className="px-6 py-3.5">Owner / Contact</th>
                <th className="px-6 py-3.5">Plan</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Branches / Users</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.city}, {t.country}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{t.owner_name}</div>
                      <div className="text-slate-500 dark:text-slate-400">{t.email}</div>
                      <div className="text-slate-400 dark:text-slate-500 text-[10px]">{t.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t.plan_name || 'No Plan'}</span>
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
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : t.subscription_status === 'TRIAL'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {t.is_active ? t.subscription_status || 'UNKNOWN' : 'SUSPENDED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <span>{t.branch_count} branch(es)</span> • <span>{t.user_count} staff</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5">
                      <button
                        onClick={() => openCredentialsModal(t)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200/50 dark:border-amber-900/50"
                        title="Manage restaurant user accounts & reset passwords"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Credentials</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTenant(t);
                          setPlanForm({ planId: t.plan_id || plans[0]?.id || '', extendDays: 30 });
                          setIsPlanModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 rounded-lg transition-colors"
                      >
                        Plan
                      </button>
                      <button
                        onClick={() => handleToggleStatus(t.id, t.is_active)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                          t.is_active
                            ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100'
                            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100'
                        }`}
                      >
                        {t.is_active ? 'Suspend' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => viewTenantDetails(t.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
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

      {/* Modal: Credential Management */}
      <Modal
        isOpen={isCredModalOpen}
        onClose={() => setIsCredModalOpen(false)}
        title={`Credentials & Users: ${credTenant?.name || ''}`}
        maxWidth="xl"
      >
        {credLoading ? (
          <div className="py-8 text-center text-slate-400 text-xs">Loading user accounts...</div>
        ) : (
          <div className="space-y-5 text-xs">
            {/* User Selector */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Restaurant Staff / Admin User
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/40">
                {tenantUsers.map((u) => {
                  const isSel = selectedUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setUserEmail(u.email);
                        setNewPassword('');
                      }}
                      className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                        isSel
                          ? 'bg-brand-500 text-white font-bold shadow-sm'
                          : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <UserCheck className={`w-4 h-4 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                        <div>
                          <p className="font-bold">{u.full_name}</p>
                          <p className={`text-[10px] ${isSel ? 'text-brand-100' : 'text-slate-500 dark:text-slate-400'}`}>
                            {u.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          isSel ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {u.role}
                        </span>
                        <span className={`text-[10px] font-semibold ${u.is_active ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Credential Edit Form */}
            {selectedUser && (
              <form onSubmit={handleUpdateCredentials} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-2 flex justify-between items-center">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Update Credentials: <span className="text-brand-600 dark:text-brand-400">{selectedUser.full_name}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {selectedUser.id.substring(0, 8)}...</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email / Login Username
                  </label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Reset Password (leave empty to keep existing)
                    </label>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="flex items-center space-x-1 text-brand-600 dark:text-brand-400 hover:underline font-bold text-[11px]"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Strong Password</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters..."
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Changing password will automatically invalidate all existing JWT tokens and active sessions for this user.
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCredModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={credUpdating}
                    className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50"
                  >
                    {credUpdating ? 'Saving...' : 'Save Credentials'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Register Restaurant */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Register Restaurant (Tenant)" maxWidth="xl">
        <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Restaurant Name</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Royal Spice Cafe"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Business Type</label>
              <select
                value={createForm.businessType}
                onChange={(e) => setCreateForm({ ...createForm, businessType: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="CAFE">Café / Coffee Shop</option>
                <option value="FAST_FOOD">Fast Food / Burger Joint</option>
                <option value="FINE_DINE">Fine Dine Restaurant</option>
                <option value="TAKEAWAY">Takeaway / Delivery Outlet</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Owner Name</label>
              <input
                type="text"
                required
                value={createForm.ownerName}
                onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                placeholder="e.g. Tariq Khan"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admin Email (Login)</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="admin@restaurant.com"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Password</label>
              <input
                type="text"
                required
                value={createForm.initialAdminPassword}
                onChange={(e) => setCreateForm({ ...createForm, initialAdminPassword: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="+92 300 1234567"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subscription Plan</label>
              <select
                value={createForm.planId}
                onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.currency} {Number(p.monthly_price).toLocaleString()}/mo)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Trial Days</label>
              <input
                type="number"
                min="0"
                value={createForm.trialDays}
                onChange={(e) => setCreateForm({ ...createForm, trialDays: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
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
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
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
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Select New Plan</label>
            <select
              value={planForm.planId}
              onChange={(e) => setPlanForm({ ...planForm, planId: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency} {Number(p.monthly_price).toLocaleString()}/mo)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Extend Period (Days)</label>
            <input
              type="number"
              min="1"
              value={planForm.extendDays}
              onChange={(e) => setPlanForm({ ...planForm, extendDays: parseInt(e.target.value) || 30 })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsPlanModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-bold shadow-md">
              Update Plan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Details */}
      {selectedTenant?.tenant && (
        <Modal isOpen={!!selectedTenant} onClose={() => setSelectedTenant(null)} title={`${selectedTenant.tenant.name} - Overview`} maxWidth="2xl">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Owner Name</p>
                <p className="font-bold text-slate-800 dark:text-white">{selectedTenant.tenant.owner_name}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Contact Email</p>
                <p className="font-bold text-slate-800 dark:text-white">{selectedTenant.tenant.email}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Currency & Timezone</p>
                <p className="font-bold text-slate-800 dark:text-white">{selectedTenant.tenant.currency} ({selectedTenant.tenant.time_zone})</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Tax Settings</p>
                <p className="font-bold text-slate-800 dark:text-white">{selectedTenant.tenant.tax_rate_percent}% (Tax Inclusive: {selectedTenant.tenant.is_tax_inclusive ? 'Yes' : 'No'})</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 dark:text-white mb-2">Branches ({selectedTenant.branches?.length || 0})</h4>
              <div className="space-y-1">
                {selectedTenant.branches?.map((b: any) => (
                  <div key={b.id} className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg flex justify-between bg-white dark:bg-slate-800">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{b.name} ({b.code})</span>
                    <span className="text-slate-500 dark:text-slate-400">{b.city}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 dark:text-white mb-2">Registered Users ({selectedTenant.users?.length || 0})</h4>
              <div className="space-y-1">
                {selectedTenant.users?.map((u: any) => (
                  <div key={u.id} className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg flex justify-between bg-white dark:bg-slate-800">
                    <span className="text-slate-800 dark:text-slate-200">{u.full_name} ({u.email})</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{u.role}</span>
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
