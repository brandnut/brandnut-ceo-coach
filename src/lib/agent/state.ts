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
  // Request metadata
  requestMetadata?: {
    timestamp: number
    ip?: string
    memoryContext?: string // Memory lookup result for logging
  }
}

export const agentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  userId: Annotation<string>(),
  conversationId: Annotation<string>(),
  systemPrompt: Annotation<string | undefined>(),
  modelName: Annotation<string | undefined>(),
  requestMetadata: Annotation<{ timestamp: number; ip?: string; memoryContext?: string } | undefined>(),
})
