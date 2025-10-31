'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { Alert, Spin, Layout } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'

const { Content } = Layout

interface ProtectedRouteProps {
  children: ReactNode
  requireAdmin?: boolean
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  redirectTo
}: ProtectedRouteProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      const loginUrl = redirectTo ? `/login?redirect=${redirectTo}` : '/login'
      router.push(loginUrl)
    } else if (status === 'authenticated' && requireAdmin && session?.user?.role !== 'admin') {
      // 如果需要管理员权限但用户不是管理员，重定向到首页或指定页面
      const targetUrl = redirectTo || '/'
      router.push(targetUrl)
    }
  }, [status, session, requireAdmin, redirectTo, router])

  if (status === 'loading') {
    return (
      <Layout className="min-h-screen">
        <Content className="flex items-center justify-center">
          <div className="text-center">
            <Spin size="large" />
            <div className="mt-4">验证权限中...</div>
          </div>
        </Content>
      </Layout>
    )
  }

  if (status === 'authenticated' && requireAdmin && session?.user?.role !== 'admin') {
    return (
      <Layout className="min-h-screen">
        <Content className="flex items-center justify-center p-8">
          <Alert
            message="权限不足"
            description="您没有权限访问此页面，需要管理员权限"
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
          />
        </Content>
      </Layout>
    )
  }

  if (status === 'authenticated') {
    return <>{children}</>
  }

  return null
}