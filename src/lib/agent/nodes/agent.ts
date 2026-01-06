/**
 * Agent Node
 *
 * LLM inference node with tool support.
 */

import { ChatOpenAI } from '@langchain/openai'
import { AgentState } from '../state'
import { createAgentLog } from '@/lib/db/agent-queries'
import { tools, TOOL_REGISTRY } from './tools'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not configured')
}

/**
 * Tool registry for display names (exported for frontend)
 */
export { TOOL_REGISTRY }

/**
 * Agent node - invokes LLM with tool support
 */
export async function agentNode(state: AgentState): Promise<Partial<AgentState>> {
  const modelName = state.modelName || DEFAULT_MODEL

  console.log('[Agent] Starting LLM inference', {
    model: modelName,
    messageCount: state.messages.length,
  })

  // Create model with standard LangChain tool binding
  const model = new ChatOpenAI({
    modelName,
    apiKey: OPENROUTER_API_KEY,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
    },
    streaming: true,
    temperature: 0.7,
  }).bindTools(tools)

  // Prepare request payload for logging
  // Convert LangChain message types to our role names
  const requestPayload = {
    model: modelName,
    messages: state.messages.map((msg) => {
      // Map LangChain types to our role names
      let role: string
      switch (msg._getType()) {
        case 'human':
          role = 'user'
          break
        case 'ai':
          role = 'assistant'
          break
        case 'system':
          role = 'system'
          break
        case 'tool':
          role = 'tool'
          break
        default:
          role = msg._getType()
      }

      return {
        role,
        content: msg.content,
        tool_calls: (msg as any).tool_calls,
      }
    }),
    temperature: 0.7,
    streaming: true,
  }

  const startTime = Date.now()
  let status: 'success' | 'error' = 'success'
  let errorMessage: string | undefined
  let response: any

  try {
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

  // Return AI response (LangGraph will append it)
  return {
    messages: [response],
  }
}
