/**
 * File Upload API - POST /api/upload
 *
 * Unified upload endpoint for:
 * - Images (PNG, JPEG, WebP, GIF) - for multimodal LLM
 * - PDFs - for multimodal LLM
 * - Text documents (TXT, DOCX, XLSX) - for text extraction and LLM context
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { uploadToOSS } from '@/lib/oss'
import { extractText, isSupportedFileType } from '@/lib/file-extractors'
import { saveFileExtraction } from '@/lib/db/file-queries'

// Allowed file types and their extensions
const ALLOWED_TYPES = {
  // Images
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  // PDF
  'application/pdf': '.pdf',
  // Text documents (for text extraction)
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
}

// Text document extensions (for fallback detection)
const TEXT_EXTENSIONS = ['.txt', '.docx', '.xlsx']

// Max file sizes
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_PDF_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_TEXT_FILE_SIZE = 15 * 1024 * 1024 // 15MB

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

    // Check if file is a text document (by extension or MIME type)
    const isTextDocument =
      isSupportedFileType(file.type, file.name) ||
      TEXT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))

    // Validate text documents
    if (isTextDocument) {
      if (file.size > MAX_TEXT_FILE_SIZE) {
        return NextResponse.json(
          {
            error: 'File too large',
            message: `Text files must be under ${MAX_TEXT_FILE_SIZE / 1024 / 1024}MB`,
          },
          { status: 400 }
        )
      }
    } else {
      // Validate images/PDFs
      if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
        return NextResponse.json(
          {
            error: 'Invalid file type',
            message: `Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`
          },
          { status: 400 }
        )
      }

      const isPDF = file.type === 'application/pdf'
      const maxSize = isPDF ? MAX_PDF_SIZE : MAX_IMAGE_SIZE

      if (file.size > maxSize) {
        return NextResponse.json(
          {
            error: 'File too large',
            message: isPDF
              ? `PDF files must be under ${MAX_PDF_SIZE / 1024 / 1024}MB (LLM provider limit)`
              : `Max file size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`
          },
          { status: 400 }
        )
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)

    // Determine extension
    let extension: string
    if (ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      extension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    } else {
      // Fallback: get from filename
      const extIndex = file.name.lastIndexOf('.')
      extension = extIndex >= 0 ? file.name.slice(extIndex) : ''
    }

    const filename = `uploads/${timestamp}-${randomSuffix}${extension}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Aliyun OSS
    const fileUrl = await uploadToOSS(filename, buffer, file.type)

    // For text documents: extract text and save to database
    if (isTextDocument) {
      const extractedText = await extractText(buffer, file.name, file.type)

      const extraction = await saveFileExtraction({
        fileUrl,
        fileName: file.name,
        extractedText,
        mimeType: file.type,
        fileSize: file.size,
      })

      // Return file ID (for attachment_ids)
      return NextResponse.json({
        success: true,
        id: extraction.id,
        url: fileUrl,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      })
    }

    // For images/PDFs: return URL (for multimodal)
    return NextResponse.json({
      success: true,
      id: filename, // Use filename as ID for images/PDFs
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
