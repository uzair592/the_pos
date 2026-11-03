import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  DollarSign,
  Utensils,
  Boxes,
  Clock,
  BarChart3,
  Users,
  Store,
  Settings,
  Monitor,
  ChefHat,
} from 'lucide-react';
import { FeatureKey, Permission } from '@pos/shared';

export const Sidebar: React.FC = () => {
  const { isSuperAdmin, hasFeature, hasPermission, tenant } = useAuth();

  const superAdminLinks = [
    { to: '/platform-admin', label: 'Platform Dashboard', icon: LayoutDashboard },
    { to: '/platform-admin/tenants', label: 'Restaurants', icon: Building2 },
    { to: '/platform-admin/plans', label: 'Subscription Plans', icon: CreditCard },
    { to: '/platform-admin/payments', label: 'Subscription Payments', icon: DollarSign },
  ];

  const restaurantLinks = [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/pos', label: 'POS Terminal', icon: Monitor },
    { to: '/kds', label: 'Kitchen Display', icon: ChefHat, feature: FeatureKey.KDS },
    { to: '/app/menu', label: 'Menu & Products', icon: Utensils, permission: Permission.MENU_VIEW },
    { to: '/app/inventory', label: 'Inventory & Recipes', icon: Boxes, feature: FeatureKey.INVENTORY, permission: Permission.INVENTORY_VIEW },
    { to: '/app/shifts', label: 'Shifts & Registers', icon: Clock, permission: Permission.SHIFTS_VIEW },
    { to: '/app/reports', label: 'Reports & Analytics', icon: BarChart3, permission: Permission.REPORTS_SALES },
    { to: '/app/staff', label: 'Staff & Roles', icon: Users, permission: Permission.STAFF_MANAGE },
    { to: '/app/branches', label: 'Branches', icon: Store, permission: Permission.BRANCHES_MANAGE },
    { to: '/app/settings', label: 'Restaurant Settings', icon: Settings, permission: Permission.SETTINGS_MANAGE },
  ];

  const links = isSuperAdmin
    ? superAdminLinks
    : restaurantLinks.filter((item: any) => {
        if (item.feature && !hasFeature(item.feature)) return false;
        if (item.permission && !hasPermission(item.permission)) return false;
        return true;
      });

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex shrink-0">
      <div className="space-y-1.5">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {isSuperAdmin ? 'Platform Management' : 'Operations & Management'}
        </div>

        {links.map((link: any) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-600 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      {!isSuperAdmin && tenant && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs">
          <p className="font-bold text-slate-800">{tenant.name}</p>
          <p className="text-slate-500 text-[11px]">{tenant.currency} • {tenant.businessType}</p>
        </div>
      )}
    </aside>
  );
};
