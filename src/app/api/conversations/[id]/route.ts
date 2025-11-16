import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-middleware'
import { getUserChatConfig } from '@/lib/db/queries'

export async function DELETE(req: NextRequest, context: any) {
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
    const { id } = await (context as { params: { id: string } } | { params: Promise<{ id: string }> }).params

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

    // First, verify that this conversation belongs to the user
    const listResponse = await fetch(
      `${apiUrl}/conversations?user=${authResult.user.id}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    if (!listResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to verify conversation ownership' },
        { status: 500 }
      )
    }

    const listData = await listResponse.json()
    const userConversations = listData.data || []
    const ownsConversation = userConversations.some((conv: any) => conv.id === id)

    if (!ownsConversation) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this conversation' },
        { status: 403 }
      )
    }

    // Delete the conversation
    const deleteResponse = await fetch(
      `${apiUrl}/conversations/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: authResult.user.id,
        }),
      }
    )

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text()
      return NextResponse.json({ error }, { status: deleteResponse.status })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Delete conversation error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
