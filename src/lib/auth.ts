import NextAuth, { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import pool from './db'

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
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
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
