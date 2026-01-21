import { Annotation } from '@langchain/langgraph'
import { BaseMessage } from '@langchain/core/messages'

/**
 * Agent State
 *
 * Holds conversation messages and metadata for the graph execution.
 */
export interface AgentState {
  messages: BaseMessage[]
  // User and conversation context
  userId: string
  conversationId: string
  // Organization config
  systemPrompt?: string
  modelName?: string
  // File attachments (text document IDs for RAG)
  attachmentIds?: string[]
  // Request metadata
  requestMetadata?: {
    timestamp: number
    ip?: string
    memoryContext?: string // Memory lookup result for logging
    ragContext?: string // RAG retrieval result for logging
  }
  // Original user message (before memory augmentation)
  originalUserMessage?: string
  // Tool call tracking (for preventing infinite loops)
  toolCallCounts?: Record<string, number>
}

export const agentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    // Special reducer: replace if new messages start with system message (from preprocess), otherwise append
    reducer: (x, y) => {
      if (y.length > 0 && y[0]._getType() === 'system') {
        return y // Replace (preprocess is setting up initial messages)
      }
      return x.concat(y) // Append (agent and tools adding new messages)
    },
    default: () => [],
  }),
  userId: Annotation<string>(),
  conversationId: Annotation<string>(),
  systemPrompt: Annotation<string | undefined>(),
  modelName: Annotation<string | undefined>(),
  attachmentIds: Annotation<string[] | undefined>(),
  requestMetadata: Annotation<{ timestamp: number; ip?: string; memoryContext?: string; ragContext?: string } | undefined>(),
  originalUserMessage: Annotation<string | undefined>(),
  toolCallCounts: Annotation<Record<string, number> | undefined>(),
})
