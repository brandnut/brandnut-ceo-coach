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
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  attachments: Attachment[]

  // Phase 2: Tool support
  tool_calls?: Array<{
    id: string
    name: string
    display_name?: string // Chinese name for frontend display
    args: Record<string, any>
  }>
  tool_call_id?: string
  tool_name?: string
  tool_display_name?: string // Chinese name for tool (when role=tool)

  createdAt: string // ISO timestamp
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

export interface SSEToolCallEvent {
  type: 'tool_call'
  message: string
  tools: Array<{
    id: string
    name: string
    display_name: string
    args: Record<string, any>
  }>
}

export interface SSEToolResultEvent {
  type: 'tool_result'
  tool: string
  tool_display_name: string
  args?: Record<string, any>
  result: string
  tool_call_id: string
}

export type SSEEvent =
  | SSEConversationEvent
  | SSEDeltaEvent
  | SSEToolCallEvent
  | SSEToolResultEvent
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
