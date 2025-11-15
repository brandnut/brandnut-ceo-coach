import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, createAccessToken, createRefreshToken, User } from '@/lib/jwt-security'
import { verifyRefreshToken, refreshTokens } from '@/lib/redis-session'
import { getUserById } from '@/lib/db/queries'

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Refresh token required' },
        { status: 400 }
      )
    }

    // 第一层验证：JWT 签名
    const jwtResult = verifyToken(refreshToken)
    if (jwtResult.error) {
      const message = jwtResult.error === 'expired' ? 'Refresh token expired' : 'Invalid refresh token'
      return NextResponse.json(
        { error: 'Unauthorized', message, code: jwtResult.error === 'expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' },
        { status: 401 }
      )
    }

    const jwtPayload = jwtResult.payload
    if (!jwtPayload || jwtPayload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid refresh token type', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    }

    // 第二层验证：Redis 状态检查
    const storedToken = await verifyRefreshToken(refreshToken)
    if (!storedToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Refresh token revoked or expired', code: 'TOKEN_REVOKED' },
        { status: 401 }
      )
    }

    // 从数据库获取最新用户信息
    const user = await getUserById(storedToken.userId)
    if (!user || !user.is_active) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found or inactive' },
        { status: 401 }
      )
    }

    // 生成新的令牌对 - 参考Ops模式，role基于is_superuser判断
    const userRole = user.is_superuser ? 'admin' : 'user'
    const newAccessToken = createAccessToken(user.id, user.username, user.email, userRole)
    const newRefreshToken = createRefreshToken(user.id)

    // 更新 Redis：撤销旧令牌，存储新令牌
    const userForToken = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: userRole,
      isActive: user.is_active
    }
    await refreshTokens(refreshToken, newAccessToken, newRefreshToken, userForToken)

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: userRole
      }
    })

  } catch (error) {
    console.error('Token refresh failed:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Token refresh failed' },
      { status: 500 }
    )
  }
}