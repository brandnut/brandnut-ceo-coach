/**
 * File Logger - Logs to file system
 *
 * Logs are written to /app/logs in container, mapped to ./logs on host
 */

import fs from 'fs'
import path from 'path'

const LOG_DIR = '/app/logs'
const LOG_FILE = path.join(LOG_DIR, 'app.log')

// Ensure log directory exists
if (typeof window === 'undefined') {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
  } catch (err) {
    console.error('Failed to create log directory:', err)
  }
}

export function logToFile(level: 'info' | 'error' | 'warn', message: string, meta?: any) {
  if (typeof window !== 'undefined') return // Browser only

  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level,
    message,
    ...(meta && { meta }),
  }

  const logLine = JSON.stringify(logEntry) + '\n'

  try {
    fs.appendFileSync(LOG_FILE, logLine)
  } catch (err) {
    // Fail silently to avoid infinite loops
    console.error('Failed to write to log file:', err)
  }
}

// Override console methods to also log to file
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  const originalError = console.error
  const originalWarn = console.warn
  const originalInfo = console.info

  console.error = (...args: any[]) => {
    originalError.apply(console, args)
    logToFile('error', args.join(' '))
  }

  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args)
    logToFile('warn', args.join(' '))
  }

  console.info = (...args: any[]) => {
    originalInfo.apply(console, args)
    logToFile('info', args.join(' '))
  }

  // Global unhandled exception handler
  process.on('uncaughtException', (error) => {
    logToFile('error', `Uncaught Exception: ${error.message}`, {
      stack: error.stack,
    })
    // Give logger time to write, then exit
    setTimeout(() => process.exit(1), 1000)
  })

  // Global unhandled promise rejection handler
  process.on('unhandledRejection', (reason) => {
    logToFile('error', `Unhandled Rejection: ${String(reason)}`, {
      reason: String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
}
