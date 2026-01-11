import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ARService } from './ar.service';
import { ARInvoice } from '../entities/ar-invoice.entity';
import { ARPayment } from '../entities/ar-payment.entity';
import { ARApply } from '../entities/ar-apply.entity';
import { AuditLog } from '../entities/audit-log.entity';

describe('ARService', () => {
  let service: ARService;
  let invoiceRepository: Repository<ARInvoice>;
  let paymentRepository: Repository<ARPayment>;
  // let applyRepository: Repository<ARApply>;
  let auditLogRepository: Repository<AuditLog>;
  // let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Mock QueryRunner
    queryRunner = {
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
        createQueryBuilder: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ARService,
        {
          provide: getRepositoryToken(ARInvoice),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ARPayment),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ARApply),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
      ],
    }).compile();
    service = module.get<ARService>(ARService);
    invoiceRepository = module.get<Repository<ARInvoice>>(
      getRepositoryToken(ARInvoice),
    );
    paymentRepository = module.get<Repository<ARPayment>>(
      getRepositoryToken(ARPayment),
    );
    // applyRepository = module.get<Repository<ARApply>>(getRepositoryToken(ARApply));
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    // dataSource = module.get<DataSource>(DataSource);
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const dto = {
        orgId: 2,
        customerId: 123,
        bankRef: '20240111123456',
        amount: 1130000,
        paymentDate: '2024-01-11',
        paymentMethod: 'BANK_TRANSFER',
        createdBy: 888,
      };

      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(paymentRepository, 'create').mockReturnValue({
        id: 1,
        paymentNo: 'PAY1704960000000ABC1',
        ...dto,
        unappliedAmount: dto.amount,
        status: 'UNAPPLIED',
        createdAt: new Date(),
      } as any);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue({
        id: 1,
        paymentNo: 'PAY1704960000000ABC1',
        ...dto,
        unappliedAmount: dto.amount,
        status: 'UNAPPLIED',
        createdAt: new Date(),
      } as any);
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as any);

      const result = await service.createPayment(dto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('paymentNo');
      expect(result.amount).toBe(dto.amount);
      expect(result.unappliedAmount).toBe(dto.amount);
      expect(result.status).toBe('UNAPPLIED');
    });

    it('should throw ConflictException if bank reference already exists', async () => {
      const dto = {
        orgId: 2,
        customerId: 123,
        bankRef: '20240111123456',
        amount: 1130000,
        paymentDate: '2024-01-11',
        paymentMethod: 'BANK_TRANSFER',
        createdBy: 888,
      };

      jest
        .spyOn(paymentRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as any);

      await expect(service.createPayment(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('applyPayment', () => {
    it('should apply payment to invoice successfully', async () => {
      const dto = {
        orgId: 2,
        paymentId: 1,
        applies: [{ invoiceId: 789, appliedAmount: 565000 }],
        operatorId: 888,
      };

      const payment = {
        id: 1,
        orgId: 2,
        customerId: 123,
        paymentNo: 'PAY1704960000000ABC1',
        unappliedAmount: 1130000,
        status: 'UNAPPLIED',
        version: 0,
      };

      const invoice = {
        id: 789,
        orgId: 2,
        customerId: 123,
        invoiceNo: 'INV202401001',
        balance: 1130000,
        status: 'OPEN',
        version: 0,
      };

      // Mock跨客户校验查询
      jest.spyOn(queryRunner.manager, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ distinctCount: '1' }),
      } as any);

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(payment)
        .mockResolvedValueOnce(invoice) // firstInvoice for customer check
        .mockResolvedValueOnce(null) // existingApply
        .mockResolvedValueOnce(invoice);

      jest.spyOn(queryRunner.manager, 'create').mockReturnValue({} as any);
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue({} as any);
      jest
        .spyOn(queryRunner.manager, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.applyPayment(dto);

      expect(result.totalApplied).toBe(565000);
      expect(result.unappliedAmount).toBe(565000);
      expect(result.paymentStatus).toBe('PARTIAL');
      expect(result.appliedInvoices).toHaveLength(1);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should throw NotFoundException if payment not found', async () => {
      const dto = {
        orgId: 2,
        paymentId: 999,
        applies: [{ invoiceId: 789, appliedAmount: 565000 }],
        operatorId: 888,
      };

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(null);

      await expect(service.applyPayment(dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should throw BadRequestException if applied amount exceeds unapplied amount', async () => {
      const dto = {
        orgId: 2,
        paymentId: 1,
        applies: [{ invoiceId: 789, appliedAmount: 2000000 }],
        operatorId: 888,
      };

      const payment = {
        id: 1,
        orgId: 2,
        customerId: 123,
        unappliedAmount: 1130000,
        version: 0,
      };

      const invoice = {
        id: 789,
        orgId: 2,
        customerId: 123,
      };

      // Mock跨客户校验查询
      jest.spyOn(queryRunner.manager, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ distinctCount: '1' }),
      } as any);

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(payment)
        .mockResolvedValueOnce(invoice);

      await expect(service.applyPayment(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if payment already applied to invoice', async () => {
      const dto = {
        orgId: 2,
        paymentId: 1,
        applies: [{ invoiceId: 789, appliedAmount: 565000 }],
        operatorId: 888,
      };

      const payment = {
        id: 1,
        orgId: 2,
        customerId: 123,
        unappliedAmount: 1130000,
        version: 0,
      };

      const invoice = {
        id: 789,
        orgId: 2,
        customerId: 123,
      };

      // Mock跨客户校验查询
      jest.spyOn(queryRunner.manager, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ distinctCount: '1' }),
      } as any);

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(payment)
        .mockResolvedValueOnce(invoice) // firstInvoice
        .mockResolvedValueOnce({ id: 1 }); // existingApply

      await expect(service.applyPayment(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if optimistic lock fails', async () => {
      const dto = {
        orgId: 2,
        paymentId: 1,
        applies: [{ invoiceId: 789, appliedAmount: 565000 }],
        operatorId: 888,
      };

      const payment = {
        id: 1,
        orgId: 2,
        customerId: 123,
        unappliedAmount: 1130000,
        version: 0,
      };

      const invoice = {
        id: 789,
        orgId: 2,
        customerId: 123,
        balance: 1130000,
        version: 0,
      };

      // Mock跨客户校验查询
      jest.spyOn(queryRunner.manager, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ distinctCount: '1' }),
      } as any);

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(payment)
        .mockResolvedValueOnce(invoice) // firstInvoice
        .mockResolvedValueOnce(null) // existingApply
        .mockResolvedValueOnce(invoice);

      jest.spyOn(queryRunner.manager, 'create').mockReturnValue({} as any);
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue({} as any);
      jest
        .spyOn(queryRunner.manager, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(service.applyPayment(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should return AR summary with aging analysis', async () => {
      const dto = { orgId: 2, customerId: 123 };

      const invoices = [
        { balance: 1000000, dueDate: new Date('2024-01-01'), status: 'OPEN' },
        { balance: 500000, dueDate: new Date('2024-01-15'), status: 'PARTIAL' },
        { balance: 300000, dueDate: new Date('2023-12-01'), status: 'OPEN' },
      ];

      jest.spyOn(invoiceRepository, 'find').mockResolvedValue(invoices as any);
      jest.spyOn(invoiceRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '300000', count: '1' }),
      } as any);

      const result = await service.getSummary(dto);

      expect(result).toHaveProperty('totalBalance');
      expect(result).toHaveProperty('overdueBalance');
      expect(result).toHaveProperty('aging');
      expect(result).toHaveProperty('upcomingDue');
      expect(result.aging).toHaveProperty('current');
      expect(result.aging).toHaveProperty('days0to30');
      expect(result.aging).toHaveProperty('days31to60');
      expect(result.aging).toHaveProperty('days61to90');
      expect(result.aging).toHaveProperty('days90plus');
    });

    it('should return summary for all customers if customerId not provided', async () => {
      const dto = { orgId: 2 };

      jest.spyOn(invoiceRepository, 'find').mockResolvedValue([]);
      jest.spyOn(invoiceRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: null, count: '0' }),
      } as any);

      const result = await service.getSummary(dto);

      expect(result.totalBalance).toBe(0);
      expect(result.overdueBalance).toBe(0);
      expect(result.upcomingDue.amount).toBe(0);
      expect(result.upcomingDue.count).toBe(0);
    });
  });
});
