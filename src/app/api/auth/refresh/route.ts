import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, createAccessToken, createRefreshToken, User } from '@/lib/jwt-security'
import { verifyRefreshToken, refreshTokens } from '@/lib/redis-session'
import { pool } from '@/lib/db'

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
    const jwtPayload = verifyToken(refreshToken)
    if (!jwtPayload || jwtPayload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    // 第二层验证：Redis 状态检查
    const storedToken = await verifyRefreshToken(refreshToken)
    if (!storedToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Refresh token not found or expired' },
        { status: 401 }
      )
    }

    // 从数据库获取最新用户信息
    const userQuery = 'SELECT id, username, email, role, is_active FROM users WHERE id = $1'
    const userResult = await pool.query(userQuery, [storedToken.userId])

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found' },
        { status: 401 }
      )
    }

    const userRow = userResult.rows[0]
    const user: User = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      role: userRow.role,
      isActive: userRow.is_active
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User account is inactive' },
        { status: 401 }
      )
    }

    // 生成新的令牌对
    const newAccessToken = createAccessToken(user.id, user.username, user.email, user.role)
    const newRefreshToken = createRefreshToken(user.id)

    // 更新 Redis：撤销旧令牌，存储新令牌
    await refreshTokens(refreshToken, newAccessToken, newRefreshToken, user)

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
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