import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './jwt-security'
import { verifyAccessToken } from './redis-session'

// 认证中间件 - 照搬 brandnut-ops 的双重验证机制

export interface AuthenticatedUser {
  id: string
  username: string
  email: string
  role: string
}

// 验证 JWT Token 并检查 Redis 状态 - 照搬 brandnut-ops
export async function verifyAuthToken(authorization: string | null): Promise<AuthenticatedUser | null> {
  if (!authorization) {
    return null
  }

  // 提取 Bearer token
  const token = authorization.replace('Bearer ', '')
  if (!token) {
    return null
  }

  // 第一层验证：JWT 签名
  const jwtPayload = verifyToken(token)
  if (!jwtPayload || jwtPayload.type !== 'access') {
    return null
  }

  // 第二层验证：Redis 状态检查
  const storedToken = await verifyAccessToken(token)
  if (!storedToken) {
    return null
  }

  // 返回用户信息
  return {
    id: storedToken.userId,
    username: storedToken.username,
    email: storedToken.email,
    role: storedToken.role
  }
}

// API 路由辅助函数 - 获取当前用户
export async function getCurrentUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get('Authorization')
  return await verifyAuthToken(authorization)
}

// 统一的错误响应
export function createAuthErrorResponse(message: string, status: number = 401) {
  return NextResponse.json(
    {
      error: 'Authentication failed',
      message
    },
    { status }
  )
}