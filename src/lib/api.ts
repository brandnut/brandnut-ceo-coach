import { VisionFile } from '@/types'
import { storage, storageKeys } from '@/lib/storage'
import { getApiUrl, getAuthHeaders } from '@/lib/utils'

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

    xhr.open('POST', getApiUrl('/api/files/upload'))

    // Add Authorization header
    const authHeaders = getAuthHeaders(storage, storageKeys)
    Object.entries(authHeaders).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.send(formData)
  })
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

    const response = await fetch(getApiUrl(`/api/conversations?${params}`), {
      headers: getAuthHeaders(storage, storageKeys)
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
    const response = await fetch(getApiUrl(`/api/conversations/${conversationId}`), {
      method: 'DELETE',
      headers: getAuthHeaders(storage, storageKeys),
    })

    return response.ok
  } catch {
    return false
  }
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  try {
    const response = await fetch(
      getApiUrl(`/api/conversations/${conversationId}/messages`),
      { headers: getAuthHeaders(storage, storageKeys) }
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

