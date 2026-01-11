import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ARService } from '../services/ar.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ApplyPaymentDto } from '../dto/apply-payment.dto';
import { GetSummaryDto } from '../dto/get-summary.dto';
import { ListPaymentsDto } from '../dto/list-payments.dto';
import { Idempotent } from '../../../common/decorators/idempotency.decorator';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import type { Request } from 'express';

@ApiTags('AR (应收账款)')
@Controller('ar')
@UseInterceptors(IdempotencyInterceptor)
export class ARController {
  constructor(private readonly arService: ARService) {}

  @Post('payments')
  @Idempotent()
  @ApiOperation({ summary: '创建收款单' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: '幂等性键（UUID格式，24小时内重复请求返回缓存响应）',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 201,
    description: '收款单创建成功',
    schema: {
      example: {
        id: 1,
        paymentNo: 'PAY1704960000000ABC1',
        amount: 1130000,
        unappliedAmount: 1130000,
        status: 'UNAPPLIED',
        createdAt: '2024-01-11T06:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: '缺少幂等键或参数错误' })
  @ApiResponse({ status: 409, description: '银行流水号已存在' })
  async createPayment(@Body() dto: CreatePaymentDto, @Req() req: Request) {
    return this.arService.createPayment(dto, req.ip, req.headers['user-agent']);
  }

  @Post('apply')
  @Idempotent()
  @ApiOperation({ summary: '核销收款' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: '幂等性键（UUID格式，24小时内重复请求返回缓存响应）',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({
    status: 200,
    description: '核销成功',
    schema: {
      example: {
        paymentNo: 'PAY1704960000000ABC1',
        totalApplied: 565000,
        unappliedAmount: 565000,
        paymentStatus: 'PARTIAL',
        appliedInvoices: [
          {
            invoiceNo: 'INV202401001',
            appliedAmount: 565000,
            beforeBalance: 1130000,
            afterBalance: 565000,
            status: 'PARTIAL',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: '缺少幂等键、参数错误或余额不足' })
  @ApiResponse({ status: 404, description: '收款单或应收单不存在' })
  @ApiResponse({ status: 409, description: '重复核销或并发冲突' })
  async applyPayment(@Body() dto: ApplyPaymentDto, @Req() req: Request) {
    return this.arService.applyPayment(dto, req.ip, req.headers['user-agent']);
  }
  @Get('payments')
  @ApiOperation({ summary: '查询收款单列表' })
  @ApiResponse({
    status: 200,
    description: '返回收款单列表',
    schema: {
      example: {
        items: [
          {
            id: 1,
            paymentNo: 'PAY1704960000000ABC1',
            orgId: 2,
            customerId: 123,
            amount: 1130000,
            unappliedAmount: 565000,
            status: 'PARTIAL',
            paymentDate: '2024-01-11',
            paymentMethod: 'BANK_TRANSFER',
            bankRef: '20240111123456',
            createdAt: '2024-01-11T10:30:00Z',
          },
        ],
        total: 50,
        page: 1,
        pageSize: 20,
        totalPages: 3,
      },
    },
  })
  async listPayments(@Query() dto: ListPaymentsDto) {
    return this.arService.listPayments(dto);
  }

  @Get('summary')
  @ApiOperation({ summary: '获取AR汇总信息（账龄聚合、近到期）' })
  @ApiResponse({
    status: 200,
    description: 'AR汇总信息',
    schema: {
      example: {
        totalBalance: 2300000,
        overdueBalance: 800000,
        aging: {
          current: 1500000,
          days0to30: 500000,
          days31to60: 200000,
          days61to90: 100000,
          days90plus: 0,
        },
        upcomingDue: {
          amount: 300000,
          count: 3,
        },
      },
    },
  })
  async getSummary(@Query() dto: GetSummaryDto) {
    return this.arService.getSummary(dto);
  }
}
