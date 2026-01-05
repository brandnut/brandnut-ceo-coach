/**
 * Streaming Helper for LangGraph
 *
 * Extracts text chunks and tool events from graph stream.
 * Phase 2: Supports tool thinking and tool results.
 */

import { CompiledStateGraph } from '@langchain/langgraph'
import { AgentState } from './state'
import { TOOL_REGISTRY } from './nodes/agent'

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

  // Use streamEvents to get all events
  const stream = graph.streamEvents(initialState, {
    version: 'v2',
  })

  let hasYielded = false
  const yieldedToolResults = new Set<string>() // Track yielded tool_call_ids to prevent duplicates

  for await (const event of stream) {
    // 1. Agent tool calls
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

    // 2. Tool execution results
    if (event.event === 'on_chain_end') {
      // Check if this is tools node completion
      const metadata = event.metadata
      if (metadata?.langgraph_node === 'tools') {
        const output = event.data?.output
        if (output?.messages) {
          // Extract tool messages from output
          const toolMessages = output.messages.filter(
            (m: any) => m._getType && m._getType() === 'tool'
          )
          for (const toolMsg of toolMessages) {
            // Deduplicate by tool_call_id
            if (toolMsg.tool_call_id && yieldedToolResults.has(toolMsg.tool_call_id)) {
              continue
            }

            hasYielded = true
            if (toolMsg.tool_call_id) {
              yieldedToolResults.add(toolMsg.tool_call_id)
            }

            const toolResultEvent = {
              type: 'tool_result' as const,
              tool: toolMsg.name || 'unknown',
              tool_display_name: TOOL_REGISTRY[toolMsg.name]?.display_name || toolMsg.name,
              tool_call_id: toolMsg.tool_call_id || '',
              result: toolMsg.content,
            }

            console.log('[Stream] Yielding tool_result event:', {
              tool: toolResultEvent.tool,
              tool_display_name: toolResultEvent.tool_display_name,
              tool_call_id: toolResultEvent.tool_call_id,
              resultLength: toolResultEvent.result.length,
            })

            yield toolResultEvent
          }
        }
      }
    }

    // 3. LLM streaming chunks (final response text)
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
    const result = await graph.invoke(initialState)
    const lastMessage = result.messages[result.messages.length - 1]
    if (lastMessage?.content && typeof lastMessage.content === 'string') {
      yield {
        type: 'text',
        content: lastMessage.content,
      }
    }
  }
}
