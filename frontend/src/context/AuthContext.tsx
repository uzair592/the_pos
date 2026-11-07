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
  login: (token: string, user: any, sessionId?: string, deviceFingerprint?: string) => void;
  logout: () => Promise<void>;
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

      // Single-branch restaurant architecture:
      // Lock current branch directly to the restaurant's primary branch
      const primaryBranchId = data.user?.branchId || (bList.length > 0 ? bList[0].id : null);
      if (primaryBranchId) {
        setCurrentBranchId(primaryBranchId);
        localStorage.setItem('pos_current_branch_id', primaryBranchId);
      } else {
        setCurrentBranchId(null);
      }
    } catch (err: any) {
      console.error('Failed to load user profile:', err);
      if (err?.statusCode === 401) {
        logout();
      }
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

  const login = (newToken: string, newUser: any, sessionId?: string, deviceFingerprint?: string) => {
    localStorage.setItem('pos_token', newToken);
    if (sessionId) localStorage.setItem('pos_session_id', sessionId);
    if (deviceFingerprint) localStorage.setItem('pos_device_fp', deviceFingerprint);
    if (newUser.branchId) {
      localStorage.setItem('pos_current_branch_id', newUser.branchId);
      setCurrentBranchId(newUser.branchId);
    }
    setToken(newToken);
    setUser(newUser);
    setIsSuperAdmin(newUser.role === SystemRole.SUPER_ADMIN);
  };

  const logout = async () => {
    const sessionId = localStorage.getItem('pos_session_id');
    const deviceFingerprint = localStorage.getItem('pos_device_fp');
    try {
      await api.post('/auth/logout', { sessionId, deviceFingerprint });
    } catch { }
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_current_branch_id');
    localStorage.removeItem('pos_session_id');
    setToken(null);
    setUser(null);
    setTenant(null);
    setSubscription(null);
    setBranches([]);
    setCurrentBranchId(null);
    setIsSuperAdmin(false);
  };

  // Online Heartbeat: keeps active device session ONLINE in centralized SaaS backend
  useEffect(() => {
    if (!token || !user) return;
    const interval = setInterval(async () => {
      try {
        const sessionId = localStorage.getItem('pos_session_id');
        const deviceFingerprint = localStorage.getItem('pos_device_fp');
        await api.post('/auth/heartbeat', { sessionId, deviceFingerprint });
      } catch {
        // Silently catch heartbeat errors when connection is lost
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [token, user]);

  // Session expired / revoked listener
  useEffect(() => {
    const handleExpired = () => {
      logout();
    };
    window.addEventListener('pos:session-expired', handleExpired);
    return () => window.removeEventListener('pos:session-expired', handleExpired);
  }, []);

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    const r = (user.role || '').toUpperCase();
    if (
      r === SystemRole.SUPER_ADMIN ||
      r === SystemRole.RESTAURANT_OWNER ||
      r === 'OWNER' ||
      r === SystemRole.BRANCH_MANAGER ||
      r === 'MANAGER' ||
      r === SystemRole.RESTAURANT_ADMIN ||
      r === 'ADMIN'
    ) return true;
    return user.permissions ? user.permissions.includes(permission) : false;
  };

  const hasFeature = (feature: FeatureKey): boolean => {
    if (isSuperAdmin) return true;
    const r = (user?.role || '').toUpperCase();
    if (r === SystemRole.RESTAURANT_OWNER || r === 'OWNER' || r === SystemRole.BRANCH_MANAGER || r === 'MANAGER') return true;
    if (!subscription || !subscription.entitlements) return true;
    return subscription.entitlements.features?.[feature] !== false;
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
