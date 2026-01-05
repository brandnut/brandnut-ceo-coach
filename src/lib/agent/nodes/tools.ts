/**
 * Tools Node
 *
 * Executes tool calls and returns results as ToolMessages.
 */

import { AIMessage, ToolMessage } from '@langchain/core/messages'
import { AgentState } from '../state'

const BOCHA_API_KEY = process.env.BOCHA_API_KEY
const BOCHA_API_URL = 'https://api.bocha.cn/v1/web-search'

if (!BOCHA_API_KEY) {
  console.warn('[Tools] BOCHA_API_KEY not configured - search will fail')
}

/**
 * Bocha 搜索 API 响应类型
 */
interface BochaSearchResult {
  code: number
  data?: {
    webPages?: {
      value: Array<{
        name: string
        url: string
        snippet: string
        summary?: string
        siteName: string
        datePublished?: string
      }>
    }
  }
  msg?: string
}

/**
 * 执行博查网页搜索
 */
async function bochaSearch(args: {
  query: string
  summary?: boolean
  freshness?: string
  count?: number
}): Promise<string> {
  if (!BOCHA_API_KEY) {
    return 'Error: BOCHA_API_KEY not configured'
  }

  try {
    const response = await fetch(BOCHA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: BOCHA_API_KEY,
      },
      body: JSON.stringify({
        query: args.query,
        summary: args.summary !== false, // 默认 true
        freshness: args.freshness || 'noLimit',
        count: Math.min(args.count || 10, 50),
      }),
    })

    if (!response.ok) {
      return `Error: Bocha API returned ${response.status} ${response.statusText}`
    }

    const data: BochaSearchResult = await response.json()

    if (data.code !== 200) {
      return `Error: Bocha API error - ${data.msg || 'Unknown error'}`
    }

    const webPages = data.data?.webPages?.value || []

    if (webPages.length === 0) {
      return '未找到相关搜索结果'
    }

    // 格式化结果
    const results = webPages.map((page, idx) => {
      const parts = [
        `[${idx + 1}] ${page.name}`,
        `URL: ${page.url}`,
        `来源: ${page.siteName}`,
      ]

      if (page.summary) {
        parts.push(`摘要: ${page.summary}`)
      } else if (page.snippet) {
        parts.push(`简介: ${page.snippet}`)
      }

      if (page.datePublished) {
        parts.push(`发布时间: ${page.datePublished}`)
      }

      return parts.join('\n')
    })

    return `找到 ${webPages.length} 条搜索结果:\n\n${results.join('\n\n')}`
  } catch (error) {
    console.error('[Tools] Bocha search error:', error)
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Tool 执行器
 */
async function executeTool(name: string, args: any): Promise<string> {
  console.log(`[Tools] Executing ${name}`, args)

  switch (name) {
    case 'bocha_search':
    case 'web_search':
      return await bochaSearch(args)

    default:
      return `Error: Unknown tool "${name}"`
  }
}

/**
 * Tools node - 执行 tool calls 并返回结果
 */
export async function toolsNode(state: AgentState): Promise<Partial<AgentState>> {
  const messages = state.messages
  if (messages.length === 0) {
    throw new Error('Tools node: no messages in state')
  }

  const lastMessage = messages[messages.length - 1]

  if (lastMessage._getType() !== 'ai') {
    throw new Error('Tools node expects AIMessage as last message')
  }

  const aiMessage = lastMessage as AIMessage
  const toolCalls = aiMessage.tool_calls || []

  if (toolCalls.length === 0) {
    console.warn('[Tools] No tool calls found, returning empty')
    return {}
  }

  console.log('[Tools] Executing', toolCalls.length, 'tool calls')

  // 并行执行所有 tool calls
  const toolMessages = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const { name, args, id } = toolCall

      let result: string
      try {
        result = await executeTool(name, args)
      } catch (error) {
        console.error(`[Tools] Error executing ${name}:`, error)
        result = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }

      console.log(`[Tools] ${name} completed`, {
        resultLength: result.length,
      })

      // 返回 ToolMessage
      return new ToolMessage({
        content: result,
        tool_call_id: id!,
        name,
      })
    })
  )

  // 将所有 ToolMessage 追加到 messages
  return {
    messages: [...state.messages, ...toolMessages],
  }
}
