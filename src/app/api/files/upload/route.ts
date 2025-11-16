import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-middleware'
import { getUserChatConfig } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
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

    const formData = await req.formData()
    const file = formData.get('file')
    const user = formData.get('user') || authResult.user.id

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const proxyFormData = new FormData()
    proxyFormData.append('file', file)
    proxyFormData.append('user', user as string)

    const response = await fetch(`${apiUrl}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: proxyFormData,
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
