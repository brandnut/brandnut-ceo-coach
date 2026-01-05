/**
 * Agent Chat Service
 *
 * Simple LLM integration with OpenRouter + Claude 4.5 Sonnet.
 * No LangGraph complexity for first version - direct ChatOpenAI call.
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
import { Message, Attachment } from '@/types/agent'

// OpenRouter configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not configured')
}

/**
 * Initialize ChatOpenAI with OpenRouter endpoint
 * Supports organization-specific model configuration
 */
function createChatModel(modelName?: string) {
  return new ChatOpenAI({
    modelName: modelName || DEFAULT_MODEL,
    apiKey: OPENROUTER_API_KEY,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
    },
    streaming: true,
    temperature: 0.7,
  })
}

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
 *
 * All messages carry their attachments (images/PDFs from DB).
 * The last user message also gets new attachments from the current request.
 *
 * Optionally injects a system message at the beginning.
 */
export function convertToLangChainMessages(
  messages: Message[],
  newAttachments?: Attachment[],
  systemPrompt?: string
): BaseMessage[] {
  const langchainMessages: BaseMessage[] = []

  // Inject system message if provided
  if (systemPrompt) {
    langchainMessages.push(new SystemMessage(systemPrompt))
  }

  // Convert user/assistant messages
  const convertedMessages = messages.map((msg, idx) => {
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
      return new AIMessage(msg.content)
    } else {
      // system messages from DB
      return new SystemMessage(msg.content)
    }
  })

  return [...langchainMessages, ...convertedMessages]
}

/**
 * Stream chat response using OpenRouter + Claude
 *
 * Yields text chunks as they arrive.
 * Supports organization-specific model and system prompt.
 */
export async function* streamChatResponse(
  messages: Message[],
  newAttachments?: Attachment[],
  options?: {
    modelName?: string
    systemPrompt?: string
  }
): AsyncGenerator<string, void, unknown> {
  const model = createChatModel(options?.modelName)

  // Convert to LangChain format with optional system prompt
  const langchainMessages = convertToLangChainMessages(
    messages,
    newAttachments,
    options?.systemPrompt
  )

  // Stream response
  const stream = await model.stream(langchainMessages)

  for await (const chunk of stream) {
    if (chunk.content && typeof chunk.content === 'string') {
      yield chunk.content
    }
  }
}

/**
 * Get non-streaming response (for testing or non-SSE scenarios)
 */
export async function getChatResponse(
  messages: Message[],
  newAttachments?: Attachment[],
  options?: {
    modelName?: string
    systemPrompt?: string
  }
): Promise<string> {
  const model = createChatModel(options?.modelName)

  const langchainMessages = convertToLangChainMessages(
    messages,
    newAttachments,
    options?.systemPrompt
  )

  const response = await model.invoke(langchainMessages)

  return response.content as string
}
