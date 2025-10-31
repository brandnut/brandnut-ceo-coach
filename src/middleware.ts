import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// 需要管理员权限的路径
const ADMIN_PATHS = ['/admin']

// 需要登录的路径
const PROTECTED_PATHS = ['/profile', ...ADMIN_PATHS]

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 检查是否为受保护路径
  const isAdminPath = ADMIN_PATHS.some(path => pathname.startsWith(path))
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path))

  if (isProtectedPath) {
    // 使用JWT token而不是auth()来避免bcrypt依赖问题
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: false // HTTP 部署必须设为 false
    })

    // 用户未登录
    if (!token) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // 检查管理员权限
    if (isAdminPath && token.role !== 'admin') {
      // 重定向到首页并显示错误信息
      const homeUrl = new URL('/', req.url)
      homeUrl.searchParams.set('error', 'admin_required')
      return NextResponse.redirect(homeUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}