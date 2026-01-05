/**
 * Agent Conversation Messages API - GET /api/agent/conversations/[id]/messages
 *
 * Get messages in a conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { getConversation, getConversationMessages } from '@/lib/db/agent-queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication
    const authResult = await getCurrentUser(request)

    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    const { id: conversationId } = await params

    // Verify conversation exists and belongs to user
    const conversation = await getConversation(conversationId, authResult.user.id)

    if (!conversation) {
      return NextResponse.json(
        { error: 'Not found', message: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get messages
    const messages = await getConversationMessages(conversationId)

    return NextResponse.json({
      conversation,
      messages,
    })
  } catch (error) {
    console.error('Get messages error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
