import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { RouteContext } from '@/types/routes'

export async function POST(req: NextRequest, context: any) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await req.json()
    const { id } = await (context as { params: { id: string } } | { params: Promise<{ id: string }> }).params

    const response = await fetch(
      `${process.env.DIFY_API_URL}/conversations/${id}/name`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          user: session.user?.name || "guest",
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Rename error:', error)
    return NextResponse.json({ error: 'Failed to rename' }, { status: 500 })
  }
}
