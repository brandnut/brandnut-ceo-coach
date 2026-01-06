/**
 * GET /api/agent/dashboard
 *
 * Returns user's personalized question dashboard.
 * - If exists and fresh: return immediately
 * - If exists but stale (>7 days): return old data, trigger background refresh
 * - If doesn't exist: generate and wait, then return
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createAuthErrorResponse } from '@/lib/auth-middleware'
import { getUserOrganizations } from '@/lib/db/queries'
import {
  getUserDashboard,
  needsRefresh,
  upsertDashboard,
  setGeneratingFlag,
} from '@/lib/db/dashboard-queries'
import { generateDashboardQuestions } from '@/lib/generate-dashboard'

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const authResult = await getCurrentUser(request)
    if (authResult.error || !authResult.user) {
      return createAuthErrorResponse(
        'Unauthorized',
        authResult.error || 'INVALID_TOKEN'
      )
    }

    const user = authResult.user

    // 2. Get user organizations
    const organizations = await getUserOrganizations(user.id)
    if (organizations.length === 0) {
      return NextResponse.json(
        { error: 'No organization', message: 'User not in any organization' },
        { status: 404 }
      )
    }

    const org = organizations[0]

    // 3. Get dashboard (may not exist)
    let dashboard = await getUserDashboard(user.id, org.id)

    // 4. If doesn't exist, generate and wait
    if (!dashboard) {
      const questions = await generateDashboardQuestions(
        user.id,
        org.id
      )
      await upsertDashboard(user.id, org.id, questions)

      return NextResponse.json({
        questions,
      })
    }

    // 5. If exists but stale, trigger background refresh
    if (needsRefresh(dashboard.updatedAt) && !dashboard.isGenerating) {
      await setGeneratingFlag(user.id, org.id, true)

      // Fire-and-forget
      generateInBackground(user.id, org.id).catch((error) => {
        console.error('Background generation failed:', error)
      })
    }

    // 6. Return existing data
    return NextResponse.json({
      questions: dashboard.questionsJsonb,
    })
  } catch (error) {
    console.error('Get dashboard error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Background generation task
 *
 * Fire-and-forget: Does not block the main request
 */
async function generateInBackground(userId: string, organizationId: string) {
  try {
    const questions = await generateDashboardQuestions(
      userId,
      organizationId
    )

    await upsertDashboard(userId, organizationId, questions)

    console.log('✅ Dashboard refreshed for user:', userId)
  } catch (error) {
    console.error('❌ Dashboard generation failed:', error)
    await setGeneratingFlag(userId, organizationId, false)
  }
}
