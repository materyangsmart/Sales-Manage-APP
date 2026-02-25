import { useEffect } from 'react';
import { toast } from 'sonner';
import { TRPCClientError } from '@trpc/client';

/**
 * 统一的错误处理hook
 * 
 * 用于处理tRPC请求错误，提供友好的用户提示
 */
export function useErrorHandler(error: unknown, context?: string) {
  useEffect(() => {
    if (!error) return;

    // 解析tRPC错误
    if (error instanceof TRPCClientError) {
      const statusCode = error.data?.httpStatus;
      const message = error.message;

      switch (statusCode) {
        case 401:
          toast.error('需要登录', {
            description: '您的登录已过期，请重新登录',
            action: {
              label: '重新登录',
              onClick: () => {
                window.location.href = '/api/oauth/login';
              },
            },
          });
          break;

        case 403:
          toast.error('权限不足', {
            description: '您没有权限执行此操作，请联系管理员',
          });
          break;

        case 404:
          toast.error('资源不存在', {
            description: context ? `${context}：资源不存在` : '请求的资源不存在',
          });
          break;

        case 500:
          toast.error('服务器错误', {
            description: '服务器遇到错误，请稍后重试',
          });
          break;

        default:
          toast.error('请求失败', {
            description: message || '未知错误，请稍后重试',
          });
      }
    } else if (error instanceof Error) {
      // 处理普通Error
      toast.error('操作失败', {
        description: error.message || '未知错误，请稍后重试',
      });
    } else {
      // 处理其他类型错误
      toast.error('操作失败', {
        description: '未知错误，请稍后重试',
      });
    }
  }, [error, context]);
}

/**
 * 从tRPC错误中提取HTTP状态码
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (error instanceof TRPCClientError) {
    return error.data?.httpStatus;
  }
  return undefined;
}

/**
 * 判断是否为认证错误（401/403）
 */
export function isAuthError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  return statusCode === 401 || statusCode === 403;
}

/**
 * 判断是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED')
    );
  }
  return false;
}
