import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/middleware'

// GET - 获取所有用户（仅admin）
export async function GET(req: NextRequest) {
  const authCheck = await requireAdmin(req)

  if (!authCheck.authorized) {
    return createErrorResponse(authCheck.reason || 'Unauthorized')
  }

  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    )

    return NextResponse.json({
      success: true,
      users: result.rows
    })
  } catch (error) {
    console.error('Get users error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// POST - 创建新用户（仅admin）
export async function POST(req: NextRequest) {
  const authCheck = await requireAdmin(req)

  if (!authCheck.authorized) {
    return createErrorResponse(authCheck.reason || 'Unauthorized')
  }

  try {
    const { username, password, role } = await req.json()

    if (!username || !password) {
      return createErrorResponse('Username and password required', 400)
    }

    if (password.length < 6) {
      return createErrorResponse('Password must be at least 6 characters', 400)
    }

    // 验证role值
    const userRole = role || 'user'
    if (!['user', 'admin'].includes(userRole)) {
      return createErrorResponse('Invalid role', 400)
    }

    // 检查用户名是否已存在
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    )

    if (existingUser.rows.length > 0) {
      return createErrorResponse('Username already exists', 409)
    }

    // 创建用户
    const bcrypt = require('bcrypt')
    const passwordHash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, passwordHash, userRole]
    )

    return NextResponse.json({
      success: true,
      user: result.rows[0]
    })
  } catch (error) {
    console.error('Create user error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}