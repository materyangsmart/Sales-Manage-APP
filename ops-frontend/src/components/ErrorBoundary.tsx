import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 错误边界组件
 * 捕获子组件中的JavaScript错误并显示友好的错误页面
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Result
            status="error"
            title="页面出错了"
            subTitle={this.state.error?.message || '抱歉，页面遇到了一些问题'}
            extra={[
              <Button type="primary" key="console" onClick={this.handleReset}>
                刷新页面
              </Button>,
              <Button key="buy" onClick={() => window.history.back()}>
                返回上一页
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
