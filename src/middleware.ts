import { NextRequest, NextResponse } from 'next/server'
import { guestMode } from '@/config/app'

// Guest mode: 所有路径都允许访问
export default async function middleware(req: NextRequest) {
  // Guest mode disabled, use normal auth flow
  if (!guestMode.enabled) {
    // Edge Middleware 中只做简单验证，具体 JWT 验证在 API 路由中处理

    // 对 API 路由进行基础检查
    if (req.nextUrl.pathname.startsWith('/api/') &&
        !req.nextUrl.pathname.startsWith('/api/auth/')) {

      // 检查 Authorization header
      const authorization = req.headers.get('Authorization')
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Valid authentication token required'
          },
          { status: 401 }
        )
      }
    }

    return NextResponse.next()
  }

  // Guest mode enabled: allow all access
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}