import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DataScope } from '../entities/role.entity';

export const PERMISSIONS_KEY = 'permissions';
export const DATA_SCOPE_KEY = 'dataScope';

/**
 * @RequirePermissions 装饰器
 * 用于 Controller 方法，声明访问该接口所需的权限编码
 *
 * 用法示例：
 * @RequirePermissions('order:view')
 * @RequirePermissions('commission:edit', 'commission:view')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * JWT Token 载荷结构（扩展版）
 * 登录时签发，包含用户完整的权限信息
 */
export interface JwtPayload {
  /** 用户ID */
  userId: number;
  /** 用户名 */
  username: string;
  /** 真实姓名 */
  realName: string;
  /** 所属组织ID */
  orgId: number;
  /** 角色编码列表（如 ['SALES_REP', 'REGION_DIRECTOR']）*/
  roles: string[];
  /** 权限编码列表（如 ['order:view', 'order:create']）*/
  permissions: string[];
  /** 数据范围（取用户所有角色中最大的数据范围）*/
  dataScope: DataScope;
  /** Token 签发时间 */
  iat?: number;
  /** Token 过期时间 */
  exp?: number;
}

/**
 * @CurrentUser 装饰器
 * 从请求中提取当前登录用户信息
 *
 * 用法：
 * async getOrders(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
