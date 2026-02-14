import { Test, TestingModule } from '@nestjs/testing';
import { ARController } from './ar.controller';
import { ARService } from '../services/ar.service';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';

describe('ARController', () => {
  let controller: ARController;
  let service: ARService;

  const mockARService = {
    createPayment: jest.fn(),
    applyPayment: jest.fn(),
    getSummary: jest.fn(),
  };

  const mockRequest = {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'Jest Test',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ARController],
      providers: [
        {
          provide: ARService,
          useValue: mockARService,
        },
        {
          provide: IdempotencyInterceptor,
          useValue: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            intercept: jest.fn((context, next) => next.handle()),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ARController>(ARController);
    service = module.get<ARService>(ARService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create a payment', async () => {
      const dto = {
        orgId: 2,
        customerId: 123,
        bankRef: '20240111123456',
        amount: 1130000,
        paymentDate: '2024-01-11',
        paymentMethod: 'BANK_TRANSFER',
        createdBy: 888,
      };

      const expectedResult = {
        id: 1,
        paymentNo: 'PAY1704960000000ABC1',
        amount: 1130000,
        unappliedAmount: 1130000,
        status: 'UNAPPLIED',
        createdAt: new Date(),
      };

      mockARService.createPayment.mockResolvedValue(expectedResult);

      const result = await controller.createPayment(dto, mockRequest as any);

      expect(result).toEqual(expectedResult);
      expect(service.createPayment).toHaveBeenCalledWith(
        dto,
        mockRequest.ip,
        mockRequest.headers['user-agent'],
      );
    });
  });

  describe('applyPayment', () => {
    it('should apply payment to invoices', async () => {
      const dto = {
        orgId: 2,
        paymentId: 1,
        applies: [{ invoiceId: 789, appliedAmount: 565000 }],
        operatorId: 888,
      };

      const expectedResult = {
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
      };

      mockARService.applyPayment.mockResolvedValue(expectedResult);

      const result = await controller.applyPayment(dto, mockRequest as any);

      expect(result).toEqual(expectedResult);
      expect(service.applyPayment).toHaveBeenCalledWith(
        dto,
        mockRequest.ip,
        mockRequest.headers['user-agent'],
      );
    });
  });

  describe('getSummary', () => {
    it('should return AR summary', async () => {
      const dto = { orgId: 2, customerId: 123 };

      const expectedResult = {
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
      };

      mockARService.getSummary.mockResolvedValue(expectedResult);

      const result = await controller.getSummary(dto);

      expect(result).toEqual(expectedResult);
      expect(service.getSummary).toHaveBeenCalledWith(dto);
    });
  });
});
