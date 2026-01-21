/**
 * Agent Chat Service
 *
 * Phase 1: LangGraph-based agent with 3-node graph
 * (preprocess → agent → postprocess)
 */

import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
import { Message, Attachment } from '@/types/agent'
import { createAgentGraph } from './graph'
import { streamAgentResponse } from './stream'
import { AgentState } from './state'

/**
 * Convert attachments to LangChain content format
 * Images: image_url type
 * PDFs: file type (OpenRouter native format)
 */
function convertAttachmentsToContent(attachments: Attachment[]) {
  const content: any[] = []

  // Handle images
  const images = attachments.filter((a) => a.type === 'image')
  images.forEach((img) => {
    content.push({
      type: 'image_url' as const,
      image_url: { url: img.url },
    })
  })

  // Handle PDFs
  const pdfs = attachments.filter((a) => a.type === 'pdf')
  pdfs.forEach((pdf) => {
    content.push({
      type: 'file' as const,
      file: {
        filename: pdf.name,
        file_data: pdf.url,
      },
    })
  })

  return content
}

/**
 * Convert messages to LangChain format with multimodal support
 * Phase 2: Supports tool messages
 */
export function convertToLangChainMessages(
  messages: Message[],
  newAttachments?: Attachment[]
): BaseMessage[] {
  const convertedMessages = messages
    .filter((msg) => {
      // Remove tool messages (they're after the current conversation)
      if (msg.role === 'tool') return false

      // Remove assistant messages with tool_calls (historical tool intermediate steps)
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        return false
      }

      return true
    })
    .map((msg, idx) => {
      const isLastUserMessage = idx === messages.length - 1 && msg.role === 'user'

      // Use stored attachments from DB for all messages
      // Plus new attachments for the last user message
      const attachments = isLastUserMessage
        ? [...(msg.attachments || []), ...(newAttachments || [])]
        : msg.attachments

      // Handle user messages
      if (msg.role === 'user') {
        // Priority 1: Use injected_content (document text already merged)
        if (msg.injected_content) {
          return new HumanMessage(msg.injected_content)
        }

        // Priority 2: Handle multimodal attachments (images, PDFs)
        if (attachments && attachments.length > 0) {
          const imageContent = convertAttachmentsToContent(attachments)

          if (imageContent.length > 0) {
            return new HumanMessage({
              content: [
                { type: 'text', text: msg.content },
                ...imageContent,
              ],
            })
          }
        }

        // Priority 3: Plain text message
        return new HumanMessage(msg.content)
      }

      // Handle assistant messages (only those without tool_calls remain after filter)
      if (msg.role === 'assistant') {
        return new AIMessage(msg.content)
      }

      // Handle system messages
      return new SystemMessage(msg.content)
    })

  return convertedMessages
}

/**
 * Stream chat response using LangGraph
 *
 * Yields text chunks and tool events as they arrive from graph execution.
 * Phase 2: Supports tool thinking and results.
 */
export async function* streamChatResponseGraph(
  messages: Message[],
  newAttachments: Attachment[],
  options: {
    userId: string
    conversationId: string
    modelName?: string
    systemPrompt?: string
    attachmentIds?: string[]
  }
): AsyncGenerator<string | Record<string, any>, void, unknown> {
  // Convert to LangChain format
  const langchainMessages = convertToLangChainMessages(messages, newAttachments)

  // Create initial state
  const initialState: AgentState = {
    messages: langchainMessages,
    userId: options.userId,
    conversationId: options.conversationId,
    systemPrompt: options.systemPrompt,
    modelName: options.modelName,
    attachmentIds: options.attachmentIds,
  }

  console.log('[Chat Service] Initial state:', {
    userId: options.userId,
    conversationId: options.conversationId,
    attachmentIds: options.attachmentIds,
    attachmentIdsType: typeof options.attachmentIds,
    attachmentIdsLength: options.attachmentIds?.length
  })

  // Create and run graph
  const graph = createAgentGraph()

  // @ts-expect-error - LangGraph type compatibility issue with CompiledStateGraph generics
  for await (const event of streamAgentResponse(graph, initialState)) {
    if (event.type === 'text') {
      // Yield text chunks as strings (for backward compatibility)
      yield event.content
    } else {
      // Yield tool events as objects
      yield event
    }
  }
}
