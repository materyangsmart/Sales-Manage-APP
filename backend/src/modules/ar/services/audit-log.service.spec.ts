import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from '../entities/audit-log.entity';
import { QueryAuditLogsDto, TraceAuditLogsDto } from '../dto/query-audit-logs.dto';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: Repository<AuditLog>;

  const mockAuditLogRepository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryAuditLogs', () => {
    it('应该返回分页的审计日志', async () => {
      const dto: QueryAuditLogsDto = {
        page: 1,
        pageSize: 20,
      };

      const mockAuditLogs = [
        {
          id: 1,
          userId: 1,
          action: 'CREATE',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          createdAt: new Date(),
        },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockAuditLogs, 1]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.queryAuditLogs(dto);

      expect(result).toEqual({
        items: mockAuditLogs,
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('应该根据userId过滤', async () => {
      const dto: QueryAuditLogsDto = {
        userId: 1,
        page: 1,
        pageSize: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.queryAuditLogs(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit_log.userId = :userId',
        { userId: 1 },
      );
    });

    it('应该根据action过滤', async () => {
      const dto: QueryAuditLogsDto = {
        action: 'CREATE',
        page: 1,
        pageSize: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.queryAuditLogs(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit_log.action = :action',
        { action: 'CREATE' },
      );
    });

    it('应该根据resourceType过滤', async () => {
      const dto: QueryAuditLogsDto = {
        resourceType: 'AR_PAYMENT',
        page: 1,
        pageSize: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.queryAuditLogs(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit_log.resourceType = :resourceType',
        { resourceType: 'AR_PAYMENT' },
      );
    });

    it('应该根据时间范围过滤', async () => {
      const dto: QueryAuditLogsDto = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 1,
        pageSize: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.queryAuditLogs(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit_log.createdAt BETWEEN :startDate AND :endDate',
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
    });
  });

  describe('traceAuditLogs', () => {
    it('应该返回资源的完整审计链路', async () => {
      const dto: TraceAuditLogsDto = {
        resourceType: 'AR_PAYMENT',
        resourceId: '1',
      };

      const mockAuditLogs = [
        {
          id: 1,
          userId: 1,
          action: 'CREATE',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          oldValue: null,
          newValue: { amount: 10000 },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          userId: 1,
          action: 'APPLY',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          oldValue: { unappliedAmount: 10000 },
          newValue: { unappliedAmount: 5000 },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date('2024-01-02'),
        },
      ];

      mockAuditLogRepository.find.mockResolvedValue(mockAuditLogs);

      const result = await service.traceAuditLogs(dto);

      expect(result.resourceType).toBe('AR_PAYMENT');
      expect(result.resourceId).toBe('1');
      expect(result.timeline).toHaveLength(2);
      expect(result.timeline[0].action).toBe('CREATE');
      expect(result.timeline[1].action).toBe('APPLY');
      expect(result.summary.totalEvents).toBe(2);
      expect(result.summary.actions).toEqual({
        CREATE: 1,
        APPLY: 1,
      });
    });

    it('应该统计操作类型分布', async () => {
      const dto: TraceAuditLogsDto = {
        resourceType: 'AR_PAYMENT',
        resourceId: '1',
      };

      const mockAuditLogs = [
        {
          id: 1,
          userId: 1,
          action: 'CREATE',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          action: 'APPLY',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          createdAt: new Date(),
        },
        {
          id: 3,
          userId: 1,
          action: 'APPLY',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          createdAt: new Date(),
        },
      ] as AuditLog[];

      mockAuditLogRepository.find.mockResolvedValue(mockAuditLogs);

      const result = await service.traceAuditLogs(dto);

      expect(result.summary.actions).toEqual({
        CREATE: 1,
        APPLY: 2,
      });
    });

    it('应该统计操作人分布', async () => {
      const dto: TraceAuditLogsDto = {
        resourceType: 'AR_PAYMENT',
        resourceId: '1',
      };

      const mockAuditLogs = [
        {
          id: 1,
          userId: 1,
          action: 'CREATE',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          action: 'APPLY',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          createdAt: new Date(),
        },
        {
          id: 3,
          userId: 2,
          action: 'APPLY',
          resourceType: 'AR_PAYMENT',
          resourceId: '1',
          createdAt: new Date(),
        },
      ] as AuditLog[];

      mockAuditLogRepository.find.mockResolvedValue(mockAuditLogs);

      const result = await service.traceAuditLogs(dto);

      expect(result.summary.users).toEqual({
        1: 2,
        2: 1,
      });
    });
  });

  describe('getRecentAuditLogs', () => {
    it('应该返回最近的审计日志', async () => {
      const mockAuditLogs = [
        {
          id: 1,
          userId: 1,
          action: 'CREATE',
          createdAt: new Date(),
        },
      ];

      mockAuditLogRepository.find.mockResolvedValue(mockAuditLogs);

      const result = await service.getRecentAuditLogs(10);

      expect(result).toEqual(mockAuditLogs);
      expect(mockAuditLogRepository.find).toHaveBeenCalledWith({
        order: {
          createdAt: 'DESC',
        },
        take: 10,
      });
    });
  });

  describe('getAuditLogStats', () => {
    it('应该返回审计日志统计信息', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(100),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getAuditLogStats();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('actionStats');
      expect(result).toHaveProperty('resourceTypeStats');
      expect(result).toHaveProperty('topUsers');
    });
  });
});
