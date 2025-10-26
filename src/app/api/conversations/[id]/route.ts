import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { RouteContext } from '@/types/routes'

export async function DELETE(req: NextRequest, context: any) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await (context as { params: { id: string } } | { params: Promise<{ id: string }> }).params

    // First, verify that this conversation belongs to the user
    const listResponse = await fetch(
      `${process.env.DIFY_API_URL}/conversations?user=${session.user.name}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
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
      `${process.env.DIFY_API_URL}/conversations/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: session.user.name,
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
