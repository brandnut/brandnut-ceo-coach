import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

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
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, passwordHash]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
