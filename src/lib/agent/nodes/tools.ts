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
import { searchSimilarChunks } from '@/lib/rag/vector-db'
import { getRAGConfig } from '@/lib/rag/config'

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
 * Search uploaded documents using RAG (Retrieval Augmented Generation)
 *
 * This tool allows the agent to search through user-uploaded documents
 * to find relevant information based on semantic similarity.
 */
async function ragSearch(args: {
  query: string
  maxResults?: number
  threshold?: number
}, conversationId: string): Promise<string> {
  try {
    const config = getRAGConfig()

    // Check if RAG is enabled
    if (!config.features.enableRAG) {
      return 'Error: RAG feature is disabled'
    }

    // Check if there are any attachments
    // Note: The attachmentIds are loaded from database by the chat API
    // We need to query the database to get them
    const { pool } = await import('@/lib/db')
    if (!pool) {
      return 'Error: Database not available'
    }

    // Load conversation attachments from database
    const attachQuery = `
      SELECT file_extraction_id
      FROM conversation_attachments
      WHERE conversation_id = $1
      ORDER BY attached_at ASC
    `
    const attachResult = await pool.query(attachQuery, [conversationId])
    const attachmentIds = attachResult.rows.map(row => row.file_extraction_id)

    if (attachmentIds.length === 0) {
      return '当前对话没有上传的文档，无法使用文档搜索。请先上传文档。'
    }

    console.log('[RAG Tool] Searching documents:', {
      conversationId,
      attachmentIds,
      query: args.query,
      maxResults: args.maxResults || config.retrieval.currentConvMaxResults,
      threshold: args.threshold || config.retrieval.currentConvThreshold
    })

    // Perform vector search
    const results = await searchSimilarChunks(args.query, {
      conversationId,
      fileIds: attachmentIds,
      maxResults: args.maxResults || config.retrieval.currentConvMaxResults,
      threshold: args.threshold || config.retrieval.currentConvThreshold
    })

    console.log('[RAG Tool] Search results:', {
      resultCount: results.length,
      results: results.map(r => ({
        file: r.file_name,
        similarity: r.similarity
      }))
    })

    if (results.length === 0) {
      return `在文档中未找到与"${args.query}"相关的内容。请尝试换一个问法或上传相关文档。`
    }

    // Format results
    const formattedResults = results.map((r, idx) => {
      const parts = [
        `[${idx + 1}] ${r.file_name}`,
        `相似度: ${(r.similarity * 100).toFixed(1)}%`,
        `内容: ${r.chunk_text.substring(0, 200)}${r.chunk_text.length > 200 ? '...' : ''}`
      ]
      return parts.join('\n')
    })

    return `在文档中找到 ${results.length} 条相关内容：\n\n${formattedResults.join('\n\n---\n\n')}`
  } catch (error) {
    console.error('[RAG Tool] Error:', error)
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Create tools with context (closure)
 */
function createTools(userId: string, conversationId: string) {
  return [
    // RAG search tool - search uploaded documents
    tool(
      async ({ query, maxResults, threshold }) => {
        return await ragSearch({ query, maxResults, threshold }, conversationId)
      },
      {
        name: 'rag_search',
        description:
          '搜索用户上传的文档，基于语义相似度查找相关内容。' +
          '使用场景: 1. 当用户询问关于上传文档的问题时使用，如"文档中提到了什么"、"某个制度的具体内容"等。2. 你需要额外的知识储备。' +
          '可以搜索 TXT、DOCX、XLSX、PPTX 等文本文档。' +
          '\n\n重要提示：' +
          '\n- 优先使用此工具来回答关于已上传文档的问题' +
          '\n- 相似度阈值默认为70%，可以调整以获取更多或更少的结果',
        schema: z.object({
          query: z.string().describe('搜索问题或关键词'),
          maxResults: z.number().min(1).max(10).optional().describe('返回结果数量（默认5条）'),
          threshold: z.number().min(0).max(1).optional().describe('相似度阈值（0-1，默认0.7）'),
        }),
      }
    ),

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
  rag_search: { display_name: '文档搜索' },
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
