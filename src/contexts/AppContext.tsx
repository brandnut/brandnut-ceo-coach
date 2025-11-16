"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAuthLogic } from "@/hooks/useAuthLogic";

// API 接口返回的实体 - 完全映射 /api/users/me
export interface UserInfo {
  id: string;
  username: string;
  email: string;
  phone?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  roles?: Array<{
    id: string;
    role_name: string;
    scope: string;
    is_active: boolean;
  }>;
}

// API 接口返回的实体 - 完全映射 /api/users/me/organizations
export interface Organization {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  is_active: boolean;
  max_members: number;
  created_at: string;
  updated_at: string;
  user_id?: string;
  organization_id?: string;
  role?: string;
  joined_at?: string;
}

// App context interface - 完全映射 API
interface AppContextType {
  // 来自 /api/users/me
  me: UserInfo | null;

  // 来自 /api/users/me/organizations
  organizations: Organization[];

  // 认证操作
  login: (phone: string, code: string) => Promise<any>;
  logout: () => Promise<void>;
  sendSmsCode: (phone: string) => Promise<any>;

  // 状态标志
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Props for provider
interface AppProviderProps {
  children: ReactNode;
}

// Provider component
export function AppProvider({ children }: AppProviderProps) {
  const authState = useAuthLogic();

  const value: AppContextType = {
    // 完全映射 API 结构，平级数据
    me: authState.me,
    organizations: authState.organizations,

    // 认证操作
    login: authState.login,
    logout: authState.logout,
    sendSmsCode: authState.sendSmsCode,

    // 状态标志
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use app context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}