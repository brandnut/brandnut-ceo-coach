import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/middleware'

export async function POST(req: NextRequest) {
  if (!pool) {
    return NextResponse.json(
      { error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    const { username, password, role } = await req.json()

    // 检查权限：只有admin可以指定role，否则默认为'user'
    const authCheck = await requireAdmin(req)
    const isAdmin = authCheck.authorized

    // 非admin用户尝试指定role - 直接拒绝
    if (!isAdmin && role && role !== 'user') {
      return NextResponse.json(
        { error: 'Admin access required to specify role' },
        { status: 403 }
      )
    }

    // 确定用户角色
    const userRole = isAdmin && role ? role : 'user'

    // 验证role值（如果提供）
    if (userRole && !['user', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
      [username, passwordHash, userRole]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
