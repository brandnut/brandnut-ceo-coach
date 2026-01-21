/**
 * File Processor Pipeline
 *
 * Orchestrates file processing: summarization and RAG indexing.
 * Triggers after file upload and text extraction.
 */

import OpenAI from 'openai'
import { chunkText, estimateTokenCount } from './chunking'
import { saveChunks, markFileAsIndexed, updateFileProcessingStatus } from './vector-db'
import { getFileExtraction } from '../db/file-queries'
import { getRAGConfig } from './config'

export interface ProcessingResult {
  success: boolean
  fileId: string
  action: 'summarize' | 'index' | 'both'
  summary?: string
  chunkCount?: number
  error?: string
}

export interface FileProcessingOptions {
  conversationId?: string
  forceReprocess?: boolean  // Re-process even if already processed
}

/**
 * Initialize OpenAI client for summarization
 */
function getSummarizationClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  })
}

/**
 * Generate file summary using LLM
 *
 * @param extractedText - Extracted text from file
 * @param fileName - File name for context
 * @returns Generated summary
 */
async function generateFileSummary(
  extractedText: string,
  fileName: string
): Promise<string> {
  const config = getRAGConfig()

  // Truncate text if too long (estimate tokens)
  const estimatedTokens = estimateTokenCount(extractedText)
  const maxTokens = 12000  // Leave room for prompt and response

  let textToSummarize = extractedText
  if (estimatedTokens > maxTokens) {
    // Take first portion of document
    const ratio = maxTokens / estimatedTokens
    const charLimit = Math.floor(extractedText.length * ratio)
    textToSummarize = extractedText.substring(0, charLimit) + '\n\n[文档已截断...]'
  }

  const client = getSummarizationClient()

  const prompt = `请为以下文档生成一个简洁的摘要（3-5句话），重点关注：
1. 文档的主要主题和目的
2. 关键信息点（数据、结论、建议等）
3. 如果是商业文档，提取核心业务信息

文档名称：${fileName}

文档内容：
${textToSummarize}

摘要：`

  try {
    const response = await client.chat.completions.create({
      model: 'qwen/qwen-2.5-72b-instruct',  // Or use 'openai/gpt-4o-mini'
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文档分析助手，擅长提取商业文档的核心信息。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3,  // Lower temperature for more factual summaries
    })

    const summary = response.choices[0]?.message?.content?.trim() || ''

    if (!summary) {
      throw new Error('Empty summary generated')
    }

    return summary
  } catch (error) {
    console.error('[FileProcessor] Error generating summary:', error)
    throw new Error(`Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process file: generate summary and/or create vector index
 *
 * @param fileId - File extraction ID
 * @param options - Processing options
 * @returns Processing result
 */
export async function processFile(
  fileId: string,
  options?: FileProcessingOptions
): Promise<ProcessingResult> {
  const config = getRAGConfig()

  // Check if RAG is enabled
  if (!config.features.enableRAG) {
    return {
      success: false,
      fileId,
      action: 'both',
      error: 'RAG feature is disabled'
    }
  }

  try {
    // Update status to processing
    await updateFileProcessingStatus(fileId, 'processing')

    // Fetch file extraction
    const fileExtraction = await getFileExtraction(fileId)
    if (!fileExtraction) {
      throw new Error(`File extraction not found: ${fileId}`)
    }

    // Update conversation_id if provided
    if (options?.conversationId) {
      const { pool } = await import('../db')
      if (!pool) {
        throw new Error('Database not available')
      }
      await pool.query(
        'UPDATE file_extractions SET conversation_id = $1 WHERE id = $2',
        [options.conversationId, fileId]
      )
    }

    const fileSize = fileExtraction.file_size || 0
    const isLongFile = fileSize > config.processing.longFileThreshold

    // Determine what actions to take
    const shouldSummarize = config.features.enableSummarization && isLongFile
    const shouldIndex = config.features.enableVectorIndex && isLongFile

    if (!shouldSummarize && !shouldIndex) {
      // File too small, mark as processed but skip
      await markFileAsIndexed(fileId)
      await updateFileProcessingStatus(fileId, 'completed')

      return {
        success: true,
        fileId,
        action: 'both',
        error: undefined // No error, just skipped
      }
    }

    let summary: string | undefined
    let chunkCount = 0

    // Step 1: Generate summary (for long files)
    if (shouldSummarize) {
      try {
        console.log(`[FileProcessor] Generating summary for file: ${fileExtraction.file_name}`)
        summary = await generateFileSummary(fileExtraction.extracted_text, fileExtraction.file_name)

        // Save summary to database
        const { pool } = await import('../db')
        if (!pool) {
          throw new Error('Database not available')
        }
        await pool.query(
          'UPDATE file_extractions SET summary = $1 WHERE id = $2',
          [summary, fileId]
        )

        console.log(`[FileProcessor] Summary generated: ${summary.length} chars`)
      } catch (error) {
        console.error('[FileProcessor] Summary generation failed:', error)
        // Don't fail entire process if summarization fails
        summary = undefined
      }
    }

    // Step 2: Create vector index (for long files)
    if (shouldIndex) {
      try {
        console.log(`[FileProcessor] Creating vector index for file: ${fileExtraction.file_name}`)

        // Chunk text
        const chunks = chunkText(fileExtraction.extracted_text, {
          metadata: {
            file_name: fileExtraction.file_name,
            file_size: fileExtraction.file_size,
            mime_type: fileExtraction.mime_type
          }
        })

        console.log(`[FileProcessor] Created ${chunks.length} chunks`)

        // Save chunks with embeddings
        const chunkIds = await saveChunks(fileId, chunks)
        chunkCount = chunkIds.length

        console.log(`[FileProcessor] Indexed ${chunkCount} chunks`)
      } catch (error) {
        console.error('[FileProcessor] Vector indexing failed:', error)
        throw error
      }
    }

    // Mark as processed
    await markFileAsIndexed(fileId)
    await updateFileProcessingStatus(fileId, 'completed')

    return {
      success: true,
      fileId,
      action: shouldSummarize && shouldIndex ? 'both' : (shouldSummarize ? 'summarize' : 'index'),
      summary,
      chunkCount
    }

  } catch (error) {
    console.error('[FileProcessor] Processing failed:', error)

    // Update status to failed
    await updateFileProcessingStatus(
      fileId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    )

    return {
      success: false,
      fileId,
      action: 'both',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Process multiple files (batch processing)
 *
 * @param fileIds - Array of file IDs
 * @param options - Processing options
 * @returns Array of processing results
 */
export async function processFiles(
  fileIds: string[],
  options?: FileProcessingOptions
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = []

  // Process files in parallel (with concurrency limit)
  const concurrencyLimit = 3
  const chunks = []

  for (let i = 0; i < fileIds.length; i += concurrencyLimit) {
    const batch = fileIds.slice(i, i + concurrencyLimit)
    const batchResults = await Promise.all(
      batch.map(fileId => processFile(fileId, options))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Trigger file processing after upload
 *
 * This should be called after file extraction is complete.
 * Processing happens asynchronously to not block the upload response.
 *
 * @param fileId - File extraction ID
 * @param conversationId - Optional conversation ID
 */
export function triggerFileProcessing(
  fileId: string,
  conversationId?: string
): void {
  // Fire and forget - process asynchronously
  processFile(fileId, { conversationId })
    .then(result => {
      if (result.success) {
        console.log(`[FileProcessor] Successfully processed file: ${result.fileId}`, {
          action: result.action,
          chunkCount: result.chunkCount
        })
      } else {
        console.error(`[FileProcessor] Failed to process file: ${result.fileId}`, {
          error: result.error
        })
      }
    })
    .catch(error => {
      console.error(`[FileProcessor] Unhandled error processing file: ${fileId}`, error)
    })
}
