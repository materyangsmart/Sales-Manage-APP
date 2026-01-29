import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from '../services/audit-log.service';
import { QueryAuditLogsDto, TraceAuditLogsDto } from '../dto/query-audit-logs.dto';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * 查询审计日志（分页、过滤）
   * GET /audit-logs?userId=1&action=CREATE&page=1&pageSize=20
   */
  @Get()
  async queryAuditLogs(@Query() dto: QueryAuditLogsDto) {
    return this.auditLogService.queryAuditLogs(dto);
  }

  /**
   * 关键事件追溯（按resourceType/resourceId拉链路）
   * GET /audit-logs/trace?resourceType=AR_PAYMENT&resourceId=1
   */
  @Get('trace')
  async traceAuditLogs(@Query() dto: TraceAuditLogsDto) {
    return this.auditLogService.traceAuditLogs(dto);
  }

  /**
   * 获取最近的审计日志
   * GET /audit-logs/recent?limit=10
   */
  @Get('recent')
  async getRecentAuditLogs(@Query('limit') limit?: number) {
    return this.auditLogService.getRecentAuditLogs(limit);
  }

  /**
   * 获取审计日志统计信息
   * GET /audit-logs/stats?startDate=2024-01-01&endDate=2024-12-31
   */
  @Get('stats')
  async getAuditLogStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLogService.getAuditLogStats(startDate, endDate);
  }
}
