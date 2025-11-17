"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Alert, Typography, Card, Space } from "antd";
import { PhoneOutlined, LockOutlined } from "@ant-design/icons";
import { appInfo } from "@/config/app";
import { useApp } from "@/contexts/AppContext";

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
      router.push("/");
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
        router.push("/");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <Title level={2}>{appInfo.name}</Title>
          <Typography.Text type="secondary">请使用手机号登录</Typography.Text>
        </div>

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
          size="large"
          initialValues={{ phone: state.phone, code: state.code }}
        >
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: "请输入手机号" },
              { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号格式" },
            ]}
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder="请输入手机号"
              maxLength={11}
              onChange={(e) =>
                setState((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </Form.Item>

          <Form.Item
            name="code"
            rules={[
              { required: true, message: "请输入验证码" },
              { pattern: /^\d{6}$/, message: "验证码为6位数字" },
            ]}
          >
            <Space.Compact style={{ width: "100%" }}>
              <Input
                prefix={<LockOutlined />}
                placeholder="请输入验证码"
                maxLength={6}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, code: e.target.value }))
                }
              />
              <Button
                onClick={() => sendSmsCode(state.phone)}
                disabled={
                  !state.phone || state.countdown > 0 || state.sendingCode
                }
                loading={state.sendingCode}
                style={{ minWidth: 120 }}
              >
                {state.countdown > 0
                  ? `${state.countdown}s后重发`
                  : state.sendingCode
                  ? "发送中..."
                  : "获取验证码"}
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              disabled={!state.phone || !state.code}
            >
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <Typography.Text type="secondary" className="text-sm">
            登录即表示同意服务条款和隐私政策
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
