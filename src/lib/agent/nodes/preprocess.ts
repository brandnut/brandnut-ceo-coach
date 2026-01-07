/**
 * Preprocess Node
 *
 * Pre-LLM hooks: system prompt injection, memory lookup, request logging, etc.
 */

import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { BaseMessage } from '@langchain/core/messages'
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

  // Extract original user message before augmentation
  let originalUserMessage: string | undefined = undefined
  if (state.messages.length > 0) {
    const lastMsg = state.messages[state.messages.length - 1]
    const content = lastMsg.content
    if (typeof content === 'string') {
      originalUserMessage = content
    }
  }

  const messages: BaseMessage[] = []

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

  // 3. Add all conversation messages EXCEPT the last user message
  // The last user message will be augmented with memory context
  const allMessagesExceptLast = state.messages.slice(0, -1)
  messages.push(...allMessagesExceptLast)

  // 4. Memory lookup (pre-LLM) - only preferences, no facts
  let memoryContext = ''
  console.log('[Preprocess] Memory lookup check:', {
    hasUserId: !!state.userId,
    hasConversationId: !!state.conversationId,
    messageCount: state.messages.length,
  })

  if (state.userId && state.conversationId && state.messages.length > 0) {
    // Get the last user message as query
    const lastMessage = state.messages[state.messages.length - 1]
    console.log('[Preprocess] Last message type:', lastMessage?._getType())

    if (lastMessage && lastMessage._getType() === 'human') {
      const query = typeof lastMessage.content === 'string' ? lastMessage.content : ''
      console.log('[Preprocess] Query length:', query?.length)

      if (query) {
        console.log('[Preprocess] Calling searchMemory...')
        const memoryData = await searchMemory(state.userId, state.conversationId, query)
        console.log('[Preprocess] Memory data received:', {
          hasData: !!memoryData,
          preferencesCount: memoryData?.preference_detail_list?.length || 0,
          memoriesCount: memoryData?.memory_detail_list?.length || 0,
        })

        if (memoryData) {
          memoryContext = formatMemoryContext(memoryData)

          if (memoryContext) {
            // Insert memory context directly into the HumanMessage content
            const augmentedContent = `${memoryContext}\n---\n\n${query}`
            messages.push(new HumanMessage(augmentedContent))

            console.log('[Preprocess] Injected memory context (preferences only):', {
              preferences: memoryData.preference_detail_list.length,
            })
          } else {
            // No memory context, add original human message
            messages.push(lastMessage)
          }
        } else {
          // No memory data, add original human message
          messages.push(lastMessage)
        }
      } else {
        // Empty query, add original human message
        messages.push(lastMessage)
      }
    } else if (lastMessage) {
      // Not a HumanMessage (e.g., AIMessage), add as-is
      messages.push(lastMessage)
    }
  } else {
    // No userId/conversationId, just add the last message as-is
    const lastMessage = state.messages[state.messages.length - 1]
    if (lastMessage) {
      messages.push(lastMessage)
    }
  }

  // 5. Return new messages (system prompt + history + augmented last message)
  return {
    messages,
    requestMetadata: {
      ...requestMetadata,
      memoryContext,
    },
    originalUserMessage,
  }
}
