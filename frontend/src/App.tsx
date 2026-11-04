import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { Navbar } from './components/common/Navbar.js';
import { Sidebar } from './components/common/Sidebar.js';

// Auth Pages
import { Login } from './pages/auth/Login.js';
import { PlatformLogin } from './pages/platform/PlatformLogin.js';
import { WorkspaceHub } from './pages/hub/WorkspaceHub.js';

// Platform Super Admin Pages
import { PlatformDashboard } from './pages/platform/PlatformDashboard.js';
import { PlatformTenants } from './pages/platform/PlatformTenants.js';
import { PlatformPlans } from './pages/platform/PlatformPlans.js';
import { PlatformPayments } from './pages/platform/PlatformPayments.js';

// Restaurant Pages
import { OnboardingWizard } from './pages/restaurant/OnboardingWizard.js';
import { RestaurantDashboard } from './pages/restaurant/RestaurantDashboard.js';
import { Daybook } from './pages/restaurant/Daybook.js';
import { OrdersHub } from './pages/orders/OrdersHub.js';
import { MenuCatalog } from './pages/restaurant/MenuCatalog.js';
import { InventoryManagement } from './pages/restaurant/InventoryManagement.js';
import { PurchaseManagement } from './pages/restaurant/PurchaseManagement.js';
import { ShiftManagement } from './pages/restaurant/ShiftManagement.js';
import { FinancialReports } from './pages/restaurant/FinancialReports.js';
import { StaffManagement } from './pages/restaurant/StaffManagement.js';
import { BranchManagement } from './pages/restaurant/BranchManagement.js';
import { RestaurantSettings } from './pages/restaurant/RestaurantSettings.js';

// Operational Fullscreen Views
import { PosTerminal } from './pages/pos/PosTerminal.js';
import { KitchenDisplay } from './pages/kds/KitchenDisplay.js';

import { SystemRole, Permission } from '@pos/shared';
import { ShieldAlert, Lock } from 'lucide-react';

// ==================== ROUTE GUARDS ====================

/**
 * Public Authentication Route: redirects already-authenticated users to their active workspace
 */
const PublicAuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSuperAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070913] text-white text-xs font-semibold">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying security credentials...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return isSuperAdmin ? <Navigate to="/platform-admin" replace /> : <Navigate to="/hub" replace />;
  }

  return <>{children}</>;
};

/**
 * Protected Route: strictly requires authentication, with optional role & permission enforcement
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: Permission;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
}) => {
  const { user, isSuperAdmin, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070913] text-white text-xs font-semibold">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Validating station access...</span>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login immediately
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If super admin is accessing restaurant operational screen, redirect to platform console
  if (isSuperAdmin) {
    return <Navigate to="/platform-admin" replace />;
  }

  const roleStr = String(user.role).toUpperCase();

  // Role validation
  if (allowedRoles && allowedRoles.length > 0) {
    const isAllowed =
      allowedRoles.includes(roleStr) ||
      roleStr === 'RESTAURANT_OWNER' ||
      roleStr === 'OWNER' ||
      roleStr === 'BRANCH_MANAGER' ||
      roleStr === 'MANAGER';

    if (!isAllowed) {
      return (
        <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Station Access Restricted</h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md mt-2 mb-6">
            Your staff account ({user.role?.replace('_', ' ')}) is not assigned to this operational module.
          </p>
          <Link
            to="/hub"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/30"
          >
            Return to Workspace Hub
          </Link>
        </div>
      );
    }
  }

  // Permission validation
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Permission Required</h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-md mt-2 mb-6">
          Your role does not possess the [{requiredPermission}] permission required for this section.
        </p>
        <Link
          to="/hub"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/30"
        >
          Return to Workspace Hub
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

// Super Admin Layout Guard
const SuperAdminLayout: React.FC = () => {
  const { user, isSuperAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-xs">
        Loading platform administration...
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/platform-admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Restaurant Protected Layout
const RestaurantLayout: React.FC = () => {
  const { user, isSuperAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-xs text-slate-500">
        Loading restaurant workspace...
      </div>
    );
  }

  if (!user || isSuperAdmin) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication Screens (Auto-redirect if already logged in) */}
              <Route
                path="/login"
                element={
                  <PublicAuthRoute>
                    <Login />
                  </PublicAuthRoute>
                }
              />
              <Route
                path="/platform-admin/login"
                element={
                  <PublicAuthRoute>
                    <PlatformLogin />
                  </PublicAuthRoute>
                }
              />

              {/* Workspace Hub / Station Launcher (Strictly Protected) */}
              <Route
                path="/hub"
                element={
                  <ProtectedRoute>
                    <WorkspaceHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspace"
                element={
                  <ProtectedRoute>
                    <WorkspaceHub />
                  </ProtectedRoute>
                }
              />

              {/* Operational Fullscreen Screens (Strictly Protected with Station Role Checks) */}
              <Route
                path="/pos"
                element={
                  <ProtectedRoute allowedRoles={['RESTAURANT_OWNER', 'OWNER', 'BRANCH_MANAGER', 'MANAGER', 'CASHIER', 'WAITER']}>
                    <PosTerminal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kds"
                element={
                  <ProtectedRoute allowedRoles={['RESTAURANT_OWNER', 'OWNER', 'BRANCH_MANAGER', 'MANAGER', 'KITCHEN_STAFF']}>
                    <KitchenDisplay />
                  </ProtectedRoute>
                }
              />

              {/* Super Admin Protected Area */}
              <Route path="/platform-admin" element={<SuperAdminLayout />}>
                <Route index element={<PlatformDashboard />} />
                <Route path="tenants" element={<PlatformTenants />} />
                <Route path="plans" element={<PlatformPlans />} />
                <Route path="payments" element={<PlatformPayments />} />
              </Route>

              {/* Restaurant Onboarding */}
              <Route
                path="/app/onboarding"
                element={
                  <ProtectedRoute allowedRoles={['RESTAURANT_OWNER', 'OWNER']}>
                    <OnboardingWizard />
                  </ProtectedRoute>
                }
              />

              {/* Restaurant Management Area */}
              <Route path="/app" element={<RestaurantLayout />}>
                <Route index element={<RestaurantDashboard />} />
                <Route path="daybook" element={<Daybook />} />
                <Route path="orders" element={<OrdersHub />} />
                <Route path="menu" element={<MenuCatalog />} />
                <Route path="inventory" element={<InventoryManagement />} />
                <Route path="purchases" element={<PurchaseManagement />} />
                <Route path="shifts" element={<ShiftManagement />} />
                <Route path="reports" element={<FinancialReports />} />
                <Route path="staff" element={<StaffManagement />} />
                <Route path="branches" element={<BranchManagement />} />
                <Route path="settings" element={<RestaurantSettings />} />
              </Route>

              {/* Default Root Route: Redirects to /hub (which checks auth and sends to /login if needed) */}
              <Route path="/" element={<Navigate to="/hub" replace />} />
              <Route path="*" element={<Navigate to="/hub" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
