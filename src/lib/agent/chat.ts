/**
 * Agent Chat Service
 *
 * Phase 1: LangGraph-based agent with 3-node graph
 * (preprocess → agent → postprocess)
 */

import { HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage } from '@langchain/core/messages'
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
  // Filter out tool messages - they should not be sent to LLM
  // Tool results are already incorporated in assistant responses
  const convertedMessages = messages
    .filter((msg) => msg.role !== 'tool')
    .map((msg, idx) => {
      const isLastUserMessage = idx === messages.length - 1 && msg.role === 'user'

      // Use stored attachments from DB for all messages
      // Plus new attachments for the last user message
      const attachments = isLastUserMessage
        ? [...(msg.attachments || []), ...(newAttachments || [])]
        : msg.attachments

      // Handle multimodal messages
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

      // Handle text-only messages
      if (msg.role === 'user') {
        return new HumanMessage(msg.content)
      } else if (msg.role === 'assistant') {
        // Check if this message has tool_calls
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          return new AIMessage({
            content: msg.content || '',
            tool_calls: msg.tool_calls,
          })
        } else {
          return new AIMessage(msg.content)
        }
      } else {
        // system messages from DB
        return new SystemMessage(msg.content)
      }
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
  newAttachments?: Attachment[],
  options: {
    userId: string
    conversationId: string
    modelName?: string
    systemPrompt?: string
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
  }

  // Create and run graph
  const graph = createAgentGraph()

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
