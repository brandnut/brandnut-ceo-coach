import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { getUserOrganizations, getUserChatConfig } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    // 使用JWT中间件获取当前用户
    const authResult = await getCurrentUser(request as any)
    if (!authResult.user) {
      if (authResult.error === 'TOKEN_EXPIRED') {
        return createAuthErrorResponse('Access token expired', 'TOKEN_EXPIRED')
      } else if (authResult.error === 'ACCOUNT_INACTIVE') {
        return createAuthErrorResponse('Account inactive', 'ACCOUNT_INACTIVE', 403)
      } else {
        return createAuthErrorResponse('Invalid access token', 'INVALID_TOKEN')
      }
    }

    // 并行获取用户组织和聊天配置
    const [organizations, chatConfig] = await Promise.all([
      getUserOrganizations(authResult.user.id),
      getUserChatConfig(authResult.user.id)
    ])

    // 过滤掉role字段，只返回组织信息（按照需求不返回role字段）
    const organizationsWithoutRole = organizations.map(org => {
      const { role, joined_at, ...orgWithoutRole } = org
      return {
        ...orgWithoutRole,
        created_at: org.created_at.toISOString(),
        updated_at: org.updated_at.toISOString()
      }
    })

    // 将 chatConfig 附加到对应的组织上
    const organizationsWithChatConfig = organizationsWithoutRole.map(org => ({
      ...org,
      chatConfig: chatConfig && chatConfig.organization_id === org.id ? {
        id: chatConfig.id,
        organization_id: chatConfig.organization_id,
        is_active: chatConfig.is_active,
      } : null
    }))

    return NextResponse.json({
      organizations: organizationsWithChatConfig
    })

  } catch (error) {
    console.error('Get user organizations failed:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get user organizations' },
      { status: 500 }
    )
  }
}