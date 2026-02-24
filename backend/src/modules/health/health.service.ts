import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../order/entities/customer.entity';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  private redisClient: Redis | null = null;

  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private configService: ConfigService,
  ) {
    // 初始化Redis客户端（如果配置了Redis）
    const redisHost = this.configService.get('REDIS_HOST');
    const redisPort = this.configService.get('REDIS_PORT', 6379);
    const redisPassword = this.configService.get('REDIS_PASSWORD');

    if (redisHost) {
      try {
        this.redisClient = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          retryStrategy: () => null, // 不自动重连
          lazyConnect: true, // 延迟连接
        });
      } catch (error) {
        console.warn('[Health] Redis client initialization failed:', error);
      }
    }
  }

  /**
   * 进程存活检查
   * 只要进程能响应请求就返回成功
   */
  async checkHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      message: 'Service is running',
    };
  }

  /**
   * 服务就绪检查
   * 检查数据库和Redis连接是否正常
   */
  async checkReadiness() {
    const checks = {
      database: false,
      redis: false,
    };

    // 检查数据库连接
    try {
      await this.customerRepository.query('SELECT 1');
      checks.database = true;
    } catch (error) {
      console.error('[Health] Database check failed:', error);
    }

    // 检查Redis连接（如果配置了Redis）
    // Redis是可选的，即使连接失败也不影响服务就绪状态
    if (this.redisClient) {
      try {
        await this.redisClient.connect();
        await this.redisClient.ping();
        checks.redis = true;
        await this.redisClient.disconnect();
      } catch (error) {
        console.warn('[Health] Redis check failed (optional service):', error.message);
        checks.redis = true; // Redis是可选的，不影响服务就绪
      }
    } else {
      // 如果没有配置 Redis，视为通过
      checks.redis = true;
    }

    const allChecksPass = Object.values(checks).every(
      (check) => check === true,
    );

    if (!allChecksPass) {
      throw new HttpException(
        {
          status: 'not ready',
          timestamp: new Date().toISOString(),
          checks,
          message: 'Service is not ready',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks,
      message: 'Service is ready',
    };
  }

  /**
   * 获取版本信息
   * 用于发布验证
   */
  async getVersion() {
    const packageJson = require('../../../../package.json');
    
    return {
      version: packageJson.version || '1.0.0',
      name: packageJson.name || 'qianzhang-sales-backend',
      description: packageJson.description || 'Qianzhang Sales Management System Backend',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV', 'development'),
    };
  }
}
