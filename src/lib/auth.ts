import { getCurrentUser } from '@/lib/auth-middleware'
import { cookies } from 'next/headers'

// 替换 NextAuth 的 auth 函数，使用 JWT 验证
export async function auth() {
  try {
    // 从请求头中获取 Authorization token
    const headersList = cookies()
    let authorization: string | null = null

    // 尝试从 cookie 中获取
    const authCookie = headersList.get('next-auth.session-token')
    if (authCookie) {
      authorization = `Bearer ${authCookie}`
    }

    // 如果没有 cookie，尝试从请求上下文获取
    if (!authorization) {
      // 这是一个临时方案，更好的做法是在 middleware 中处理
      return null
    }

    const user = await getCurrentUser({
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return authorization
          return headersList.get(key)
        }
      }
    } as any)

    if (!user) {
      return null
    }

    // 转换为 NextAuth 兼容的 session 格式
    return {
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role as 'admin' | 'user'
      }
    }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

// 导出其他 NextAuth 相关函数（如果需要）
export const handlers = {
  GET: () => new Response('NextAuth handlers replaced with JWT system', { status: 200 }),
  POST: () => new Response('NextAuth handlers replaced with JWT system', { status: 200 })
}

export const signIn = () => {
  return new Response('Use Brandnut Ops for sign in', { status: 404 })
}

export const signOut = () => {
  return new Response('Use Brandnut Ops sign out', { status: 404 })
}

// 保持向后兼容，但使用 JWT 系统
export const authConfig = {
  // 空配置，因为我们不使用 NextAuth
}

// 新增：便捷函数，供直接使用
export async function getCurrentUserFromRequest(request: Request) {
  return await getCurrentUser(request as any)
}
