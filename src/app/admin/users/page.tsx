'use client'

import { Typography, Layout } from 'antd'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import UserManagement from '@/components/admin/UserManagement'

const { Title } = Typography
const { Content } = Layout

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requireAdmin redirectTo="/admin/users">
      <Layout className="min-h-screen bg-gray-50">
        <Content className="p-8">
          <div className="max-w-6xl mx-auto">
            <Breadcrumbs />
            <Title level={2} className="mb-6">
              管理员控制台
            </Title>
            <UserManagement />
          </div>
        </Content>
      </Layout>
    </ProtectedRoute>
  )
}