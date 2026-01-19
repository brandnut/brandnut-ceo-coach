/**
 * Embeddings Client using OpenRouter
 *
 * Model: baai/bge-m3 (1024 dimensions)
 */

import OpenAI from 'openai'
import { getRAGConfig } from './config'

export interface EmbeddingResult {
  text: string
  embedding: number[]
  index: number
}

export interface EmbeddingOptions {
  timeout?: number  // Request timeout in milliseconds
}

/**
 * Embeddings client singleton
 */
let embeddingsClient: OpenAI | null = null

/**
 * Get or create OpenAI client configured for OpenRouter
 */
function getClient(): OpenAI {
  if (!embeddingsClient) {
    const config = getRAGConfig()

    embeddingsClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 60000,  // 60 seconds default
    })
  }
  return embeddingsClient
}

/**
 * Generate embedding for a single text
 *
 * @param text - Input text to embed
 * @param options - Optional timeout setting
 * @returns Embedding vector (1024 dimensions)
 */
export async function generateEmbedding(
  text: string,
  options?: EmbeddingOptions
): Promise<number[]> {
  const config = getRAGConfig()

  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text')
  }

  try {
    const client = getClient()

    console.log('[Embeddings] Requesting embedding for text:', text.substring(0, 50) + '...')
    console.log('[Embeddings] Using model:', config.embedding.model)

    const response = await client.embeddings.create({
      model: config.embedding.model,
      input: text,
      encoding_format: 'float',  // Use float format
      timeout: options?.timeout || 30000,  // 30 seconds default
    })

    console.log('[Embeddings] Response received:', {
      hasData: !!response.data,
      dataLength: response.data?.length,
      firstItem: response.data?.[0]
    })

    if (!response.data || response.data.length === 0) {
      console.error('[Embeddings] Full response:', JSON.stringify(response, null, 2))
      throw new Error('Empty response from embeddings API')
    }

    const embedding = response.data[0].embedding

    // Validate embedding dimension
    if (embedding.length !== config.embedding.dimensions) {
      throw new Error(
        `Invalid embedding dimension: expected ${config.embedding.dimensions}, got ${embedding.length}`
      )
    }

    console.log('[Embeddings] Successfully generated embedding with dimension:', embedding.length)
    return embedding
  } catch (error) {
    if (error instanceof Error) {
      // Log error details for debugging
      console.error('[Embeddings] Error generating embedding:', error.message)
      console.error('[Embeddings] Error stack:', error.stack)

      // Add context
      if (error.message.includes('401')) {
        throw new Error('OpenRouter API key is invalid or missing')
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded, please retry later')
      } else if (error.message.includes('timeout')) {
        throw new Error('Embedding generation timed out')
      }
    }
    throw error
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 *
 * @param texts - Array of texts to embed
 * @param options - Optional timeout setting
 * @returns Array of embedding results with text, embedding, and index
 */
export async function generateEmbeddings(
  texts: string[],
  options?: EmbeddingOptions
): Promise<EmbeddingResult[]> {
  const config = getRAGConfig()

  if (!texts || texts.length === 0) {
    throw new Error('Cannot generate embeddings for empty array')
  }

  // Filter out empty texts
  const validTexts = texts.filter(t => t && t.trim().length > 0)

  if (validTexts.length === 0) {
    throw new Error('No valid texts to embed')
  }

  // If only one text, use single embedding function
  if (validTexts.length === 1) {
    const embedding = await generateEmbedding(validTexts[0], options)
    return [{
      text: validTexts[0],
      embedding,
      index: 0
    }]
  }

  // Process in batches if needed
  const batchSize = config.embedding.batchSize
  const results: EmbeddingResult[] = []

  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize)
    const batchStartIndex = i

    try {
      const client = getClient()

      const response = await client.embeddings.create({
        model: config.embedding.model,
        input: batch,
        encoding_format: 'float',
        timeout: options?.timeout || 60000,  // Longer timeout for batches
      })

      if (!response.data || response.data.length !== batch.length) {
        throw new Error(
          `Batch embedding mismatch: expected ${batch.length}, got ${response.data?.length || 0}`
        )
      }

      // Collect results with original text
      const batchResults: EmbeddingResult[] = response.data.map((item, idx) => ({
        text: batch[idx],
        embedding: item.embedding,
        index: batchStartIndex + idx
      }))

      results.push(...batchResults)
    } catch (error) {
      console.error(`[Embeddings] Error processing batch ${i}-${i + batch.length}:`, error)
      throw error
    }
  }

  return results
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(
  embedding1: number[],
  embedding2: number[]
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimension')
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i]
    norm1 += embedding1[i] * embedding1[i]
    norm2 += embedding2[i] * embedding2[i]
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)

  if (denominator === 0) {
    return 0
  }

  return dotProduct / denominator
}

/**
 * Convert embedding array to PostgreSQL vector format
 *
 * @param embedding - Embedding array
 * @returns Vector string for PostgreSQL (e.g., "[0.1,0.2,0.3]")
 */
export function embeddingToVectorString(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Convert PostgreSQL vector string to embedding array
 *
 * @param vectorString - Vector string from PostgreSQL
 * @returns Embedding array
 */
export function vectorStringToEmbedding(vectorString: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorString.replace(/[\[\]]/g, '').trim()
  if (!cleaned) {
    return []
  }
  return cleaned.split(',').map(s => parseFloat(s))
}

/**
 * Validate embedding dimension
 *
 * @param embedding - Embedding array to validate
 * @returns True if valid
 */
export function validateEmbedding(embedding: number[]): boolean {
  const config = getRAGConfig()
  return (
    Array.isArray(embedding) &&
    embedding.length === config.embedding.dimensions &&
    embedding.every(n => typeof n === 'number' && !isNaN(n))
  )
}

/**
 * Reset embeddings client (useful for testing or config changes)
 */
export function resetEmbeddingsClient(): void {
  embeddingsClient = null
}
