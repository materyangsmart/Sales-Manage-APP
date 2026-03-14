import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, JwtPayload } from '../decorators/require-permissions.decorator';

/**
 * 权限拦截 Guard
 * 配合 @RequirePermissions() 装饰器使用
 *
 * 拦截逻辑：
 * 1. 读取 @RequirePermissions() 声明的所需权限
 * 2. 从 request.user（JWT 解析后）读取用户权限列表
 * 3. 如果用户没有所需权限，返回 403 Forbidden
 *
 * 注意：必须在 JwtAuthGuard 之后执行
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 读取 @RequirePermissions() 声明的权限列表
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 未声明权限要求，默认放行（只需认证，不需特定权限）
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('用户未认证');
    }

    const userPermissions = user.permissions || [];

    // 超级管理员（permissions 包含 '*'）直接放行
    if (userPermissions.includes('*')) {
      return true;
    }

    // 检查用户是否拥有所有所需权限（AND 逻辑）
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter((p) => !userPermissions.includes(p));
      this.logger.warn(
        `[403] 用户 ${user.username}(id=${user.userId}) 缺少权限: ${missing.join(', ')}`,
      );
      throw new ForbiddenException(
        `权限不足。缺少以下权限：${missing.join(', ')}`,
      );
    }

    return true;
  }
}
