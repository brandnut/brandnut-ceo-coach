import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth-middleware'
import { streamText } from 'ai'
import { getUserChatConfig } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  const authResult = await getCurrentUser(req as any)
  if (!authResult.user) {
    if (authResult.error === 'TOKEN_EXPIRED') {
      return new Response('Access token expired', { status: 401 })
    } else if (authResult.error === 'ACCOUNT_INACTIVE') {
      return new Response('Account inactive', { status: 403 })
    } else {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  try {
    const body = await req.json()
    const { query, conversationId = null, files = [], inputs = {} } = body

    if (!query || !query.trim()) {
      return new Response('Empty message', { status: 400 })
    }

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
      return new Response('Chat API configuration not found', { status: 500 })
    }

    const response = await fetch(`${apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        query,
        user: authResult.user.id,
        conversation_id: conversationId,
        files,
        response_mode: 'streaming',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return new Response(error, { status: response.status })
    }

    // Return Dify SSE stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
