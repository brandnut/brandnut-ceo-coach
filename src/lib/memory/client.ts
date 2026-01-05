/**
 * OpenMem Memory Service Client
 *
 * Retrieves user's long-term memory and preferences from memos.memtensor.cn
 */

import { loggedFetch } from '@/lib/http/logged-client'

const MEMOS_API_KEY = process.env.MEMOS_API_KEY
const MEMOS_API_URL = 'https://memos.memtensor.cn/api/openmem/v1/search/memory'

export interface MemoryDetail {
  id: string
  memory_key: string
  memory_value: string
  memory_type: 'LongTermMemory'
  create_time: string
  conversation_id: string
  status: 'activated'
  confidence: number
  tags: string[]
  update_time: string
  relativity: number
}

export interface PreferenceDetail {
  id: string
  preference_type: 'explicit_preference'
  preference: string
  reasoning: string
  create_time: string
  conversation_id: string
  status: 'activated'
  update_time: string
}

export interface MemorySearchResponse {
  code: number
  data: {
    memory_detail_list: MemoryDetail[]
    preference_detail_list: PreferenceDetail[]
    preference_note: string
  }
  message: string
}

/**
 * Search user's memory based on current query
 */
export async function searchMemory(
  userId: string,
  conversationId: string,
  query: string
): Promise<MemorySearchResponse['data'] | null> {
  if (!MEMOS_API_KEY) {
    console.warn('MEMOS_API_KEY not configured, skipping memory lookup')
    return null
  }

  try {
    const response = await loggedFetch(MEMOS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${MEMOS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        conversation_id: conversationId,
        query,
      }),
      logContext: {
        userId,
        conversationId,
        requestType: 'memory_search',
      },
    })

    if (!response.ok) {
      console.error('Memory search failed:', response.status, response.statusText)
      return null
    }

    const result: MemorySearchResponse = await response.json()

    if (result.code !== 0) {
      console.error('Memory search error:', result.message)
      return null
    }

    return result.data
  } catch (error) {
    console.error('Memory search exception:', error)
    return null
  }
}

/**
 * Save conversation to Memtensor
 */
export async function addMessage(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string
): Promise<boolean> {
  if (!MEMOS_API_KEY) {
    console.warn('[Memory] MEMOS_API_KEY not configured, skipping save')
    return false
  }

  try {
    const response = await loggedFetch('https://memos.memtensor.cn/api/openmem/v1/add/message', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${MEMOS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        conversation_id: conversationId,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantMessage },
        ],
      }),
      logContext: {
        userId,
        conversationId,
        requestType: 'memory_add',
      },
    })

    if (!response.ok) {
      console.error('[Memory] Add message failed:', response.status, response.statusText)
      return false
    }

    const result = await response.json()
    console.log('[Memory] Conversation saved:', result)
    return true
  } catch (error) {
    console.error('[Memory] Add message exception:', error)
    return false
  }
}

/**
 * Format memory data into a prompt context string
 */
export function formatMemoryContext(data: MemorySearchResponse['data']): string {
  const parts: string[] = []

  // Format long-term memories
  if (data.memory_detail_list.length > 0) {
    const memories = data.memory_detail_list
      .map((m) => `- ${m.memory_key}: ${m.memory_value}`)
      .join('\n')
    parts.push(`用户的事实记忆：\n${memories}`)
  }

  // Format preferences
  if (data.preference_detail_list.length > 0) {
    const preferences = data.preference_detail_list
      .map((p) => `- ${p.preference} (${p.reasoning})`)
      .join('\n')
    parts.push(`用户的偏好记忆：\n${preferences}`)
  }

  return parts.join('\n\n')
}
