"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Alert, Typography, Card, Space } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

const { Title } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">已登录，正在跳转...</div>
      </div>
    );
  }

  async function handleSubmit(values: { username: string; password: string }) {
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username: values.username,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setError("用户名或密码错误");
      } else {
        // Set tutorial shown flag to false for first-time login
        localStorage.setItem("tutorial-shown", "false");
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <Title level={2}>中欧银发经济知识库</Title>
          <Typography.Text type="secondary">请使用您的账户登录</Typography.Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon className="mb-6" />
        )}

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {loading ? "登录中..." : "登录"}
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <Typography.Text type="secondary" className="text-sm">
            还没有账户？请联系管理员创建
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
