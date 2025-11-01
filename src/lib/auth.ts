import NextAuth, { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import pool from './db'
import { guestMode } from '@/config/app'

// Build trigger: v2

export const authConfig: NextAuthConfig = {
  trustHost: true, // Trust all hosts for production deployment
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Guest mode: 检查是否是guest自动登录
        if (guestMode.enabled && guestMode.autoSignIn &&
            credentials?.username === guestMode.username &&
            credentials?.password === "guest") {
          return {
            id: '0',
            name: guestMode.username,
            role: 'user',
          }
        }

        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const result = await pool.query(
          'SELECT * FROM users WHERE username = $1',
          [credentials.username]
        )

        const user = result.rows[0]
        if (!user) {
          return null
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        )

        if (!passwordMatch) {
          return null
        }

        return {
          id: user.id.toString(),
          name: user.username,
          role: user.role || 'user', // 确保向后兼容
        }
      },
    }),
  ],
  pages: guestMode.enabled ? {} : {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role as 'admin' | 'user'
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
