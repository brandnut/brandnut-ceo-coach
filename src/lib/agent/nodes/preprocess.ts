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

  // Only process on first call (when messages don't start with system message)
  // Skip on subsequent calls in tool loops
  const firstMsgType = state.messages[0]?._getType()
  if (firstMsgType === 'system') {
    console.log('[Preprocess] Skipping (already processed)')
    return {}
  }

  const messages: Array<SystemMessage | HumanMessage> = []

  // 2. Inject system prompt with timestamp if provided
  if (state.systemPrompt) {
    // Add current timestamp to system prompt (using local timezone)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')

    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    const promptWithTimestamp = `当前日期时间: ${timestamp}\n\n${state.systemPrompt}`

    messages.push(new SystemMessage(promptWithTimestamp))
    console.log('[Preprocess] Injected system prompt with timestamp:', timestamp)
  }

  // 3. Memory lookup (pre-LLM) - inject into HumanMessage
  let memoryContext = ''
  if (state.userId && state.conversationId && state.messages.length > 0) {
    // Get the last user message as query
    const lastMessage = state.messages[state.messages.length - 1]
    if (lastMessage && lastMessage.constructor.name === 'HumanMessage') {
      const query = typeof lastMessage.content === 'string' ? lastMessage.content : ''

      if (query) {
        const memoryData = await searchMemory(state.userId, state.conversationId, query)

        if (memoryData) {
          memoryContext = formatMemoryContext(memoryData)

          if (memoryContext) {
            // Insert memory context directly into the HumanMessage content
            const augmentedContent = `${memoryContext}\n---\n\n ${query}`
            messages.push(new HumanMessage(augmentedContent))

            console.log('[Preprocess] Injected memory context into HumanMessage:', {
              memories: memoryData.memory_detail_list.length,
              preferences: memoryData.preference_detail_list.length,
            })
          } else {
            // No memory context, add original human message
            messages.push(lastMessage as HumanMessage)
          }
        } else {
          // No memory data, add original human message
          messages.push(lastMessage as HumanMessage)
        }
      } else {
        // Empty query, add original human message
        messages.push(lastMessage as HumanMessage)
      }
    }
  }

  // 4. Return new messages (will replace original messages)
  return {
    messages,
    requestMetadata: {
      ...requestMetadata,
      memoryContext,
    },
  }
}
