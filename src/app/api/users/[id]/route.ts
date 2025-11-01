import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/middleware'

// PUT - 更新用户（修改角色或重置密码）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(req)

  if (!authCheck.authorized) {
    return createErrorResponse(authCheck.reason || 'Unauthorized')
  }

  if (!pool) {
    return createErrorResponse('Database not available', 503)
  }

  try {
    const { id } = await params
    const { role, newPassword } = await req.json()

    // 验证用户存在
    const userExists = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    )

    if (userExists.rows.length === 0) {
      return createErrorResponse('User not found', 404)
    }

    let updateFields = []
    let values = []
    let paramIndex = 1

    // 更新角色
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return createErrorResponse('Invalid role', 400)
      }
      updateFields.push(`role = $${paramIndex++}`)
      values.push(role)
    }

    // 更新密码
    if (newPassword) {
      if (newPassword.length < 6) {
        return createErrorResponse('Password must be at least 6 characters', 400)
      }
      const bcrypt = require('bcrypt')
      const passwordHash = await bcrypt.hash(newPassword, 10)
      updateFields.push(`password_hash = $${paramIndex++}`)
      values.push(passwordHash)
    }

    if (updateFields.length === 0) {
      return createErrorResponse('No fields to update', 400)
    }

    values.push(id) // WHERE clause

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, role, created_at
    `

    const result = await pool.query(query, values)

    return NextResponse.json({
      success: true,
      user: result.rows[0]
    })
  } catch (error) {
    console.error('Update user error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// DELETE - 删除用户
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(req)

  if (!authCheck.authorized) {
    return createErrorResponse(authCheck.reason || 'Unauthorized')
  }

  if (!pool) {
    return createErrorResponse('Database not available', 503)
  }

  try {
    const { id } = await params

    // 验证用户存在
    const userExists = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    )

    if (userExists.rows.length === 0) {
      return createErrorResponse('User not found', 404)
    }

    // 防止admin删除自己
    const currentUser = authCheck.session?.user
    const targetUser = userExists.rows[0]

    if (currentUser?.id === id) {
      return createErrorResponse('Cannot delete yourself', 400)
    }

    // 删除用户
    await pool.query('DELETE FROM users WHERE id = $1', [id])

    return NextResponse.json({
      success: true,
      message: `User "${targetUser.username}" deleted successfully`
    })
  } catch (error) {
    console.error('Delete user error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}