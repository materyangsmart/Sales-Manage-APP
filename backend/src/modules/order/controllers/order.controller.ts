import { Controller, Get, Post, Body, Param, Query, Request, UseGuards, UnauthorizedException } from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { CreateOrderDto, ReviewOrderDto, QueryOrdersDto } from '../dto/order.dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles, Role } from '../../../common/decorators/roles.decorator';

@Controller('api/internal/orders')
@UseGuards(RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 创建订单（内部用）
   * POST /api/internal/orders
   * 权限：ADMIN, OPERATOR
   */
  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  async createOrder(@Body() dto: CreateOrderDto, @Request() req) {
    // 从token中获取createdBy，而不是从DTO中获取
    const userId = req.user?.id || 1; // TODO: 从JWT token中获取
    const createOrderData = {
      orgId: dto.orgId,
      customerId: dto.customerId,
      orderDate: dto.orderDate,
      items: dto.items,
      deliveryAddress: dto.deliveryAddress,
      deliveryDate: dto.deliveryDate,
      remark: dto.remark,
      createdBy: userId,
    };
    return this.orderService.createOrder(createOrderData);
  }

  /**
   * 审核订单（approve/reject）
   * POST /api/internal/orders/review
   * 权限：ADMIN, OPERATOR
   */
  @Post('review')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async reviewOrder(@Body() dto: ReviewOrderDto, @Request() req) {
    // 从token中获取reviewedBy，而不是从DTO中获取
    const userId = req.user?.id || 1; // TODO: 从JWT token中获取
    const reviewOrderData = {
      orderId: dto.orderId,
      action: dto.action,
      comment: dto.comment,
      reviewedBy: userId,
    };
    return this.orderService.reviewOrder(reviewOrderData);
  }

  /**
   * 查询订单（分页、过滤）
   * GET /api/internal/orders?orgId=2&status=PENDING_REVIEW&page=1&pageSize=20
   * 权限：ADMIN, OPERATOR, AUDITOR（只读）
   */
  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async queryOrders(@Query() dto: QueryOrdersDto) {
    return this.orderService.queryOrders(dto);
  }

  /**
   * 获取订单详情
   * GET /api/internal/orders/:id
   * 权限：ADMIN, OPERATOR, AUDITOR（只读）
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async getOrderById(@Param('id') id: number) {
    return this.orderService.getOrderById(id);
  }

  /**
   * 履行订单（生成应收发票）
   * POST /api/internal/orders/:id/fulfill
   */
  @Post(':id/fulfill')
  async fulfillOrder(@Param('id') id: number, @Request() req) {
    // 强制要求 internal token，不允许 fallback
    if (!req.user?.id) {
      throw new UnauthorizedException('Fulfill order requires internal authentication');
    }
    
    const userId = req.user.id; // 必须是 number
    return this.orderService.fulfillOrder(id, userId);
  }
}
