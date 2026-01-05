/**
 * Logged HTTP Client
 *
 * A fetch wrapper that automatically logs HTTP requests to agent_outbound_logs.
 * Use this instead of global fetch for agent-related HTTP calls.
 */

import { logOutboundRequest, OutboundLogRequestType } from '@/lib/db/agent-outbound-logs'

export interface LoggedFetchOptions extends RequestInit {
  logContext?: {
    userId: string
    conversationId: string
    requestType: OutboundLogRequestType
  }
}

/**
 * Logged fetch - automatically logs to agent_outbound_logs
 *
 * Usage:
 *   await loggedFetch(url, {
 *     method: 'POST',
 *     body: JSON.stringify(data),
 *     logContext: {
 *       userId: '...',
 *       conversationId: '...',
 *       requestType: 'tool_use' | 'memory_search' | 'memory_add'
 *     }
 *   })
 */
export async function loggedFetch(url: string, options: LoggedFetchOptions = {}): Promise<Response> {
  const { logContext, ...fetchOptions } = options

  // If no logging context, just call normal fetch
  if (!logContext) {
    console.warn('[LoggedFetch] Called without logContext, request will not be logged')
    return fetch(url, fetchOptions)
  }

  const startTime = Date.now()
  const method = fetchOptions.method || 'GET'

  try {
    const response = await fetch(url, fetchOptions)
    const duration = Date.now() - startTime

    // Try to parse response for logging
    let responsePayload: any = null
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      try {
        const clonedResponse = response.clone()
        responsePayload = await clonedResponse.json()
      } catch {
        // Failed to parse, that's ok
      }
    }

    // Log the request
    await logOutboundRequest({
      userId: logContext.userId,
      conversationId: logContext.conversationId,
      requestType: logContext.requestType,
      endpoint: url,
      method,
      requestPayload: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined,
      responsePayload,
      status: response.ok ? 'success' : 'error',
      errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
      durationMs: duration,
    })

    return response
  } catch (error) {
    const duration = Date.now() - startTime

    // Log the error
    await logOutboundRequest({
      userId: logContext.userId,
      conversationId: logContext.conversationId,
      requestType: logContext.requestType,
      endpoint: url,
      method,
      requestPayload: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: duration,
    })

    throw error
  }
}
