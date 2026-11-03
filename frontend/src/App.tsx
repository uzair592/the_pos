import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { Navbar } from './components/common/Navbar.js';
import { Sidebar } from './components/common/Sidebar.js';

// Auth Pages
import { Login } from './pages/auth/Login.js';
import { PlatformLogin } from './pages/platform/PlatformLogin.js';

// Platform Super Admin Pages
import { PlatformDashboard } from './pages/platform/PlatformDashboard.js';
import { PlatformTenants } from './pages/platform/PlatformTenants.js';
import { PlatformPlans } from './pages/platform/PlatformPlans.js';
import { PlatformPayments } from './pages/platform/PlatformPayments.js';

// Restaurant Pages
import { OnboardingWizard } from './pages/restaurant/OnboardingWizard.js';
import { RestaurantDashboard } from './pages/restaurant/RestaurantDashboard.js';
import { OrdersHub } from './pages/orders/OrdersHub.js';
import { MenuCatalog } from './pages/restaurant/MenuCatalog.js';
import { InventoryManagement } from './pages/restaurant/InventoryManagement.js';
import { ShiftManagement } from './pages/restaurant/ShiftManagement.js';
import { FinancialReports } from './pages/restaurant/FinancialReports.js';
import { StaffManagement } from './pages/restaurant/StaffManagement.js';
import { BranchManagement } from './pages/restaurant/BranchManagement.js';
import { RestaurantSettings } from './pages/restaurant/RestaurantSettings.js';

// Operational Fullscreen Views
import { PosTerminal } from './pages/pos/PosTerminal.js';
import { KitchenDisplay } from './pages/kds/KitchenDisplay.js';

// Super Admin Protected Layout
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
              {/* Public Authentication */}
              <Route path="/login" element={<Login />} />
              <Route path="/platform-admin/login" element={<PlatformLogin />} />

              {/* Super Admin Protected Area */}
              <Route path="/platform-admin" element={<SuperAdminLayout />}>
                <Route index element={<PlatformDashboard />} />
                <Route path="tenants" element={<PlatformTenants />} />
                <Route path="plans" element={<PlatformPlans />} />
                <Route path="payments" element={<PlatformPayments />} />
              </Route>

              {/* Restaurant Onboarding */}
              <Route path="/app/onboarding" element={<OnboardingWizard />} />

              {/* Restaurant Management Area */}
              <Route path="/app" element={<RestaurantLayout />}>
                <Route index element={<RestaurantDashboard />} />
                <Route path="orders" element={<OrdersHub />} />
                <Route path="menu" element={<MenuCatalog />} />
                <Route path="inventory" element={<InventoryManagement />} />
                <Route path="shifts" element={<ShiftManagement />} />
                <Route path="reports" element={<FinancialReports />} />
                <Route path="staff" element={<StaffManagement />} />
                <Route path="branches" element={<BranchManagement />} />
                <Route path="settings" element={<RestaurantSettings />} />
              </Route>

              {/* Operational Fullscreen Screens */}
              <Route path="/pos" element={<PosTerminal />} />
              <Route path="/kds" element={<KitchenDisplay />} />

              {/* Default Route Redirect */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
