import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customer/entities/customer.entity';

@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

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
   * 检查数据库连接是否正常
   */
  async checkReadiness() {
    const checks = {
      database: false,
    };

    try {
      // 检查数据库连接
      await this.customerRepository.query('SELECT 1');
      checks.database = true;
    } catch (error) {
      console.error('[Health] Database check failed:', error);
    }

    const allChecksPass = Object.values(checks).every((check) => check === true);

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
}
