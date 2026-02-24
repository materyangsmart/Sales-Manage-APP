import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/ar/entities/audit-log.entity';
import { IDEMPOTENCY_KEY } from '../decorators/idempotency.decorator';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const isIdempotent = this.reflector.get<boolean>(
      IDEMPOTENCY_KEY,
      context.getHandler(),
    );

    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      throw new BadRequestException('Missing Idempotency-Key header');
    }

    // 检查是否已处理
    const existingLog = await this.auditLogRepository.findOne({
      where: { idempotencyKey },
    });

    if (existingLog && existingLog.responseData) {
      // 返回缓存的响应
      return of(existingLog.responseData);
    }

    // 执行请求并缓存响应

    return next.handle().pipe(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      tap(async (response) => {
        // 保存响应用于幂等性
        await this.auditLogRepository.save({
          userId: request.user?.id || null,
          action: request.method,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          resourceType: request.url.split('/')[2] || 'unknown',
          resourceId: response.id || response.paymentNo || 'unknown',
          newValue: request.body,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          idempotencyKey,
          responseData: response,
        });
      }),
    );
  }
}
