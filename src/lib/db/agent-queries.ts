/**
 * Agent Chat Database Queries
 *
 * Simple, clean queries following the project's patterns.
 * No special cases, no unnecessary complexity.
 */

import pool from '@/lib/db'
import { Conversation, Message, Attachment } from '@/types/agent'

// Database wrapper from existing queries.ts pattern
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
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  title?: string
): Promise<Conversation> {
  return withClient(async (client) => {
    const query = `
      INSERT INTO agent_conversations (user_id, title)
      VALUES ($1, $2)
      RETURNING id, user_id, title, created_at, updated_at
    `

    const result = await client.query(query, [userId, title || null])

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  })
}

/**
 * Get a conversation by ID (with user ownership check)
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  return withClient(async (client) => {
    const query = `
      SELECT id, user_id, title, created_at, updated_at
      FROM agent_conversations
      WHERE id = $1 AND user_id = $2
    `

    const result = await client.query(query, [conversationId, userId])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  })
}

/**
 * Get messages in a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  limit: number = 50
): Promise<Message[]> {
  return withClient(async (client) => {
    const query = `
      SELECT id, conversation_id, role, content, attachments, created_at
      FROM agent_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `

    const result = await client.query(query, [conversationId, limit])

    return result.rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      attachments: row.attachments || [],
      createdAt: row.created_at.toISOString(),
    }))
  })
}

/**
 * Create a message in a conversation
 */
export async function createMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  attachments?: Attachment[]
): Promise<Message> {
  return withClient(async (client) => {
    const query = `
      INSERT INTO agent_messages (conversation_id, role, content, attachments)
      VALUES ($1, $2, $3, $4)
      RETURNING id, conversation_id, role, content, attachments, created_at
    `

    const result = await client.query(query, [
      conversationId,
      role,
      content,
      JSON.stringify(attachments || []),
    ])

    const row = result.rows[0]
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      attachments: row.attachments || [],
      createdAt: row.created_at.toISOString(),
    }
  })
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  return withClient(async (client) => {
    const query = `
      UPDATE agent_conversations
      SET title = $1, updated_at = NOW()
      WHERE id = $2
    `

    await client.query(query, [title, conversationId])
  })
}

/**
 * Get user's conversations (for listing)
 */
export async function getUserConversations(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ conversations: Conversation[]; total: number }> {
  return withClient(async (client) => {
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM agent_conversations
      WHERE user_id = $1
    `
    const countResult = await client.query(countQuery, [userId])
    const total = parseInt(countResult.rows[0].total, 10)

    // Get conversations
    const query = `
      SELECT id, user_id, title, created_at, updated_at
      FROM agent_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3
    `

    const result = await client.query(query, [userId, limit, offset])

    const conversations = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }))

    return { conversations, total }
  })
}
