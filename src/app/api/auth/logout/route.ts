import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-middleware'
import { revokeToken, revokeAllUserTokens } from '@/lib/redis-session'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid authentication token required' },
        { status: 401 }
      )
    }

    // 获取请求头中的 Authorization token
    const authorization = request.headers.get('Authorization')
    if (!authorization) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Authorization header required' },
        { status: 400 }
      )
    }

    const token = authorization.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Token required' },
        { status: 400 }
      )
    }

    // 撤销当前访问令牌
    await revokeToken(token, 'access')

    // 可选：撤销用户所有令牌（完全登出所有设备）
    const logoutAll = request.headers.get('X-Logout-All') === 'true'
    if (logoutAll) {
      await revokeAllUserTokens(user.id)
    }

    return NextResponse.json({
      success: true,
      message: logoutAll ? 'Logged out from all devices' : 'Logged out successfully'
    })

  } catch (error) {
    console.error('Logout failed:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Logout failed' },
      { status: 500 }
    )
  }
}