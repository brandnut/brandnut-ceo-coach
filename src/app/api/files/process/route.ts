/**
 * File Processing API Endpoint
 *
 * POST /api/files/process
 *
 * Triggers file processing: summarization and RAG indexing.
 * Can be called after file upload to process asynchronously.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processFile, processFiles } from '@/lib/rag/file-processor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ProcessRequest {
  fileId: string | string[]
  conversationId?: string
  force?: boolean  // Force re-process even if already processed
}

interface ProcessResponse {
  success: boolean
  message: string
  results?: Array<{
    fileId: string
    success: boolean
    action: 'summarize' | 'index' | 'both'
    summary?: string
    chunkCount?: number
    error?: string
  }>
  error?: string
}

/**
 * POST /api/files/process
 *
 * Request body:
 * {
 *   fileId: string | string[],  // Single file ID or array of IDs
 *   conversationId?: string,    // Optional conversation ID
 *   force?: boolean             // Force re-processing
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Processing started...",
 *   results: [...]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json()

    // Validate request
    if (!body.fileId) {
      return NextResponse.json<ProcessResponse>({
        success: false,
        message: 'Missing fileId in request body',
        error: 'fileId is required'
      }, { status: 400 })
    }

    const fileIds = Array.isArray(body.fileId) ? body.fileId : [body.fileId]

    if (fileIds.length === 0) {
      return NextResponse.json<ProcessResponse>({
        success: false,
        message: 'No file IDs provided',
        error: 'fileId array is empty'
      }, { status: 400 })
    }

    // Validate each file ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const fileId of fileIds) {
      if (!uuidRegex.test(fileId)) {
        return NextResponse.json<ProcessResponse>({
          success: false,
          message: `Invalid file ID format: ${fileId}`,
          error: 'fileId must be a valid UUID'
        }, { status: 400 })
      }
    }

    console.log(`[API] Processing ${fileIds.length} file(s): ${fileIds.join(', ')}`)

    // Process files
    const results = await processFiles(fileIds, {
      conversationId: body.conversationId,
      forceReprocess: body.force
    })

    // Check if any failed
    const failures = results.filter(r => !r.success)
    const success = failures.length === 0

    return NextResponse.json<ProcessResponse>({
      success,
      message: success
        ? `Successfully processed ${results.length} file(s)`
        : `Processed ${results.length} file(s), ${failures.length} failed`,
      results
    })

  } catch (error) {
    console.error('[API] File processing error:', error)

    return NextResponse.json<ProcessResponse>({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/files/process
 *
 * Get processing status for a file (optional endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({
        success: false,
        error: 'Missing fileId parameter'
      }, { status: 400 })
    }

    // Query processing status from database
    const { pool } = await import('@/lib/db')

    if (!pool) {
      return NextResponse.json({
        success: false,
        error: 'Database not available'
      }, { status: 500 })
    }

    const query = `
      SELECT
        id,
        file_name,
        processed,
        should_index,
        processing_status,
        processing_error,
        indexed_at,
        summary,
        (SELECT COUNT(*) FROM file_chunks WHERE file_extraction_id = file_extractions.id) as chunk_count
      FROM file_extractions
      WHERE id = $1
    `

    const result = await pool.query(query, [fileId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'File not found'
      }, { status: 404 })
    }

    const file = result.rows[0]

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        file_name: file.file_name,
        processed: file.processed,
        processing_status: file.processing_status,
        processing_error: file.processing_error,
        indexed_at: file.indexed_at,
        summary: file.summary,
        chunk_count: parseInt(file.chunk_count, 10)
      }
    })

  } catch (error) {
    console.error('[API] Get processing status error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
