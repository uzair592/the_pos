import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { AuthUser, SystemRole, Permission, FeatureKey } from '@pos/shared';

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
  phone?: string;
  address?: string;
  city?: string;
  is_main_branch?: boolean;
  is_active?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  tenant: any | null;
  subscription: any | null;
  branches: BranchInfo[];
  currentBranchId: string | null;
  currentBranch: BranchInfo | null;
  switchBranch: (branchId: string | null) => void;
  token: string | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  login: (token: string, user: any) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasFeature: (feature: FeatureKey) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pos_token'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<any | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(() => {
    const saved = localStorage.getItem('pos_current_branch_id');
    return saved === 'ALL' ? null : saved;
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    if (!token) {
      setUser(null);
      setTenant(null);
      setSubscription(null);
      setBranches([]);
      setCurrentBranchId(null);
      setIsSuperAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setTenant(data.tenant || null);
      setSubscription(data.subscription || null);
      setIsSuperAdmin(data.isSuperAdmin || data.user?.role === SystemRole.SUPER_ADMIN);

      const bList: BranchInfo[] = data.branches || [];
      setBranches(bList);

      // Branch selection priority:
      // 1. Stored choice in localStorage
      // 2. User assigned branch
      // 3. First branch in tenant
      const stored = localStorage.getItem('pos_current_branch_id');
      if (stored === 'ALL') {
        setCurrentBranchId(null);
      } else if (stored && bList.some((b) => b.id === stored)) {
        setCurrentBranchId(stored);
      } else if (data.user?.branchId && bList.some((b) => b.id === data.user.branchId)) {
        setCurrentBranchId(data.user.branchId);
        localStorage.setItem('pos_current_branch_id', data.user.branchId);
      } else if (bList.length > 0) {
        setCurrentBranchId(bList[0].id);
        localStorage.setItem('pos_current_branch_id', bList[0].id);
      } else {
        setCurrentBranchId(null);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [token]);

  const switchBranch = (branchId: string | null) => {
    if (!branchId || branchId === 'ALL') {
      localStorage.setItem('pos_current_branch_id', 'ALL');
      setCurrentBranchId(null);
    } else {
      localStorage.setItem('pos_current_branch_id', branchId);
      setCurrentBranchId(branchId);
    }
  };

  const login = (newToken: string, newUser: any) => {
    localStorage.setItem('pos_token', newToken);
    if (newUser.branchId) {
      localStorage.setItem('pos_current_branch_id', newUser.branchId);
      setCurrentBranchId(newUser.branchId);
    }
    setToken(newToken);
    setUser(newUser);
    setIsSuperAdmin(newUser.role === SystemRole.SUPER_ADMIN);
  };

  const logout = () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_current_branch_id');
    setToken(null);
    setUser(null);
    setTenant(null);
    setSubscription(null);
    setBranches([]);
    setCurrentBranchId(null);
    setIsSuperAdmin(false);
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === SystemRole.SUPER_ADMIN || user.role === SystemRole.RESTAURANT_OWNER) return true;
    return user.permissions ? user.permissions.includes(permission) : false;
  };

  const hasFeature = (feature: FeatureKey): boolean => {
    if (isSuperAdmin) return true;
    if (!subscription || !subscription.entitlements) return false;
    return !!subscription.entitlements.features?.[feature];
  };

  const currentBranch = branches.find((b) => b.id === currentBranchId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        subscription,
        branches,
        currentBranchId,
        currentBranch,
        switchBranch,
        token,
        isSuperAdmin,
        isLoading,
        login,
        logout,
        refreshProfile,
        hasPermission,
        hasFeature,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
