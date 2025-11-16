'use client'

import { ThemeProvider } from './ThemeProvider'
import { AppProvider } from '@/contexts/AppContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppProvider>
        {children}
      </AppProvider>
    </ThemeProvider>
  )
}
