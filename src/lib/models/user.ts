// 用户相关类型定义 - 基于Ops项目的数据结构

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  // me接口不返回以下字段
  // is_active: boolean;
  // is_verified: boolean;
  // is_superuser: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface UserWithInternal extends User {
  is_active: boolean;
  is_verified: boolean;
  is_superuser: boolean;
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
  max_members: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserOrganization {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
  max_members: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserOrganizationWithRole extends Organization {
  role: string;
  joined_at: Date;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  role_name: string;
  scope: string;
  scope_id?: string;
  granted_at: Date;
  granted_by?: string;
  expires_at?: Date;
  assignment_reason?: string;
  is_active: boolean;
}

export interface UserMeResponse {
  username: string;
  email: string;
  full_name?: string;
  id: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  avatar_url?: string;
  phone?: string;
  roles: UserRole[];
  subscriptions: any[];
}

export interface UserOrganizationResponse {
  organization: UserOrganization;
  role: string;
  joined_at: string;
}

// 组织聊天配置
export interface OrganizationChatConfig {
  id: string;
  organization_id: string;
  chat_api_url: string;
  chat_api_key: string;
  system_prompt?: string;
  model_name?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// 用户聊天配置（包含组织信息）
export interface UserChatConfig {
  chat_api_url: string;
  chat_api_key: string;
  system_prompt?: string;
  model_name?: string;
  organization_name: string;
  organization_id: string;
}