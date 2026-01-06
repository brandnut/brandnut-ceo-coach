-- Add soft delete support for agent conversations
-- Migration: add_soft_delete_agent_conversations
-- Date: 2025-01-07

-- Add deleted_at column to agent_conversations
ALTER TABLE agent_conversations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add partial index for active (non-deleted) conversations only
-- This improves query performance and keeps index size small
CREATE INDEX IF NOT EXISTS idx_agent_conversations_deleted
  ON agent_conversations(user_id, deleted_at) WHERE deleted_at IS NULL;
