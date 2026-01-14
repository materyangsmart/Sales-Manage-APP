import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/ar/entities/audit-log.entity';
export declare class IdempotencyInterceptor implements NestInterceptor {
    private reflector;
    private auditLogRepository;
    constructor(reflector: Reflector, auditLogRepository: Repository<AuditLog>);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
