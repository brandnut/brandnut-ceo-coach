-- ============================================
-- Migration: Add RAG Support with pgvector
-- Date: 2025-01-16
-- Description: Add vector database support for file chunking and semantic search
-- ============================================

-- ============================================
-- Step 1: Install pgvector extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Step 2: Extend file_extractions table
-- ============================================

-- Add conversation_id for cross-conversation search support
ALTER TABLE file_extractions
ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Add RAG processing status fields
ALTER TABLE file_extractions
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS should_index BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Add index for conversation lookup
CREATE INDEX IF NOT EXISTS idx_file_extractions_conversation
ON file_extractions(conversation_id) WHERE conversation_id IS NOT NULL;

-- Add index for processing queue (find files that need processing)
CREATE INDEX IF NOT EXISTS idx_file_extractions_processing_queue
ON file_extractions(processed, should_index)
WHERE processed = FALSE AND should_index = TRUE;

-- ============================================
-- Step 3: Create file_chunks table for vector storage
-- ============================================

CREATE TABLE IF NOT EXISTS file_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_extraction_id UUID NOT NULL REFERENCES file_extractions(id) ON DELETE CASCADE,

  -- Chunk content
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension

  -- Metadata (optional: page number, section title, etc.)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: unique chunk index per file
  UNIQUE(file_extraction_id, chunk_index)
);

-- ============================================
-- Step 4: Create vector similarity index
-- ============================================

-- IVFFlat index (recommended for < 1M rows)
-- Using cosine similarity (vector_cosine_ops)
-- Lists parameter: should be roughly sqrt(number_of_rows)
-- Starting with 100, can be adjusted later based on actual data size
CREATE INDEX IF NOT EXISTS idx_file_chunks_embedding
ON file_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Auxiliary index: query chunks by file
CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id
ON file_chunks(file_extraction_id);

-- ============================================
-- Step 5: Full-text search index (optional, for hybrid search)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_file_chunks_fulltext
ON file_chunks
USING gin(to_tsvector('simple', chunk_text));

-- ============================================
-- Step 6: Helper function for similarity search
-- ============================================

CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(1536),
  p_conversation_id UUID DEFAULT NULL,
  p_file_ids UUID[] DEFAULT NULL,
  max_results INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  file_id UUID,
  file_name TEXT,
  chunk_index INT,
  chunk_text TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id as chunk_id,
    fc.file_extraction_id as file_id,
    fe.file_name,
    fc.chunk_index,
    fc.chunk_text,
    1 - (fc.embedding <=> query_embedding) as similarity,
    fc.metadata
  FROM file_chunks fc
  JOIN file_extractions fe ON fc.file_extraction_id = fe.id
  WHERE
    -- Optional: limit by conversation (current conversation takes priority)
    (p_conversation_id IS NULL OR fe.conversation_id = p_conversation_id)

    -- Optional: limit by specific files
    AND (p_file_ids IS NULL OR fc.file_extraction_id = ANY(p_file_ids))

    -- Similarity threshold filter
    AND (1 - (fc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY fc.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: Helper function for cross-conversation search
-- ============================================

CREATE OR REPLACE FUNCTION search_similar_chunks_cross_conv(
  query_embedding vector(1536),
  exclude_conversation_id UUID DEFAULT NULL,
  max_results INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.75  -- Higher threshold for cross-conversation
)
RETURNS TABLE (
  chunk_id UUID,
  file_id UUID,
  file_name TEXT,
  conversation_id UUID,
  chunk_index INT,
  chunk_text TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id as chunk_id,
    fc.file_extraction_id as file_id,
    fe.file_name,
    fe.conversation_id,
    fc.chunk_index,
    fc.chunk_text,
    1 - (fc.embedding <=> query_embedding) as similarity,
    fc.metadata
  FROM file_chunks fc
  JOIN file_extractions fe ON fc.file_extraction_id = fe.id
  WHERE
    -- Exclude current conversation
    (exclude_conversation_id IS NULL OR fe.conversation_id != exclude_conversation_id)

    -- Higher similarity threshold for cross-conversation results
    AND (1 - (fc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY fc.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 8: View for file processing status
-- ============================================

CREATE OR REPLACE VIEW v_file_processing_status AS
SELECT
  fe.id,
  fe.file_name,
  fe.file_size,
  fe.conversation_id,
  fe.should_index,
  fe.processed,
  fe.processing_status,
  fe.processing_error,
  fe.indexed_at,
  COUNT(fc.id) as chunk_count,
  SUM(LENGTH(fc.chunk_text)) as total_indexed_text,
  AVG(1 - (fc.embedding <=> '[0]'::vector(1536))) as avg_embedding_magnitude  -- Placeholder for monitoring
FROM file_extractions fe
LEFT JOIN file_chunks fc ON fe.id = fc.file_extraction_id
GROUP BY fe.id;

-- ============================================
-- Step 9: Create table for tracking file processing history (optional)
-- ============================================

CREATE TABLE IF NOT EXISTS file_processing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_extraction_id UUID REFERENCES file_extractions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'summarize', 'index', 'both'
  status TEXT NOT NULL,  -- 'started', 'completed', 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_file_processing_history_file_id
ON file_processing_history(file_extraction_id);

-- ============================================
-- Step 10: Triggers for automatic cleanup (optional)
-- ============================================

-- Function to update indexed_at timestamp when chunks are added
CREATE OR REPLACE FUNCTION update_indexed_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE file_extractions
  SET indexed_at = NOW()
  WHERE id = NEW.file_extraction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: update indexed_at when new chunks are inserted
DROP TRIGGER IF EXISTS trigger_update_indexed_at ON file_chunks;
CREATE TRIGGER trigger_update_indexed_at
AFTER INSERT ON file_chunks
FOR EACH ROW
EXECUTE FUNCTION update_indexed_at();

-- ============================================
-- Verification queries
-- ============================================

-- Check if pgvector is installed
-- SELECT extversion FROM pg_extension WHERE extname = 'vector';

-- View table structure
-- \d file_extractions
-- \d file_chunks

-- Count chunks by file
-- SELECT fe.file_name, COUNT(fc.id) as chunk_count
-- FROM file_extractions fe
-- LEFT JOIN file_chunks fc ON fe.id = fc.file_extraction_id
-- GROUP BY fe.id, fe.file_name;

-- ============================================
-- Rollback instructions (if needed)
-- ============================================

-- To rollback this migration:
-- DROP TABLE IF EXISTS file_processing_history CASCADE;
-- DROP TABLE IF EXISTS file_chunks CASCADE;
-- DROP VIEW IF EXISTS v_file_processing_status CASCADE;
-- DROP FUNCTION IF EXISTS search_similar_chunks CASCADE;
-- DROP FUNCTION IF EXISTS search_similar_chunks_cross_conv CASCADE;
-- DROP FUNCTION IF EXISTS update_indexed_at CASCADE;
-- ALTER TABLE file_extractions DROP COLUMN IF EXISTS conversation_id, summary, processed, should_index, indexed_at, processing_status, processing_error;
-- DROP EXTENSION IF EXISTS vector CASCADE;
