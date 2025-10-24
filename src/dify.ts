const API_URL = 'https://api.dify.ai/v1'
const API_KEY = 'app-cm3DGPtKu82A15UJBULqah2u'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  files?: string[]
}

export interface Conversation {
  id: string
  name: string
  updatedAt: number
}

export async function sendMessage(
  query: string,
  userId: string,
  conversationId: string | null,
  onChunk: (text: string) => void,
  onEnd: (convId: string, messageId: string) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query,
        user: userId,
        response_mode: 'streaming',
        conversation_id: conversationId || undefined,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader')

    const decoder = new TextDecoder()
    let buffer = ''
    let currentConvId = conversationId || ''
    let currentMsgId = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        try {
          const data = JSON.parse(line.slice(6))

          if (data.event === 'message') {
            console.log('[SSE] message chunk:', data.answer?.slice(0, 50))
            onChunk(data.answer)
            currentConvId = data.conversation_id
            currentMsgId = data.message_id
          } else if (data.event === 'message_end') {
            console.log('[SSE] message_end')
            onEnd(currentConvId, currentMsgId)
          } else if (data.event === 'error') {
            console.log('[SSE] error:', data.message)
            onError(data.message || 'Unknown error')
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Network error')
  }
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  try {
    const response = await fetch(`${API_URL}/conversations?user=${userId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    })

    if (!response.ok) return []

    const data = await response.json()
    return (data.data || []).map((conv: any) => ({
      id: conv.id,
      name: conv.name || 'Untitled',
      updatedAt: new Date(conv.updated_at).getTime(),
    }))
  } catch {
    return []
  }
}

export async function getMessages(conversationId: string, userId: string): Promise<Message[]> {
  try {
    const response = await fetch(
      `${API_URL}/messages?conversation_id=${conversationId}&user=${userId}&limit=100`,
      { headers: { 'Authorization': `Bearer ${API_KEY}` } }
    )

    if (!response.ok) return []

    const data = await response.json()
    const messages: Message[] = []

    // Dify returns messages in reverse order (newest first), so reverse it
    const messagesData = (data.data || []).reverse()

    for (const msg of messagesData) {
      if (msg.query) {
        messages.push({
          id: `${msg.id}-user`,
          role: 'user',
          content: msg.query,
        })
      }
      if (msg.answer) {
        messages.push({
          id: msg.id,
          role: 'assistant',
          content: msg.answer,
        })
      }
    }

    return messages
  } catch {
    return []
  }
}
