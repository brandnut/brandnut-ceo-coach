import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const error = searchParams.get('error') || 'Unknown error'

    return NextResponse.json({
      error: error,
      message: `Authentication error: ${error}`
    }, { status: 400 })
  } catch (error) {
    console.error('Error API error:', error)
    return NextResponse.json({
      error: 'internal_error',
      message: 'Internal server error'
    }, { status: 500 })
  }
}