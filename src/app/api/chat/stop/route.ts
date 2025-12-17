import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await req.json()
    const { taskId } = body

    if (!taskId) {
      return new Response('Missing taskId', { status: 400 })
    }

    const response = await fetch(
      `${process.env.DIFY_API_URL}/chat-messages/${taskId}/stop`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: session.user?.name || "guest",
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return new Response(error, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Stop error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
