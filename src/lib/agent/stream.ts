/**
 * Streaming Helper for LangGraph
 *
 * Simplified implementation using streamEvents.
 */

import { CompiledStateGraph } from '@langchain/langgraph'
import { AgentState } from './state'
import { TOOL_REGISTRY } from './nodes/tools'

/**
 * Stream event types (can be text or tool events)
 */
export type StreamEvent =
  | { type: 'text'; content: string }
  | {
      type: 'tool_call'
      tools: Array<{ id: string; name: string; display_name: string; args: any }>
    }
  | {
      type: 'tool_result'
      tool: string
      tool_display_name: string
      tool_call_id: string
      result: string
    }

/**
 * Stream agent response as text chunks and tool events
 */
export async function* streamAgentResponse(
  graph: CompiledStateGraph<AgentState, any>,
  initialState: AgentState
): AsyncGenerator<StreamEvent, void, unknown> {
  console.log('[Stream] Starting graph execution')

  // @ts-expect-error - LangGraph type compatibility issue
  const stream = graph.streamEvents(initialState, {
    version: 'v2',
  })

  const yieldedToolResults = new Set<string>()
  let hasYielded = false

  for await (const event of stream) {
    // Agent tool calls
    if (event.event === 'on_chat_model_end') {
      const message = event.data?.output
      if (message?.tool_calls && message.tool_calls.length > 0) {
        hasYielded = true
        yield {
          type: 'tool_call',
          tools: message.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.name,
            display_name: TOOL_REGISTRY[tc.name]?.display_name || tc.name,
            args: tc.args,
          })),
        }
      }
    }

    // Tool execution results
    if (event.event === 'on_chain_end') {
      const metadata = event.metadata
      if (metadata?.langgraph_node === 'tools') {
        const output = event.data?.output
        if (output?.messages) {
          const toolMessages = output.messages.filter(
            (m: any) => m._getType && m._getType() === 'tool'
          )
          for (const toolMsg of toolMessages) {
            if (toolMsg.tool_call_id && yieldedToolResults.has(toolMsg.tool_call_id)) {
              continue
            }

            hasYielded = true
            if (toolMsg.tool_call_id) {
              yieldedToolResults.add(toolMsg.tool_call_id)
            }

            yield {
              type: 'tool_result',
              tool: toolMsg.name || 'unknown',
              tool_display_name: TOOL_REGISTRY[toolMsg.name]?.display_name || toolMsg.name,
              tool_call_id: toolMsg.tool_call_id || '',
              result: toolMsg.content,
            }
          }
        }
      }
    }

    // LLM streaming chunks (final response text)
    if (event.event === 'on_chat_model_stream') {
      const chunk = event.data?.chunk
      if (chunk?.content && typeof chunk.content === 'string') {
        hasYielded = true
        yield {
          type: 'text',
          content: chunk.content,
        }
      }
    }
  }

  // Fallback: if no streaming chunks, get final result
  if (!hasYielded) {
    console.log('[Stream] No streaming events, using final result')
    // @ts-expect-error - LangGraph type compatibility issue
    const result = await graph.invoke(initialState) as AgentState
    const lastMessage = result.messages[result.messages.length - 1]
    if (lastMessage?.content && typeof lastMessage.content === 'string') {
      yield {
        type: 'text',
        content: lastMessage.content,
      }
    }
  }
}
