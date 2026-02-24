import { Controller, Get, Request } from '@nestjs/common';
import { CommissionService } from '../services/commission.service';

@Controller('api/internal/commission')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  /**
   * 获取当前登录用户的个人业绩
   * GET /api/internal/commission/my-performance
   * 通过 JWT Token 解析出当前 userId，聚合真实发货额和逾期扣减
   */
  @Get('my-performance')
  async getMyPerformance(@Request() req: any) {
    const userId = req.user?.id || 1;
    return this.commissionService.getMyPerformance(userId);
  }
}
