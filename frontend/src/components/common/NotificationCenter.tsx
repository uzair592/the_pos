import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Bell,
  ShoppingBag,
  ChefHat,
  AlertTriangle,
  Calendar,
  Users,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface NotificationCenterProps {
  badges: {
    activeOrders: number;
    pendingKitchen: number;
    lowStock: number;
    pendingReservations: number;
    waitlistCount: number;
  };
  onRefresh?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ badges, onRefresh }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalAlerts = isDismissed
    ? 0
    : badges.activeOrders +
      badges.pendingKitchen +
      badges.lowStock +
      badges.pendingReservations +
      badges.waitlistCount;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAction = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleMarkAllRead = () => {
    setIsDismissed(true);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setIsDismissed(false);
        }}
        className={`relative p-2 rounded-xl transition-all ${
          isOpen
            ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="Notifications & System Alerts"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {totalAlerts > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-50 duration-200">
            {totalAlerts > 99 ? '99+' : totalAlerts}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-brand-500" />
              <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Notifications
              </h3>
              {totalAlerts > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {totalAlerts}
                </span>
              )}
            </div>
            {totalAlerts > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center space-x-1 text-[11px] font-bold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                title="Dismiss all active badges"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark Read</span>
              </button>
            )}
          </div>

          {/* Alerts List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {totalAlerts === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <CheckCheck className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="font-bold text-slate-700 dark:text-slate-300">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No critical orders, kitchen tickets, or stock alerts.</p>
              </div>
            ) : (
              <>
                {/* Active Orders */}
                {badges.activeOrders > 0 && (
                  <div
                    onClick={() => handleAction('/app/orders?tab=active')}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {badges.activeOrders} Active / Queued Orders
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Orders in progress awaiting completion or settlement.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}

                {/* Pending Kitchen Tickets */}
                {badges.pendingKitchen > 0 && (
                  <div
                    onClick={() => handleAction('/kds')}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
                        <ChefHat className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {badges.pendingKitchen} Pending Kitchen Tickets
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Kitchen station orders preparing or waiting on line.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}

                {/* Low Stock Ingredients */}
                {badges.lowStock > 0 && (
                  <div
                    onClick={() => handleAction('/app/inventory?tab=low_stock')}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {badges.lowStock} Low Stock Alert(s)
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Ingredients fell below minimum reorder threshold.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}

                {/* Pending Reservations */}
                {badges.pendingReservations > 0 && (
                  <div
                    onClick={() => handleAction('/app/orders?tab=reservations')}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {badges.pendingReservations} Dining Table Reservations
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Customers booked for table seating today.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}

                {/* Waitlist Queue */}
                {badges.waitlistCount > 0 && (
                  <div
                    onClick={() => handleAction('/app/orders?tab=waitlist')}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {badges.waitlistCount} Waiting List Guests
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Guests waiting in lobby for open table allocation.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Status Bar */}
          <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500 font-semibold">Live System Sync Active</span>
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                title="Refresh alerts"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

