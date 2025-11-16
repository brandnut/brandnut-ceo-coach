import { VisionFile } from '@/types'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  files?: VisionFile[]
}

export interface Conversation {
  id: string
  name: string
  updatedAt: number
}

export interface ConversationsResponse {
  conversations: Conversation[]
  hasMore: boolean
  limit: number
}

// Helper function to get auth headers
function getAuthHeaders(): Record<string, string> {
  const storedTokens = localStorage.getItem('auth_tokens')
  const headers: Record<string, string> = {}

  if (storedTokens) {
    try {
      const { access_token } = JSON.parse(storedTokens)
      headers['Authorization'] = `Bearer ${access_token}`
    } catch (error) {
      console.error('Error parsing tokens:', error)
    }
  }

  return headers
}

export async function uploadFile(
  file: File,
  onProgress: (percent: number) => void
): Promise<{ id: string }> {
  console.log('[uploadFile] Starting upload for:', file.name, file.size)
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.floor((e.loaded / e.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve({ id: response.id })
        } catch {
          reject(new Error('Invalid response'))
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error'))

    xhr.open('POST', '/api/files/upload')
    xhr.send(formData)
  })
}

export async function sendMessage(
  query: string,
  conversationId: string | null,
  files: VisionFile[],
  onChunk: (text: string) => void,
  onEnd: (convId: string, messageId: string) => void,
  onError: (error: string) => void,
  onWorkflowStarted?: () => void,
  onNodeStarted?: (title: string) => void
): Promise<void> {
  try {
    const response = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        query,
        conversation_id: conversationId || undefined,
        files: files.map(f => ({
          type: f.type,
          transfer_method: f.transfer_method,
          upload_file_id: f.upload_file_id,
          url: '',
        })),
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

          if (data.event === 'workflow_started') {
            console.log('[SSE] workflow_started')
            onWorkflowStarted?.()
          } else if (data.event === 'node_started') {
            console.log('[SSE] node_started:', data.data?.title)
            onNodeStarted?.(data.data?.title || '正在处理')
          } else if (data.event === 'message') {
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

export async function getConversations(
  lastId?: string,
  limit: number = 20
): Promise<ConversationsResponse> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (lastId) {
      params.append('last_id', lastId)
    }

    const response = await fetch(`/api/conversations?${params}`, {
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      return { conversations: [], hasMore: false, limit: 20 }
    }

    const data = await response.json()
    return {
      conversations: (data.data || []).map((conv: any) => ({
        id: conv.id,
        name: conv.name || 'Untitled',
        updatedAt: conv.updated_at * 1000, // Convert to milliseconds
      })),
      hasMore: data.has_more || false,
      limit: data.limit || 20,
    }
  } catch {
    return { conversations: [], hasMore: false, limit: 20 }
  }
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })

    return response.ok
  } catch {
    return false
  }
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  try {
    const response = await fetch(
      `/api/conversations/${conversationId}/messages`,
      { headers: getAuthHeaders() }
    )

    if (!response.ok) return []

    const data = await response.json()
    const messages: Message[] = []

    for (const msg of data.data || []) {
      if (msg.query) {
        const files: VisionFile[] | undefined = msg.message_files?.length > 0
          ? msg.message_files.map((f: any) => ({
              type: f.type || 'document',
              transfer_method: f.transfer_method || 'local_file',
              upload_file_id: f.id,
              url: f.url || '',
              name: f.name,
              size: f.size,
            }))
          : undefined

        messages.push({
          id: `${msg.id}-user`,
          role: 'user',
          content: msg.query,
          files,
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
