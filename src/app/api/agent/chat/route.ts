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
} from '@/lib/db/agent-queries'
import { getUserChatConfig } from '@/lib/db/queries'
import { streamChatResponse } from '@/lib/agent/chat'
import { ChatRequest } from '@/types/agent'

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await getCurrentUser(request)

    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    // 2. Parse request
    const body: ChatRequest = await request.json()
    const { message, conversationId, attachments } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'message is required' },
        { status: 400 }
      )
    }

    // 3. Get or create conversation
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

    // 4. Save user message immediately (eliminates consistency issues)
    await createMessage(convId, 'user', message, attachments)

    // 5. Load conversation history
    const history = await getConversationMessages(convId)

    // 6. Get organization chat config (system prompt + model)
    const chatConfig = await getUserChatConfig(authResult.user.id)
    const systemPrompt = chatConfig?.system_prompt || undefined
    const modelName = chatConfig?.model_name || undefined

    // 7. Stream response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Declare outside try block to save on abort
        let fullResponse = ''
        let aiMessage = null
        let wasAborted = false

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
            for await (const delta of streamChatResponse(history, attachments, {
              modelName,
              systemPrompt,
            })) {
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
            }
          } finally {
            // Save whatever was accumulated, even on abort
            // This ensures partial responses are persisted
            if (fullResponse.length > 0 && !aiMessage) {
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

          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
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
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
