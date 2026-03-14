/**
 * NotificationGateway
 *
 * WebSocket 实时消息推送网关
 *
 * 功能：
 * 1. JWT 握手鉴权：连接建立时解析 Token，绑定 socketId ↔ userId
 * 2. 断线自动注销：disconnect 时从 SocketUserMapService 移除映射
 * 3. 提供 pushToUser() 方法供 NotificationService 调用，毫秒级推送
 *
 * 前端连接方式：
 *   const socket = io('/notifications', {
 *     auth: { token: 'Bearer <jwt>' }
 *   });
 *   socket.on('new_notification', (data) => { ... });
 *
 * 事件定义：
 *   new_notification  → 推送给指定用户的新通知
 *   connected         → 握手成功确认
 *   error             → 鉴权失败
 */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { SocketUserMapService } from '../services/socket-user-map.service';
import { JwtPayload } from '../../rbac/decorators/require-permissions.decorator';

export const WS_EVENTS = {
  NEW_NOTIFICATION: 'new_notification',
  CONNECTED: 'connected',
  ERROR: 'error',
} as const;

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly socketUserMapService: SocketUserMapService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('[NotificationGateway] WebSocket 网关已启动，命名空间: /notifications');
  }

  /**
   * 连接建立时：JWT 握手鉴权 + 注册 userId ↔ socketId 映射
   */
  async handleConnection(client: Socket) {
    try {
      // 从握手数据中提取 Token（支持 auth.token 和 query.token 两种方式）
      const rawToken =
        (client.handshake.auth as any)?.token ||
        (client.handshake.query?.token as string) ||
        '';

      const token = rawToken.startsWith('Bearer ') ? rawToken.substring(7) : rawToken;

      if (!token) {
        this.logger.warn(`[Gateway] 连接被拒绝（无 Token）: socketId=${client.id}`);
        client.emit(WS_EVENTS.ERROR, { message: '缺少认证 Token' });
        client.disconnect(true);
        return;
      }

      const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
      let payload: JwtPayload;

      try {
        payload = jwt.verify(token, jwtSecret) as JwtPayload;
      } catch (err) {
        this.logger.warn(`[Gateway] Token 验证失败: socketId=${client.id}, error=${err.message}`);
        client.emit(WS_EVENTS.ERROR, { message: 'Token 无效或已过期' });
        client.disconnect(true);
        return;
      }

      const userId = payload.userId;

      // 注册映射
      await this.socketUserMapService.register(userId, client.id);

      // 将 userId 存储到 socket 数据中，方便后续使用
      (client as any).userId = userId;
      (client as any).userPayload = payload;

      // 加入用户专属房间（方便广播）
      client.join(`user:${userId}`);

      this.logger.log(
        `[Gateway] 用户连接成功: userId=${userId} (${payload.realName}), socketId=${client.id}`,
      );

      // 发送连接确认
      client.emit(WS_EVENTS.CONNECTED, {
        message: '连接成功',
        userId,
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(`[Gateway] 连接处理异常: ${err.message}`);
      client.disconnect(true);
    }
  }

  /**
   * 断开连接时：注销 socketId 映射
   */
  async handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    await this.socketUserMapService.unregister(client.id);
    this.logger.log(
      `[Gateway] 用户断开连接: userId=${userId ?? 'unknown'}, socketId=${client.id}`,
    );
  }

  /**
   * 推送通知给指定用户（由 NotificationService 调用）
   *
   * @param userId 目标用户 ID
   * @param notification 通知数据
   * @returns 是否成功推送（用户在线则为 true）
   */
  async pushToUser(
    userId: number,
    notification: {
      id: number;
      type: string;
      title: string;
      content: string;
      businessType?: string;
      businessId?: number;
      priority?: string;
      createdAt: Date;
    },
  ): Promise<boolean> {
    const socketIds = await this.socketUserMapService.getSocketIds(userId);

    if (socketIds.length === 0) {
      this.logger.debug(`[Gateway] 用户 ${userId} 不在线，跳过 WebSocket 推送`);
      return false;
    }

    // 通过用户专属房间广播（支持多 Tab）
    this.server.to(`user:${userId}`).emit(WS_EVENTS.NEW_NOTIFICATION, {
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    });

    this.logger.log(
      `[Gateway] 推送通知给用户 ${userId}（${socketIds.length} 个连接）: "${notification.title}"`,
    );
    return true;
  }

  /**
   * 处理客户端心跳（ping/pong）
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): string {
    return 'pong';
  }
}
