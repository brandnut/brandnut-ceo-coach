/**
 * Tools Node
 *
 * Uses LangGraph's ToolNode with context injection
 */

import { ToolNode } from '@langchain/langgraph/prebuilt'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { AgentState } from '../state'
import { loggedFetch } from '@/lib/http/logged-client'
import { brandnutTools, BRANDNUT_TOOL_REGISTRY } from '@/lib/tools/brandnut'

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
}, userId: string, conversationId: string): Promise<string> {
  if (!BOCHA_API_KEY) {
    return 'Error: BOCHA_API_KEY not configured'
  }

  try {
    const response = await loggedFetch(BOCHA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: BOCHA_API_KEY,
      },
      body: JSON.stringify({
        query: args.query,
        summary: args.summary !== false,
        freshness: args.freshness || 'noLimit',
        count: Math.min(args.count || 10, 50),
      }),
      logContext: {
        userId,
        conversationId,
        requestType: 'tool_use' as const,
      },
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
 * Create tools with context (closure)
 */
function createTools(userId: string, conversationId: string) {
  return [
    // Bocha search tool
    tool(
      async ({ query, summary, freshness, count }) => {
        return await bochaSearch({ query, summary, freshness, count }, userId, conversationId)
      },
      {
        name: 'bocha_search',
        description:
          '从博查搜索网页信息和网页链接。搜索结果准确、完整，适合查询实时信息、新闻、资料等。' +
          '使用场景: 当用户询问需要实时信息、最新数据、新闻、公开资料时使用。' +
          '\n\n重要提示：' +
          '\n- 根据查询需求设置 freshness 参数（oneDay/oneWeek/oneMonth/oneYear）来限制搜索时间范围' +
          '\n- 根据需要的结果数量设置 count 参数（默认10条，最多50条）',
        schema: z.object({
          query: z.string().describe('搜索关键字或语句'),
          summary: z.boolean().optional().describe('是否在搜索结果中包含摘要'),
          freshness: z.enum(['noLimit', 'oneDay', 'oneWeek', 'oneMonth', 'oneYear']).optional().describe('搜索时间范围'),
          count: z.number().min(1).max(50).optional().describe('返回结果数量'),
        }),
      }
    ),

    // Brandnut API tools
    ...brandnutTools,
  ]
}

// Export default tools (for agent initialization)
export const tools = createTools('', '')

/**
 * Tool registry for display names (for frontend)
 */
export const TOOL_REGISTRY: Record<string, { display_name: string }> = {
  bocha_search: { display_name: '网页搜索' },
  ...BRANDNUT_TOOL_REGISTRY,
}

/**
 * Tools node using LangGraph's ToolNode
 */
export async function toolsNode(state: AgentState): Promise<Partial<AgentState>> {
  // Create tools with context (closure captures userId and conversationId)
  const toolsWithContext = createTools(state.userId, state.conversationId)

  // Create ToolNode with context-aware tools
  const node = new ToolNode(toolsWithContext)

  // ToolNode expects { messages: BaseMessage[] }
  const result = await node.invoke({ messages: state.messages })

  return { messages: result.messages }
}
