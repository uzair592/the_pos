import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import {
  MapPin,
  Search,
  Building2,
  RefreshCw,
  Users,
  Monitor,
  CheckCircle2,
  XCircle,
  Phone,
} from 'lucide-react';

export const PlatformBranches: React.FC = () => {
  const { success, error } = useToast();
  const [branches, setBranches] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');

  const fetchBranches = async () => {
    try {
      let url = '/platform/branches?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (tenantFilter) url += `tenantId=${encodeURIComponent(tenantFilter)}&`;
      const data = await api.get(url);
      setBranches(data.branches || []);
    } catch (err: any) {
      console.error('Failed to load branches:', err);
      error(err.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await api.get('/platform/tenants');
      setTenants(data.tenants || []);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchTenants();
  }, [search, tenantFilter]);

  const handleToggleStatus = async (branchId: string, currentActive: boolean) => {
    try {
      await api.put(`/platform/branches/${branchId}/status`, {
        isActive: !currentActive,
      });
      success(`Branch ${!currentActive ? 'activated' : 'deactivated'} successfully`);
      fetchBranches();
    } catch (err: any) {
      error(err.message || 'Failed to update branch status');
    }
  };

  const totalBranches = branches.length;
  const activeBranches = branches.filter((b) => b.is_active).length;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Restaurant Branches
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Centralized view of all operating outlets, locations, and terminal assignments across all restaurants
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchBranches();
          }}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Registered Branches</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalBranches}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Outlets</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeBranches}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Suspended Outlets</p>
          <p className="text-2xl font-black text-slate-400 dark:text-slate-500 mt-1">{totalBranches - activeBranches}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by branch name, city or restaurant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Restaurants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Branches Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Branch Name & Code</th>
                <th className="px-6 py-3.5">Parent Restaurant</th>
                <th className="px-6 py-3.5">Location & Contact</th>
                <th className="px-6 py-3.5">Assigned Staff</th>
                <th className="px-6 py-3.5">Terminals</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading branches across restaurants...
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No branches found matching your search.
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5">
                        <span>{b.name}</span>
                        {b.is_main_branch && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-bold border border-brand-200 dark:border-brand-800">
                            Main Branch
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        Code: {b.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.tenant_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{b.tenant_city || 'Pakistan'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <div>{b.address || 'Address on file'}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        {b.phone && (
                          <>
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{b.phone}</span>
                          </>
                        )}
                        <span>{b.city ? `• ${b.city}` : ''}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.user_count || 0} Staff</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-300">
                        <Monitor className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.device_count || 0} Terminals</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {b.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(b.id, b.is_active)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${
                          b.is_active
                            ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                        }`}
                      >
                        {b.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
