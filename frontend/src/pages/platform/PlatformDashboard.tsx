import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  TrendingUp,
  RefreshCw,
  HardDrive,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart,
  HelpCircle,
  FileText,
  Radio,
  Layers,
} from 'lucide-react';

export const PlatformDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setIsRefreshing(true);
      const data = await api.get('/platform/dashboard');
      setStats(data);
    } catch (err) {
      console.error('Failed to load platform stats:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500">Loading SaaS platform intelligence...</p>
      </div>
    );
  }

  const revenueTrends = stats?.revenueTrends || [];
  const maxRevenue = Math.max(...revenueTrends.map((r: any) => Number(r.revenue) || 0), 1);

  const registrationTrends = stats?.registrationTrends || [];
  const maxRegCount = Math.max(...registrationTrends.map((r: any) => Number(r.count) || 0), 1);

  const planDistribution = stats?.planDistribution || [];
  const totalSubscribers = planDistribution.reduce((sum: number, p: any) => sum + Number(p.tenant_count || 0), 0) || 1;

  return (
    <div className="p-6 sm:p-8 space-y-8 animate-in fade-in">
      {/* Page Title & Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Platform Super Admin
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/10 text-brand-600 border border-brand-500/20">
              Multi-Tenant SaaS
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized command center for restaurants, subscriptions, revenue, concurrent sessions, and system health
          </p>
        </div>
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={fetchStats}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-all"
            title="Refresh statistics from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-500' : 'text-slate-400'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-brand-500" />
            <span>{new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          </div>
        </div>
      </div>

      {/* Row 1: Core Revenue & Subscription Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Monthly Recurring Revenue"
          value={`PKR ${Number(stats?.mrr || 0).toLocaleString()}`}
          subtitle={`ARR: PKR ${Number(stats?.arr || 0).toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Total Registered Restaurants"
          value={stats?.totalRestaurants ?? 0}
          subtitle={`${stats?.newRegistrationsMonth ?? 0} new this month`}
          icon={Building2}
          color="orange"
        />
        <StatCard
          title="Active Subscriptions"
          value={stats?.activeRestaurants ?? 0}
          subtitle={`${stats?.trialRestaurants ?? 0} currently in free trial`}
          icon={CreditCard}
          color="blue"
        />
        <StatCard
          title="Attention Required"
          value={(stats?.expiredRestaurants ?? 0) + (stats?.suspendedRestaurants ?? 0) + (stats?.pendingPayments ?? 0)}
          subtitle={`${stats?.renewalsDue ?? 0} renewals due this week`}
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Row 2: Secondary Operational Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Branches</span>
            <Store className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{stats?.totalBranches ?? 0}</div>
          <span className="text-[10px] text-slate-400 mt-1">Across all tenants</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Users</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{stats?.totalUsers ?? 0}</div>
          <span className="text-[10px] text-slate-400 mt-1">Staff & owners</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Live Devices</span>
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.currentlyConnectedDevices ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Connected in last 3m</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Terminals</span>
            <Smartphone className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{stats?.totalRegisteredDevices ?? 0}</div>
          <span className="text-[10px] text-slate-400 mt-1">Hardware registered</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Billing</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white truncate">
            PKR {Number(stats?.totalSubscriptionRevenue || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Collected to date</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Pending Pay</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">{stats?.pendingPayments ?? 0}</div>
          <span className="text-[10px] text-slate-400 mt-1">Require verification</span>
        </div>
      </div>

      {/* Row 3: Interactive Visual Charts (Revenue & Plan Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Trends Bar Visualizer */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-brand-500" />
                <span>Subscription Revenue Trends (Past 12 Months)</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time collection performance across SaaS subscription renewals and invoices
              </p>
            </div>
            <Link
              to="/platform-admin/payments"
              className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
            >
              <span>View Invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {revenueTrends.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs italic">
              No subscription payment history recorded yet
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-12 gap-2 h-44 items-end pb-2 border-b border-slate-100 dark:border-slate-800">
                {revenueTrends.map((rt: any, idx: number) => {
                  const rev = Number(rt.revenue) || 0;
                  const pct = Math.max(8, Math.round((rev / maxRevenue) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                      {/* Hover Tooltip */}
                      <div className="absolute -top-9 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                          PKR {rev.toLocaleString()}
                        </div>
                        <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-0.5"></div>
                      </div>
                      <div
                        style={{ height: `${pct}%` }}
                        className="w-full max-w-[28px] bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-sm"
                      ></div>
                      <span className="text-[9px] font-semibold text-slate-400 mt-2 truncate w-full text-center">
                        {rt.month?.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Peak Monthly Revenue: <strong>PKR {maxRevenue.toLocaleString()}</strong></span>
                <span>Annualized SaaS ARR: <strong>PKR {Number(stats?.arr || 0).toLocaleString()}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Subscription Plan Distribution */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-blue-500" />
              <span>Plan Distribution</span>
            </h3>
            <Link
              to="/platform-admin/plans"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {planDistribution.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                No active subscription plans configured
              </div>
            ) : (
              planDistribution.map((p: any, idx: number) => {
                const count = Number(p.tenant_count || 0);
                const share = Math.round((count / totalSubscribers) * 100);
                const colors = ['bg-brand-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                const barColor = colors[idx % colors.length];

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{p.plan_name}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        {count} restaurant{count === 1 ? '' : 's'} ({share}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(5, share)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Total Paying Subscribers:</span>
            <span className="font-bold text-slate-900 dark:text-white">{stats?.activeRestaurants ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Platform Activity Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Activity className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Recent Platform Security & Activity Audit
            </h3>
          </div>
          <Link
            to="/platform-admin/audit-logs"
            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
          >
            <span>Full Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Restaurant / Tenant</th>
                <th className="px-6 py-3.5">Action Event</th>
                <th className="px-6 py-3.5">Actor Role</th>
                <th className="px-6 py-3.5">Target Resource</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats?.recentActivities?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">
                    No recent platform activity logged
                  </td>
                </tr>
              ) : (
                stats?.recentActivities?.map((act: any) => {
                  const isSuccess = !act.action?.includes('FAIL') && !act.action?.includes('ERROR');
                  return (
                    <tr key={act.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(act.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                        {act.tenant_name || 'Global Platform'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded border border-brand-200/50 dark:border-brand-900/40">
                          {act.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                        {act.actor_role}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">
                        {act.resource_type}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {isSuccess ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Logged</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Incident</span>
                          </span>
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
  );
};
