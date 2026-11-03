import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { StatCard } from '../../components/common/StatCard.js';
import {
  Building2,
  CreditCard,
  AlertTriangle,
  DollarSign,
  Store,
  Users,
  Smartphone,
  Activity,
  Calendar,
} from 'lucide-react';

export const PlatformDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await api.get('/platform/dashboard');
      setStats(data);
    } catch (err) {
      console.error('Failed to load platform stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Platform Super Admin</h1>
          <p className="text-xs text-slate-500 mt-1">
            Global SaaS oversight, multi-tenant subscription health, and revenue metrics
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Restaurants"
          value={stats?.totalRestaurants ?? 0}
          subtitle="Independent SaaS tenants"
          icon={Building2}
          color="orange"
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value={`PKR ${Number(stats?.mrr || 0).toLocaleString()}`}
          subtitle="From active subscriptions"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Active Subscriptions"
          value={stats?.activeSubscriptions ?? 0}
          subtitle={`${stats?.trialRestaurants ?? 0} currently on trial`}
          icon={CreditCard}
          color="blue"
        />
        <StatCard
          title="Expired / Suspended"
          value={(stats?.expiredSubscriptions ?? 0) + (stats?.suspendedRestaurants ?? 0)}
          subtitle="Requires billing follow-up"
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Branches</p>
            <p className="text-xl font-bold text-slate-900">{stats?.totalBranches ?? 0}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Registered Users</p>
            <p className="text-xl font-bold text-slate-900">{stats?.totalUsers ?? 0}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Active Terminals</p>
            <p className="text-xl font-bold text-slate-900">{stats?.activeDevices ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Recent Platform Audit Log</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Restaurant</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.recentActivity?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                    No recent activity recorded
                  </td>
                </tr>
              ) : (
                stats?.recentActivity?.map((act: any) => (
                  <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(act.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      {act.tenant_name || 'System / Platform'}
                    </td>
                    <td className="px-6 py-3 font-mono text-[11px] text-brand-600">
                      {act.action}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{act.actor_role}</td>
                    <td className="px-6 py-3 text-slate-500">{act.resource_type}</td>
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
