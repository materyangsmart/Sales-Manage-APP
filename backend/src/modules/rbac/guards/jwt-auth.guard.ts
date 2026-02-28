import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../decorators/require-permissions.decorator';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public 装饰器：标记无需认证的接口
 */
export const Public = () => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(IS_PUBLIC_KEY, true);
};

/**
 * JWT 认证 Guard
 * 全局应用，解析 Authorization Bearer Token 并注入 request.user
 *
 * 支持两种认证方式：
 * 1. Authorization: Bearer <jwt_token>  （标准 JWT）
 * 2. x-internal-token: <token>          （内部服务调用）
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 检查是否标记为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();

    // 方式1：内部服务 Token（用于 ops-frontend → backend 的内部调用）
    const internalToken = request.headers['x-internal-token'];
    const expectedInternalToken = this.configService.get('INTERNAL_SERVICE_TOKEN');
    if (internalToken && expectedInternalToken && internalToken === expectedInternalToken) {
      // 内部调用注入超级管理员权限
      request.user = {
        userId: 0,
        username: 'internal-service',
        realName: '内部服务',
        orgId: 1,
        roles: ['ADMIN'],
        permissions: ['*'],
        dataScope: 'ALL',
      } as JwtPayload;
      return true;
    }

    // 方式2：JWT Bearer Token
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少认证 Token，请先登录');
    }

    const token = authHeader.substring(7);
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      this.logger.error('JWT_SECRET 未配置！');
      throw new UnauthorizedException('服务器认证配置错误');
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as JwtPayload;
      request.user = payload;
      return true;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token 已过期，请重新登录');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Token 无效，请重新登录');
      }
      throw new UnauthorizedException('认证失败');
    }
  }
}
