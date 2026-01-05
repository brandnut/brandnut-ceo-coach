/**
 * Preprocess Node
 *
 * Pre-LLM hooks: system prompt injection, memory lookup, request logging, etc.
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { AgentState } from '../state'
import { searchMemory, formatMemoryContext } from '@/lib/memory/client'

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

  // 3. Memory lookup (pre-LLM) - inject into HumanMessage
  let memoryContext = ''
  if (state.userId && state.conversationId) {
    // Get the last user message as query
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.constructor.name === 'HumanMessage') {
      const query = typeof lastMessage.content === 'string' ? lastMessage.content : ''

      if (query) {
        const memoryData = await searchMemory(state.userId, state.conversationId, query)

        if (memoryData) {
          memoryContext = formatMemoryContext(memoryData)

          if (memoryContext) {
            // Insert memory context directly into the HumanMessage content
            const augmentedContent = `${memoryContext}\n---\n\n${query}`
            messages[messages.length - 1] = new HumanMessage(augmentedContent)

            console.log('[Preprocess] Injected memory context into HumanMessage:', {
              memories: memoryData.memory_detail_list.length,
              preferences: memoryData.preference_detail_list.length,
            })
          }
        }
      }
    }
  }

  // 4. Future: rate limiting, input validation, etc.

  return {
    messages,
    requestMetadata: {
      ...requestMetadata,
      memoryContext, // Store for logging purposes
    },
  }
}
