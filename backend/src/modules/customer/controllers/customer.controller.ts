import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CustomerService } from '../customer.service';
import { InternalAuthGuard } from '../../auth/guards/internal-auth.guard';

@Controller('api/internal/customers')
@UseGuards(InternalAuthGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * 获取客户列表
   * GET /api/internal/customers?orgId=1&createdAfter=2026-01-01&page=1&pageSize=100
   */
  @Get()
  async findAll(
    @Query('orgId', ParseIntPipe) orgId: number,
    @Query('createdAfter') createdAfter?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.customerService.findAll({
      orgId,
      createdAfter,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  /**
   * 统计客户数量
   * GET /api/internal/customers/count?orgId=1&createdAfter=2026-01-01
   */
  @Get('count')
  async count(
    @Query('orgId', ParseIntPipe) orgId: number,
    @Query('createdAfter') createdAfter?: string,
  ) {
    const count = await this.customerService.count({
      orgId,
      createdAfter,
    });

    return { count };
  }

  /**
   * 获取单个客户
   * GET /api/internal/customers/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.findOne(id);
  }

  /**
   * 创建客户
   * POST /api/internal/customers
   */
  @Post()
  async create(@Body() customerData: any) {
    return this.customerService.create(customerData);
  }

  /**
   * 更新客户
   * PUT /api/internal/customers/:id
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() customerData: any,
  ) {
    return this.customerService.update(id, customerData);
  }

  /**
   * 删除客户
   * DELETE /api/internal/customers/:id
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.customerService.remove(id);
    return { success: true };
  }
}
