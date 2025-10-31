'use client'

import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, message, Layout } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { useSession } from 'next-auth/react'

const { Title } = Typography
const { Content } = Layout

function ProfileContent() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handlePasswordChange = async (values: any) => {
    setLoading(true)
    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to change password')
      }

      message.success('密码修改成功')
      form.resetFields()
    } catch (error: any) {
      message.error(error.message || '密码修改失败')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return null
  }

  return (
    <Layout className="min-h-screen bg-gray-50">
      <Content className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Breadcrumbs />
          <Card className="shadow-lg">
            <div className="text-center mb-8">
              <Title level={2}>个人资料</Title>
              <Typography.Text type="secondary">
                管理您的账户信息
              </Typography.Text>
            </div>

            <div className="mb-6">
              <Alert
                message={`当前用户：${session.user.name}`}
                type="info"
                showIcon
                icon={<UserOutlined />}
              />
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handlePasswordChange}
            >
              <Form.Item
                name="currentPassword"
                label="当前密码"
                rules={[
                  { required: true, message: '请输入当前密码' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请输入当前密码"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码至少6个字符' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请输入新密码（至少6个字符）"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'))
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                >
                  {loading ? '修改中...' : '修改密码'}
                </Button>
              </Form.Item>
            </Form>

            <div className="text-center mt-4">
              <Typography.Text type="secondary" className="text-sm">
                如需修改用户名或其他信息，请联系管理员
              </Typography.Text>
            </div>
          </Card>
        </div>
      </Content>
    </Layout>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute redirectTo="/profile">
      <ProfileContent />
    </ProtectedRoute>
  )
}