/**
 * Brandnut API Tools
 *
 * Tools for interacting with Brandnut Memory API service
 * https://brandnut.cn/memory/api/v1
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { loggedFetch, LoggedFetchOptions } from '@/lib/http/logged-client'

const BRANDNUT_API_BASE = 'https://brandnut.cn/memory/api/v1'
const BRANDNUT_API_KEY = process.env.BRANDNUT_MEMORY_API_KEY

if (!BRANDNUT_API_KEY) {
  console.warn('[Brandnut] BRANDNUT_MEMORY_API_KEY not configured - tools will fail')
}

/**
 * Brandnut API Response Types
 */
interface InstanceItem {
  id: string | null
  org_id: string | null
  title: string
  template_name: string
  template_version: string
  model: string
  temperature: number | null
  tags: string[] | null
  description: string | null
  prompt: string | null
}

interface ListInstancesResponse {
  message: string
  total: number
  page: number
  page_size: number
  items: InstanceItem[]
}

interface TagInfo {
  message: string
  id: number | null
  name: string | null
  text_color: string | null
  background_color: string | null
}

interface ErrorResponse {
  detail: string
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, path: string, params: Record<string, any>): string {
  const url = new URL(path, baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v))
      } else {
        url.searchParams.append(key, String(value))
      }
    }
  })
  return url.toString()
}

/**
 * Format instance item for display
 */
function formatInstanceItem(item: InstanceItem): string {
  const parts = [
    `**${item.title}** (${item.template_name} v${item.template_version})`,
    `ID: ${item.id || 'N/A'}`,
    `Model: ${item.model}`,
  ]

  if (item.temperature) {
    parts.push(`Temperature: ${item.temperature}`)
  }

  if (item.tags && item.tags.length > 0) {
    parts.push(`Tags: ${item.tags.join(', ')}`)
  }

  if (item.description) {
    parts.push(`Description: ${item.description}`)
  }

  if (item.prompt) {
    const preview = item.prompt.length > 200
      ? item.prompt.substring(0, 200) + '...'
      : item.prompt
    parts.push(`Prompt Preview:\n${preview}`)
  }

  return parts.join('\n')
}

/**
 * Format tag info for display
 */
function formatTagInfo(tag: TagInfo): string {
  const parts = []

  if (tag.name) {
    parts.push(`**${tag.name}**`)
  }

  if (tag.text_color || tag.background_color) {
    parts.push(`Colors: text="${tag.text_color || 'N/A'}" bg="${tag.background_color || 'N/A'}"`)
  }

  return parts.join(' | ')
}

/**
 * List instances for an organization
 */
async function listInstances(
  orgId: string,
  page = 1,
  pageSize = 10,
  tags?: string[],
  metadataOnly = false
): Promise<string> {
  if (!BRANDNUT_API_KEY) {
    return 'Error: BRANDNUT_MEMORY_API_KEY not configured'
  }

  try {
    const url = buildUrl(BRANDNUT_API_BASE, `/instances/${orgId}`, {
      page,
      page_size: pageSize,
      tags,
      metadata_only: metadataOnly,
    })

    const logContext: LoggedFetchOptions['logContext'] = {
      userId: '',
      conversationId: '',
      requestType: 'tool_use',
    }

    const response = await loggedFetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': BRANDNUT_API_KEY,
      },
      logContext,
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      return `Error: ${error.detail || response.statusText}`
    }

    const data: ListInstancesResponse = await response.json()

    if (data.items.length === 0) {
      return `No instances found for organization ${orgId}`
    }

    const items = data.items.map(formatInstanceItem).join('\n\n---\n\n')

    return `Found ${data.total} instances (page ${data.page} of ${Math.ceil(data.total / data.page_size)}):\n\n${items}`
  } catch (error) {
    console.error('[Brandnut] List instances error:', error)
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Get all tags
 */
async function getTags(): Promise<string> {
  if (!BRANDNUT_API_KEY) {
    return 'Error: BRANDNUT_MEMORY_API_KEY not configured'
  }

  try {
    const url = `${BRANDNUT_API_BASE}/tags`

    const logContext: LoggedFetchOptions['logContext'] = {
      userId: '',
      conversationId: '',
      requestType: 'tool_use',
    }

    const response = await loggedFetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': BRANDNUT_API_KEY,
      },
      logContext,
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      return `Error: ${error.detail || response.statusText}`
    }

    const data: TagInfo[] = await response.json()

    if (data.length === 0) {
      return 'No tags found'
    }

    const tags = data.map(formatTagInfo).join('\n')
    return `Available tags (${data.length}):\n\n${tags}`
  } catch (error) {
    console.error('[Brandnut] Get tags error:', error)
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Get single instance by ID
 */
async function getSingleInstance(id: string): Promise<string> {
  if (!BRANDNUT_API_KEY) {
    return 'Error: BRANDNUT_MEMORY_API_KEY not configured'
  }

  try {
    const url = `${BRANDNUT_API_BASE}/instance/${id}`

    const logContext: LoggedFetchOptions['logContext'] = {
      userId: '',
      conversationId: '',
      requestType: 'tool_use',
    }

    const response = await loggedFetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': BRANDNUT_API_KEY,
      },
      logContext,
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      return `Error: ${error.detail || response.statusText}`
    }

    const data: InstanceItem = await response.json()

    return formatInstanceItem(data)
  } catch (error) {
    console.error('[Brandnut] Get instance error:', error)
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Tool definitions for LangChain
 */
export const brandnutTools = [
  tool(
    async ({ page, page_size, tags }) => {
      return await listInstances('public', page, page_size, tags, true)
    },
    {
      name: 'list_instances',
      description:
        '列出公共实例库的所有实例（支持分页和标签过滤）。' +
        '使用场景：当用户需要浏览可用的 prompt 模板实例时使用。' +
        '\n\n重要提示：' +
        '\n- 仅返回元信息（不含 prompt 内容），避免返回过长内容' +
        '\n- page 从1开始，默认为1' +
        '\n- page_size 默认为10，最大100' +
        '\n- tags 是标签数组，用于过滤实例',
      schema: z.object({
        page: z.number().min(1).optional().default(1).describe('页码，从1开始'),
        page_size: z.number().min(1).max(100).optional().default(10).describe('每页数量'),
        tags: z.array(z.string()).optional().describe('标签过滤'),
      }),
    }
  ),

  tool(
    async () => {
      return await getTags()
    },
    {
      name: 'get_tags',
      description:
        '获取所有可用的标签信息（包括颜色配置）。' +
        '使用场景：当用户需要了解有哪些标签可以用于过滤实例时使用。',
      schema: z.object({}),
    }
  ),

  tool(
    async ({ id }) => {
      return await getSingleInstance(id)
    },
    {
      name: 'get_single_instance',
      description:
        '获取单个实例的完整详情（包括 prompt 内容）。' +
        '使用场景：当用户需要查看特定实例的完整 prompt 时使用。' +
        '\n\n重要提示：' +
        '\n- id 是实例ID（UUID格式），必需参数',
      schema: z.object({
        id: z.string().describe('实例ID（UUID格式）'),
      }),
    }
  ),
]

/**
 * Tool registry for display names (for frontend)
 */
export const BRANDNUT_TOOL_REGISTRY: Record<string, { display_name: string }> = {
  list_instances: { display_name: '列出实例' },
  get_tags: { display_name: '获取标签' },
  get_single_instance: { display_name: '获取实例详情' },
}
