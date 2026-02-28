/**
 * useNotificationSocket
 *
 * WebSocket 长连接 Hook，替代 30 秒轮询
 *
 * 功能：
 * 1. 建立 WebSocket 长连接到 /notifications 命名空间
 * 2. JWT 握手鉴权（从 localStorage 获取 token）
 * 3. 监听 new_notification 事件，动态增加未读数并弹出 Toast
 * 4. 自动重连（socket.io 内置指数退避）
 * 5. 组件卸载时自动断开连接
 *
 * 使用方式：
 *   const { isConnected } = useNotificationSocket({
 *     onNewNotification: (data) => { ... }
 *   });
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface NotificationPayload {
  id: number;
  type: string;
  title: string;
  content: string;
  businessType?: string;
  businessId?: number;
  priority?: string;
  createdAt: string;
}

interface UseNotificationSocketOptions {
  /** JWT token（如果不传，Hook 会尝试从 document.cookie 或 localStorage 中获取） */
  token?: string;
  /** 收到新通知时的回调 */
  onNewNotification?: (notification: NotificationPayload) => void;
  /** 是否启用（登录后才启用） */
  enabled?: boolean;
}

interface UseNotificationSocketReturn {
  /** WebSocket 是否已连接 */
  isConnected: boolean;
  /** 手动断开连接 */
  disconnect: () => void;
  /** 手动重连 */
  reconnect: () => void;
}

/**
 * 从 document.cookie 中提取 token（后端通过 httpOnly cookie 设置）
 * 注意：如果是 httpOnly cookie，前端无法读取，需要通过其他方式传递 token
 */
function getTokenFromStorage(): string {
  // 尝试从 localStorage 获取（开发模式）
  const localToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
  if (localToken) return localToken;

  // 尝试从 cookie 中获取（非 httpOnly）
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === 'auth_token' || key === 'token') {
      return decodeURIComponent(value);
    }
  }

  return '';
}

export function useNotificationSocket(
  options: UseNotificationSocketOptions = {},
): UseNotificationSocketReturn {
  const { token, onNewNotification, enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onNewNotificationRef = useRef(onNewNotification);

  // 保持回调引用稳定
  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const authToken = token || getTokenFromStorage();

    // 确定 WebSocket 服务器地址
    // 开发环境：通过 Vite 代理，后端在同一域名下
    // 生产环境：直接连接后端
    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || '';

    const socket = io(`${backendUrl}/notifications`, {
      auth: { token: authToken ? `Bearer ${authToken}` : '' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('[NotificationSocket] 连接成功, socketId:', socket.id);
      setIsConnected(true);
    });

    socket.on('connected', (data: any) => {
      console.log('[NotificationSocket] 握手确认:', data);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('[NotificationSocket] 断开连接:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err: Error) => {
      console.warn('[NotificationSocket] 连接错误:', err.message);
      setIsConnected(false);
    });

    socket.on('new_notification', (data: NotificationPayload) => {
      console.log('[NotificationSocket] 收到新通知:', data);
      onNewNotificationRef.current?.(data);
    });

    socket.on('error', (err: any) => {
      console.warn('[NotificationSocket] 服务端错误:', err);
    });

    socketRef.current = socket;
  }, [token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 500);
  }, [connect, disconnect]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return { isConnected, disconnect, reconnect };
}
