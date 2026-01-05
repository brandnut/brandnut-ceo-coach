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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authentication
    const authResult = await getCurrentUser(request)

    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    const { id: conversationId } = await params

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

    // 4. Get system prompt context (first 100 chars)
    const systemMessage = messages.find((m) => m.role === 'system')
    const systemContext = systemMessage?.content.slice(0, 100) || ''

    // 5. Build prompt with user/assistant pairs
    const conversationText = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n')

    const prompt = `你是一个对话标题生成助手。根据以下信息，生成一个准确、具体的对话标题。

${systemContext ? `助手角色：${systemContext}...\n\n` : ''}对话内容：
${conversationText}

标题要求：
- 准确概括对话的核心主题或问题
- 使用具体、有信息量的词汇，避免过于宽泛（如"讨论"、"咨询"等）
- 中文或英文均可，8-15个字为佳
- 直接描述主题，不要使用引号或标点

例如：
- 好："企业价值观落地策略"、"北京未来两周天气预警"
- 差："关于企业文化的讨论"、"天气咨询"

请以JSON格式返回：{"title": "你的标题"}`

    // 6. Call OpenRouter with structured output (using GLM for cost efficiency)
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
                  description: 'Specific and informative conversation title, 8-15 characters',
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
    const title = result.title.substring(0, 20) // Max 20 chars (8-15 preferred)

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
