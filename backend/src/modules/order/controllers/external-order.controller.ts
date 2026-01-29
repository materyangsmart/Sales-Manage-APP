import { Controller, Get, Param, Query, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { QueryOrdersDto } from '../dto/order.dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CustomerScopeGuard } from '../../../common/guards/customer-scope.guard';
import { Roles, Role } from '../../../common/decorators/roles.decorator';
import { CustomerScope } from '../../../common/decorators/customer-scope.decorator';

/**
 * 外部客户订单API
 * 路径: /api/external/orders
 * 
 * 特点：
 * 1. 只允许CUSTOMER角色访问
 * 2. 强制执行CustomerScope（只能访问自己的数据）
 * 3. 不允许创建、审核等写操作（只读）
 */
@Controller('api/external/orders')
@UseGuards(RolesGuard, CustomerScopeGuard)
@Roles(Role.CUSTOMER)
@CustomerScope()
export class ExternalOrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 查询我的订单（外部客户）
   * GET /api/external/orders
   * 
   * 特点：
   * - 自动注入customerId = token.customerId
   * - 客户端传入的customerId会被忽略
   * - 只返回该客户的订单
   */
  @Get()
  async getMyOrders(@Query() dto: QueryOrdersDto, @Request() req) {
    // 强制使用token中的customerId，忽略客户端传入的customerId
    const customerId = req.user?.customerId;

    if (!customerId) {
      throw new ForbiddenException('Customer ID not found in token');
    }

    // 强制注入customerId，防止越权访问
    return this.orderService.queryOrders({
      ...dto,
      customerId, // 强制覆盖
    });
  }

  /**
   * 获取我的订单详情（外部客户）
   * GET /api/external/orders/:id
   * 
   * 特点：
   * - 验证订单归属：订单的customerId必须等于token.customerId
   * - 如果不匹配，返回403 Forbidden
   */
  @Get(':id')
  async getMyOrderById(@Param('id') id: number, @Request() req) {
    const customerId = req.user?.customerId;

    if (!customerId) {
      throw new ForbiddenException('Customer ID not found in token');
    }

    // 获取订单
    const order = await this.orderService.getOrderById(id);

    // 验证订单归属
    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have permission to access this order',
      );
    }

    return order;
  }
}
