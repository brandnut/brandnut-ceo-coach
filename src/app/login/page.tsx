"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Alert, Typography, Card, Space } from "antd";
import { PhoneOutlined, LockOutlined } from "@ant-design/icons";
import { appInfo } from "@/config/app";
import { useApp } from "@/contexts/AppContext";
import { getAssetUrl } from "@/lib/utils";

const { Title } = Typography;

interface LoginState {
  phone: string;
  code: string;
  sendingCode: boolean;
  countdown: number;
  error: string;
  success: string;
}

export default function LoginPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading,
    login,
    sendSmsCode: authSendSmsCode,
  } = useApp();
  const [state, setState] = useState<LoginState>({
    phone: "",
    code: "",
    sendingCode: false,
    countdown: 0,
    error: "",
    success: "",
  });
  const [form] = Form.useForm();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/chat");
    }
  }, [isAuthenticated, isLoading, router]);

  // Countdown timer for SMS resend
  useEffect(() => {
    if (state.countdown > 0) {
      const timer = setTimeout(() => {
        setState((prev) => ({ ...prev, countdown: prev.countdown - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.countdown]);

  const sendSmsCode = async (phone: string) => {
    setState((prev) => ({
      ...prev,
      sendingCode: true,
      error: "",
      success: "",
    }));

    try {
      await authSendSmsCode(phone);
      setState((prev) => ({
        ...prev,
        sendingCode: false,
        success: "验证码已发送，请查收短信",
        countdown: 60,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        sendingCode: false,
        error: error.message || "发送验证码失败",
      }));
    }
  };

  const handleLogin = async (values: { phone: string; code: string }) => {
    setState((prev) => ({
      ...prev,
      error: "",
      success: "",
    }));

    try {
      await login(values.phone, values.code);
      setState((prev) => ({
        ...prev,
        success: "登录成功，正在跳转...",
      }));

      // Manual redirect after successful login
      setTimeout(() => {
        router.push("/chat");
      }, 1000);
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.message || "登录失败",
      }));
    }
  };

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <span className="spinner-large"></span>
          <span className="text-base font-medium">品核 AI 正在载入...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--brandnut-bg-gradient)' }}>
      <div className="w-full max-w-md">
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <img
            src={getAssetUrl("/favicon.png")}
            alt={appInfo.name}
            className="w-16 h-16 mx-auto mb-4"
            style={{ objectFit: 'cover' }}
          />
          <Title level={2} className="mb-2" style={{ color: '#1f2937', fontWeight: 600, fontSize: '24px' }}>
            {appInfo.name}
          </Title>
          <Typography.Text style={{ color: '#6b7280', fontSize: '16px' }}>
            懂企业、懂你的贴身 AI 顾问
          </Typography.Text>
        </div>

        {/* 主卡片 */}
        <Card
          className="shadow-2xl border-0"
          style={{
            borderRadius: '16px',
            paddingTop: '1rem',
            paddingBottom: '0',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}
        >

        {state.error && (
          <Alert message={state.error} type="error" showIcon className="mb-6" />
        )}

        {state.success && (
          <Alert
            message={state.success}
            type="success"
            showIcon
            className="mb-6"
          />
        )}

        <Form
          form={form}
          onFinish={handleLogin}
          layout="vertical"
          initialValues={{ phone: state.phone, code: state.code }}
        >
          {/* 手机号输入 */}
          <div className="mb-6">
            <label className="block text-xs font-medium mb-2" style={{ color: '#374151', fontSize: '12px' }}>
              手机号
            </label>
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: "请输入手机号" },
                { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号格式" },
              ]}
              className="mb-0"
            >
              <Input
                size="large"
                placeholder="请输入手机号"
                maxLength={11}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, phone: e.target.value }))
                }
                style={{
                  borderRadius: '10px',
                  border: '1px solid #fdd5d2',
                  background: '#fff3f2',
                  padding: '12px 16px',
                  fontSize: '14px'
                }}
                className="focus:border-red-500 focus:shadow-sm transition-all"
              />
            </Form.Item>
          </div>

          {/* 验证码输入 */}
          <div className="mb-6">
            <label className="block text-xs font-medium mb-2" style={{ color: '#374151', fontSize: '12px' }}>
              短信验证码
            </label>
            <div className="flex gap-2">
              <Form.Item
                name="code"
                rules={[
                  { required: true, message: "请输入验证码" },
                  { pattern: /^\d{6}$/, message: "验证码为6位数字" },
                ]}
                className="flex-1 mb-0"
              >
                <Input
                  size="large"
                  placeholder="验证码"
                  maxLength={6}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, code: e.target.value }))
                  }
                  style={{
                    borderRadius: '10px',
                    border: '1px solid #fdd5d2',
                    background: '#fff3f2',
                    padding: '12px 16px',
                    fontSize: '14px'
                  }}
                  className="focus:border-red-500 focus:shadow-sm transition-all"
                />
              </Form.Item>
              <Button
                size="large"
                onClick={() => sendSmsCode(state.phone)}
                disabled={
                  !state.phone || state.countdown > 0 || state.sendingCode
                }
                loading={state.sendingCode}
                style={{
                  minWidth: '120px',
                  borderRadius: '10px',
                  background: '#f3f4f6',
                  borderColor: 'transparent',
                  color: state.phone && !state.countdown && !state.sendingCode ? '#6b7280' : '#9ca3af',
                  fontWeight: 400,
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                className="hover:bg-gray-300"
              >
                {state.countdown > 0
                  ? `${state.countdown}s后重发`
                  : state.sendingCode
                  ? "发送中..."
                  : "发送验证码"}
              </Button>
            </div>
          </div>

          {/* 登录按钮 */}
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
            size="large"
            disabled={!state.phone || !state.code}
            style={{
              borderRadius: '10px',
              height: '48px',
              background: state.phone && state.code && !isLoading
                ? 'linear-gradient(135deg, #d51f19 0%, #f5271f 100%)'
                : 'linear-gradient(135deg, #f87171 0%, #f87171 100%)',
              borderColor: 'transparent',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 400,
              transition: 'all 0.2s ease'
            }}
            className="hover:shadow-lg hover:-translate-y-0.5"
          >
            {isLoading ? "登录中..." : "立即登录"}
          </Button>
        </Form>

        {/* 隐私条款 */}
        <div className="text-center mt-6">
          <Typography.Text style={{ color: '#9ca3af', fontSize: '12px' }}>
            登录即代表您已阅读并同意
          </Typography.Text>
          <a
            href="https://brandnut.cn/privacy.txt"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#d51f19', textDecoration: 'none', fontSize: '12px' }}
            className="hover:underline ml-1"
          >
            隐私政策
          </a>
        </div>
        </Card>
      </div>
    </div>
  );
}
