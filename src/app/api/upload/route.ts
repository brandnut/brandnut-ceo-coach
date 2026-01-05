/**
 * File Upload API - POST /api/upload
 *
 * Handles image and PDF uploads to Aliyun OSS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { uploadToOSS } from '@/lib/oss'

// Allowed file types
const ALLOWED_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
}

// Max file size: 10MB for images, 5MB for PDFs (LLM provider limit)
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_PDF_SIZE = 5 * 1024 * 1024

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

    // Validate file size (stricter limit for PDFs since they can't be compressed)
    const isPDF = file.type === 'application/pdf'
    const maxSize = isPDF ? MAX_PDF_SIZE : MAX_FILE_SIZE

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: isPDF
            ? `PDF files must be under ${MAX_PDF_SIZE / 1024 / 1024}MB (LLM provider limit)`
            : `Max file size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const extension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    const filename = `uploads/${timestamp}-${randomSuffix}${extension}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Aliyun OSS (with MIME type for image processing)
    const fileUrl = await uploadToOSS(filename, buffer, file.type)

    return NextResponse.json({
      success: true,
      id: filename, // Use filename as ID
      url: fileUrl,
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
