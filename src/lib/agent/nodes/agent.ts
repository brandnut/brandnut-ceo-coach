/**
 * Agent Node
 *
 * LLM inference node with tool support.
 */

import { ChatOpenAI } from '@langchain/openai'
import { AgentState } from '../state'
import { createAgentLog } from '@/lib/db/agent-queries'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not configured')
}

/**
 * Tool definitions for LLM
 */
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'bocha_search',
      display_name: '网页搜索', // Chinese name for frontend display
      description:
        '从博查搜索网页信息和网页链接。搜索结果准确、完整，适合查询实时信息、新闻、资料等。' +
        '使用场景: 当用户询问需要实时信息、最新数据、新闻、公开资料时使用。' +
        '\n\n重要提示：' +
        '\n- 根据查询需求设置 freshness 参数（oneDay/oneWeek/oneMonth/oneYear）来限制搜索时间范围' +
        '\n- 根据需要的结果数量设置 count 参数（默认10条，最多50条）',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键字或语句，例如 "阿里巴巴2024年ESG报告"',
          },
          summary: {
            type: 'boolean',
            description: '是否在搜索结果中包含摘要，默认 true',
            default: true,
          },
          freshness: {
            type: 'string',
            description:
              '搜索指定时间范围内的网页。建议根据用户问题选择合适的时间范围：' +
              '\n- oneDay: 最近一天（适合突发新闻、当日信息）' +
              '\n- oneWeek: 最近一周（适合近期动态、周报）' +
              '\n- oneMonth: 最近一月（适合月度报告、近期趋势）' +
              '\n- oneYear: 最近一年（适合年度报告、长期趋势）' +
              '\n- noLimit: 不限时间（默认值，适合历史资料、常识性查询）',
            enum: ['noLimit', 'oneDay', 'oneWeek', 'oneMonth', 'oneYear'],
            default: 'noLimit',
          },
          count: {
            type: 'integer',
            description:
              '返回的搜索结果数量 (1-50)，默认 10。' +
              '建议根据查询复杂度调整：简单查询用5-10条，复杂查询用15-30条',
            default: 10,
            minimum: 1,
            maximum: 50,
          },
        },
        required: ['query'],
      },
    },
  },
]

/**
 * Tool registry for display names
 */
export const TOOL_REGISTRY: Record<string, { display_name: string }> = {
  bocha_search: { display_name: '网页搜索' },
}

/**
 * Agent node - invokes LLM with tool support
 */
export async function agentNode(state: AgentState): Promise<Partial<AgentState>> {
  const modelName = state.modelName || DEFAULT_MODEL

  console.log('[Agent] Starting LLM inference', {
    model: modelName,
    messageCount: state.messages.length,
  })

  // Prepare request payload for logging
  const requestPayload = {
    model: modelName,
    messages: state.messages.map((msg) => ({
      role: msg._getType(),
      content: msg.content,
      tool_calls: (msg as any).tool_calls,
    })),
    tools,
    temperature: 0.7,
    streaming: true,
  }

  const startTime = Date.now()
  let status: 'success' | 'error' = 'success'
  let errorMessage: string | undefined
  let response: any

  try {
    // Create model with tool support (via modelKwargs for OpenRouter)
    const model = new ChatOpenAI({
      modelName,
      apiKey: OPENROUTER_API_KEY,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      streaming: true,
      temperature: 0.7,
      modelKwargs: {
        tools, // ← Pass tools via modelKwargs for OpenRouter
        usage: { include: true }, // ← Enable usage metadata including cost
      },
    })

    // Invoke LLM
    response = await model.invoke(state.messages)

    console.log('[Agent] LLM response received', {
      contentLength: typeof response.content === 'string' ? response.content.length : 0,
      hasToolCalls: response.tool_calls && response.tool_calls.length > 0,
      toolCallCount: response.tool_calls?.length || 0,
    })
  } catch (error) {
    status = 'error'
    errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Agent] LLM call failed:', errorMessage)
    throw error
  } finally {
    const durationMs = Date.now() - startTime

    // Save log to database (non-blocking)
    createAgentLog({
      userId: state.userId,
      conversationId: state.conversationId,
      modelName,
      request: requestPayload,
      response: response || { error: errorMessage },
      durationMs,
      status,
      errorMessage,
    }).catch((err) => {
      console.error('[Agent] Failed to save log:', err)
    })
  }

  // Append AI response to messages
  return {
    messages: [...state.messages, response],
  }
}
