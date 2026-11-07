import React, { useEffect, useState, useRef } from 'react';
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
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  AlertTriangle,
  Trash2,
  Edit3,
  Shield,
  Monitor,
  Layers,
  Check,
  ChevronDown,
  ExternalLink,
  X,
  Smartphone,
  Globe,
  Sliders,
  DollarSign,
  Users,
  MapPin,
} from 'lucide-react';

export const PlatformTenants: React.FC = () => {
  const { success, error, info } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  // Three-dot Action Menu Dropdown state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isCredModalOpen, setIsCredModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  // Selected item contexts
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [detailedTenantData, setDetailedTenantData] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'OVERVIEW' | 'BRANCHES' | 'STAFF' | 'BILLING' | 'DEVICES' | 'BACKUPS'>('OVERVIEW');

  // Edit Tenant Form State
  const [editForm, setEditForm] = useState({
    name: '',
    legalName: '',
    ownerName: '',
    email: '',
    phone: '',
    city: '',
    country: 'Pakistan',
    currency: 'PKR',
    timeZone: 'Asia/Karachi',
    businessType: 'FINE_DINE',
    maxConcurrentDevices: 4,
  });

  // Credential Management Modal State
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credUpdating, setCredUpdating] = useState(false);

  // Create Form State
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

  // Change Plan Form State
  const [planForm, setPlanForm] = useState({
    planId: '',
    extendDays: 30,
  });

  // Suspension & Archiving Reason State
  const [suspensionReason, setSuspensionReason] = useState('Suspended by platform administrator');
  const [archiveReason, setArchiveReason] = useState('Customer account archived');
  const [archivePermanent, setArchivePermanent] = useState(false);

  // Restore Modal State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePackage, setRestorePackage] = useState<any | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'FULL' | 'SELECTIVE' | 'MERGE'>('FULL');
  const [selectedRestoreModules, setSelectedRestoreModules] = useState<string[]>(['menu', 'inventory', 'customers', 'sales']);

  // Close three-dot menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTenants = async () => {
    try {
      let url = '/platform/tenants?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      if (planFilter) url += `planId=${encodeURIComponent(planFilter)}&`;
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
  }, [search, statusFilter, planFilter]);

  // Direct authorized file download helper
  const handleDownloadBackup = async (tenantId: string, format: 'json' | 'excel', tenantName: string) => {
    try {
      info(`Generating ${format.toUpperCase()} backup for "${tenantName}"...`);
      const token = localStorage.getItem('pos_token') || sessionStorage.getItem('pos_token');
      const url = `/api/platform/tenants/${tenantId}/backup/${format}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Backup generation failed' }));
        throw new Error(errJson.error || 'Failed to download backup');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      let filename = `${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_backup.${format === 'json' ? 'json' : 'xlsx'}`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      success(`${format.toUpperCase()} backup downloaded successfully!`);
    } catch (err: any) {
      error(err.message || `Failed to download ${format} backup`);
    }
  };

  // View Detailed Drawer / Modal
  const openDetailsModal = async (tenant: any) => {
    setSelectedTenant(tenant);
    setIsDetailsOpen(true);
    setDetailsLoading(true);
    setActiveDetailsTab('OVERVIEW');
    try {
      const data = await api.get(`/platform/tenants/${tenant.id}`);
      setDetailedTenantData(data);
    } catch (err: any) {
      error(err.message || 'Failed to load restaurant details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (tenant: any) => {
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name || '',
      legalName: tenant.legal_name || '',
      ownerName: tenant.owner_name || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      city: tenant.city || '',
      country: tenant.country || 'Pakistan',
      currency: tenant.currency || 'PKR',
      timeZone: tenant.time_zone || 'Asia/Karachi',
      businessType: tenant.business_type || 'FINE_DINE',
      maxConcurrentDevices: tenant.max_concurrent_devices || 4,
    });
    setIsEditOpen(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    try {
      await api.put(`/platform/tenants/${selectedTenant.id}`, editForm);
      success(`Restaurant "${editForm.name}" updated successfully`);
      setIsEditOpen(false);
      fetchTenants();
      if (isDetailsOpen) {
        openDetailsModal(selectedTenant);
      }
    } catch (err: any) {
      error(err.message || 'Failed to update restaurant');
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const recommendedPlan = plans.find((p) => p.code === 'GROWTH') || plans[0];
      const payload = {
        ...createForm,
        planId: createForm.planId || recommendedPlan?.id || undefined,
      };
      await api.post('/platform/tenants', payload);
      success(`Restaurant "${createForm.name}" created and initialized with 14-day access`);
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

  const handleToggleStatus = async () => {
    if (!selectedTenant) return;
    try {
      await api.put(`/platform/tenants/${selectedTenant.id}/status`, {
        isActive: !selectedTenant.is_active,
        reason: !selectedTenant.is_active ? undefined : suspensionReason,
      });
      success(`Restaurant "${selectedTenant.name}" status updated`);
      setIsSuspendModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      error(err.message || 'Failed to update restaurant status');
    }
  };

  const handleArchiveTenant = async () => {
    if (!selectedTenant) return;
    try {
      await api.delete(`/platform/tenants/${selectedTenant.id}`, {
        reason: archiveReason,
        permanent: archivePermanent,
      });
      success(`Restaurant "${selectedTenant.name}" ${archivePermanent ? 'permanently deleted' : 'archived'}`);
      setIsArchiveModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      error(err.message || 'Failed to archive restaurant');
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
      success(`Subscription plan updated for "${selectedTenant.name}"`);
      setIsPlanModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      error(err.message || 'Failed to change plan');
    }
  };

  // Credential Management Modal Handler
  const openCredentialsModal = async (tenant: any) => {
    setSelectedTenant(tenant);
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
    if (!selectedTenant || !selectedUser) return;
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
      await api.patch(`/platform/tenants/${selectedTenant.id}/users/${selectedUser.id}/credentials`, payload);
      success(`Credentials updated for ${selectedUser.full_name}. Active sessions invalidated.`);
      setNewPassword('');
      const data = await api.get(`/platform/tenants/${selectedTenant.id}/users`);
      setTenantUsers(data.users || []);
      const updated = (data.users || []).find((u: any) => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      error(err.message || 'Failed to update credentials');
    } finally {
      setCredUpdating(false);
    }
  };

  // Restore Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setRestorePackage(json);
        setValidating(true);
        const res = await api.post('/platform/backups/validate', {
          backupPackage: json,
          targetTenantId: selectedTenant.id,
        });
        setValidationResult(res);
        if (res.valid) {
          success('Backup structure validated! Safe to restore.');
        } else {
          error(`Validation warnings: ${res.errors?.join(', ') || 'Invalid format'}`);
        }
      } catch (err: any) {
        error('Invalid JSON file format: ' + err.message);
      } finally {
        setValidating(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!selectedTenant || !restorePackage) return;
    setRestoring(true);
    try {
      const res = await api.post(`/platform/tenants/${selectedTenant.id}/restore`, {
        backupPackage: restorePackage,
        mode: restoreMode,
        selectedModules: selectedRestoreModules,
      });
      success(`Restoration completed successfully! ${res.recordsRestored || 0} records restored.`);
      setIsRestoreModalOpen(false);
      setRestorePackage(null);
      setRestoreFile(null);
      setValidationResult(null);
      fetchTenants();
      if (isDetailsOpen) {
        openDetailsModal(selectedTenant);
      }
    } catch (err: any) {
      error(err.message || 'Restoration failed');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Restaurant Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Centralized multi-tenant control, subscriptions, credentials, multi-device sessions & data recovery
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchTenants();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              if (plans.length > 0 && !createForm.planId) {
                setCreateForm((prev) => ({ ...prev, planId: plans[0].id }));
              }
              setIsCreateOpen(true);
            }}
            className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register Restaurant</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by restaurant name, owner, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Subscription Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Subscription Plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
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
                <th className="px-6 py-3.5">Plan & Billing</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Connected Devices</th>
                <th className="px-6 py-3.5">Branches / Staff</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading restaurants & multi-tenant status...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No restaurants match your search criteria.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const maxAllowed = t.max_concurrent_devices || 4;
                  const connected = Number(t.connected_device_count) || 0;
                  const isMenuOpen = activeMenuId === t.id;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5">
                          <span>{t.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{t.city || 'Headquarters'}, {t.country || 'Pakistan'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{t.owner_name}</div>
                        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{t.email}</div>
                        {t.phone && <div className="text-slate-400 dark:text-slate-500 text-[10px]">{t.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{t.plan_name || 'Standard Plan'}</div>
                        {t.current_period_end ? (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Renews: {new Date(t.current_period_end).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">No expiration</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            !t.is_active
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : t.subscription_status === 'ACTIVE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : t.subscription_status === 'TRIAL'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {t.is_active ? t.subscription_status || 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              connected > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {connected} / {maxAllowed}
                          </span>
                          <span className="text-[10px] text-slate-400">Connected</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {t.registered_device_count || 0} registered hardware
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {t.branch_count || 1} branch(es)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.user_count || 1} staff accounts
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right relative">
                        {/* Three-Dot Action Trigger */}
                        <div className="inline-block text-left" ref={isMenuOpen ? menuRef : undefined}>
                          <button
                            onClick={() => setActiveMenuId(isMenuOpen ? null : t.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Actions menu"
                            aria-label="Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Contextual Action Dropdown Menu */}
                          {isMenuOpen && (
                            <div className="origin-top-right absolute right-6 mt-1 w-56 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100 text-left">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    openDetailsModal(t);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-brand-500" />
                                  <span>View Details & Hub</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    openEditModal(t);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Edit Restaurant Details</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    openCredentialsModal(t);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Manage Credentials & Staff</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSelectedTenant(t);
                                    setPlanForm({ planId: t.plan_id || plans[0]?.id || '', extendDays: 30 });
                                    setIsPlanModalOpen(true);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <Sliders className="w-3.5 h-3.5 text-purple-500" />
                                  <span>Change / Extend Plan</span>
                                </button>
                              </div>

                              {/* Backup & Recovery Actions */}
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDownloadBackup(t.id, 'json', t.name);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <FileJson className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Download JSON Backup</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDownloadBackup(t.id, 'excel', t.name);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-500" />
                                  <span>Download Excel (.xlsx)</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSelectedTenant(t);
                                    setRestoreFile(null);
                                    setRestorePackage(null);
                                    setValidationResult(null);
                                    setIsRestoreModalOpen(true);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Restore from Backup</span>
                                </button>
                              </div>

                              {/* Danger Zone Actions */}
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSelectedTenant(t);
                                    setIsSuspendModalOpen(true);
                                  }}
                                  className={`w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold ${
                                    t.is_active
                                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                  }`}
                                >
                                  {t.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                  <span>{t.is_active ? 'Suspend Restaurant' : 'Reactivate Restaurant'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSelectedTenant(t);
                                    setIsArchiveModalOpen(true);
                                  }}
                                  className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Archive / Delete</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Register Restaurant */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Register Restaurant (Tenant)" maxWidth="2xl">
        <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Restaurant Name *</label>
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
                <option value="BAKERY">Bakery & Pastry</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Owner Name *</label>
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admin Email (Login) *</label>
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Password *</label>
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
                value={createForm.planId || (plans.find((p) => p.code === 'GROWTH')?.id || plans[0]?.id || '')}
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Trial Period (Days)</label>
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

      {/* Modal 2: Edit Restaurant Details */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Edit Restaurant: ${selectedTenant?.name}`} maxWidth="2xl">
        <form onSubmit={handleUpdateTenant} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Restaurant Name *</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Legal Registered Name</label>
              <input
                type="text"
                value={editForm.legalName}
                onChange={(e) => setEditForm({ ...editForm, legalName: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Owner Name *</label>
              <input
                type="text"
                required
                value={editForm.ownerName}
                onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Email *</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">City / Region</label>
              <input
                type="text"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Currency Code</label>
              <input
                type="text"
                value={editForm.currency}
                onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Business Type</label>
              <select
                value={editForm.businessType}
                onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="CAFE">Café / Coffee Shop</option>
                <option value="FAST_FOOD">Fast Food / Burger Joint</option>
                <option value="FINE_DINE">Fine Dine Restaurant</option>
                <option value="TAKEAWAY">Takeaway / Delivery Outlet</option>
                <option value="BAKERY">Bakery & Pastry</option>
                <option value="FOOD_TRUCK">Food Truck</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Max Concurrent Device Sessions
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={editForm.maxConcurrentDevices}
                onChange={(e) => setEditForm({ ...editForm, maxConcurrentDevices: parseInt(e.target.value) || 4 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Enforces concurrent active terminals without permanently locking hardware.
              </p>
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
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: View Details & Hub */}
      {selectedTenant && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={`Restaurant Console: ${selectedTenant.name}`}
          maxWidth="4xl"
        >
          {detailsLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-brand-500" />
              Loading complete restaurant telemetry...
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Tabs Navigation */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto space-x-4">
                {[
                  { key: 'OVERVIEW', label: 'Overview & Profile', icon: Building2 },
                  { key: 'BRANCHES', label: `Branches (${detailedTenantData?.branches?.length || 0})`, icon: MapPin },
                  { key: 'STAFF', label: `Staff (${detailedTenantData?.users?.length || 0})`, icon: Users },
                  { key: 'BILLING', label: 'Subscriptions & Payments', icon: DollarSign },
                  { key: 'DEVICES', label: 'Devices & Sessions', icon: Monitor },
                  { key: 'BACKUPS', label: 'Backups & Recovery', icon: Download },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeDetailsTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveDetailsTab(tab.key as any)}
                      className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 font-bold text-xs whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Overview */}
              {activeDetailsTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Status</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {detailedTenantData?.tenant?.is_active ? 'Active' : 'Suspended'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Owner</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">{detailedTenantData?.tenant?.owner_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Email</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5 font-mono">{detailedTenantData?.tenant?.email}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Currency & TZ</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {detailedTenantData?.tenant?.currency} ({detailedTenantData?.tenant?.time_zone})
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">Instant Data Export</h4>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Download restaurant schema, sales, recipes, and items directly.
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownloadBackup(selectedTenant.id, 'json', selectedTenant.name)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg flex items-center space-x-1.5 shadow-sm"
                      >
                        <FileJson className="w-3.5 h-3.5" />
                        <span>Download JSON</span>
                      </button>
                      <button
                        onClick={() => handleDownloadBackup(selectedTenant.id, 'excel', selectedTenant.name)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg flex items-center space-x-1.5 shadow-sm"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download Excel (.xlsx)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Branches */}
              {activeDetailsTab === 'BRANCHES' && (
                <div className="space-y-2">
                  {detailedTenantData?.branches?.length === 0 ? (
                    <p className="text-slate-400 py-6 text-center">No branches registered.</p>
                  ) : (
                    detailedTenantData?.branches?.map((b: any) => (
                      <div
                        key={b.id}
                        className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between bg-white dark:bg-slate-800"
                      >
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                            <span>{b.name}</span>
                            {b.is_main_branch && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-brand-100 text-brand-700 font-bold">
                                Main
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">Code: {b.code} • City: {b.city || 'N/A'}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {b.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Staff */}
              {activeDetailsTab === 'STAFF' && (
                <div className="space-y-2">
                  {detailedTenantData?.users?.map((u: any) => (
                    <div
                      key={u.id}
                      className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between bg-white dark:bg-slate-800"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white">{u.full_name}</p>
                        <p className="text-slate-400 font-mono text-[11px]">{u.email}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono font-bold text-[10px] text-slate-600 dark:text-slate-300">
                          {u.role}
                        </span>
                        <span className={`text-[10px] font-bold ${u.is_active ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 4: Subscriptions & Billing */}
              {activeDetailsTab === 'BILLING' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 dark:text-white">Subscription History</h4>
                  <div className="space-y-2">
                    {detailedTenantData?.subscriptions?.map((sub: any) => (
                      <div
                        key={sub.id}
                        className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between bg-white dark:bg-slate-800"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{sub.plan_name}</p>
                          <p className="text-slate-400 text-[11px]">
                            Period: {new Date(sub.current_period_start).toLocaleDateString()} to{' '}
                            {new Date(sub.current_period_end).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          {sub.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <h4 className="font-bold text-slate-800 dark:text-white pt-2">Payment Invoices</h4>
                  <div className="space-y-2">
                    {detailedTenantData?.payments?.length === 0 ? (
                      <p className="text-slate-400 py-3 text-center">No recorded payment transactions.</p>
                    ) : (
                      detailedTenantData?.payments?.map((pay: any) => (
                        <div
                          key={pay.id}
                          className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between bg-white dark:bg-slate-800"
                        >
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white">
                              {pay.currency} {Number(pay.amount).toLocaleString()}
                            </p>
                            <p className="text-slate-400 text-[11px]">
                              Inv #{pay.invoice_number} • Ref: {pay.transaction_reference || 'N/A'} • {new Date(pay.payment_date).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            pay.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {pay.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Devices & Sessions */}
              {activeDetailsTab === 'DEVICES' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">Concurrent Device Capacity</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Limits simultaneous connected terminals without binding permanent hardware.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-brand-600 dark:text-brand-400">
                        {detailedTenantData?.concurrentDevices?.activeSessionsCount || 0} / {detailedTenantData?.concurrentDevices?.maxConcurrentDevices || 4}
                      </span>
                      <p className="text-[10px] text-slate-400">Live Connected</p>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-800 dark:text-white">Registered Terminals ({detailedTenantData?.devices?.length || 0})</h4>
                  <div className="space-y-2">
                    {detailedTenantData?.devices?.map((d: any) => (
                      <div
                        key={d.id}
                        className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between bg-white dark:bg-slate-800"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{d.device_name || 'POS Terminal'}</p>
                          <p className="text-slate-400 font-mono text-[10px]">
                            Fingerprint: {d.device_fingerprint} • IP: {d.ip_address || 'Local'}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Last seen: {d.last_active_at ? new Date(d.last_active_at).toLocaleString() : 'Never'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 6: Backups & Restorations */}
              {activeDetailsTab === 'BACKUPS' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-white">Restoration Audit Trail</h4>
                    <button
                      onClick={() => {
                        setIsDetailsOpen(false);
                        setSelectedTenant(selectedTenant);
                        setIsRestoreModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg flex items-center space-x-1.5 shadow-sm text-[11px]"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Restore</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {detailedTenantData?.restorations?.length === 0 ? (
                      <p className="text-slate-400 py-6 text-center">No previous restore operations performed.</p>
                    ) : (
                      detailedTenantData?.restorations?.map((r: any) => (
                        <div
                          key={r.id}
                          className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between bg-white dark:bg-slate-800"
                        >
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white">
                              Mode: {r.mode} ({r.records_restored || 0} records)
                            </p>
                            <p className="text-slate-400 text-[11px]">
                              File: {r.backup_file_name} • Restored on: {new Date(r.created_at).toLocaleString()}
                            </p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Modal 4: Credential Management */}
      <Modal
        isOpen={isCredModalOpen}
        onClose={() => setIsCredModalOpen(false)}
        title={`Credentials & Password Reset: ${selectedTenant?.name || ''}`}
        maxWidth="xl"
      >
        {credLoading ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
            Loading user accounts...
          </div>
        ) : (
          <div className="space-y-4 text-xs">
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
                    Updating password invalidates stale JWT tokens and logs this user out across active devices.
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

      {/* Modal 5: Change Subscription Plan */}
      <Modal isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} title={`Change Plan: ${selectedTenant?.name || ''}`} maxWidth="md">
        <form onSubmit={handleChangePlan} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Select New Tier Plan</label>
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
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Extend Access Period (Days)</label>
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

      {/* Modal 6: Restore Backup from JSON */}
      <Modal isOpen={isRestoreModalOpen} onClose={() => setIsRestoreModalOpen(false)} title={`Restore Restaurant Backup: ${selectedTenant?.name || ''}`} maxWidth="2xl">
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 flex items-start space-x-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">Automated Pre-Restore Safety Backup</p>
              <p className="text-[11px] mt-0.5">
                Before applying restore changes, the system automatically creates a timestamped safety backup in the database so changes can be reverted if needed.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Backup Archive (.json)
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500 file:text-white hover:file:bg-brand-600"
            />
          </div>

          {validating && (
            <div className="py-4 text-center text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-brand-500" />
              Validating backup integrity and record schema...
            </div>
          )}

          {validationResult && (
            <div className={`p-4 rounded-xl border ${
              validationResult.valid ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
                {validationResult.valid ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                <span>{validationResult.valid ? 'Valid Backup Package' : 'Validation Errors Detected'}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Original Restaurant: {validationResult.metadata?.tenantName || 'Unknown'} • Exported: {new Date(validationResult.metadata?.exportedAt).toLocaleString()}
              </p>
              {validationResult.summary && (
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                  <div>Branches: <strong>{validationResult.summary.branches || 0}</strong></div>
                  <div>Categories: <strong>{validationResult.summary.categories || 0}</strong></div>
                  <div>Products: <strong>{validationResult.summary.products || 0}</strong></div>
                  <div>Ingredients: <strong>{validationResult.summary.ingredients || 0}</strong></div>
                  <div>Orders: <strong>{validationResult.summary.orders || 0}</strong></div>
                  <div>Suppliers: <strong>{validationResult.summary.suppliers || 0}</strong></div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Restoration Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'FULL', title: 'Full Replace', desc: 'Cleans current tenant data and restores exact snapshot' },
                { id: 'MERGE', title: 'Safe Merge', desc: 'Upserts records preserving new items created since' },
                { id: 'SELECTIVE', title: 'Selective', desc: 'Restores only selected operational modules' },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setRestoreMode(m.id as any)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    restoreMode === m.id
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="font-bold text-slate-800 dark:text-white">{m.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{m.desc}</p>
                </div>
              ))}
            </div>
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
              disabled={!validationResult?.valid || restoring}
              onClick={handleExecuteRestore}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50"
            >
              {restoring ? 'Restoring Database...' : 'Confirm & Execute Restore'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 7: Suspend / Reactivate Confirmation */}
      <Modal isOpen={isSuspendModalOpen} onClose={() => setIsSuspendModalOpen(false)} title={`${selectedTenant?.is_active ? 'Suspend' : 'Reactivate'} Restaurant`} maxWidth="md">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            {selectedTenant?.is_active
              ? `Are you sure you want to suspend "${selectedTenant?.name}"? Restaurant staff will be blocked from logging into POS and KDS stations immediately.`
              : `Are you sure you want to reactivate "${selectedTenant?.name}"? Active subscription status will be restored.`}
          </p>
          {selectedTenant?.is_active && (
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Suspension
              </label>
              <textarea
                rows={3}
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          )}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSuspendModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`px-4 py-2 font-bold text-white rounded-lg shadow-md ${
                selectedTenant?.is_active ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {selectedTenant?.is_active ? 'Confirm Suspension' : 'Confirm Reactivation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 8: Archive / Delete Restaurant */}
      <Modal isOpen={isArchiveModalOpen} onClose={() => setIsArchiveModalOpen(false)} title={`Archive Restaurant: ${selectedTenant?.name || ''}`} maxWidth="md">
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 flex items-start space-x-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Destructive Action</p>
              <p className="text-[11px] mt-0.5">
                Archiving deactivates the tenant, marks their records as deleted, and immediately prevents any further access.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Deletion / Archive Reason</label>
            <input
              type="text"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <label className="flex items-center space-x-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={archivePermanent}
              onChange={(e) => setArchivePermanent(e.target.checked)}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              Permanent purge (Cascade delete all tables from database)
            </span>
          </label>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveTenant}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md"
            >
              Confirm Deletion
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
