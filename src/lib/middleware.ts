import { auth } from './auth'
import { NextRequest } from 'next/server'

// 权限检查函数 - 简单直接，没有废话
export async function checkRole(request: NextRequest, requiredRole: 'admin' | 'user') {
  const session = await auth()

  // 用户必须登录
  if (!session?.user) {
    return { authorized: false, reason: 'Unauthorized' }
  }

  // admin可以访问所有功能
  if (requiredRole === 'admin' && session.user.role !== 'admin') {
    return { authorized: false, reason: 'Admin access required' }
  }

  return { authorized: true, session }
}

// 快捷函数 - 避免重复代码
export async function requireAdmin(request: NextRequest) {
  return checkRole(request, 'admin')
}

export async function requireUser(request: NextRequest) {
  return checkRole(request, 'user')
}

// 在API路由中使用的辅助函数
export function createErrorResponse(reason: string, status: number = 403) {
  return new Response(JSON.stringify({ error: reason }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}