import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import pool from '@/lib/db'
import { requireUser, createErrorResponse } from '@/lib/middleware'

export async function POST(req: NextRequest) {
  const authCheck = await requireUser(req)

  if (!authCheck.authorized) {
    return createErrorResponse(authCheck.reason || 'Unauthorized')
  }

  try {
    const { currentPassword, newPassword } = await req.json()
    const userId = authCheck.session?.user?.id

    if (!currentPassword || !newPassword) {
      return createErrorResponse('Current password and new password required', 400)
    }

    if (newPassword.length < 6) {
      return createErrorResponse('New password must be at least 6 characters', 400)
    }

    // 获取当前用户密码
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return createErrorResponse('User not found', 404)
    }

    // 验证当前密码
    const currentPasswordMatch = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash
    )

    if (!currentPasswordMatch) {
      return createErrorResponse('Current password is incorrect', 401)
    }

    // 更新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    )

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    })
  } catch (error) {
    console.error('Change password error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}