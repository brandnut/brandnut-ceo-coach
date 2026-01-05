/**
 * Postprocess Node
 *
 * Post-LLM hooks: save conversation to memory
 */

import { AIMessage } from '@langchain/core/messages'
import { AgentState } from '../state'
import { addMessage } from '@/lib/memory/client'

export async function postprocessNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Postprocess] Saving conversation to memory')

  // Extract original user message (saved in preprocess)
  const userMessage = state.originalUserMessage || ''

  // Extract assistant response (last AI message)
  const lastMessage = state.messages[state.messages.length - 1]
  if (!lastMessage || lastMessage._getType() !== 'ai') {
    console.warn('[Postprocess] Last message is not AI message, skipping save')
    return {}
  }

  const aiMessage = lastMessage as AIMessage

  // Skip if AI message has tool calls (shouldn't happen, but safety check)
  if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
    console.warn('[Postprocess] AI message has tool calls, skipping save')
    return {}
  }

  const assistantMessage = typeof aiMessage.content === 'string'
    ? aiMessage.content
    : ''

  if (!userMessage || !assistantMessage) {
    console.warn('[Postprocess] Missing user or assistant message, skipping save')
    return {}
  }

  // Save to Memtensor (fire and forget, don't block flow)
  addMessage(state.userId, state.conversationId, userMessage, assistantMessage)
    .then((success) => {
      if (success) {
        console.log('[Postprocess] Conversation saved to memory')
      } else {
        console.warn('[Postprocess] Failed to save conversation to memory')
      }
    })
    .catch((error) => {
      console.error('[Postprocess] Error saving conversation:', error)
    })

  // No state changes needed
  return {}
}
