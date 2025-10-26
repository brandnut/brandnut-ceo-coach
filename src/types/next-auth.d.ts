import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
    }
  }

  interface User {
    id: string
    name: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string
    name?: string
  }
}
