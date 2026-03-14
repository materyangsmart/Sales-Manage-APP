/**
 * Redis 分布式锁服务
 *
 * 使用 SET key value NX PX ttl 实现轻量级分布式锁
 * 适用场景：防止高并发重复提交（如工作流发起、订单创建）
 *
 * 在测试/无 Redis 环境下，使用内存 Map 模拟（保证测试可运行）
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private redisClient: any = null;
  private readonly memoryLocks = new Map<string, { value: string; expireAt: number }>();
  private readonly isMock: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isMock =
      configService.get('NODE_ENV') === 'test' || configService.get('REDIS_MOCK') === 'true';

    if (!this.isMock) {
      this.initRedisClient();
    }
  }

  private async initRedisClient() {
    try {
      this.redisClient = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });
      await this.redisClient.connect();
      this.logger.log('Redis 分布式锁客户端连接成功');
    } catch (err) {
      this.logger.warn(`Redis 连接失败，降级为内存锁模式: ${err.message}`);
      this.redisClient = null;
    }
  }

  /**
   * 尝试获取分布式锁
   * @param lockKey 锁的 key（建议格式：module:action:resourceId）
   * @param ttlMs 锁的过期时间（毫秒），默认 10 秒
   * @returns lockToken（成功）或 null（失败，锁已被占用）
   */
  async acquireLock(lockKey: string, ttlMs = 10000): Promise<string | null> {
    const lockToken = uuidv4();
    const fullKey = `lock:${lockKey}`;

    if (this.redisClient) {
      // 真实 Redis：SET key value NX PX ttl
      const result = await this.redisClient.set(fullKey, lockToken, 'NX', 'PX', ttlMs);
      if (result === 'OK') {
        this.logger.debug(`[分布式锁] 获取锁成功: ${fullKey} (token: ${lockToken.slice(0, 8)}...)`);
        return lockToken;
      }
      this.logger.debug(`[分布式锁] 锁已被占用: ${fullKey}`);
      return null;
    }

    // 内存模拟（测试环境）
    const now = Date.now();
    const existing = this.memoryLocks.get(fullKey);
    if (existing && existing.expireAt > now) {
      this.logger.debug(`[分布式锁-内存] 锁已被占用: ${fullKey}`);
      return null;
    }
    this.memoryLocks.set(fullKey, { value: lockToken, expireAt: now + ttlMs });
    this.logger.debug(`[分布式锁-内存] 获取锁成功: ${fullKey}`);
    return lockToken;
  }

  /**
   * 释放分布式锁（只有持有者才能释放）
   * @param lockKey 锁的 key
   * @param lockToken acquireLock 返回的 token
   */
  async releaseLock(lockKey: string, lockToken: string): Promise<boolean> {
    const fullKey = `lock:${lockKey}`;

    if (this.redisClient) {
      // Lua 脚本保证原子性：只有 token 匹配才删除
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await this.redisClient.eval(luaScript, 1, fullKey, lockToken);
      const released = result === 1;
      this.logger.debug(`[分布式锁] 释放锁: ${fullKey} → ${released ? '成功' : '失败（token不匹配）'}`);
      return released;
    }

    // 内存模拟
    const existing = this.memoryLocks.get(fullKey);
    if (existing && existing.value === lockToken) {
      this.memoryLocks.delete(fullKey);
      this.logger.debug(`[分布式锁-内存] 释放锁成功: ${fullKey}`);
      return true;
    }
    return false;
  }

  /**
   * 检查锁是否存在
   */
  async isLocked(lockKey: string): Promise<boolean> {
    const fullKey = `lock:${lockKey}`;
    if (this.redisClient) {
      const result = await this.redisClient.exists(fullKey);
      return result === 1;
    }
    const existing = this.memoryLocks.get(fullKey);
    return !!(existing && existing.expireAt > Date.now());
  }

  /**
   * 带锁执行函数（自动获取和释放锁）
   * @param lockKey 锁的 key
   * @param fn 要执行的函数
   * @param ttlMs 锁的过期时间
   * @throws 如果获取锁失败，抛出错误
   */
  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    ttlMs = 10000,
  ): Promise<T> {
    const token = await this.acquireLock(lockKey, ttlMs);
    if (!token) {
      throw new Error(`LOCK_CONFLICT: 资源 ${lockKey} 正在被处理，请勿重复提交`);
    }
    try {
      return await fn();
    } finally {
      await this.releaseLock(lockKey, token);
    }
  }
}
