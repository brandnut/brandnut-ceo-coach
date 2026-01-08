/**
 * Monitoring initialization entry point
 *
 * This file initializes all monitoring:
 * - Frontend: ARMS RUM (loaded by ARMSRumProvider.tsx)
 * - Backend: OpenTelemetry tracing (loaded here)
 */

// Initialize OpenTelemetry tracing for backend
// Only runs in server-side Node.js environment
if (typeof process !== 'undefined' && process.versions?.node) {
  require('./tracing')
}

export {}
