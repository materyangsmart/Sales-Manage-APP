import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CUSTOMER_SCOPE_KEY } from '../decorators/customer-scope.decorator';

/**
 * CustomerScopeGuard
 * 强制执行客户数据隔离
 * 
 * 功能：
 * 1. 检查API是否标记了@CustomerScope()
 * 2. 如果标记了，则自动在查询条件中添加 customerId 过滤
 * 3. 外部客户只能访问自己的数据
 * 
 * 使用场景：
 * - 外部客户查询自己的订单
 * - 外部客户查询自己的发票
 * - 外部客户查询自己的收款单
 */
@Injectable()
export class CustomerScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresCustomerScope = this.reflector.getAllAndOverride<boolean>(
      CUSTOMER_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresCustomerScope) {
      // 如果没有标记@CustomerScope()，则不需要检查
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // 检查用户是否是外部客户
    if (user.roles?.includes('CUSTOMER')) {
      // 外部客户必须有customerId
      if (!user.customerId) {
        throw new ForbiddenException('Customer ID not found in token');
      }

      // 自动注入customerId到查询条件
      // 注意：这里只是验证，实际的customerId注入在service层完成
      request.customerScope = {
        customerId: user.customerId,
        enforced: true,
      };
    }

    return true;
  }
}
