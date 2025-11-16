import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-middleware'
import { getOrganizationChatConfig, createOrganizationChatConfig } from '@/lib/db/queries'

/**
 * @swagger
 * /api/organizations/{id}/chat-config:
 *   get:
 *     summary: Get organization chat configuration
 *     description: Retrieve the chat API configuration for a specific organization
 *     tags: [Organizations, Chat Configuration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization chat configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   description: Configuration ID
 *                 organization_id:
 *                   type: string
 *                   format: uuid
 *                   description: Organization ID
 *                 chat_api_url:
 *                   type: string
 *                   description: Chat API URL
 *                 chat_api_key:
 *                   type: string
 *                   description: Chat API key (partially masked)
 *                 is_active:
 *                   type: boolean
 *                   description: Whether the configuration is active
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: Creation timestamp
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                   description: Last update timestamp
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - User doesn't have access to this organization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden"
 *       404:
 *         description: Organization chat configuration not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Chat configuration not found"
 *   post:
 *     summary: Create or update organization chat configuration
 *     description: Create a new chat configuration or update existing one for an organization
 *     tags: [Organizations, Chat Configuration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chat_api_url
 *               - chat_api_key
 *             properties:
 *               chat_api_url:
 *                 type: string
 *                 description: Chat API URL
 *                 example: "https://api.example.com/v1"
 *               chat_api_key:
 *                 type: string
 *                 description: Chat API key
 *                 example: "sk-xxxxxxxxxxxxx"
 *     responses:
 *       200:
 *         description: Chat configuration created/updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   description: Configuration ID
 *                 organization_id:
 *                   type: string
 *                   format: uuid
 *                   description: Organization ID
 *                 chat_api_url:
 *                   type: string
 *                   description: Chat API URL
 *                 chat_api_key:
 *                   type: string
 *                   description: Chat API key (partially masked)
 *                 is_active:
 *                   type: boolean
 *                   description: Whether the configuration is active
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: Creation timestamp
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                   description: Last update timestamp
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid request data"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - User doesn't have permission to manage this organization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden"
 */

// Helper function to mask API key for security
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return apiKey
  }
  return apiKey.slice(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.slice(-4)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证用户
    const authResult = await getCurrentUser(request as any)
    if (!authResult.user) {
      if (authResult.error === 'TOKEN_EXPIRED') {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Access token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      } else if (authResult.error === 'ACCOUNT_INACTIVE') {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Account inactive', code: 'ACCOUNT_INACTIVE' },
          { status: 403 }
        )
      } else {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid access token', code: 'INVALID_TOKEN' },
          { status: 401 }
        )
      }
    }

    const { id: organizationId } = await params

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // 获取组织聊天配置
    const chatConfig = await getOrganizationChatConfig(organizationId)

    if (!chatConfig) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Chat configuration not found' },
        { status: 404 }
      )
    }

    // 返回配置信息，隐藏敏感信息
    const response = {
      id: chatConfig.id,
      organization_id: chatConfig.organization_id,
      chat_api_url: chatConfig.chat_api_url,
      chat_api_key: maskApiKey(chatConfig.chat_api_key),
      is_active: chatConfig.is_active,
      created_at: chatConfig.created_at.toISOString(),
      updated_at: chatConfig.updated_at.toISOString()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get organization chat config error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get chat configuration' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证用户
    const authResult = await getCurrentUser(request as any)
    if (!authResult.user) {
      if (authResult.error === 'TOKEN_EXPIRED') {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Access token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      } else if (authResult.error === 'ACCOUNT_INACTIVE') {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Account inactive', code: 'ACCOUNT_INACTIVE' },
          { status: 403 }
        )
      } else {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid access token', code: 'INVALID_TOKEN' },
          { status: 401 }
        )
      }
    }

    const { id: organizationId } = await params

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const { chat_api_url, chat_api_key } = body

    if (!chat_api_url || !chat_api_key) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'chat_api_url and chat_api_key are required' },
        { status: 400 }
      )
    }

    // 验证URL格式
    try {
      new URL(chat_api_url)
    } catch {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid chat_api_url format' },
        { status: 400 }
      )
    }

    // 创建或更新组织聊天配置
    const chatConfig = await createOrganizationChatConfig(organizationId, chat_api_url, chat_api_key)

    // 返回配置信息，隐藏敏感信息
    const response = {
      id: chatConfig.id,
      organization_id: chatConfig.organization_id,
      chat_api_url: chatConfig.chat_api_url,
      chat_api_key: maskApiKey(chatConfig.chat_api_key),
      is_active: chatConfig.is_active,
      created_at: chatConfig.created_at.toISOString(),
      updated_at: chatConfig.updated_at.toISOString()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Create organization chat config error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create chat configuration' },
      { status: 500 }
    )
  }
}