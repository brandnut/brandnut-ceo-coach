import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// JWT 配置 - 照搬 brandnut-ops
const SECRET_KEY = process.env.SECRET_KEY || 'your-super-secret-key-change-in-production'
const ALGORITHM = 'HS256'
const ACCESS_TOKEN_EXPIRE_MINUTES = 30
const REFRESH_TOKEN_EXPIRE_DAYS = 7

// Token 接口定义
export interface TokenPayload {
  exp: number
  sub: string
  type: 'access' | 'refresh'
  username?: string
  email?: string
  role?: string
}

export interface User {
  id: string
  username: string
  email: string
  role: string
  isActive: boolean
}

// 创建访问令牌 - 照搬 brandnut-ops
export function createAccessToken(
  subject: string,
  username: string,
  email: string,
  role: string,
  expiresDelta?: number
): string {
  const expire = Math.floor(Date.now() / 1000) + (expiresDelta || ACCESS_TOKEN_EXPIRE_MINUTES * 60)

  const toEncode: TokenPayload = {
    exp: expire,
    sub: subject,
    type: 'access',
    username,
    email,
    role
  }

  return jwt.sign(toEncode, SECRET_KEY, { algorithm: ALGORITHM })
}

// 创建刷新令牌 - 照搬 brandnut-ops
export function createRefreshToken(
  subject: string,
  expiresDelta?: number
): string {
  const expire = Math.floor(Date.now() / 1000) + (expiresDelta || REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)

  const toEncode: TokenPayload = {
    exp: expire,
    sub: subject,
    type: 'refresh'
  }

  return jwt.sign(toEncode, SECRET_KEY, { algorithm: ALGORITHM })
}

// 验证 JWT 令牌 - 照搬 brandnut-ops
export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM] }) as TokenPayload
    return payload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

// 密码哈希 - 照搬 brandnut-ops
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

// 验证密码 - 照搬 brandnut-ops
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword)
  } catch (error) {
    console.error('Password verification failed:', error)
    return false
  }
}

// 生成 Token 哈希用于 Redis 存储 - 照搬 brandnut-ops
export function hashToken(token: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(token).digest('hex')
}