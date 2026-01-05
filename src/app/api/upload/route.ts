/**
 * File Upload API - POST /api/upload
 *
 * Handles image and PDF uploads, stores temporarily on disk.
 * Later: hook up to object storage (S3, Aliyun OSS, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'

// Allowed file types
const ALLOWED_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
}

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Upload directory (public so Next.js can serve it)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await getCurrentUser(request)
    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse('Unauthorized', authResult.error || 'INVALID_TOKEN')
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `Max file size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 400 }
      )
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const extension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    const filename = `${timestamp}-${randomSuffix}${extension}`
    const filepath = path.join(UPLOAD_DIR, filename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Construct URL (served by Next.js from /public)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const fileUrl = `${baseUrl}/uploads/${filename}`

    return NextResponse.json({
      success: true,
      file: {
        url: fileUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
