'use client'

import { useEffect } from 'react'

export default function ARMSRumProvider() {
  useEffect(() => {
    // Only initialize ARMS RUM in production
    // Turbopack has compatibility issues with rrweb (dependency of @arms/rum-browser)
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      import('@/lib/monitoring/rum')
        .then(() => {
          console.log('[ARMS RUM] Initialized in production')
        })
        .catch((error) => {
          console.error('[ARMS RUM] Failed to initialize:', error)
        })
    }
  }, [])

  return null
}
