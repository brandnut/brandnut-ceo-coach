import { redis } from './redis'
import { hashToken, TokenPayload, User } from './jwt-security'

// Redis 会话管理 - 照搬 brandnut-ops

interface StoredToken {
  userId: string
  type: 'access' | 'refresh'
  username: string
  email: string
  role: string
  createdAt: number
  expiresAt: number
  is_revoked?: boolean
  revoked_at?: number
}

// 存储访问令牌 - 照搬 brandnut-ops
export async function storeAccessToken(
  token: string,
  user: User
): Promise<void> {
  // Ops使用原始token作为key，不是hash！
  const key = `access_token:${token}`

  // 完全照搬Ops的数据结构 - 简洁明了
  const tokenData = {
    user_id: user.id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30分钟
    is_revoked: false
  }

  // 存储令牌，30分钟过期
  await redis.setex(key, 30 * 60, JSON.stringify(tokenData))

  // 添加到用户活跃令牌集合
  await redis.sadd(`user_session:${user.id}:access_tokens`, token)
}

// 存储刷新令牌 - 统一使用原始token做key，和Ops保持一致
export async function storeRefreshToken(
  token: string,
  user: User
): Promise<void> {
  const key = `refresh_token:${token}`

  // 完全照搬Ops的数据结构
  const tokenData = {
    user_id: user.id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天
    is_revoked: false
  }

  // 存储令牌，7天过期
  await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(tokenData))

  // 添加到用户活跃令牌集合（存储原始token，不是hash！）
  await redis.sadd(`user_session:${user.id}:refresh_tokens`, token)
}

// 验证访问令牌是否在 Redis 中有效 - 百分百匹配 Ops 的数据结构
export async function verifyAccessToken(token: string): Promise<StoredToken | null> {
  try {
    // 1. 首先验证 JWT 签名
    const jwt = require('jsonwebtoken')
    const SECRET_KEY = process.env.SECRET_KEY || 'your-super-secret-key-change-in-production'
    const ALGORITHM = 'HS256'

    let jwtPayload
    try {
      jwtPayload = jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM] }) as any
      if (!jwtPayload || jwtPayload.type !== 'access') {
        return null
      }
    } catch (error) {
      return null
    }

    // 2. 使用 Ops 的方式：直接从Redis获取access token数据
    const key = `access_token:${token}`
    const tokenData = await redis.get(key)

    if (tokenData) {
      const parsedTokenData = JSON.parse(tokenData) as StoredToken

      // 检查是否被撤销
      if (parsedTokenData.is_revoked) {
        return null
      }

      return parsedTokenData
    }

    return null
  } catch (error) {
    console.error('Access token verification failed:', error)
    return null
  }
}

// 验证刷新令牌是否在 Redis 中有效 - 使用原始token
export async function verifyRefreshToken(token: string): Promise<any | null> {
  const key = `refresh_token:${token}`

  try {
    const data = await redis.get(key)
    if (!data) {
      return null
    }

    const tokenData = JSON.parse(data)
    if (tokenData.is_revoked) {
      return null
    }

    // 返回Ops格式的数据，包含userId字段用于兼容
    return {
      ...tokenData,
      userId: tokenData.user_id  // 兼容字段
    }
  } catch (error) {
    console.error('Refresh token verification failed:', error)
    return null
  }
}

// 撤销特定令牌 - 照搬 brandnut-ops
export async function revokeToken(token: string, type: 'access' | 'refresh'): Promise<void> {
  const key = `${type}_token:${token}`

  try {
    const data = await redis.get(key)
    if (data) {
      const tokenData = JSON.parse(data) as StoredToken
      const userKey = `user_session:${tokenData.userId}:${type === 'access' ? 'access_tokens' : 'refresh_tokens'}`

      // 标记为已撤销（Ops的方式）
      tokenData.is_revoked = true
      tokenData.revoked_at = Date.now()

      // 获取剩余过期时间
      const ttl = await redis.ttl(key)
      if (ttl > 0) {
        await redis.setex(key, ttl, JSON.stringify(tokenData))
      }

      // 从用户令牌集合移除
      await redis.srem(userKey, token)
    }
  } catch (error) {
    console.error('Token revocation failed:', error)
  }
}

// 撤销用户所有令牌 - 照搬 brandnut-ops
export async function revokeAllUserTokens(userId: string): Promise<void> {
  try {
    // 获取所有访问令牌
    const accessTokens = await redis.smembers(`user_session:${userId}:access_tokens`)
    for (const tokenHash of accessTokens) {
      await redis.del(`access_token:${tokenHash}`)
    }
    await redis.del(`user_session:${userId}:access_tokens`)

    // 获取所有刷新令牌
    const refreshTokens = await redis.smembers(`user_session:${userId}:refresh_tokens`)
    for (const tokenHash of refreshTokens) {
      await redis.del(`refresh_token:${tokenHash}`)
    }
    await redis.del(`user_session:${userId}:refresh_tokens`)

    console.log(`All tokens revoked for user: ${userId}`)
  } catch (error) {
    console.error('Revoke all user tokens failed:', error)
  }
}

// 刷新令牌时撤销旧令牌 - 照搬 brandnut-ops
export async function refreshTokens(
  oldRefreshToken: string,
  newAccessToken: string,
  newRefreshToken: string,
  user: User
): Promise<void> {
  // 先撤销旧令牌
  await revokeToken(oldRefreshToken, 'refresh')

  // 存储新令牌
  await storeAccessToken(newAccessToken, user)
  await storeRefreshToken(newRefreshToken, user)
}