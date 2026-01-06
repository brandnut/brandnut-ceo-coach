/**
 * Dashboard Questions Database Queries
 *
 * Manage user question dashboards with 7-day cache and concurrent generation control.
 */

import pool from '@/lib/db'

// Database wrapper from existing queries pattern
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

export interface Dashboard {
  id: string
  userId: string
  organizationId: string
  questionsJsonb: Record<string, string[]>
  createdAt: string
  updatedAt: string
  isGenerating: boolean
}

/**
 * Get user's dashboard for an organization
 */
export async function getUserDashboard(
  userId: string,
  organizationId: string
): Promise<Dashboard | null> {
  return withClient(async (client) => {
    const query = `
      SELECT id, user_id, organization_id, questions_jsonb,
             created_at, updated_at, is_generating
      FROM user_question_dashboards
      WHERE user_id = $1 AND organization_id = $2
    `
    const result = await client.query(query, [userId, organizationId])

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      questionsJsonb: row.questions_jsonb,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      isGenerating: row.is_generating,
    }
  })
}

/**
 * Check if dashboard needs refresh (>7 days old)
 */
export function needsRefresh(updatedAt: string): boolean {
  const daysSinceUpdate =
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceUpdate > 7
}

/**
 * Create or update dashboard
 */
export async function upsertDashboard(
  userId: string,
  organizationId: string,
  questionsJsonb: Record<string, string[]>
): Promise<Dashboard> {
  return withClient(async (client) => {
    const query = `
      INSERT INTO user_question_dashboards
        (user_id, organization_id, questions_jsonb, is_generating)
      VALUES ($1, $2, $3, false)
      ON CONFLICT (user_id, organization_id)
      DO UPDATE SET
        questions_jsonb = EXCLUDED.questions_jsonb,
        updated_at = NOW(),
        is_generating = false
      RETURNING id, user_id, organization_id, questions_jsonb,
                created_at, updated_at, is_generating
    `
    const result = await client.query(query, [
      userId,
      organizationId,
      JSON.stringify(questionsJsonb),
    ])
    const row = result.rows[0]

    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      questionsJsonb: row.questions_jsonb,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      isGenerating: row.is_generating,
    }
  })
}

/**
 * Set generating flag (concurrency control)
 */
export async function setGeneratingFlag(
  userId: string,
  organizationId: string,
  isGenerating: boolean
): Promise<void> {
  return withClient(async (client) => {
    const query = `
      UPDATE user_question_dashboards
      SET is_generating = $1
      WHERE user_id = $2 AND organization_id = $3
    `
    await client.query(query, [isGenerating, userId, organizationId])
  })
}
