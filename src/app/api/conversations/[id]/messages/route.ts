import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-middleware'
import { getUserChatConfig } from '@/lib/db/queries'
import type { RouteContext } from '@/types/routes'

export async function GET(req: NextRequest, context: any) {
  const authResult = await getCurrentUser(req as any)
  if (!authResult.user) {
    if (authResult.error === 'TOKEN_EXPIRED') {
      return NextResponse.json({ error: 'Access token expired' }, { status: 401 })
    } else if (authResult.error === 'ACCOUNT_INACTIVE') {
      return NextResponse.json({ error: 'Account inactive' }, { status: 403 })
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // 获取用户的组织聊天配置
    let chatConfig = null
    try {
      chatConfig = await getUserChatConfig(authResult.user.id)
    } catch (error) {
      console.error('Failed to get user chat config:', error)
    }

    // 向后兼容：如果没有组织配置，使用全局环境变量
    const apiUrl = chatConfig?.chat_api_url || process.env.DIFY_API_URL
    const apiKey = chatConfig?.chat_api_key || process.env.DIFY_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Chat API configuration not found' }, { status: 500 })
    }

    const { id } = await (context as { params: { id: string } } | { params: Promise<{ id: string }> }).params

    const response = await fetch(
      `${apiUrl}/messages?conversation_id=${id}&user=${authResult.user.id}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
