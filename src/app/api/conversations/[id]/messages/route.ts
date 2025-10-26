import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest, context: any) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = (context?.params || {}) as { id: string }

    const response = await fetch(
      `${process.env.DIFY_API_URL}/messages?conversation_id=${id}&user=${session.user.name}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
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
