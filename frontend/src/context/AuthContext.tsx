import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { AuthUser, SystemRole, Permission, FeatureKey } from '@pos/shared';

interface AuthContextType {
  user: AuthUser | null;
  tenant: any | null;
  subscription: any | null;
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
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    if (!token) {
      setUser(null);
      setTenant(null);
      setSubscription(null);
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

  const login = (newToken: string, newUser: any) => {
    localStorage.setItem('pos_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setIsSuperAdmin(newUser.role === SystemRole.SUPER_ADMIN);
  };

  const logout = () => {
    localStorage.removeItem('pos_token');
    setToken(null);
    setUser(null);
    setTenant(null);
    setSubscription(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        subscription,
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
