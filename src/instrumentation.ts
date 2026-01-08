/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically imported by Next.js when the server starts.
 * It's used to initialize server-side monitoring and instrumentation.
 *
 * @see https://nextjs.org/docs/app/building-your-application/configuring/instrumentation
 */

export async function register() {
  // Initialize OpenTelemetry tracing for backend monitoring
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/monitoring/index.ts')
    console.log('[Instrumentation] OpenTelemetry tracing registered')
  }
}
