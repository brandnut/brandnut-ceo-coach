/**
 * LangGraph Agent
 *
 * Phase 2: ReAct pattern with conditional edges for tool use
 */

import { StateGraph, END } from '@langchain/langgraph'
import { AIMessage } from '@langchain/core/messages'
import { agentStateAnnotation, AgentState } from './state'
import { preprocessNode } from './nodes/preprocess'
import { agentNode } from './nodes/agent'
import { toolsNode } from './nodes/tools'
import { postprocessNode } from './nodes/postprocess'

/**
 * Router: Check if agent wants to use tools
 * Inlined from router.ts for simplicity
 */
function shouldContinue(state: AgentState): 'continue' | 'postprocess' {
  const lastMessage = state.messages[state.messages.length - 1]

  if (lastMessage._getType() === 'ai') {
    const aiMessage = lastMessage as AIMessage
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      console.log('[Router] Agent called tools, continuing...', {
        toolCount: aiMessage.tool_calls.length,
        tools: aiMessage.tool_calls.map((t) => t.name),
      })
      return 'continue'
    }
  }

  console.log('[Router] No tool calls, moving to postprocess...')
  return 'postprocess'
}

/**
 * Create the agent graph with tool support
 */
export function createAgentGraph() {
  const graph = new StateGraph(agentStateAnnotation)
    // Add nodes
    .addNode('preprocess', preprocessNode)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addNode('postprocess', postprocessNode)

    // Linear flow: start → preprocess → agent
    .addEdge('__start__', 'preprocess')
    .addEdge('preprocess', 'agent')

    // Conditional flow: agent → (continue to tools OR postprocess)
    .addConditionalEdges('agent', shouldContinue, {
      continue: 'tools', // If agent called tools → execute tools
      postprocess: 'postprocess', // If no tool calls → save to memory
    })

    // Loop: tools → agent (for next round)
    .addEdge('tools', 'agent')

    // Termination: postprocess → END
    .addEdge('postprocess', END)

  return graph.compile()
}
