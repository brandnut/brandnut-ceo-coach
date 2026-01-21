/**
 * GET /api/conversations/[id]/attachments
 * Get all attachments for a conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { pool } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const authResult = await getCurrentUser(request)
    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    const conversationId = params.id

    // Check pool is available
    if (!pool) {
      return NextResponse.json(
        {
          error: 'Database not available',
          message: 'Database connection not initialized'
        },
        { status: 500 }
      )
    }

    // Query conversation attachments
    const query = `
      SELECT
        ca.id as attachment_id,
        ca.file_extraction_id,
        fe.file_name,
        fe.file_url,
        fe.mime_type,
        fe.file_size,
        ca.attached_at,
        ca.created_at
      FROM conversation_attachments ca
      JOIN file_extractions fe ON ca.file_extraction_id = fe.id
      WHERE ca.conversation_id = $1
      ORDER BY ca.attached_at ASC
    `

    const result = await pool.query(query, [conversationId])

    // Return file IDs array
    const attachmentIds = result.rows.map(row => row.file_extraction_id)

    console.log('[Conversation Attachments] Retrieved:', {
      conversationId,
      count: attachmentIds.length,
      attachmentIds
    })

    return NextResponse.json({
      success: true,
      attachmentIds,
      attachments: result.rows
    })
  } catch (error) {
    console.error('[Conversation Attachments] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve attachments',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
