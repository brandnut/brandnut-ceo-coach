/**
 * Vector Database Utilities (pgvector)
 *
 * Handles storing and querying embeddings in PostgreSQL with pgvector.
 */

import { pool } from '../db'
import { generateEmbedding, embeddingToVectorString } from './embeddings'
import { getRAGConfig } from './config'

export interface FileChunk {
  id: string
  file_extraction_id: string
  chunk_index: number
  chunk_text: string
  metadata?: Record<string, any>
  created_at: Date
}

export interface SearchResult {
  chunk_id: string
  file_id: string
  file_name: string
  chunk_index: number
  chunk_text: string
  similarity: number
  metadata?: Record<string, any>
  conversation_id?: string
}

export interface SearchOptions {
  conversationId?: string     // Search only in this conversation (current conversation priority)
  fileIds?: string[]          // Search only in these files
  maxResults?: number         // Maximum results to return
  threshold?: number          // Minimum similarity threshold (0-1)
  includeCrossConv?: boolean  // Include cross-conversation results
}

/**
 * Save a single chunk to the database
 *
 * @param fileExtractionId - File ID
 * @param chunkText - Chunk text content
 * @param chunkIndex - Chunk index
 * @param metadata - Optional metadata
 * @returns Inserted chunk ID
 */
export async function saveChunk(
  fileExtractionId: string,
  chunkText: string,
  chunkIndex: number,
  metadata?: Record<string, any>
): Promise<string> {
  const config = getRAGConfig()

  // Generate embedding
  const embedding = await generateEmbedding(chunkText)
  const embeddingVector = embeddingToVectorString(embedding)

  // Insert into database
  const query = `
    INSERT INTO file_chunks (file_extraction_id, chunk_index, chunk_text, embedding, metadata)
    VALUES ($1, $2, $3, $4::vector, $5)
    RETURNING id
  `

  const values = [
    fileExtractionId,
    chunkIndex,
    chunkText,
    embeddingVector,
    JSON.stringify(metadata || {})
  ]

  const result = await pool.query(query, values)
  return result.rows[0].id
}

/**
 * Save multiple chunks in batch
 *
 * @param chunks - Array of chunks with embeddings
 * @returns Array of inserted chunk IDs
 */
export async function saveChunks(
  fileExtractionId: string,
  chunks: Array<{
    text: string
    index: number
    embedding?: number[]
    metadata?: Record<string, any>
  }>
): Promise<string[]> {
  const config = getRAGConfig()

  // Generate embeddings for all chunks if not provided
  const chunksWithEmbeddings = await Promise.all(
    chunks.map(async (chunk) => ({
      ...chunk,
      embedding: chunk.embedding || await generateEmbedding(chunk.text)
    }))
  )

  // Batch insert
  const client = await pool.connect()
  const chunkIds: string[] = []

  try {
    await client.query('BEGIN')

    for (const chunk of chunksWithEmbeddings) {
      const embeddingVector = embeddingToVectorString(chunk.embedding!)

      const query = `
        INSERT INTO file_chunks (file_extraction_id, chunk_index, chunk_text, embedding, metadata)
        VALUES ($1, $2, $3, $4::vector, $5)
        RETURNING id
      `

      const values = [
        fileExtractionId,
        chunk.index,
        chunk.text,
        embeddingVector,
        JSON.stringify(chunk.metadata || {})
      ]

      const result = await client.query(query, values)
      chunkIds.push(result.rows[0].id)
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return chunkIds
}

/**
 * Search for similar chunks (current conversation priority)
 *
 * @param queryText - Query text
 * @param options - Search options
 * @returns Array of similar chunks with similarity scores
 */
export async function searchSimilarChunks(
  queryText: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const config = getRAGConfig()

  console.log('[VectorDB] ===== searchSimilarChunks START =====')
  console.log('[VectorDB] Input:', {
    queryTextLength: queryText.length,
    queryTextPreview: queryText.substring(0, 100),
    options
  })

  // Generate query embedding
  const embedding = await generateEmbedding(queryText)
  const embeddingVector = embeddingToVectorString(embedding)

  console.log('[VectorDB] Embedding generated:', {
    dimension: embedding.length,
    configDimension: config.embedding.dimensions,
    vectorPreview: embeddingVector.substring(0, 50) + '...'
  })

  const {
    conversationId,
    fileIds,
    maxResults = config.retrieval.currentConvMaxResults,
    threshold = config.retrieval.currentConvThreshold
  } = options || {}

  console.log('[VectorDB] Search options:', {
    conversationId,
    fileIds,
    fileIdsCount: fileIds?.length || 0,
    maxResults,
    threshold,
    configThreshold: config.retrieval.currentConvThreshold
  })

  // Build query conditions
  const conditions: string[] = []
  const values: any[] = [embeddingVector]
  let paramIndex = 2

  // Add file filter
  if (fileIds && fileIds.length > 0) {
    console.log('[VectorDB] File filter:', {
      fileIdsLength: fileIds.length,
      fileIds: fileIds
    })

    // 生成占位符: $2, $3, ...
    const uuidPlaceholders = fileIds.map((_, idx) => {
      return `$${paramIndex + idx}::uuid`
    }).join(', ')

    conditions.push(`fc.file_extraction_id IN (${uuidPlaceholders})`)
    
    // 将文件 ID 追加到 values 数组
    values.push(...fileIds.map(id => id.trim()))
    
    // 更新 paramIndex
    paramIndex += fileIds.length

    console.log('[VectorDB] File filter added:', {
      placeholders: uuidPlaceholders,
      paramIndex
    })
  }

  // Add conversation filter
  // IMPORTANT: Only apply conversation filter if we're NOT filtering by specific files
  // When fileIds are provided, we want to search those files regardless of conversation
  if (conversationId && (!fileIds || fileIds.length === 0)) {
    conditions.push(`fe.conversation_id = $${paramIndex}::uuid`)
    values.push(conversationId)
    paramIndex++
    console.log('[VectorDB] Conversation filter added (no fileIds specified)')
  } else if (conversationId && fileIds && fileIds.length > 0) {
    console.log('[VectorDB] Conversation filter SKIPPED (fileIds specified - search across conversations)')
  }

  const thresholdIndex = paramIndex
  const limitIndex = paramIndex + 1

  values.push(threshold)
  values.push(maxResults)

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

  console.log('[VectorDB] Query parameters:', {
    thresholdIndex,
    limitIndex,
    valuesCount: values.length,
    whereClause
  })

  const query = `
    SELECT
      fc.id as chunk_id,
      fc.file_extraction_id as file_id,
      fe.file_name,
      fe.conversation_id,
      fc.chunk_index,
      fc.chunk_text,
      1 - (fc.embedding <=> $1::vector) as similarity,
      fc.metadata
    FROM file_chunks fc
    JOIN file_extractions fe ON fc.file_extraction_id = fe.id
    WHERE 1=1
      ${whereClause}
      -- 使用上面计算好的索引
      AND (1 - (fc.embedding <=> $1::vector)) >= $${thresholdIndex}
    ORDER BY fc.embedding <=> $1::vector
    LIMIT $${limitIndex}
  `

  console.log('[VectorDB] Executing query:', {
    query,
    values: values.map((v, i) => ({
      index: i + 1,
      type: typeof v,
      isArray: Array.isArray(v),
      preview: Array.isArray(v) ? `[array with ${v.length} items]` : String(v).substring(0, 50)
    }))
  })

  const result = await pool.query(query, values)

  console.log('[VectorDB] Query result:', {
    rowCount: result.rowCount,
    rows: result.rows.map(r => ({
      chunkId: r.chunk_id.substring(0, 8),
      fileName: r.file_name,
      similarity: r.similarity,
      chunkTextPreview: r.chunk_text.substring(0, 50)
    }))
  })

  console.log('[VectorDB] ===== searchSimilarChunks END =====')

  return result.rows
}

/**
 * Search across conversations (for cross-conversation retrieval)
 *
 * @param queryText - Query text
 * @param excludeConversationId - Exclude this conversation (current one)
 * @param options - Search options
 * @returns Array of similar chunks from other conversations
 */
export async function searchCrossConversations(
  queryText: string,
  excludeConversationId: string,
  options?: Partial<SearchOptions>
): Promise<SearchResult[]> {
  const config = getRAGConfig()

  if (!config.retrieval.crossConvEnabled) {
    return []
  }

  // Generate query embedding
  const embedding = await generateEmbedding(queryText)
  const embeddingVector = embeddingToVectorString(embedding)

  const {
    maxResults = config.retrieval.crossConvMaxResults,
    threshold = config.retrieval.crossConvThreshold
  } = options || {}

  const query = `
    SELECT
      fc.id as chunk_id,
      fc.file_extraction_id as file_id,
      fe.file_name,
      fe.conversation_id,
      fc.chunk_index,
      fc.chunk_text,
      1 - (fc.embedding <=> $1::vector) as similarity,
      fc.metadata
    FROM file_chunks fc
    JOIN file_extractions fe ON fc.file_extraction_id = fe.id
    WHERE
      fe.conversation_id != $2::uuid
      AND (1 - (fc.embedding <=> $1::vector)) >= $3
    ORDER BY fc.embedding <=> $1::vector
    LIMIT $4
  `

  const values = [embeddingVector, excludeConversationId, threshold, maxResults]

  const result = await pool.query(query, values)
  return result.rows
}

/**
 * Get chunks for a specific file
 *
 * @param fileExtractionId - File ID
 * @returns Array of chunks
 */
export async function getFileChunks(fileExtractionId: string): Promise<FileChunk[]> {
  const query = `
    SELECT id, file_extraction_id, chunk_index, chunk_text, metadata, created_at
    FROM file_chunks
    WHERE file_extraction_id = $1
    ORDER BY chunk_index
  `

  const result = await pool.query(query, [fileExtractionId])
  return result.rows
}

/**
 * Delete all chunks for a file
 *
 * @param fileExtractionId - File ID
 * @returns Number of deleted chunks
 */
export async function deleteFileChunks(fileExtractionId: string): Promise<number> {
  const query = 'DELETE FROM file_chunks WHERE file_extraction_id = $1'
  const result = await pool.query(query, [fileExtractionId])
  return result.rowCount || 0
}

/**
 * Count chunks for a file
 *
 * @param fileExtractionId - File ID
 * @returns Number of chunks
 */
export async function countFileChunks(fileExtractionId: string): Promise<number> {
  console.log('[VectorDB] countFileChunks:', {
    fileExtractionId
  })

  const query = 'SELECT COUNT(*) FROM file_chunks WHERE file_extraction_id = $1'
  const result = await pool.query(query, [fileExtractionId])
  const count = parseInt(result.rows[0].count, 10)

  console.log('[VectorDB] countFileChunks result:', {
    fileExtractionId,
    count
  })

  return count
}

/**
 * Update file extraction indexed timestamp
 *
 * @param fileExtractionId - File ID
 */
export async function markFileAsIndexed(fileExtractionId: string): Promise<void> {
  const query = `
    UPDATE file_extractions
    SET indexed_at = NOW(),
        processed = TRUE,
        processing_status = 'completed'
    WHERE id = $1
  `

  await pool.query(query, [fileExtractionId])
}

/**
 * Get files that need indexing (processing queue)
 *
 * @param limit - Maximum number of files to return
 * @returns Array of file extractions that need processing
 */
export async function getFilesToProcess(limit: number = 10): Promise<Array<{
  id: string
  file_name: string
  extracted_text: string
  conversation_id?: string
}>> {
  const query = `
    SELECT id, file_name, extracted_text, conversation_id
    FROM file_extractions
    WHERE should_index = TRUE
      AND processed = FALSE
      AND processing_status = 'pending'
    ORDER BY created_at ASC
    LIMIT $1
  `

  const result = await pool.query(query, [limit])
  return result.rows
}

/**
 * Update file processing status
 *
 * @param fileExtractionId - File ID
 * @param status - Processing status
 * @param error - Optional error message
 */
export async function updateFileProcessingStatus(
  fileExtractionId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  error?: string
): Promise<void> {
  const query = `
    UPDATE file_extractions
    SET processing_status = $1,
        processing_error = $2
    WHERE id = $3
  `

  await pool.query(query, [status, error || null, fileExtractionId])
}

/**
 * Hybrid search: vector similarity + keyword matching
 *
 * @param queryText - Query text
 * @param options - Search options
 * @returns Array of similar chunks
 */
export async function hybridSearch(
  queryText: string,
  options?: SearchOptions & { keywords?: string[] }
): Promise<SearchResult[]> {
  const config = getRAGConfig()

  // Vector search
  const vectorResults = await searchSimilarChunks(queryText, options)

  // If no keywords provided, return vector results only
  if (!options?.keywords || options.keywords.length === 0) {
    return vectorResults
  }

  // Build keyword search query
  const keywordConditions = options.keywords.map((_, idx) => {
    return `to_tsvector('simple', chunk_text) @@ to_tsquery('simple', $${idx + 1})`
  }).join(' OR ')

  const keywordQuery = `
    SELECT
      fc.id as chunk_id,
      fc.file_extraction_id as file_id,
      fe.file_name,
      fc.chunk_index,
      fc.chunk_text,
      1.0 as similarity,  -- Default score for keyword match
      fc.metadata
    FROM file_chunks fc
    JOIN file_extractions fe ON fc.file_extraction_id = fe.id
    WHERE ${keywordConditions}
  `

  const keywordResults = await pool.query(keywordQuery, options.keywords)

  // Merge and deduplicate results
  const resultMap = new Map<string, SearchResult>()

  // Add vector results
  vectorResults.forEach(result => {
    resultMap.set(result.chunk_id, result)
  })

  // Boost scores for keyword matches
  keywordResults.rows.forEach((result: SearchResult) => {
    const existing = resultMap.get(result.chunk_id)
    if (existing) {
      // Boost existing result score
      existing.similarity = Math.min(1.0, existing.similarity + 0.1)
    } else {
      // Add keyword-only result
      resultMap.set(result.chunk_id, result)
    }
  })

  // Sort by similarity and return top results
  return Array.from(resultMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options?.maxResults || 10)
}
