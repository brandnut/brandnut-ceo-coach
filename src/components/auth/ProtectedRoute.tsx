'use client'

import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { Layout } from 'antd'
import { useApp } from '@/contexts/AppContext'

const { Content } = Layout

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
  requireAdmin?: boolean
}

export default function ProtectedRoute({
  children,
  redirectTo,
  requireAdmin = false
}: ProtectedRouteProps) {
  const { me, isLoading } = useApp()
  const isAuthenticated = !!me
  const isAdmin = me?.roles?.some(role => role.role_name === '管理员') || false
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const loginUrl = redirectTo ? `/login?redirect=${redirectTo}` : '/login'
      router.push(loginUrl)
    } else if (!isLoading && isAuthenticated && requireAdmin && !isAdmin) {
      // Redirect to home if user is not admin
      router.push('/')
    }
  }, [isAuthenticated, isAdmin, isLoading, me, redirectTo, router, requireAdmin])

  // Only render children if authenticated
  // Loading handled by parent component using global isLoading state
  if (!isAuthenticated) {
    return null
  }

  // If admin access required but user is not admin, don't render
  if (requireAdmin && !isAdmin) {
    return null
  }

  return <>{children}</>
}