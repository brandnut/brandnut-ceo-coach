# 认证错误码文档

## 概述

本文档定义了Coach后端API的认证错误码体系，用于精确区分不同类型的认证失败情况，使前端能够智能处理各种认证场景。

**设计优势**：
- 相比Ops项目混用`JWTError`的设计，我们提供精确的错误分类
- 前端可以实现无感知token刷新，提升用户体验
- 支持多种认证场景的差异化处理

## 错误码体系

### 1. Access Token 相关错误

#### `TOKEN_EXPIRED` (401)
**场景**：Access Token过期（30分钟）
**响应示例**：
```json
{
  "error": "Unauthorized",
  "message": "Access token expired",
  "code": "TOKEN_EXPIRED"
}
```

**前端处理**：
- 尝试用refresh token获取新access token
- 刷新成功后自动重试原请求
- 用户无感知，体验流畅

#### `INVALID_TOKEN` (401)
**场景**：Access Token无效（格式错误、签名错误、伪造等）
**响应示例**：
```json
{
  "error": "Unauthorized",
  "message": "Invalid access token",
  "code": "INVALID_TOKEN"
}
```

**前端处理**：
- 清除本地存储的所有tokens
- 立即跳转登录页面
- 不要尝试refresh（因为token本身无效）

#### `ACCOUNT_INACTIVE` (403)
**场景**：用户账号被禁用
**响应示例**：
```json
{
  "error": "Forbidden",
  "message": "Account inactive",
  "code": "ACCOUNT_INACTIVE"
}
```

**前端处理**：
- 清除本地tokens
- 显示账号被禁用提示
- 跳转登录页面并传递禁用原因

### 2. Refresh Token 相关错误

#### `TOKEN_EXPIRED` (401)
**场景**：Refresh Token过期（7天）
**响应示例**：
```json
{
  "error": "Unauthorized",
  "message": "Refresh token expired",
  "code": "TOKEN_EXPIRED"
}
```

**前端处理**：
- 清除本地tokens
- 提示用户登录已过期
- 跳转登录页面

#### `INVALID_TOKEN` (401)
**场景**：Refresh Token无效（格式错误、签名错误、伪造等）
**响应示例**：
```json
{
  "error": "Unauthorized",
  "message": "Invalid refresh token",
  "code": "INVALID_TOKEN"
}
```

**前端处理**：
- 清除本地tokens
- 跳转登录页面

#### `TOKEN_REVOKED` (401)
**场景**：Refresh Token被撤销（异地登录、管理员撤销等）
**响应示例**：
```json
{
  "error": "Unauthorized",
  "message": "Refresh token revoked or expired",
  "code": "TOKEN_REVOKED"
}
```

**前端处理**：
- 清除本地tokens
- 提示用户登录状态失效
- 跳转登录页面

## 前端实现指南

### 1. Axios 拦截器实现

```typescript
// api/axios.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 10000,
});

// 请求拦截器 - 添加access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => response,  // 成功直接返回

  async (error) => {
    const originalRequest = error.config;

    // 只处理认证相关的401错误
    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorData = error.response.data;

      switch (errorData.code) {
        case 'TOKEN_EXPIRED':
          // 尝试refresh
          return await handleTokenRefresh(originalRequest);

        case 'INVALID_TOKEN':
        case 'TOKEN_REVOKED':
          // 清除tokens，跳转登录
          clearAuthAndRedirect();
          return Promise.reject(error);

        default:
          return Promise.reject(error);
      }
    }

    // 403错误处理
    if (error.response?.status === 403) {
      const errorData = error.response.data;
      if (errorData.code === 'ACCOUNT_INACTIVE') {
        clearAuthAndRedirect('/login?reason=account_disabled');
      }
    }

    return Promise.reject(error);
  }
);

async function handleTokenRefresh(originalRequest: any) {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await axios.post('/api/auth/refresh', {
      refreshToken
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data;

    // 保存新tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);

    // 标记原始请求为重试，避免无限循环
    originalRequest._retry = true;

    // 更新原始请求的Authorization头
    originalRequest.headers.Authorization = `Bearer ${accessToken}`;

    // 重新执行原始请求
    return api(originalRequest);

  } catch (refreshError) {
    // refresh失败，清除tokens并跳转登录
    clearAuthAndRedirect();
    return Promise.reject(refreshError);
  }
}

function clearAuthAndRedirect(redirectUrl: string = '/login') {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = redirectUrl;
}

export default api;
```

### 2. React Hook 实现

```typescript
// hooks/useAuth.ts
import { useState, useCallback } from 'react';
import api from '../api/axios';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(userData);

      return userData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      // 即使logout失败也要清除本地数据
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  }, []);

  const getCurrentUser = useCallback(async () => {
    try {
      const response = await api.get('/api/users/me');
      setUser(response.data);
      return response.data;
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, []);

  return {
    user,
    loading,
    login,
    logout,
    getCurrentUser
  };
};
```

### 3. 用户体验优化

```typescript
// utils/authNotifications.ts
export const showAuthNotification = (errorCode: string) => {
  switch (errorCode) {
    case 'TOKEN_REVOKED':
      return {
        type: 'warning',
        message: '检测到异地登录，请重新登录'
      };
    case 'ACCOUNT_INACTIVE':
      return {
        type: 'error',
        message: '账号已被禁用，请联系管理员'
      };
    case 'TOKEN_EXPIRED':
      return {
        type: 'info',
        message: '会话已更新，请重试'
      };
    default:
      return {
        type: 'error',
        message: '认证失败，请重新登录'
      };
  }
};
```

## 与Ops项目对比

| 特性 | Ops项目 | Coach项目 |
|------|---------|-----------|
| 错误分类 | ❌ 混用`JWTError`，无法区分 | ✅ 精确错误码分类 |
| Token过期处理 | ❌ 盲目尝试refresh | ✅ 智能区分过期vs无效 |
| 用户体验 | ❌ 频繁要求重新登录 | ✅ 无感知token刷新 |
| 开发体验 | ❌ 调试困难 | ✅ 清晰的错误信息 |
| 安全性 | ⚠️ 基础 | ✅ 多层次安全检查 |

## 实现检查清单

- [ ] JWT验证函数支持错误类型区分
- [ ] auth middleware返回精确错误码
- [ ] 受保护API使用错误码响应
- [ ] refresh endpoint使用错误码响应
- [ ] 前端axios拦截器实现
- [ ] 前端错误处理逻辑实现
- [ ] 用户体验通知系统
- [ ] 端到端测试覆盖

## 测试用例

```typescript
// 测试用例示例
describe('Auth Error Codes', () => {
  test('should handle expired access token', async () => {
    // 使用过期的access token
    const expiredToken = createExpiredAccessToken();

    const response = await api.get('/api/users/me', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    expect(response.status).toBe(401);
    expect(response.data.code).toBe('TOKEN_EXPIRED');
  });

  test('should handle invalid access token', async () => {
    // 使用无效的access token
    const response = await api.get('/api/users/me', {
      headers: { Authorization: 'Bearer invalid.token' }
    });

    expect(response.status).toBe(401);
    expect(response.data.code).toBe('INVALID_TOKEN');
  });
});
```

---

**注意**：本文档会随着认证系统的演进持续更新，请确保实现与最新版本保持一致。