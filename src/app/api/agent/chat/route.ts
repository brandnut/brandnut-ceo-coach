/**
 * Agent Chat API - POST /api/agent/chat
 *
 * SSE streaming chat with OpenRouter + Claude 4.5 Sonnet
 *
 * Key principle: Streaming events and history must be consistent.
 * The 'done' event includes the complete Message object matching history format.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import {
  createConversation,
  getConversation,
  getConversationMessages,
  createMessage,
  markMessageError,
} from '@/lib/db/agent-queries'
import { getUserChatConfig } from '@/lib/db/queries'
import { getFileExtractions } from '@/lib/db/file-queries'
import { pool } from '@/lib/db'
import { streamChatResponseGraph } from '@/lib/agent/chat'
import { agentConfig } from '@/config/app'
import { ChatRequest, Attachment } from '@/types/agent'

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await getCurrentUser(request)

    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    // 2. Parse request
    const body: ChatRequest = await request.json()
    const { message, conversationId, attachment_ids, attachments: clientAttachments } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'message is required' },
        { status: 400 }
      )
    }

    // 3. Handle attachments (only images/PDFs for multimodal)
    // Text documents are processed later after loading from database
    let attachments: Attachment[] = []
    let injected_content: string | undefined = undefined

    // 3a. Process client attachments (images/PDFs for multimodal)
    if (clientAttachments && clientAttachments.length > 0) {
      attachments = [...attachments, ...clientAttachments]
    }

    // 4. Get or create conversation
    let convId = conversationId

    if (convId) {
      // Verify conversation exists and belongs to user
      const conv = await getConversation(convId, authResult.user.id)
      if (!conv) {
        return NextResponse.json(
          { error: 'Not found', message: 'Conversation not found' },
          { status: 404 }
        )
      }
    } else {
      // Create new conversation
      const newConv = await createConversation(authResult.user.id)
      convId = newConv.id
    }

    // 4b. Load conversation attachments from database (if conversation exists)
    // This ensures RAG works even when frontend doesn't send attachment_ids
    let conversationAttachmentIds: string[] = []
    if (convId && pool) {
      try {
        const attachQuery = `
          SELECT file_extraction_id
          FROM conversation_attachments
          WHERE conversation_id = $1
          ORDER BY attached_at ASC
        `
        const attachResult = await pool.query(attachQuery, [convId])
        conversationAttachmentIds = attachResult.rows.map(row => row.file_extraction_id)

        console.log('[Chat API] Loaded conversation attachments from database:', {
          convId,
          count: conversationAttachmentIds.length,
          attachmentIds: conversationAttachmentIds
        })
      } catch (error) {
        console.error('[Chat API] Failed to load conversation attachments:', error)
      }
    }

    // 4c. Merge frontend attachment_ids with database attachments
    // Frontend attachment_ids are saved to database for future use
    if (attachment_ids && attachment_ids.length > 0 && pool) {
      try {
        const attachQuery = `
          INSERT INTO conversation_attachments (conversation_id, file_extraction_id)
          VALUES ${attachment_ids.map((_, i) => `($1, $${i + 2})`).join(', ')}
          ON CONFLICT (conversation_id, file_extraction_id) DO NOTHING
        `
        await pool.query(attachQuery, [convId, ...attachment_ids])
        console.log('[Chat API] Attached files to conversation:', {
          convId,
          fileCount: attachment_ids.length
        })
      } catch (error) {
        console.error('[Chat API] Failed to attach files to conversation:', error)
      }
    }

    // 4d. Combine all attachment IDs (database + newly uploaded)
    const allAttachmentIds = [
      ...new Set([
        ...conversationAttachmentIds,  // From database (persisted)
        ...(attachment_ids || [])       // From frontend (just uploaded)
      ])
    ]

    console.log('[Chat API] Combined attachment IDs for RAG:', {
      database: conversationAttachmentIds.length,
      frontend: (attachment_ids || []).length,
      total: allAttachmentIds.length,
      allAttachmentIds
    })

    // Use allAttachmentIds instead of attachment_ids for subsequent processing
    const effectiveAttachmentIds = allAttachmentIds.length > 0 ? allAttachmentIds : undefined

    // 4e. Process effective attachment IDs for RAG
    if (effectiveAttachmentIds && effectiveAttachmentIds.length > 0) {
      console.log('[Chat API] Processing effective attachment IDs:', effectiveAttachmentIds)

      const extractions = await getFileExtractions(effectiveAttachmentIds)

      // Build attachments metadata (for UI display)
      attachments = extractions.map((ext) => ({
        id: ext.id,
        type: 'document' as const,
        url: ext.file_url,
        name: ext.file_name,
        mimeType: ext.mime_type || 'application/octet-stream',
      }))

      // Build injected_content: "[User uploaded file: xxx.docx]\n{file text}\n{user message}"
      const fileParts = extractions.map(
        (ext) => `[User uploaded file: ${ext.file_name}]\n${ext.extracted_text}`
      )

      injected_content = [...fileParts, message].join('\n\n')
    }

    // 5. Save user message immediately (eliminates consistency issues)
    const userMessage = await createMessage(
      convId,
      'user',
      message,
      attachments,
      undefined,
      injected_content
    )

    // 6. Load conversation history (limit to recent rounds to prevent context explosion)
    const history = await getConversationMessages(convId, agentConfig.maxConversationRounds * 2)

    // 7. Get organization chat config (system prompt + model)
    const chatConfig = await getUserChatConfig(authResult.user.id)
    const systemPrompt = chatConfig?.system_prompt || undefined
    const modelName = chatConfig?.model_name || undefined

    // 8. Extract userId for closure (TypeScript type narrowing doesn't cross async boundaries)
    const userId = authResult.user.id

    // 9. Stream response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Declare outside try block to save on abort
        let fullResponse = ''
        let aiMessage = null
        let wasAborted = false
        let currentToolCalls: any[] = [] // Track tool calls for saving

        try {
          // Send conversation event (for new conversations)
          if (!conversationId) {
            const event = `event: conversation\ndata: ${JSON.stringify({
              type: 'conversation',
              conversationId: convId,
            })}\n\n`
            controller.enqueue(encoder.encode(event))
          }

          // Stream AI response with abort handling
          try {
            for await (const delta of streamChatResponseGraph(history, attachments || [], {
              userId,
              conversationId: convId,
              modelName,
              systemPrompt,
              attachmentIds: effectiveAttachmentIds, // Use effective IDs (database + frontend)
            })) {
              // Handle different event types
              if (typeof delta === 'string') {
                // Text chunk
                fullResponse += delta

                // Send delta event
                const event = `event: delta\ndata: ${JSON.stringify({
                  type: 'delta',
                  text: delta,
                })}\n\n`

                try {
                  controller.enqueue(encoder.encode(event))
                } catch (err: any) {
                  // Controller closed (client aborted), stop streaming
                  if (err.code === 'ERR_INVALID_STATE') {
                    wasAborted = true
                    break
                  }
                  throw err
                }
              } else if (delta.type === 'tool_call') {
                // Tool call event - save immediately
                // Extract tool_calls with IDs from delta
                currentToolCalls = delta.tools.map((t: any) => ({
                  id: t.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: t.name,
                  args: t.args,
                }))

                // Save assistant message with tool_calls
                aiMessage = await createMessage(convId, 'assistant', '', undefined, {
                  tool_calls: currentToolCalls,
                })

                // Send tool_call event
                const event = `event: tool_call\ndata: ${JSON.stringify(delta)}\n\n`
                try {
                  controller.enqueue(encoder.encode(event))
                } catch (err: any) {
                  if (err.code === 'ERR_INVALID_STATE') {
                    wasAborted = true
                    break
                  }
                  throw err
                }
              } else if (delta.type === 'tool_result') {
                // Tool result event - save immediately
                await createMessage(convId, 'tool', delta.result, undefined, {
                  tool_call_id: delta.tool_call_id,
                  tool_name: delta.tool,
                })

                // Send tool_result event
                const event = `event: tool_result\ndata: ${JSON.stringify(delta)}\n\n`
                try {
                  controller.enqueue(encoder.encode(event))
                } catch (err: any) {
                  if (err.code === 'ERR_INVALID_STATE') {
                    wasAborted = true
                    break
                  }
                  throw err
                }
              }
            }
          } finally {
            // Save final assistant text response if we have accumulated text
            if (fullResponse.length > 0) {
              // If we already saved aiMessage with tool_calls, this will be a new message
              aiMessage = await createMessage(convId, 'assistant', fullResponse)
            }
          }

          // Send done event only if completed normally (not aborted)
          if (aiMessage && !wasAborted) {
            const event = `event: done\ndata: ${JSON.stringify({
              type: 'done',
              message: aiMessage,
            })}\n\n`
            controller.enqueue(encoder.encode(event))
          }

          // Close controller (may already be closed if aborted)
          try {
            controller.close()
          } catch (err: any) {
            // Ignore if already closed
            if (err.code !== 'ERR_INVALID_STATE') {
              throw err
            }
          }
        } catch (error) {
          console.error('Streaming error:', error)
          // Log full error object for debugging
          if (error && typeof error === 'object') {
            console.error('Error details:', JSON.stringify(error, null, 2))
          }

          // Extract detailed error information
          let errorMessage = 'Unknown error'
          if (error instanceof Error) {
            errorMessage = error.message
            // Include additional details for API errors
            const errorObj = error as any
            if (errorObj.status) {
              errorMessage = `${errorObj.status} ${errorMessage}`
            }
            if (errorObj.code) {
              errorMessage = `${errorMessage} (code: ${errorObj.code})`
            }
            if (errorObj.type) {
              errorMessage = `${errorMessage} [${errorObj.type}]`
            }
            // Include error.error object if present
            if (errorObj.error && typeof errorObj.error === 'object') {
              const innerError = JSON.stringify(errorObj.error)
              console.error('Inner error object:', innerError)
              errorMessage = `${errorMessage} - Details: ${innerError}`
            }
          }

          // Mark user message as having error to prevent history pollution
          try {
            await markMessageError(userMessage.id, errorMessage)
            console.log(`Marked message ${userMessage.id} as error`)
          } catch (markError) {
            console.error('Failed to mark message as error:', markError)
          }

          const event = `event: error\ndata: ${JSON.stringify({
            type: 'error',
            error: errorMessage,
          })}\n\n`
          controller.enqueue(encoder.encode(event))

          controller.close()
        }
      },
      cancel() {
        console.log('Stream cancelled by client')
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
