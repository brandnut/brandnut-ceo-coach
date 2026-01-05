/**
 * Postprocess Node
 *
 * Post-LLM hooks: response logging, content filtering, etc.
 */

import { AgentState } from '../state'

export async function postprocessNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Postprocess] Starting postprocessing', {
    userId: state.userId,
    conversationId: state.conversationId,
    finalMessageCount: state.messages.length,
  })

  // 1. Log response (basic version)
  const lastMessage = state.messages[state.messages.length - 1]
  if (lastMessage) {
    const contentLength =
      typeof lastMessage.content === 'string' ? lastMessage.content.length : 0
    console.log('[Postprocess] Response logged', {
      contentLength,
      timestamp: Date.now(),
    })
  }

  // 2. Future: content filtering, token tracking, etc.

  // No state changes needed for now
  return {}
}
