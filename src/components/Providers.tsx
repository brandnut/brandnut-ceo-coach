'use client'

import { ThemeProvider } from './ThemeProvider'
import { AppProvider } from '@/contexts/AppContext'
import { ErrorBoundary } from './ErrorBoundary'
import { ErrorHandling } from './ErrorHandling'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ErrorHandling />
      <ThemeProvider>
        <AppProvider>
          {children}
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
