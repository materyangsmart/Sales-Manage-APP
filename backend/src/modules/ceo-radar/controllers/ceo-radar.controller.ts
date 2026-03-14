import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { CeoRadarService } from '../services/ceo-radar.service';

@Controller('api/internal/ceo-radar')
export class CeoRadarController {
  constructor(private readonly ceoRadarService: CeoRadarService) {}

  /**
   * 获取CEO雷达全部警报（含得率异动审计）
   * GET /api/internal/ceo-radar/alerts?orgId=2
   */
  @Get('alerts')
  async getAlerts(@Query('orgId', ParseIntPipe) orgId: number) {
    return this.ceoRadarService.getRadarAlerts(orgId);
  }
}
