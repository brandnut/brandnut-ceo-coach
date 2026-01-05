/**
 * Preprocess Node
 *
 * Pre-LLM hooks: system prompt injection, request logging, etc.
 */

import { SystemMessage } from '@langchain/core/messages'
import { AgentState } from '../state'

export async function preprocessNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Preprocess] Starting preprocessing', {
    userId: state.userId,
    conversationId: state.conversationId,
    messageCount: state.messages.length,
  })

  // 1. Add request metadata
  const requestMetadata = {
    timestamp: Date.now(),
  }

  // 2. Inject system prompt with timestamp if provided
  const messages = [...state.messages]
  if (state.systemPrompt && messages.length > 0) {
    // Check if first message is already a system message
    const hasSystemMessage = messages[0]?.constructor.name === 'SystemMessage'

    if (!hasSystemMessage) {
      // Add current timestamp to system prompt
      const now = new Date()
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19)
      const promptWithTimestamp = `当前日期时间: ${timestamp}\n\n${state.systemPrompt}`

      messages.unshift(new SystemMessage(promptWithTimestamp))
      console.log('[Preprocess] Injected system prompt with timestamp:', timestamp)
    }
  }

  // 3. Future: rate limiting, input validation, etc.

  return {
    messages,
    requestMetadata,
  }
}
