/**
 * Agent Chat System Types
 *
 * Key principle: SSE events and chat history UI must be consistent.
 * The message structure during streaming and after refresh should be identical.
 */

export interface Attachment {
  type: 'image' | 'pdf' | 'document'
  url: string
  mimeType: string
  name: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments: Attachment[]
  createdAt: string  // ISO timestamp
}

export interface Conversation {
  id: string
  userId: string
  title: string | null
  createdAt: string  // ISO timestamp
  updatedAt: string  // ISO timestamp
}

/**
 * SSE Event Types
 * These events are sent during streaming and must match the structure
 * of messages returned from the history API.
 */
export interface SSEConversationEvent {
  type: 'conversation'
  conversationId: string
}

export interface SSEDeltaEvent {
  type: 'delta'
  text: string
}

export interface SSEDoneEvent {
  type: 'done'
  message: Message  // Complete message matching history format
}

export interface SSEErrorEvent {
  type: 'error'
  error: string
}

export type SSEEvent =
  | SSEConversationEvent
  | SSEDeltaEvent
  | SSEDoneEvent
  | SSEErrorEvent

/**
 * API Request/Response Types
 */
export interface ChatRequest {
  message: string
  conversationId?: string
  attachments?: Attachment[]
}

export interface ConversationListResponse {
  conversations: Conversation[]
  total: number
}

export interface MessageHistoryResponse {
  messages: Message[]
  conversation: Conversation
}
