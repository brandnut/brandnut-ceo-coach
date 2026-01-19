/**
 * RAG Configuration
 *
 * Centralized configuration for RAG (Retrieval Augmented Generation) system.
 * All parameters are configurable via environment variables.
 */

export interface RAGConfig {
  // Embedding model configuration
  embedding: {
    model: string              // Model identifier for OpenRouter
    dimensions: number         // Vector dimension (1024 for baai/bge-m3)
    batchSize: number         // Number of texts to embed in one request
  }

  // Chunking configuration
  chunking: {
    chunkSize: number         // Target chunk size in tokens (default: 600)
    chunkOverlap: number      // Overlap between chunks in tokens (default: 100)
    minChunkSize: number      // Minimum chunk size to avoid tiny fragments
    maxChunkSize: number      // Maximum chunk size to avoid oversized chunks
    separators: string[]      // Text separators for splitting (in priority order)
  }

  // File processing configuration
  processing: {
    longFileThreshold: number // File size threshold in bytes (50KB = 50000)
    enableAsync: boolean      // Whether to process files asynchronously
    maxRetries: number        // Maximum retry attempts for failed processing
    retryDelay: number        // Delay between retries in milliseconds
  }

  // Retrieval configuration
  retrieval: {
    currentConvMaxResults: number      // Max chunks from current conversation
    currentConvThreshold: number       // Similarity threshold for current conv (0.0-1.0)
    crossConvMaxResults: number        // Max chunks from other conversations
    crossConvThreshold: number         // Similarity threshold for cross-conversation
    crossConvEnabled: boolean          // Whether to enable cross-conversation search
  }

  // Feature flags
  features: {
    enableRAG: boolean         // Master switch for RAG functionality
    enableSummarization: boolean // Whether to generate file summaries
    enableVectorIndex: boolean // Whether to create vector index
  }
}

/**
 * Default RAG configuration
 */
const defaultConfig: RAGConfig = {
  embedding: {
    model: 'baai/bge-m3',
    dimensions: 1024,
    batchSize: 100, 
  },

  chunking: {
    chunkSize: 600,          // tokens per chunk
    chunkOverlap: 100,       // tokens overlap
    minChunkSize: 200,       // avoid tiny chunks
    maxChunkSize: 1500,      // avoid oversized chunks
    separators: [
      '\n\n',      // Paragraph break
      '\n',        // Line break
      '。',        // Chinese period
      '！',        // Chinese exclamation
      '？',        // Chinese question mark
      '. ',        // English period
      '! ',        // English exclamation
      '? ',        // English question mark
      '; ',        // Semicolon
      ', ',        // Comma
      ' ',         // Space
      ''           // Last resort: character-level split
    ]
  },

  processing: {
    longFileThreshold: 0,  // 0KB in bytes
    enableAsync: true,
    maxRetries: 3,
    retryDelay: 1000,  // 1 second
  },

  retrieval: {
    currentConvMaxResults: 5,
    currentConvThreshold: 0.70,  // 70% similarity
    crossConvMaxResults: 3,
    crossConvThreshold: 0.75,    // 75% similarity (higher for cross-conversation)
    crossConvEnabled: true,
  },

  features: {
    enableRAG: true,
    enableSummarization: true,
    enableVectorIndex: true,
  }
}

/**
 * Load RAG configuration from environment variables
 *
 * Environment variables:
 * - RAG_ENABLED: Enable/disable RAG (default: true)
 * - RAG_EMBEDDING_MODEL: Embedding model name (default: openai/text-embedding-3-small)
 * - RAG_CHUNK_SIZE: Chunk size in tokens (default: 600)
 * - RAG_CHUNK_OVERLAP: Chunk overlap in tokens (default: 100)
 * - RAG_LONG_FILE_THRESHOLD: Long file threshold in bytes (default: 0)
 * - RAG_CROSS_CONV_ENABLED: Enable cross-conversation search (default: true)
 */
export function loadRAGConfig(): RAGConfig {
  return {
    ...defaultConfig,
    embedding: {
      ...defaultConfig.embedding,
      model: process.env.RAG_EMBEDDING_MODEL || defaultConfig.embedding.model,
    },

    chunking: {
      ...defaultConfig.chunking,
      chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '600', 10),
      chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '100', 10),
    },

    processing: {
      ...defaultConfig.processing,
      longFileThreshold: parseInt(process.env.RAG_LONG_FILE_THRESHOLD || '0', 10),
    },

    retrieval: {
      ...defaultConfig.retrieval,
      crossConvEnabled: process.env.RAG_CROSS_CONV_ENABLED !== 'false',
    },

    features: {
      enableRAG: process.env.RAG_ENABLED !== 'false',
      enableSummarization: process.env.RAG_ENABLE_SUMMARIZATION !== 'false',
      enableVectorIndex: process.env.RAG_ENABLE_VECTOR_INDEX !== 'false',
    }
  }
}

/**
 * Get singleton RAG configuration instance
 */
let configCache: RAGConfig | null = null

export function getRAGConfig(): RAGConfig {
  if (!configCache) {
    configCache = loadRAGConfig()
  }
  return configCache
}

/**
 * Reset configuration cache (useful for testing)
 */
export function resetRAGConfig(): void {
  configCache = null
}

/**
 * Validate RAG configuration
 */
export function validateRAGConfig(config: RAGConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate chunking parameters
  if (config.chunking.chunkSize < 100 || config.chunking.chunkSize > 4000) {
    errors.push('RAG_CHUNK_SIZE must be between 100 and 4000 tokens')
  }

  if (config.chunking.chunkOverlap < 0 || config.chunking.chunkOverlap >= config.chunking.chunkSize) {
    errors.push('RAG_CHUNK_OVERLAP must be between 0 and chunk size')
  }

  if (config.chunking.minChunkSize >= config.chunking.chunkSize) {
    errors.push('minChunkSize must be less than chunkSize')
  }

  // Validate retrieval thresholds
  if (config.retrieval.currentConvThreshold < 0 || config.retrieval.currentConvThreshold > 1) {
    errors.push('currentConvThreshold must be between 0 and 1')
  }

  if (config.retrieval.crossConvThreshold < 0 || config.retrieval.crossConvThreshold > 1) {
    errors.push('crossConvThreshold must be between 0 and 1')
  }

  // Validate embedding dimensions
  if (config.embedding.dimensions <= 0) {
    errors.push('Embedding dimensions must be positive')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
