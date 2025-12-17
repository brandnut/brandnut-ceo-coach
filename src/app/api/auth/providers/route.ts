import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 返回可用的认证提供者
    const providers = {
      credentials: {
        id: "credentials",
        name: "credentials",
        type: "credentials",
        signinUrl: "/api/auth/signin/credentials",
        callbackUrl: "/api/auth/callback/credentials"
      }
    }

    return NextResponse.json(providers, { status: 200 })
  } catch (error) {
    console.error('Providers API error:', error)
    return NextResponse.json({}, { status: 500 })
  }
}