/**
 * File Extraction Database Queries
 *
 * Simple, clean queries following the project's patterns.
 */

import pool from '@/lib/db'

export interface FileExtraction {
  id: string
  file_url: string
  file_name: string
  extracted_text: string
  mime_type: string | null
  file_size: number | null
  extracted_at: string
  created_at: string
  metadata: Record<string, any>
  summary?: string | null  // 文件摘要（如果有的话）
}

// Database wrapper
async function withClient<T>(callback: (client: any) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error('Database not available')
  }

  const client = await pool.connect()
  try {
    return await callback(client)
  } finally {
    client.release()
  }
}

/**
 * Save file extraction result
 */
export async function saveFileExtraction(params: {
  fileUrl: string
  fileName: string
  extractedText: string
  mimeType?: string
  fileSize?: number
  metadata?: Record<string, any>
}): Promise<FileExtraction> {
  return withClient(async (client) => {
    const query = `
      INSERT INTO file_extractions (
        file_url, file_name, extracted_text,
        mime_type, file_size, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (file_url) DO UPDATE SET
        extracted_text = EXCLUDED.extracted_text,
        extracted_at = NOW()
      RETURNING id, file_url, file_name, extracted_text,
                mime_type, file_size, extracted_at, created_at, metadata
    `

    const result = await client.query(query, [
      params.fileUrl,
      params.fileName,
      params.extractedText,
      params.mimeType || null,
      params.fileSize || null,
      JSON.stringify(params.metadata || {}),
    ])

    return result.rows[0]
  })
}

/**
 * Get file extraction by ID
 */
export async function getFileExtraction(
  id: string
): Promise<FileExtraction | null> {
  return withClient(async (client) => {
    const query = `
      SELECT id, file_url, file_name, extracted_text,
             mime_type, file_size, extracted_at, created_at, metadata
      FROM file_extractions
      WHERE id = $1
    `

    const result = await client.query(query, [id])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  })
}

/**
 * Get file extractions by IDs (batch query)
 */
export async function getFileExtractions(
  ids: string[]
): Promise<FileExtraction[]> {
  if (ids.length === 0) {
    return []
  }

  return withClient(async (client) => {
    const query = `
      SELECT id, file_url, file_name, extracted_text,
             mime_type, file_size, extracted_at, created_at, metadata, summary
      FROM file_extractions
      WHERE id = ANY($1)
    `

    const result = await client.query(query, [ids])
    return result.rows
  })
}

/**
 * Get file extraction by URL
 */
export async function getFileExtractionByUrl(
  fileUrl: string
): Promise<FileExtraction | null> {
  return withClient(async (client) => {
    const query = `
      SELECT id, file_url, file_name, extracted_text,
             mime_type, file_size, extracted_at, created_at, metadata
      FROM file_extractions
      WHERE file_url = $1
    `

    const result = await client.query(query, [fileUrl])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  })
}
