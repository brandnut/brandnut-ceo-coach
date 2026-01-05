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
import { streamChatResponseGraph } from '@/lib/agent/chat'
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
    const userMessage = await createMessage(convId, 'user', message, attachments)

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
            for await (const delta of streamChatResponseGraph(history, attachments, {
              userId: authResult.user.id,
              conversationId: convId,
              modelName,
              systemPrompt,
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
