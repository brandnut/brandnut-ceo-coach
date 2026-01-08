/**
 * Global Error Handler
 *
 * Catches and logs all unhandled errors and promise rejections.
 * Logs are written to console (captured by Docker) and optionally to database.
 */

// TODO: Implement createErrorLog function and enable DB logging
// import { createErrorLog } from '@/lib/db/agent-queries'

interface ErrorContext {
  userId?: string
  conversationId?: string
  route?: string
  [key: string]: any
}

interface ErrorLog {
  timestamp: string
  type: 'uncaughtException' | 'unhandledRejection' | 'apiError' | 'streamError'
  message: string
  stack?: string
  context?: ErrorContext
}

/**
 * Format error for logging
 */
function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  if (error && typeof error === 'object') {
    try {
      const stringified = JSON.stringify(error)
      return { message: stringified }
    } catch {
      return { message: String(error) }
    }
  }

  return { message: 'Unknown error' }
}

/**
 * Log error to console (captured by Docker)
 */
function logError(errorLog: ErrorLog) {
  const logEntry = JSON.stringify(errorLog, null, 2)
  console.error('[GlobalErrorHandler]', logEntry)
}

/**
 * Log error to database (non-blocking)
 * TODO: Re-enable after implementing createErrorLog
 */
function logToDatabase(
  _userId: string | undefined,
  _errorType: string,
  _errorMessage: string,
  _errorStack: string | undefined,
  _context: ErrorContext | undefined
) {
  // Disabled until createErrorLog is implemented
  // if (!userId) return
  // createErrorLog({...}).catch((err) => {
  //   console.error('[GlobalErrorHandler] Failed to save error log:', err)
  // })
}

/**
 * Handle uncaught exceptions
 */
function handleUncaughtException(error: Error) {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    type: 'uncaughtException',
    message: error.message,
    stack: error.stack,
  }

  logError(errorLog)
  logToDatabase(undefined, 'uncaughtException', error.message, error.stack, undefined)

  // Give logger time to flush, then exit
  setTimeout(() => {
    process.exit(1)
  }, 1000)
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(reason: unknown) {
  const { message, stack } = formatError(reason)

  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    type: 'unhandledRejection',
    message,
    stack,
  }

  logError(errorLog)
  logToDatabase(undefined, 'unhandledRejection', message, stack, undefined)
}

/**
 * Log API error
 */
export function logApiError(error: unknown, context: ErrorContext = {}) {
  const { message, stack } = formatError(error)

  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    type: 'apiError',
    message,
    stack,
    context,
  }

  logError(errorLog)
  logToDatabase(context.userId, 'apiError', message, stack, context)
}

/**
 * Log streaming error
 */
export function logStreamError(error: unknown, context: ErrorContext = {}) {
  const { message, stack } = formatError(error)

  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    type: 'streamError',
    message,
    stack,
    context,
  }

  logError(errorLog)
  logToDatabase(context.userId, 'streamError', message, stack, context)
}

/**
 * Initialize global error handlers
 */
export function initializeGlobalErrorHandlers() {
  process.on('uncaughtException', handleUncaughtException)
  process.on('unhandledRejection', handleUnhandledRejection)

  console.log('[GlobalErrorHandler] Initialized')
}
