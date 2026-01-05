/**
 * Generate Title API - POST /api/agent/conversations/[id]/generate-title
 *
 * Automatically generates a concise title (<10 chars) for a conversation
 * using OpenRouter structured output based on the conversation's messages.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import {
  getConversation,
  getConversationMessages,
  updateConversationTitle,
} from '@/lib/db/agent-queries'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage } from '@langchain/core/messages'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not configured')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const authResult = await getCurrentUser(request)

    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    const conversationId = params.id

    // 2. Verify conversation exists and belongs to user
    const conversation = await getConversation(conversationId, authResult.user.id)

    if (!conversation) {
      return NextResponse.json(
        { error: 'Not found', message: 'Conversation not found' },
        { status: 404 }
      )
    }

    // 3. Skip if conversation already has a title
    if (conversation.title) {
      return NextResponse.json({
        success: true,
        title: conversation.title,
        skipped: true,
      })
    }

    // 4. Get conversation messages (first 6 messages, ~3 turns, enough for title)
    const messages = await getConversationMessages(conversationId, 6)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages', message: 'Conversation has no messages' },
        { status: 400 }
      )
    }

    // 4. Build prompt with user/assistant pairs
    const conversationText = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n')

    const prompt = `根据以下对话内容，生成一个简洁的标题。要求：
- 中文或英文均可
- 少于10个字
- 准确概括对话主题
- 不要使用引号

对话内容：
${conversationText}

请以JSON格式返回：{"title": "你的标题"}`

    // 5. Call OpenRouter with structured output (using GLM for cost efficiency)
    const model = new ChatOpenAI({
      modelName: 'z-ai/glm-4.5-air',
      apiKey: OPENROUTER_API_KEY,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      temperature: 0.7,
      modelKwargs: {
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'conversation_title',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Concise conversation title, less than 10 characters',
                },
              },
              required: ['title'],
              additionalProperties: false,
            },
          },
        },
      },
    })

    const response = await model.invoke([new HumanMessage(prompt)])

    // 6. Parse response
    const result = JSON.parse(response.content as string)
    const title = result.title.substring(0, 10) // Enforce max length

    // 7. Update conversation title
    await updateConversationTitle(conversationId, title)

    return NextResponse.json({
      success: true,
      title,
    })
  } catch (error) {
    console.error('Generate title error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate title',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
