import { NextRequest, NextResponse } from 'next/server'

// 临时禁用NextAuth，返回简单的guest session
export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  // 检查是否是session请求 - 返回正确的next-auth格式
  if (url.pathname.endsWith('/session')) {
    return NextResponse.json({
      user: {
        id: '0',
        name: 'guest',
        role: 'user'
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
  }

  // 对于其他auth请求，返回错误但避免崩溃
  return NextResponse.json({ error: 'Auth temporarily simplified' }, { status: 200 })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Auth temporarily simplified' }, { status: 200 })
}
