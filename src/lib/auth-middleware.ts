import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './jwt-security'
import { getUserById } from './db/queries'

export interface AuthenticatedUser {
  id: string
  username: string
  email: string
  role: string
}

// 简化认证流程 - 返回用户和错误信息
export async function verifyAuthToken(authorization: string | null): Promise<{ user: AuthenticatedUser | null, error: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'ACCOUNT_INACTIVE' | null }> {
  if (!authorization) {
    return { user: null, error: 'INVALID_TOKEN' }
  }

  // 提取 Bearer token
  const token = authorization.replace('Bearer ', '')
  if (!token) {
    return { user: null, error: 'INVALID_TOKEN' }
  }

  // 验证 JWT 签名
  const jwtResult = verifyToken(token)
  if (jwtResult.error) {
    return { user: null, error: jwtResult.error === 'expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' }
  }

  const jwtPayload = jwtResult.payload
  if (!jwtPayload || jwtPayload.type !== 'access') {
    return { user: null, error: 'INVALID_TOKEN' }
  }

  // 从JWT获取用户ID
  const userId = jwtPayload.sub
  if (!userId) {
    return { user: null, error: 'INVALID_TOKEN' }
  }

  // 从数据库获取用户信息
  const user = await getUserById(userId)
  if (!user) {
    return { user: null, error: 'INVALID_TOKEN' }
  }

  if (!user.is_active) {
    return { user: null, error: 'ACCOUNT_INACTIVE' }
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.is_superuser ? 'admin' : 'user'
    },
    error: null
  }
}

// API 路由辅助函数 - 获取当前用户
export async function getCurrentUser(request: NextRequest): Promise<{ user: AuthenticatedUser | null, error: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'ACCOUNT_INACTIVE' | null }> {
  const authorization = request.headers.get('Authorization')
  return await verifyAuthToken(authorization)
}

// 统一的错误响应 - 支持错误码
export function createAuthErrorResponse(message: string, code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'ACCOUNT_INACTIVE' = 'INVALID_TOKEN', status: number = 401) {
  return NextResponse.json(
    {
      error: status === 401 ? 'Unauthorized' : 'Forbidden',
      message,
      code
    },
    { status }
  )
}