/**
 * POST /api/conversations/[conversationId]/attachments
 * Attach files to a conversation (persistent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { pool } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Authentication
    const authResult = await getCurrentUser(request)
    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    const { conversationId } = params
    const body = await request.json()
    const { fileIds } = body

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'fileIds must be a non-empty array' },
        { status: 400 }
      )
    }

    console.log('[Conversation Attachments] Attaching files:', {
      conversationId,
      fileCount: fileIds.length,
      fileIds
    })

    // Insert attachments (ignore duplicates)
    const query = `
      INSERT INTO conversation_attachments (conversation_id, file_extraction_id)
      VALUES ${fileIds.map((_, i) => `($1, $${i + 2})`).join(', ')}
      ON CONFLICT (conversation_id, file_extraction_id) DO NOTHING
      RETURNING id, file_extraction_id
    `

    const values = [conversationId, ...fileIds]
    const result = await pool.query(query, values)

    console.log('[Conversation Attachments] Attached:', {
      conversationId,
      attached: result.rowCount,
      total: fileIds.length
    })

    return NextResponse.json({
      success: true,
      attached: result.rowCount,
      attachments: result.rows
    })
  } catch (error) {
    console.error('[Conversation Attachments] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to attach files',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
