import { NextRequest, NextResponse } from 'next/server'
import { guestMode } from '@/config/app'

// Guest mode: 所有路径都允许访问
export default async function middleware(req: NextRequest) {
  // Guest mode disabled, use normal auth flow
  if (!guestMode.enabled) {
    // 这里可以保留原来的认证逻辑作为备用
    return NextResponse.next()
  }

  // Guest mode enabled: allow all access
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * _next/static (static files)
     * _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/',  // Explicitly match root path
  ],
}