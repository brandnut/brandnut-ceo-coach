import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(
      `${process.env.DIFY_API_URL}/conversations?user=${session.user.name}`,
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
    console.error('Conversations error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
