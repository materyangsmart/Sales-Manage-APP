import React from 'react';
import { Empty as AntEmpty, Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

interface EmptyProps {
  description?: string;
  onRetry?: () => void;
  onReset?: () => void;
  showRetry?: boolean;
  showReset?: boolean;
}

/**
 * 空态组件
 * 用于展示无数据或错误状态
 */
export const Empty: React.FC<EmptyProps> = ({
  description = '暂无数据',
  onRetry,
  onReset,
  showRetry = false,
  showReset = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AntEmpty
        image={<InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
        description={
          <span className="text-gray-500 text-base">{description}</span>
        }
      >
        <div className="mt-4 space-x-2">
          {showRetry && onRetry && (
            <Button type="primary" onClick={onRetry}>
              重试
            </Button>
          )}
          {showReset && onReset && (
            <Button onClick={onReset}>
              重置筛选
            </Button>
          )}
        </div>
      </AntEmpty>
    </div>
  );
};
