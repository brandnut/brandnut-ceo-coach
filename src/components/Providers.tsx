'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from './ThemeProvider'
import { basePath } from '@/lib/config'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      basePath={basePath ? `${basePath}/api/auth` : undefined}
    >
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}
