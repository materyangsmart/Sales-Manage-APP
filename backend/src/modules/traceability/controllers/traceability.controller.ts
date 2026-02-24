import { Controller, Get, Param } from '@nestjs/common';
import { TraceabilityService } from '../services/traceability.service';

@Controller('api/internal/traceability')
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  /**
   * 获取追溯数据（联表查询 production_plans + delivery_records）
   * GET /api/internal/traceability/:code
   * code 可以是 orderId 或 orderNo
   */
  @Get(':code')
  async getTraceData(@Param('code') code: string) {
    return this.traceabilityService.getTraceData(code);
  }
}
