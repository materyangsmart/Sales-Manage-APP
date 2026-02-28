/**
 * Redis 基础设施模块
 *
 * 提供：
 * 1. 全局缓存（@nestjs/cache-manager + ioredis）
 * 2. BullMQ 异步任务队列（@nestjs/bull）
 * 3. 原生 ioredis 客户端（用于分布式锁）
 *
 * 使用方式：
 * - 缓存：注入 @Inject(CACHE_MANAGER) private cacheManager: Cache
 * - 分布式锁：注入 RedisLockService
 * - 队列：@InjectQueue('export') private exportQueue: Queue
 */
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { RedisLockService } from './redis-lock.service';

@Global()
@Module({
  imports: [
    // ─── 全局缓存配置 ─────────────────────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD', '');
        const ttl = configService.get<number>('CACHE_TTL_SECONDS', 300); // 默认 5 分钟

        // 如果是测试环境，使用内存缓存
        if (configService.get('NODE_ENV') === 'test' || configService.get('REDIS_MOCK') === 'true') {
          return { ttl: ttl * 1000 }; // cache-manager v5 使用毫秒
        }

        // 生产/开发环境使用 Redis
        const { redisStore } = await import('cache-manager-ioredis-yet');
        return {
          store: redisStore,
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          ttl: ttl * 1000,
        };
      },
      inject: [ConfigService],
    }),

    // ─── BullMQ 队列配置 ──────────────────────────────────────────────────
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isMock = configService.get('NODE_ENV') === 'test' || configService.get('REDIS_MOCK') === 'true';
        if (isMock) {
          // 测试环境：使用内存队列（通过 ioredis-mock）
          return {
            redis: {
              host: 'localhost',
              port: 6379,
              // Bull 在无法连接时会降级为内存模式
              enableOfflineQueue: true,
              maxRetriesPerRequest: 0,
              lazyConnect: true,
            },
          };
        }
        return {
          redis: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [RedisLockService],
  exports: [CacheModule, BullModule, RedisLockService],
})
export class RedisModule {}
