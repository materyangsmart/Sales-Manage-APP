import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ARService } from './ar.service';
import { ARPayment } from '../entities/ar-payment.entity';
import { ARInvoice } from '../entities/ar-invoice.entity';
import { ARApply } from '../entities/ar-apply.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ApplyPaymentDto } from '../dto/apply-payment.dto';

describe('ARService - Audit Log Integration', () => {
  let service: ARService;
  let paymentRepository: Repository<ARPayment>;
  let auditLogRepository: Repository<AuditLog>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ARService,
        {
          provide: getRepositoryToken(ARPayment),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ARInvoice),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ARApply),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ARService>(ARService);
    paymentRepository = module.get<Repository<ARPayment>>(
      getRepositoryToken(ARPayment),
    );
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('createPayment - Audit Log', () => {
    it('应该在创建收款单时写入审计日志', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        orgId: 2,
        customerId: 1,
        paymentNo: 'PMT-TEST-001',
        bankRef: 'BANK-REF-001',
        amount: 10000,
        paymentDate: new Date('2024-01-01'),
        paymentMethod: 'BANK_TRANSFER',
        createdBy: 1,
      };

      const savedPayment = {
        id: 1,
        ...dto,
        unappliedAmount: dto.amount,
        status: 'UNAPPLIED',
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ARPayment;

      jest.spyOn(paymentRepository, 'save').mockResolvedValue(savedPayment);
      const auditLogSaveSpy = jest
        .spyOn(auditLogRepository, 'save')
        .mockResolvedValue({} as any);

      // Act
      await service.createPayment(dto);

      // Assert
      expect(auditLogSaveSpy).toHaveBeenCalledTimes(1);
      expect(auditLogSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: dto.createdBy,
          action: 'CREATE',
          resourceType: 'AR_PAYMENT',
          resourceId: savedPayment.id.toString(),
          newValue: savedPayment,
        }),
      );
    });

    it('审计日志应该包含必需字段', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        orgId: 2,
        customerId: 1,
        paymentNo: 'PMT-TEST-002',
        bankRef: 'BANK-REF-002',
        amount: 20000,
        paymentDate: new Date('2024-01-02'),
        paymentMethod: 'BANK_TRANSFER',
        createdBy: 2,
      };

      const savedPayment = {
        id: 2,
        ...dto,
        unappliedAmount: dto.amount,
        status: 'UNAPPLIED',
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ARPayment;

      jest.spyOn(paymentRepository, 'save').mockResolvedValue(savedPayment);
      const auditLogSaveSpy = jest
        .spyOn(auditLogRepository, 'save')
        .mockResolvedValue({} as any);

      // Act
      await service.createPayment(dto);

      // Assert
      const auditLogCall = auditLogSaveSpy.mock.calls[0][0];
      expect(auditLogCall).toHaveProperty('userId');
      expect(auditLogCall).toHaveProperty('action');
      expect(auditLogCall).toHaveProperty('resourceType');
      expect(auditLogCall).toHaveProperty('resourceId');
      expect(auditLogCall).toHaveProperty('newValue');
    });
  });

  describe('applyPayment - Audit Log', () => {
    it('应该在核销时写入审计日志', async () => {
      // Arrange
      const dto: ApplyPaymentDto = {
        orgId: 2,
        paymentId: 1,
        applies: [
          {
            invoiceId: 1,
            appliedAmount: 5000,
          },
        ],
        operatorId: 1,
      };

      const mockQueryRunner = dataSource.createQueryRunner();

      // Mock payment
      const mockPayment = {
        id: 1,
        orgId: 2,
        unappliedAmount: 10000,
        status: 'UNAPPLIED',
        version: 0,
      } as ARPayment;

      // Mock invoice
      const mockInvoice = {
        id: 1,
        orgId: 2,
        invoiceNo: 'INV-001',
        balance: 5000,
        status: 'OPEN',
        version: 0,
      } as ARInvoice;

      jest
        .spyOn(mockQueryRunner.manager, 'findOne')
        .mockImplementation((entity: any, options: any) => {
          if (entity === ARPayment) {
            return Promise.resolve(mockPayment);
          }
          if (entity === ARInvoice) {
            return Promise.resolve(mockInvoice);
          }
          if (entity === ARApply) {
            return Promise.resolve(null); // 没有重复核销
          }
          return Promise.resolve(null);
        });

      jest
        .spyOn(mockQueryRunner.manager, 'create')
        .mockImplementation((entity: any, data: any) => data);

      jest
        .spyOn(mockQueryRunner.manager, 'save')
        .mockResolvedValue({} as any);

      jest.spyOn(mockQueryRunner.manager, 'update').mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      });

      // Act
      await service.applyPayment(dto);

      // Assert
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({
          userId: dto.operatorId,
          action: 'APPLY',
          resourceType: 'AR_PAYMENT',
          resourceId: mockPayment.id.toString(),
          oldValue: expect.objectContaining({
            unappliedAmount: mockPayment.unappliedAmount,
            status: mockPayment.status,
          }),
          newValue: expect.objectContaining({
            unappliedAmount: 5000, // 10000 - 5000
            status: 'PARTIAL',
          }),
        }),
      );
    });

    it('审计日志应该记录核销前后的状态变化', async () => {
      // Arrange
      const dto: ApplyPaymentDto = {
        orgId: 2,
        paymentId: 1,
        applies: [
          {
            invoiceId: 1,
            appliedAmount: 10000, // 全额核销
          },
        ],
        operatorId: 1,
      };

      const mockQueryRunner = dataSource.createQueryRunner();

      const mockPayment = {
        id: 1,
        orgId: 2,
        unappliedAmount: 10000,
        status: 'UNAPPLIED',
        version: 0,
      } as ARPayment;

      const mockInvoice = {
        id: 1,
        orgId: 2,
        invoiceNo: 'INV-001',
        balance: 10000,
        status: 'OPEN',
        version: 0,
      } as ARInvoice;

      jest
        .spyOn(mockQueryRunner.manager, 'findOne')
        .mockImplementation((entity: any) => {
          if (entity === ARPayment) return Promise.resolve(mockPayment);
          if (entity === ARInvoice) return Promise.resolve(mockInvoice);
          if (entity === ARApply) return Promise.resolve(null);
          return Promise.resolve(null);
        });

      jest
        .spyOn(mockQueryRunner.manager, 'create')
        .mockImplementation((entity: any, data: any) => data);

      const auditLogSaveSpy = jest
        .spyOn(mockQueryRunner.manager, 'save')
        .mockResolvedValue({} as any);

      jest.spyOn(mockQueryRunner.manager, 'update').mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      });

      // Act
      await service.applyPayment(dto);

      // Assert
      const auditLogCalls = auditLogSaveSpy.mock.calls.filter(
        (call) => call[0] === AuditLog,
      );
      expect(auditLogCalls.length).toBeGreaterThan(0);

      const auditLog = auditLogCalls[0][1];
      expect(auditLog.oldValue).toEqual({
        unappliedAmount: 10000,
        status: 'UNAPPLIED',
      });
      expect(auditLog.newValue).toEqual({
        unappliedAmount: 0,
        status: 'APPLIED', // 全额核销后状态变为APPLIED
      });
    });
  });

  describe('Audit Log 字段完整性', () => {
    it('CREATE操作的审计日志应该包含所有必需字段', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        orgId: 2,
        customerId: 1,
        paymentNo: 'PMT-TEST-003',
        bankRef: 'BANK-REF-003',
        amount: 30000,
        paymentDate: new Date('2024-01-03'),
        paymentMethod: 'BANK_TRANSFER',
        createdBy: 3,
      };

      const savedPayment = {
        id: 3,
        ...dto,
        unappliedAmount: dto.amount,
        status: 'UNAPPLIED',
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ARPayment;

      jest.spyOn(paymentRepository, 'save').mockResolvedValue(savedPayment);
      const auditLogSaveSpy = jest
        .spyOn(auditLogRepository, 'save')
        .mockResolvedValue({} as any);

      // Act
      await service.createPayment(dto);

      // Assert
      const auditLog = auditLogSaveSpy.mock.calls[0][0];

      // 必需字段检查
      expect(auditLog.userId).toBe(dto.createdBy);
      expect(auditLog.action).toBe('CREATE');
      expect(auditLog.resourceType).toBe('AR_PAYMENT');
      expect(auditLog.resourceId).toBe(savedPayment.id.toString());
      expect(auditLog.newValue).toEqual(savedPayment);

      // 可选字段检查
      expect(auditLog).toHaveProperty('ipAddress');
      expect(auditLog).toHaveProperty('userAgent');
    });

    it('APPLY操作的审计日志应该包含oldValue和newValue', async () => {
      // Arrange
      const dto: ApplyPaymentDto = {
        orgId: 2,
        paymentId: 1,
        applies: [{ invoiceId: 1, appliedAmount: 5000 }],
        operatorId: 1,
      };

      const mockQueryRunner = dataSource.createQueryRunner();

      const mockPayment = {
        id: 1,
        orgId: 2,
        unappliedAmount: 10000,
        status: 'UNAPPLIED',
        version: 0,
      } as ARPayment;

      const mockInvoice = {
        id: 1,
        orgId: 2,
        invoiceNo: 'INV-001',
        balance: 5000,
        status: 'OPEN',
        version: 0,
      } as ARInvoice;

      jest
        .spyOn(mockQueryRunner.manager, 'findOne')
        .mockImplementation((entity: any) => {
          if (entity === ARPayment) return Promise.resolve(mockPayment);
          if (entity === ARInvoice) return Promise.resolve(mockInvoice);
          if (entity === ARApply) return Promise.resolve(null);
          return Promise.resolve(null);
        });

      jest
        .spyOn(mockQueryRunner.manager, 'create')
        .mockImplementation((entity: any, data: any) => data);

      const auditLogSaveSpy = jest
        .spyOn(mockQueryRunner.manager, 'save')
        .mockResolvedValue({} as any);

      jest.spyOn(mockQueryRunner.manager, 'update').mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      });

      // Act
      await service.applyPayment(dto);

      // Assert
      const auditLogCalls = auditLogSaveSpy.mock.calls.filter(
        (call) => call[0] === AuditLog,
      );
      const auditLog = auditLogCalls[0][1];

      expect(auditLog).toHaveProperty('oldValue');
      expect(auditLog).toHaveProperty('newValue');
      expect(auditLog.oldValue).toHaveProperty('unappliedAmount');
      expect(auditLog.oldValue).toHaveProperty('status');
      expect(auditLog.newValue).toHaveProperty('unappliedAmount');
      expect(auditLog.newValue).toHaveProperty('status');
    });
  });
});
