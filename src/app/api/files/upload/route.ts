import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const user = formData.get('user') || session.user.id

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const proxyFormData = new FormData()
    proxyFormData.append('file', file)
    proxyFormData.append('user', user as string)

    const response = await fetch(`${process.env.DIFY_API_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      },
      body: proxyFormData,
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
