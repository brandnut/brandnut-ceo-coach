import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { getUserById, getUserRoles } from '@/lib/db/queries'
import { UserMeResponse } from '@/lib/models/user'

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user information
 *     description: Retrieve the current authenticated user's profile information and roles
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserMeResponse'
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_token:
 *                 summary: Invalid access token
 *                 value:
 *                   error: "Unauthorized"
 *                   message: "Invalid access token"
 *                   code: "INVALID_TOKEN"
 *               token_expired:
 *                 summary: Access token expired
 *                 value:
 *                   error: "Unauthorized"
 *                   message: "Access token expired"
 *                   code: "TOKEN_EXPIRED"
 *       403:
 *         description: Account inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Forbidden"
 *               message: "Account inactive"
 *               code: "ACCOUNT_INACTIVE"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal Server Error"
 *                 message:
 *                   type: string
 *                   example: "Failed to get user info"
 */

export async function GET(request: NextRequest) {
  try {
    // 使用JWT中间件获取当前用户
    const authResult = await getCurrentUser(request as any)
    if (!authResult.user) {
      if (authResult.error === 'TOKEN_EXPIRED') {
        return createAuthErrorResponse('Access token expired', 'TOKEN_EXPIRED')
      } else if (authResult.error === 'ACCOUNT_INACTIVE') {
        return createAuthErrorResponse('Account inactive', 'ACCOUNT_INACTIVE', 403)
      } else {
        return createAuthErrorResponse('Invalid access token', 'INVALID_TOKEN')
      }
    }

    // 获取完整用户信息
    const fullUser = await getUserById(authResult.user.id)
    if (!fullUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 获取用户角色（来自user_roles表，这是用户角色的唯一定义）
    const roles = await getUserRoles(authResult.user.id)

    // 构建响应数据（移除不需要的字段）
    const response: UserMeResponse = {
      username: fullUser.username,
      email: fullUser.email,
      full_name: fullUser.full_name || undefined,
      id: fullUser.id,
      created_at: fullUser.created_at.toISOString(),
      updated_at: fullUser.updated_at.toISOString(),
      last_login_at: fullUser.last_login_at ? fullUser.last_login_at.toISOString() : undefined,
      avatar_url: fullUser.avatar_url || undefined,
      phone: fullUser.phone || undefined,
      roles: roles.map(role => ({
        ...role,
        granted_at: role.granted_at.toISOString(),
        expires_at: role.expires_at ? role.expires_at.toISOString() : undefined
      })),
      subscriptions: [] // 暂时返回空数组，后续可以根据需要实现
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Get current user info failed:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get user info' },
      { status: 500 }
    )
  }
}