'use client'

import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { Layout } from 'antd'
import { useApp } from '@/contexts/AppContext'

const { Content } = Layout

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  redirectTo
}: ProtectedRouteProps) {
  const { me, isLoading } = useApp()
  const isAuthenticated = !!me
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const loginUrl = redirectTo ? `/login?redirect=${redirectTo}` : '/login'
      router.push(loginUrl)
    }
  }, [isAuthenticated, isLoading, me, redirectTo, router])

  // Only render children if authenticated
  // Loading handled by parent component using global isLoading state
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}