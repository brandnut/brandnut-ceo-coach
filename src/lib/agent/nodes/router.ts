/**
 * Router Node
 *
 * Decides whether to continue to tools or end execution.
 * This is the core of the ReAct pattern.
 */

import { AIMessage } from '@langchain/core/messages'
import { AgentState } from '../state'

/**
 * Routing decision: continue to tools or end?
 */
export function shouldContinue(state: AgentState): 'continue' | 'end' {
  const messages = state.messages
  if (messages.length === 0) {
    return 'end'
  }

  const lastMessage = messages[messages.length - 1]

  // Check if last message is AI message with tool calls
  if (lastMessage._getType() === 'ai') {
    const aiMessage = lastMessage as AIMessage
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      console.log('[Router] Agent called tools, continuing...', {
        toolCount: aiMessage.tool_calls.length,
        tools: aiMessage.tool_calls.map((t) => t.name),
      })
      return 'continue' // → go to tools node
    }
  }

  console.log('[Router] No tool calls, ending...')
  return 'end' // → go to postprocess
}
