import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { QueryAuditLogsDto, TraceAuditLogsDto } from '../dto/query-audit-logs.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * 查询审计日志（分页、过滤）
   */
  async queryAuditLogs(dto: QueryAuditLogsDto) {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = dto;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');

    // 过滤条件
    if (userId) {
      queryBuilder.andWhere('audit_log.userId = :userId', { userId });
    }

    if (action) {
      queryBuilder.andWhere('audit_log.action = :action', { action });
    }

    if (resourceType) {
      queryBuilder.andWhere('audit_log.resourceType = :resourceType', {
        resourceType,
      });
    }

    if (resourceId) {
      queryBuilder.andWhere('audit_log.resourceId = :resourceId', {
        resourceId,
      });
    }

    // 时间范围过滤
    if (startDate && endDate) {
      queryBuilder.andWhere('audit_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      queryBuilder.andWhere('audit_log.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.andWhere('audit_log.createdAt <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // 排序：最新的在前
    queryBuilder.orderBy('audit_log.createdAt', 'DESC');

    // 分页
    const skip = (page - 1) * pageSize;
    queryBuilder.skip(skip).take(pageSize);

    // 执行查询
    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 关键事件追溯（按resourceType/resourceId拉链路）
   */
  async traceAuditLogs(dto: TraceAuditLogsDto) {
    const { resourceType, resourceId, limit = 100 } = dto;

    const auditLogs = await this.auditLogRepository.find({
      where: {
        resourceType,
        resourceId,
      },
      order: {
        createdAt: 'ASC', // 按时间顺序排列，展示完整链路
      },
      take: limit,
    });

    // 构建事件链路
    const timeline = auditLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      timestamp: log.createdAt,
      oldValue: log.oldValue,
      newValue: log.newValue,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    }));

    // 统计信息
    const summary = {
      totalEvents: auditLogs.length,
      firstEvent: auditLogs[0]?.createdAt,
      lastEvent: auditLogs[auditLogs.length - 1]?.createdAt,
      actions: this.countActions(auditLogs),
      users: this.countUsers(auditLogs),
    };

    return {
      resourceType,
      resourceId,
      timeline,
      summary,
    };
  }

  /**
   * 统计操作类型分布
   */
  private countActions(auditLogs: AuditLog[]): Record<string, number> {
    const actionCounts: Record<string, number> = {};
    auditLogs.forEach((log) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    return actionCounts;
  }

  /**
   * 统计操作人分布
   */
  private countUsers(auditLogs: AuditLog[]): Record<number, number> {
    const userCounts: Record<number, number> = {};
    auditLogs.forEach((log) => {
      if (log.userId) {
        userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
      }
    });
    return userCounts;
  }

  /**
   * 获取最近的审计日志（用于仪表板）
   */
  async getRecentAuditLogs(limit: number = 10) {
    return this.auditLogRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * 获取审计日志统计信息
   */
  async getAuditLogStats(startDate?: string, endDate?: string) {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');

    // 时间范围过滤
    if (startDate && endDate) {
      queryBuilder.where('audit_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      queryBuilder.where('audit_log.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.where('audit_log.createdAt <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // 统计总数
    const total = await queryBuilder.getCount();

    // 按操作类型统计
    const actionStats = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit_log.action')
      .getRawMany();

    // 按资源类型统计
    const resourceTypeStats = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.resourceType', 'resourceType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit_log.resourceType')
      .getRawMany();

    // 按用户统计
    const userStats = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.userId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('audit_log.userId IS NOT NULL')
      .groupBy('audit_log.userId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      total,
      actionStats,
      resourceTypeStats,
      topUsers: userStats,
    };
  }
}
