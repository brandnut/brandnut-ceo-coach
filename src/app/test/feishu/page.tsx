'use client'

import { useState } from 'react'
import { Card, Typography, Button, Alert, Space } from 'antd'
import { FeishuSwitch } from '@/components/ai-elements/FeishuSwitch'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

const { Title, Text } = Typography

function TestFeishuContent() {
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testInitStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/feishu/init-status')
      const data = await response.json()
      setTestResult({
        status: response.status,
        data,
        success: response.ok
      })
    } catch (error) {
      setTestResult({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      })
    } finally {
      setLoading(false)
    }
  }

  const testTokenRefresh = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cron/feishu-token-check?cron_secret=${process.env.NEXT_PUBLIC_CRON_SECRET || 'test'}`)
      const data = await response.json()
      setTestResult({
        status: response.status,
        data,
        success: response.ok
      })
    } catch (error) {
      setTestResult({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Title level={2}>飞书集成测试页面</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 飞书开关组件测试 */}
        <Card title="飞书开关组件">
          <Text>这是实际的飞书开关组件：</Text>
          <div className="mt-4">
            <FeishuSwitch />
          </div>
        </Card>

        {/* API测试 */}
        <Card title="API测试">
          <Space>
            <Button 
              type="primary" 
              onClick={testInitStatus}
              loading={loading}
            >
              测试初始化状态API
            </Button>
            <Button 
              onClick={testTokenRefresh}
              loading={loading}
            >
              测试Token刷新API
            </Button>
          </Space>
          
          {testResult && (
            <div className="mt-4">
              <Alert
                type={testResult.success ? 'success' : 'error'}
                message={testResult.success ? '测试成功' : '测试失败'}
                description={
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                }
              />
            </div>
          )}
        </Card>

        {/* 使用说明 */}
        <Card title="使用说明">
          <div className="space-y-2">
            <Text strong>完整功能流程：</Text>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>确保数据库中已配置飞书应用（feishu_apps表）</li>
              <li>点击上方飞书开关进行授权</li>
              <li>授权成功后开关会保持开启状态</li>
              <li>系统会自动刷新即将过期的Token</li>
              <li>可通过测试API验证功能状态</li>
            </ol>
            
            <Text strong>环境变量配置：</Text>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>CRON_SECRET: 用于定时任务安全验证</li>
              <li>DATABASE_URL: 数据库连接字符串</li>
              <li>AUTH_SECRET: NextAuth密钥</li>
            </ul>
          </div>
        </Card>
      </Space>
    </div>
  )
}

export default function TestFeishuPage() {
  return (
    <ProtectedRoute redirectTo="/test/feishu">
      <TestFeishuContent />
    </ProtectedRoute>
  )
}