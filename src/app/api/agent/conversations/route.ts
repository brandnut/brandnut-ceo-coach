/**
 * Agent Conversations API - GET /api/agent/conversations
 *
 * List user's conversations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { getUserConversations } from '@/lib/db/agent-queries'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await getCurrentUser(request)

    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Get conversations
    const result = await getUserConversations(authResult.user.id, limit, offset)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get conversations error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
