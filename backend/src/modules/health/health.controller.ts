import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '进程存活检查' })
  @ApiResponse({ status: 200, description: '进程正常运行' })
  async checkHealth() {
    return this.healthService.checkHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: '服务就绪检查（DB/Redis可用性）' })
  @ApiResponse({ status: 200, description: '服务就绪' })
  @ApiResponse({ status: 503, description: '服务未就绪' })
  async checkReadiness() {
    return this.healthService.checkReadiness();
  }
}
