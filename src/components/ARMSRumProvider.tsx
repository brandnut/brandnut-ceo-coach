'use client'

/**
 * ARMS RUM Provider
 *
 * DISABLED: @arms/rum-browser depends on rrweb which is incompatible with modern bundlers.
 * The rrweb library uses CommonJS 'module' object which causes "module is not defined" errors.
 *
 * We are using OpenTelemetry for backend monitoring instead.
 * Frontend monitoring can be re-enabled if a compatible solution is found.
 *
 * Alternative: Use ARMS SDK for browser without rrweb dependency, or implement custom error tracking.
 */
export default function ARMSRumProvider() {
  // Disabled - see comment above
  return null
}
