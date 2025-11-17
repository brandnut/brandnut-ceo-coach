import pool from '@/lib/db'
import { User, UserWithInternal, Organization, UserRole, UserOrganizationWithRole, OrganizationChatConfig, UserChatConfig } from '@/lib/models/user'

// 安全的数据库查询包装器
async function withClient<T>(callback: (client: any) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error('Database not available')
  }

  const client = await pool.connect()
  try {
    return await callback(client)
  } finally {
    client.release()
  }
}

// 用户查询函数
export async function getUserById(userId: string): Promise<UserWithInternal | null> {
  return withClient(async (client) => {
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

    const result = await client.query(query, [userId])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  })
}

// 获取用户角色 - 从user_roles表获取（这是用户角色的唯一定义）
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  return withClient(async (client) => {
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

    const result = await client.query(query, [userId])
    return result.rows
  })
}

// 获取用户所属组织
export async function getUserOrganizations(userId: string): Promise<UserOrganizationWithRole[]> {
  return withClient(async (client) => {
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
        uo.user_id,
        uo.organization_id,
        uo.role,
        uo.joined_at
      FROM organizations o
      INNER JOIN user_organizations uo ON o.id = uo.organization_id
      WHERE uo.user_id = $1 AND o.is_active = true
      ORDER BY o.created_at DESC
    `

    const result = await client.query(query, [userId])
    return result.rows
  })
}

// 获取用户聊天配置
export async function getUserChatConfig(userId: string, organizationId?: string): Promise<UserChatConfig | null> {
  return withClient(async (client) => {
    // 首先获取用户所属的组织
    const orgQuery = `
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = $1
    `
    const orgResult = await client.query(orgQuery, [userId])

    if (orgResult.rows.length === 0) {
      return null
    }

    const userOrgIds = orgResult.rows.map((row: any) => row.organization_id)

    let query = `
      SELECT
        id,
        organization_id,
        chat_api_key,
        chat_api_url,
        is_active,
        created_at,
        updated_at
      FROM organization_chat_configs
      WHERE organization_id = ANY($1) AND is_active = true
    `

    const params = [userOrgIds]

    if (organizationId) {
      query += ` AND organization_id = $2`
      params.push(organizationId)
    }

    query += ` ORDER BY updated_at DESC LIMIT 1`

    const result = await client.query(query, params)

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  })
}

// 获取组织聊天配置
export async function getOrganizationChatConfig(organizationId: string): Promise<OrganizationChatConfig | null> {
  return withClient(async (client) => {
    const query = `
      SELECT
        id,
        organization_id,
        chat_api_url,
        chat_api_key,
        is_active,
        created_at,
        updated_at
      FROM organization_chat_configs
      WHERE organization_id = $1 AND is_active = true
      ORDER BY updated_at DESC
      LIMIT 1
    `

    const result = await client.query(query, [organizationId])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  })
}

// 创建组织聊天配置
export async function createOrganizationChatConfig(
  organizationId: string,
  chatApiUrl: string,
  chatApiKey: string
): Promise<OrganizationChatConfig> {
  return withClient(async (client) => {
    const query = `
      INSERT INTO organization_chat_configs (
        organization_id,
        chat_api_url,
        chat_api_key,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `

    const result = await client.query(query, [organizationId, chatApiUrl, chatApiKey])
    return result.rows[0]
  })
}

// 创建用户聊天配置
export async function createUserChatConfig(
  userId: string,
  organizationId: string,
  difyApiKey: string,
  difyApiUrl: string
): Promise<UserChatConfig> {
  return withClient(async (client) => {
    const query = `
      INSERT INTO organization_chat_configs (
        user_id,
        organization_id,
        dify_api_key,
        dify_api_url,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `

    const result = await client.query(query, [userId, organizationId, difyApiKey, difyApiUrl])
    return result.rows[0]
  })
}