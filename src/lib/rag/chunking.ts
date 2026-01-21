/**
 * Text Chunking Utility
 *
 * Splits text into chunks for RAG indexing with configurable parameters.
 * Uses recursive character splitting with semantic awareness.
 */

import { getRAGConfig } from './config'

export interface Chunk {
  text: string
  index: number
  metadata?: {
    start_index?: number
    end_index?: number
    [key: string]: any
  }
}

export interface ChunkingOptions {
  chunkSize?: number       // Override default chunk size
  chunkOverlap?: number    // Override default chunk overlap
  minChunkSize?: number    // Override minimum chunk size
  separators?: string[]    // Override default separators
  metadata?: Record<string, any>  // Additional metadata to attach
}

/**
 * Estimate token count for text
 *
 * This is a rough estimation: ~1 token per 4 characters for English,
 * ~1 token per 2 characters for Chinese.
 * For production, consider using a proper tokenizer like tiktoken.
 *
 * @param text - Input text
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0

  // Count Chinese characters
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  // Count other characters (assumed to be mostly English/numbers)
  const otherChars = text.length - chineseChars

  // Approximate: 1 token per 2 Chinese chars, 1 token per 4 English chars
  return Math.ceil(chineseChars / 2 + otherChars / 4)
}

/**
 * Split text by separators in priority order
 *
 * @param text - Input text to split
 * @param separators - Array of separators (tried in order)
 * @returns Array of text chunks
 */
function splitBySeparators(text: string, separators: string[]): string[] {
  if (!text) return []

  // Try each separator in order
  for (const separator of separators) {
    if (!separator) {
      // Last resort: split by characters
      return text.split('').map(c => c)
    }

    // Skip if separator not in text
    if (!text.includes(separator)) {
      continue
    }

    // Split by separator
    const chunks = text.split(separator)
      .map(s => s.trim())
      .filter(s => s.length > 0)

    if (chunks.length > 1) {
      return chunks
    }
  }

  // If no separator worked, return whole text
  return [text]
}

/**
 * Split text into chunks with configurable parameters
 *
 * Uses recursive character splitting:
 * 1. Try to split by best separator first
 * 2. Combine small chunks
 * 3. Split oversized chunks
 * 4. Add overlap between chunks
 *
 * @param text - Input text to chunk
 * @param options - Optional chunking parameters
 * @returns Array of text chunks
 */
export function chunkText(text: string, options?: ChunkingOptions): Chunk[] {
  const config = getRAGConfig()

  // Use options or defaults from config
  const chunkSize = options?.chunkSize || config.chunking.chunkSize
  const chunkOverlap = options?.chunkOverlap || config.chunking.chunkOverlap
  const minChunkSize = options?.minChunkSize || config.chunking.minChunkSize
  const separators = options?.separators || config.chunking.separators

  if (!text || text.trim().length === 0) {
    return []
  }

  // Initial split by separators (semantic split)
  const initialChunks = splitBySeparators(text, separators)

  // Group initial chunks into target-sized chunks
  const chunks: Chunk[] = []
  let currentChunk = ''
  let currentIndex = 0
  let globalIndex = 0

  for (const initialChunk of initialChunks) {
    const estimatedTokens = estimateTokenCount(initialChunk)

    // If adding this chunk would exceed max size, save current and start new
    if (currentChunk && estimateTokenCount(currentChunk) + estimatedTokens > chunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          index: currentIndex++,
          metadata: {
            ...options?.metadata,
            start_index: globalIndex - currentChunk.length,
            end_index: globalIndex
          }
        })
      }
      currentChunk = initialChunk
      globalIndex += initialChunk.length
    } else {
      // Add to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + initialChunk
      } else {
        currentChunk = initialChunk
      }
      globalIndex += initialChunk.length
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: currentIndex++,
      metadata: {
        ...options?.metadata,
        start_index: globalIndex - currentChunk.length,
        end_index: globalIndex
      }
    })
  }

  // Step 2: Merge small chunks with neighbors
  const mergedChunks: Chunk[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const estimatedTokens = estimateTokenCount(chunk.text)

    if (estimatedTokens < minChunkSize) {
      // Try to merge with next chunk
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1]
        const mergedText = chunk.text + '\n\n' + nextChunk.text
        const mergedTokens = estimateTokenCount(mergedText)

        if (mergedTokens <= chunkSize) {
          // Merge successfully
          mergedChunks.push({
            text: mergedText,
            index: mergedChunks.length,
            metadata: {
              ...chunk.metadata,
              merged: true,
              original_count: 2
            }
          })
          i++  // Skip next chunk as it's merged
          continue
        }
      }

      // Try to merge with previous chunk
      if (mergedChunks.length > 0) {
        const prevChunk = mergedChunks[mergedChunks.length - 1]
        const mergedText = prevChunk.text + '\n\n' + chunk.text
        const mergedTokens = estimateTokenCount(mergedText)

        if (mergedTokens <= chunkSize) {
          // Merge successfully
          mergedChunks[mergedChunks.length - 1] = {
            text: mergedText,
            index: prevChunk.index,
            metadata: {
              ...prevChunk.metadata,
              merged: true,
              original_count: (prevChunk.metadata?.original_count || 1) + 1
            }
          }
          continue
        }
      }
    }

    // Keep chunk as-is
    mergedChunks.push(chunk)
  }

  // Step 3: Split oversized chunks (shouldn't happen often)
  const finalChunks: Chunk[] = []
  for (const chunk of mergedChunks) {
    const estimatedTokens = estimateTokenCount(chunk.text)

    if (estimatedTokens <= chunkSize) {
      finalChunks.push(chunk)
    } else {
      // Split oversized chunk
      const subChunks = splitOversizedChunk(chunk, chunkSize, chunkOverlap)
      finalChunks.push(...subChunks)
    }
  }

  // Step 4: Add overlap between chunks
  if (chunkOverlap > 0) {
    return addOverlap(finalChunks, chunkOverlap)
  }

  return finalChunks
}

/**
 * Split an oversized chunk into smaller chunks
 *
 * @param chunk - Oversized chunk
 * @param targetSize - Target size in tokens
 * @param overlap - Overlap in tokens
 * @returns Array of smaller chunks
 */
function splitOversizedChunk(chunk: Chunk, targetSize: number, overlap: number): Chunk[] {
  const text = chunk.text
  const estimatedTokens = estimateTokenCount(text)

  if (estimatedTokens <= targetSize) {
    return [chunk]
  }

  // Calculate character ratio (rough approximation)
  const charPerToken = text.length / estimatedTokens
  const targetChars = Math.floor(targetSize * charPerToken)
  const overlapChars = Math.floor(overlap * charPerToken)

  const subChunks: Chunk[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    let endIndex = startIndex + targetChars

    // Try to break at a sentence boundary
    if (endIndex < text.length) {
      // Look for sentence endings nearby
      const lookbehind = 200
      const searchStart = Math.max(startIndex, endIndex - lookbehind)

      const sentenceEnds = ['。', '！', '？', '. ', '! ', '? ', '\n\n']
      let bestBreak = endIndex

      for (const ending of sentenceEnds) {
        const pos = text.lastIndexOf(ending, endIndex)
        if (pos > searchStart) {
          bestBreak = pos + ending.length
          break
        }
      }

      endIndex = bestBreak
    }

    // Extract sub-chunk
    const subText = text.substring(startIndex, endIndex).trim()

    if (subText.length > 0) {
      subChunks.push({
        text: subText,
        index: subChunks.length,
        metadata: {
          ...chunk.metadata,
          split: true,
          parent_index: chunk.index
        }
      })
    }

    // Move to next chunk with overlap
    startIndex = endIndex - overlapChars
  }

  return subChunks
}

/**
 * Add overlap between chunks
 *
 * @param chunks - Array of chunks
 * @param overlapTokens - Overlap size in tokens
 * @returns Chunks with overlap added
 */
function addOverlap(chunks: Chunk[], overlapTokens: number): Chunk[] {
  if (chunks.length <= 1 || overlapTokens <= 0) {
    return chunks
  }

  const withOverlap: Chunk[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    let text = chunk.text

    // Add overlap from previous chunk
    if (i > 0) {
      const prevChunk = chunks[i - 1]
      const estimatedTokens = estimateTokenCount(prevChunk.text)
      const charPerToken = prevChunk.text.length / estimatedTokens
      const overlapChars = Math.floor(overlapTokens * charPerToken)

      // Take last N characters from previous chunk
      const overlapText = prevChunk.text.slice(-overlapChars)
      text = `[Previous context: ${overlapText}]\n\n${text}`
    }

    // Add overlap to next chunk (preview)
    if (i < chunks.length - 1) {
      const nextChunk = chunks[i + 1]
      const estimatedTokens = estimateTokenCount(nextChunk.text)
      const charPerToken = nextChunk.text.length / estimatedTokens
      const overlapChars = Math.floor(overlapTokens * charPerToken)

      // Take first N characters from next chunk
      const overlapText = nextChunk.text.slice(0, overlapChars)
      text = `${text}\n\n[Next context: ${overlapText}]`
    }

    withOverlap.push({
      ...chunk,
      text,
      metadata: {
        ...chunk.metadata,
        has_overlap: true
      }
    })
  }

  return withOverlap
}

/**
 * Count total tokens across all chunks
 *
 * @param chunks - Array of chunks
 * @returns Total estimated token count
 */
export function countTotalTokens(chunks: Chunk[]): number {
  return chunks.reduce((sum, chunk) => sum + estimateTokenCount(chunk.text), 0)
}

/**
 * Get chunking statistics
 *
 * @param text - Input text
 * @param options - Chunking options
 * @returns Statistics about chunking results
 */
export function getChunkingStats(text: string, options?: ChunkingOptions) {
  const chunks = chunkText(text, options)

  return {
    total_chunks: chunks.length,
    total_tokens: countTotalTokens(chunks),
    avg_tokens_per_chunk: countTotalTokens(chunks) / chunks.length,
    min_tokens: Math.min(...chunks.map(c => estimateTokenCount(c.text))),
    max_tokens: Math.max(...chunks.map(c => estimateTokenCount(c.text))),
    chunk_sizes: chunks.map(c => estimateTokenCount(c.text))
  }
}
