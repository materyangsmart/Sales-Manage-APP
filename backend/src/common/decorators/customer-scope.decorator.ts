import { SetMetadata } from '@nestjs/common';

/**
 * CustomerScope装饰器
 * 标记需要强制执行客户数据隔离的API
 * 
 * 使用示例:
 * @CustomerScope()
 * @Get()
 * async getMyOrders(@Request() req) {
 *   // 自动注入 where customerId = req.user.customerId
 * }
 */
export const CUSTOMER_SCOPE_KEY = 'customerScope';
export const CustomerScope = () => SetMetadata(CUSTOMER_SCOPE_KEY, true);
