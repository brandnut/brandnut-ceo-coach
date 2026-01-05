/**
 * OpenMem Memory Service Client
 *
 * Retrieves user's long-term memory and preferences from memos.memtensor.cn
 */

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
    const response = await fetch(MEMOS_API_URL, {
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

  // Add preference note if available
  if (data.preference_note) {
    parts.push(`偏好使用说明：${data.preference_note}`)
  }

  return parts.join('\n\n')
}
