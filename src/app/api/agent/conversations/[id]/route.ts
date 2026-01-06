import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { softDeleteConversation } from '@/lib/db/agent-queries'

/**
 * DELETE /api/agent/conversations/[id]
 * Soft delete a conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const authResult = await getCurrentUser(request)

    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    // Soft delete
    await softDeleteConversation(params.id, authResult.user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete conversation error:', error)

    if (error?.message === 'Conversation not found or already deleted') {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
