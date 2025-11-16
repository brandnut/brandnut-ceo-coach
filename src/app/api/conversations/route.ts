import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { getUserChatConfig } from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  const session = {
    user: await getCurrentUserFromRequest(req)
  }
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 获取用户的组织聊天配置
    let chatConfig = null
    try {
      chatConfig = await getUserChatConfig(session.user.id)
    } catch (error) {
      console.error('Failed to get user chat config:', error)
    }

    // 向后兼容：如果没有组织配置，使用全局环境变量
    const apiUrl = chatConfig?.chat_api_url || process.env.DIFY_API_URL
    const apiKey = chatConfig?.chat_api_key || process.env.DIFY_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Chat API configuration not found' }, { status: 500 })
    }

    const searchParams = req.nextUrl.searchParams
    const lastId = searchParams.get('last_id') || ''
    const limit = searchParams.get('limit') || '20'

    const params = new URLSearchParams({
      user: session.user.name,
      limit,
    })
    if (lastId) {
      params.append('last_id', lastId)
    }

    const response = await fetch(
      `${apiUrl}/conversations?${params}`,
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
    console.error('Conversations error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
