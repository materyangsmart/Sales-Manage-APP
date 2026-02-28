/**
 * 全局审计日志中间件（AuditLogMiddleware）
 *
 * 与 Interceptor 的区别：
 * - Middleware 在 Guard/Interceptor 之前执行，能捕获所有请求（包括被 Guard 拒绝的）
 * - 使用 response.on('finish') 监听响应完成事件，在响应发送后异步写入日志
 * - 不影响请求响应链，完全异步写入
 *
 * 拦截规则：
 * - 只记录 POST、PUT、PATCH、DELETE 请求
 * - 跳过健康检查、Swagger、WebSocket 等路径
 * - 敏感字段（password、token 等）自动脱敏
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../../modules/ar/entities/audit-log.entity';

/** 跳过审计的路径前缀 */
const SKIP_PATHS = [
  '/health',
  '/api-docs',
  '/swagger',
  '/favicon',
  '/socket.io',
  '/metrics',
];

/** 需要脱敏的字段名（大小写不敏感） */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'authorization',
  'credit_card',
  'card_number',
  'cvv',
  'pin',
];

/**
 * 递归脱敏对象中的敏感字段
 */
function sanitizeBody(body: any, depth = 0): any {
  if (depth > 5 || body === null || body === undefined) return body;
  if (typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map((item) => sanitizeBody(item, depth + 1));

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * 从 Request 中提取真实 IP 地址
 */
function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  return req.ip || (req.socket as any)?.remoteAddress || 'unknown';
}

/**
 * 从 Request 中提取 userId
 * 支持两种认证方式：
 * 1. NestJS JWT（req.user.userId）
 * 2. 内部服务 Token（x-internal-token header，userId 为 0）
 */
function extractUserId(req: Request): number | null {
  const user = (req as any).user;
  if (user?.userId) return user.userId;
  if (user?.id) return user.id;
  const internalToken = req.headers['x-internal-token'];
  if (internalToken) return 0;
  return null;
}

/**
 * 从路径中提取资源类型、资源ID 和操作类型
 */
function extractResource(
  path: string,
  method: string,
): { resourceType: string; resourceId: string; action: string } {
  const cleanPath = path.split('?')[0];
  const segments = cleanPath.split('/').filter(Boolean);
  const internalIdx = segments.indexOf('internal');
  const resourceSegments =
    internalIdx >= 0 ? segments.slice(internalIdx + 1) : segments;
  const resourceType = resourceSegments[0] || 'unknown';
  const resourceId =
    resourceSegments[1] && /^\d+$/.test(resourceSegments[1])
      ? resourceSegments[1]
      : 'N/A';
  const actionMap: Record<string, string> = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };
  const action = actionMap[method.toUpperCase()] || 'WRITE';
  return { resourceType, resourceId, action };
}

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLogMiddleware.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const method = req.method?.toUpperCase() || '';

    // 只拦截写操作
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next();
    }

    // 跳过特定路径
    const path = req.path || req.url || '';
    if (SKIP_PATHS.some((skip) => path.startsWith(skip))) {
      return next();
    }

    const startTime = Date.now();
    const ipAddress = extractIp(req);
    const sanitizedBody = sanitizeBody(req.body);
    const { resourceType, resourceId, action } = extractResource(path, method);

    // 监听响应完成事件（在响应发送后异步写入日志）
    res.on('finish', () => {
      const userId = extractUserId(req);
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const finalAction =
        statusCode >= 400 ? `${action}_FAILED` : action;

      this.writeAuditLog({
        userId,
        action: finalAction,
        resourceType,
        resourceId,
        apiPath: path,
        httpMethod: method,
        ipAddress,
        userAgent: req.headers['user-agent'] || null,
        requestBody: sanitizedBody,
        responseData: { statusCode, durationMs: duration },
      }).catch((err) => {
        this.logger.warn(`[AuditLog] 写入失败: ${err.message}`);
      });
    });

    next();
  }

  private async writeAuditLog(data: {
    userId: number | null;
    action: string;
    resourceType: string;
    resourceId: string;
    apiPath: string;
    httpMethod: string;
    ipAddress: string;
    userAgent: string | null;
    requestBody?: any;
    responseData?: any;
  }): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        apiPath: data.apiPath,
        httpMethod: data.httpMethod,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestBody: data.requestBody,
        newValue: null,
        oldValue: null,
        idempotencyKey: null,
        responseData: data.responseData || null,
      });
      await this.auditLogRepo.save(log);
      this.logger.debug(
        `[AuditLog] ${data.httpMethod} ${data.apiPath} userId=${data.userId ?? 'anonymous'} ip=${data.ipAddress} action=${data.action}`,
      );
    } catch (err: any) {
      this.logger.error(`[AuditLog] 数据库写入异常: ${err.message}`);
    }
  }
}
