-- Add file extraction support for document uploads
-- Migration: add_file_extractions
-- Date: 2025-01-07

-- 1. File extractions table (stores extracted text from uploaded documents)
CREATE TABLE IF NOT EXISTS file_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  mime_type TEXT,
  file_size INT,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Index for URL lookups
CREATE INDEX IF NOT EXISTS idx_file_extractions_url ON file_extractions(file_url);

-- 2. Add injected_content column to agent_messages
-- This stores the merged content (user input + file text) for LLM context
ALTER TABLE agent_messages
ADD COLUMN IF NOT EXISTS injected_content TEXT;

-- 3. Index for historical message queries (conversation history)
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created
  ON agent_messages(conversation_id, created_at DESC);
