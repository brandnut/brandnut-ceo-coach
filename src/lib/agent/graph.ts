/**
 * LangGraph Agent
 *
 * Phase 2: ReAct pattern with conditional edges for tool use
 */

import { StateGraph, END } from '@langchain/langgraph'
import { agentStateAnnotation, AgentState } from './state'
import { preprocessNode } from './nodes/preprocess'
import { agentNode } from './nodes/agent'
import { toolsNode } from './nodes/tools'
import { postprocessNode } from './nodes/postprocess'
import { shouldContinue } from './nodes/router'

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

    // Conditional flow: agent → (continue to tools OR end)
    .addConditionalEdges('agent', shouldContinue, {
      continue: 'tools', // If agent called tools → execute tools
      end: 'postprocess', // If no tool calls → end
    })

    // Loop: tools → agent (for next round)
    .addEdge('tools', 'agent')

    // Final: postprocess → END
    .addEdge('postprocess', END)

  return graph.compile()
}
