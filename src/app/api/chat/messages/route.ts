import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { streamText } from 'ai'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await req.json()
    const { query, conversationId = null, files = [], inputs = {} } = body

    if (!query || !query.trim()) {
      return new Response('Empty message', { status: 400 })
    }

    const response = await fetch(`${process.env.DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        query,
        user: session.user.name,
        conversation_id: conversationId,
        files,
        response_mode: 'streaming',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return new Response(error, { status: response.status })
    }

    // Return Dify SSE stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
