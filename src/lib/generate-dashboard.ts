/**
 * Generate Personalized Dashboard Questions
 *
 * Uses LLM to generate 7 categories of personalized questions
 * based on org system prompt and user memories.
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { getUserChatConfig } from '@/lib/db/queries'
import { searchMemory, formatMemoryContext } from '@/lib/memory/client'
import { createAgentLog } from '@/lib/db/agent-queries'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not configured')
}

export interface DashboardQuestions {
  [category: string]: string[]
}

/**
 * Generate personalized dashboard questions
 *
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @param conversationId - Conversation ID (for memory lookup)
 * @returns Object with 7 categories of questions
 */
export async function generateDashboardQuestions(
  userId: string,
  organizationId: string
): Promise<DashboardQuestions> {
  // 1. Get org system prompt and extract company info
  const orgConfig = await getUserChatConfig(userId, organizationId)
  const rawSystemPrompt = orgConfig?.system_prompt || '你是一位CEO教练'

  // Extract text between <company></company> tags, or use full prompt if not found
  const companyMatch = rawSystemPrompt.match(/<company>([\s\S]*?)<\/company>/)
  const systemPrompt = companyMatch ? companyMatch[1].trim() : rawSystemPrompt

  // 2. Get user memories from memtensor (using temp conversationId)
  const tempConversationId = `dashboard-${Date.now()}`
  const memoryData = await searchMemory(
    userId,
    tempConversationId,
    '用户的背景、企业情况、挑战、偏好、目标、行业、规模'
  )

  const memoryContext = memoryData
    ? formatMemoryContext(memoryData)
    : '暂无用户记忆'

  // 3. Build prompt
  const prompt = `你是CEO教练。为这位企业家生成9个分类的启发性问题，这些问题是**用户可以问AI的问题**，用于开启对话。

组织背景：
${systemPrompt}

用户记忆：
${memoryContext}

分类：战略、营销、产品、财务、组织、人事、销售、运营、自我成长
要求：
- 每个分类3-5个问题
- 这些问题是用户可以问AI的，例如："如何判断...？"、"XX和YY该选哪个？"、"怎样做才能...？"
- 深度个性化，结合用户的行业、规模、挑战
- 具体有信息量，避免"如何提高销售额"这种泛泛问题
- 口语化表达

返回JSON：
{
  "战略": ["如何在规模经济和小而美之间找到平衡点？", "明年的战略重点该选哪个方向？"],
  "营销": ["中腰部达人ROI好但犹豫的原因是什么？", "如何平衡抖音的短期数据和长期品牌？"],
  "产品": [...],
  "财务": [...],
  "组织": [...],
  "人事": [...],
  "销售": [...],
  "运营": [...],
  "自我成长": [...]
}`

  // 4. Call GLM 4.5 Air with structured output
  const startTime = Date.now()
  const modelName = 'z-ai/glm-4.5-air'

  const model = new ChatOpenAI({
    modelName: 'z-ai/glm-4.5-air',
    apiKey: OPENROUTER_API_KEY,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
    },
    temperature: 0.7,
    modelKwargs: {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'dashboard_questions',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              战略: {
                type: 'array',
                items: { type: 'string' },
              },
              营销: {
                type: 'array',
                items: { type: 'string' },
              },
              产品: {
                type: 'array',
                items: { type: 'string' },
              },
              财务: {
                type: 'array',
                items: { type: 'string' },
              },
              组织: {
                type: 'array',
                items: { type: 'string' },
              },
              人事: {
                type: 'array',
                items: { type: 'string' },
              },
              销售: {
                type: 'array',
                items: { type: 'string' },
              },
              运营: {
                type: 'array',
                items: { type: 'string' },
              },
              自我成长: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['战略', '营销', '产品', '财务', '组织', '人事', '销售', '运营', '自我成长'],
            additionalProperties: false,
          },
        },
      },
    },
  })

  try {
    const response = await model.invoke([new HumanMessage(prompt)])
    const durationMs = Date.now() - startTime
    const result = JSON.parse(response.content as string)

    // Log to agent_logs
    await createAgentLog({
      userId,
      conversationId: null, // No real conversation for dashboard generation
      modelName,
      request: { prompt },
      response: result,
      durationMs,
      status: 'success',
      type: 'dashboard_generation',
    }).catch((err) => console.error('Failed to log dashboard generation:', err))

    return result
  } catch (error) {
    const durationMs = Date.now() - startTime

    // Log error to agent_logs
    await createAgentLog({
      userId,
      conversationId: null, // No real conversation for dashboard generation
      modelName,
      request: { prompt },
      response: null,
      durationMs,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      type: 'dashboard_generation',
    }).catch((err) => console.error('Failed to log dashboard generation error:', err))

    throw error
  }
}
