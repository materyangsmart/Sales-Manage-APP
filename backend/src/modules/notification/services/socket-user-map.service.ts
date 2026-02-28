/**
 * SocketUserMapService
 *
 * 管理 userId ↔ socketId 的双向映射
 * - 开发/测试环境：使用内存 Map（REDIS_MOCK=true 或 NODE_ENV=test）
 * - 生产环境：使用 Redis Hash，支持多实例水平扩展
 *
 * Redis Key 设计：
 *   ws:user:{userId}   → Set<socketId>   （一个用户可能有多个 Tab）
 *   ws:socket:{socketId} → userId         （反向查找）
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const WS_USER_PREFIX = 'ws:user:';
const WS_SOCKET_PREFIX = 'ws:socket:';
const WS_TTL_SECONDS = 86400; // 24 小时

@Injectable()
export class SocketUserMapService {
  private readonly logger = new Logger(SocketUserMapService.name);
  private readonly isMock: boolean;
  private redisClient: Redis | null = null;

  // 内存模式（测试/无 Redis 环境）
  private readonly userToSockets = new Map<number, Set<string>>();
  private readonly socketToUser = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    this.isMock =
      configService.get('NODE_ENV') === 'test' ||
      configService.get('REDIS_MOCK') === 'true';

    if (!this.isMock) {
      this.initRedis();
    } else {
      this.logger.log('[SocketUserMap] 使用内存模式（测试/无 Redis 环境）');
    }
  }

  private async initRedis() {
    try {
      this.redisClient = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });
      await this.redisClient.connect();
      this.logger.log('[SocketUserMap] Redis 连接成功');
    } catch (err) {
      this.logger.warn(`[SocketUserMap] Redis 连接失败，降级为内存模式: ${err.message}`);
      this.redisClient = null;
    }
  }

  /**
   * 注册用户的 Socket 连接
   */
  async register(userId: number, socketId: string): Promise<void> {
    if (this.redisClient) {
      const pipeline = this.redisClient.pipeline();
      pipeline.sadd(`${WS_USER_PREFIX}${userId}`, socketId);
      pipeline.expire(`${WS_USER_PREFIX}${userId}`, WS_TTL_SECONDS);
      pipeline.set(`${WS_SOCKET_PREFIX}${socketId}`, String(userId), 'EX', WS_TTL_SECONDS);
      await pipeline.exec();
    } else {
      // 内存模式
      if (!this.userToSockets.has(userId)) {
        this.userToSockets.set(userId, new Set());
      }
      this.userToSockets.get(userId)!.add(socketId);
      this.socketToUser.set(socketId, userId);
    }
    this.logger.log(`[SocketUserMap] 注册: userId=${userId}, socketId=${socketId}`);
  }

  /**
   * 注销 Socket 连接（断开时调用）
   */
  async unregister(socketId: string): Promise<void> {
    if (this.redisClient) {
      const userIdStr = await this.redisClient.get(`${WS_SOCKET_PREFIX}${socketId}`);
      if (userIdStr) {
        const userId = parseInt(userIdStr);
        await this.redisClient.srem(`${WS_USER_PREFIX}${userId}`, socketId);
        await this.redisClient.del(`${WS_SOCKET_PREFIX}${socketId}`);
        this.logger.log(`[SocketUserMap] 注销: userId=${userId}, socketId=${socketId}`);
      }
    } else {
      const userId = this.socketToUser.get(socketId);
      if (userId !== undefined) {
        this.userToSockets.get(userId)?.delete(socketId);
        this.socketToUser.delete(socketId);
        this.logger.log(`[SocketUserMap] 注销(内存): userId=${userId}, socketId=${socketId}`);
      }
    }
  }

  /**
   * 获取用户的所有在线 socketId
   */
  async getSocketIds(userId: number): Promise<string[]> {
    if (this.redisClient) {
      const socketIds = await this.redisClient.smembers(`${WS_USER_PREFIX}${userId}`);
      return socketIds;
    }
    const sockets = this.userToSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * 通过 socketId 反查 userId
   */
  async getUserId(socketId: string): Promise<number | null> {
    if (this.redisClient) {
      const userIdStr = await this.redisClient.get(`${WS_SOCKET_PREFIX}${socketId}`);
      return userIdStr ? parseInt(userIdStr) : null;
    }
    return this.socketToUser.get(socketId) ?? null;
  }

  /**
   * 检查用户是否在线
   */
  async isOnline(userId: number): Promise<boolean> {
    const socketIds = await this.getSocketIds(userId);
    return socketIds.length > 0;
  }

  /**
   * 获取所有在线用户数（用于监控）
   */
  getOnlineCount(): number {
    if (!this.redisClient) {
      return this.userToSockets.size;
    }
    return -1; // Redis 模式下需要异步查询，此处仅返回占位
  }
}
