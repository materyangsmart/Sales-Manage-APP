import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { CreateOrderDto, ReviewOrderDto, QueryOrdersDto } from '../dto/order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 创建订单（内部用）
   * POST /orders
   */
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  /**
   * 审核订单（approve/reject）
   * POST /orders/review
   */
  @Post('review')
  async reviewOrder(@Body() dto: ReviewOrderDto) {
    return this.orderService.reviewOrder(dto);
  }

  /**
   * 查询订单（分页、过滤）
   * GET /orders?orgId=2&status=PENDING_REVIEW&page=1&pageSize=20
   */
  @Get()
  async queryOrders(@Query() dto: QueryOrdersDto) {
    return this.orderService.queryOrders(dto);
  }

  /**
   * 获取订单详情
   * GET /orders/:id
   */
  @Get(':id')
  async getOrderById(@Param('id') id: number) {
    return this.orderService.getOrderById(id);
  }
}
