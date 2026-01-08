"use client";

import React from "react";
import { Result, Button } from "antd";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details (ARMS will capture this)
    console.error("[Error Boundary] Caught an error:", error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Log additional context
    console.error("[Error Boundary] Error details:", {
      message: error.message,
      stack: error.stack,
      digest: errorInfo.digest,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Result
            status="error"
            title="页面出错了"
            subTitle="抱歉，页面遇到了一些问题。我们已经记录了错误信息，请稍后再试。"
            extra={[
              <Button type="primary" key="refresh" onClick={() => window.location.reload()}>
                刷新页面
              </Button>,
              <Button key="reset" onClick={this.handleReset}>
                重试
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                <p className="font-semibold text-red-800">错误详情：</p>
                <pre className="mt-2 text-xs text-red-700 overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}
