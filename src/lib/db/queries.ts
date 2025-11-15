import pool from '@/lib/db'
import { User, UserWithInternal, Organization, UserRole, UserOrganizationWithRole } from '@/lib/models/user'

// 用户查询函数
export async function getUserById(userId: string): Promise<UserWithInternal | null> {
  if (!pool) {
    throw new Error('Database not available')
  }

  try {
    const query = `
      SELECT
        id,
        username,
        email,
        full_name,
        avatar_url,
        phone,
        is_active,
        is_verified,
        is_superuser,
        created_at,
        updated_at,
        last_login_at
      FROM users
      WHERE id = $1
    `

    const result = await pool.query(query, [userId])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error getting user by ID:', error)
    throw error
  }
}

// 获取用户角色 - 从user_roles表获取（这是用户角色的唯一定义）
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  if (!pool) {
    throw new Error('Database not available')
  }

  try {
    const query = `
      SELECT
        ur.id,
        ur.user_id,
        ur.role_id,
        r.name as role_name,
        ur.scope,
        ur.scope_id,
        ur.granted_at,
        ur.granted_by,
        ur.expires_at,
        ur.assignment_reason,
        ur.is_active
      FROM user_roles ur
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND ur.is_active = true
      ORDER BY ur.granted_at DESC
    `

    const result = await pool.query(query, [userId])
    return result.rows
  } catch (error) {
    console.error('Error getting user roles:', error)
    throw error
  }
}

// 获取用户所属组织
export async function getUserOrganizations(userId: string): Promise<UserOrganizationWithRole[]> {
  if (!pool) {
    throw new Error('Database not available')
  }

  try {
    const query = `
      SELECT
        o.id,
        o.name,
        o.description,
        o.logo_url,
        o.is_active,
        o.max_members,
        o.created_at,
        o.updated_at,
        uo.role,
        uo.joined_at
      FROM organizations o
      INNER JOIN user_organizations uo ON o.id = uo.organization_id
      WHERE uo.user_id = $1 AND o.is_active = true
      ORDER BY uo.joined_at DESC
    `

    const result = await pool.query(query, [userId])
    return result.rows
  } catch (error) {
    console.error('Error getting user organizations:', error)
    throw error
  }
}

// 根据JWT token获取用户信息
export async function getUserByToken(token: string): Promise<User | null> {
  if (!pool) {
    throw new Error('Database not available')
  }

  try {
    // 先通过token获取用户ID - 这里需要根据实际的token存储方式调整
    // 假设我们有token到用户ID的映射，或者通过JWT解析得到用户ID
    const jwt = require('jsonwebtoken')
    const SECRET_KEY = process.env.SECRET_KEY || 'your-super-secret-key-change-in-production'
    const ALGORITHM = 'HS256'

    let jwtPayload
    try {
      jwtPayload = jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM] }) as any
      if (!jwtPayload || jwtPayload.type !== 'access' || !jwtPayload.sub) {
        return null
      }
    } catch (error) {
      return null
    }

    // 使用用户ID获取完整用户信息
    const user = await getUserById(jwtPayload.sub)
    if (!user) {
      return null
    }

    // 移除不需要返回的字段
    const { is_active, is_verified, is_superuser, ...userResponse } = user

    return userResponse
  } catch (error) {
    console.error('Error getting user by token:', error)
    throw error
  }
}