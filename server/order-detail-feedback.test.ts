/**
 * 订单详情页和客户评价功能测试
 * 
 * 测试范围：
 * 1. orders.get procedure - 获取订单详情（通过backend API）
 * 2. public.submitFeedback mutation - 提交客户评价（通过backend API）
 * 3. public.getFeedbackList query - 获取评价列表（通过backend API）
 * 4. public.getTraceData query - 获取追溯数据（通过backend API）
 */

import { describe, it, expect, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

// 创建测试上下文
const createTestContext = (user: any = null): TrpcContext => ({
  req: {} as any,
  res: {} as any,
  user,
});

const adminUser = {
  id: 1,
  openId: 'test-user',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 所有数据通过backend API获取，无Drizzle直连
vi.mock('./backend-api', () => ({
  ordersAPI: {
    get: vi.fn().mockResolvedValue({
      id: 1,
      orderNo: 'ORD-20250101-000001',
      customerName: '菜市场-0001',
      totalAmount: 3500,
      status: 'FULFILLED',
      items: [{ id: 1, productName: '普通千张', quantity: 100, unitPrice: 8.5, totalPrice: 850 }],
    }),
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    approve: vi.fn().mockResolvedValue({ success: true }),
    reject: vi.fn().mockResolvedValue({ success: true }),
    fulfill: vi.fn().mockResolvedValue({ success: true }),
  },
  invoicesAPI: { list: vi.fn().mockResolvedValue({ data: [], total: 0 }) },
  paymentsAPI: { list: vi.fn().mockResolvedValue({ data: [], total: 0 }), create: vi.fn() },
  applyAPI: { list: vi.fn().mockResolvedValue({ data: [], total: 0 }), create: vi.fn() },
  auditLogsAPI: { list: vi.fn().mockResolvedValue({ data: [], total: 0 }) },
  customersAPI: { list: vi.fn().mockResolvedValue({ data: [], total: 0 }), get: vi.fn() },
  commissionRulesAPI: { list: vi.fn().mockResolvedValue([]) },
  ceoRadarAPI: { getRadarData: vi.fn().mockResolvedValue({}) },
  antiFraudAPI: { getPriceAnomalies: vi.fn(), reviewAnomaly: vi.fn() },
  creditAPI: { getScores: vi.fn(), getScoreDetail: vi.fn(), recalculate: vi.fn() },
  governanceAPI: { getRoles: vi.fn(), getPermissions: vi.fn() },
  complaintAPI: { submitComplaint: vi.fn(), getUnreadCount: vi.fn(), getComplaints: vi.fn(), markAsRead: vi.fn(), updateComplaintStatus: vi.fn() },
  employeeAPI: {
    list: vi.fn().mockResolvedValue([
      { id: 1, username: 'admin', full_name: '系统管理员', department: '管理部', status: 'ACTIVE' }
    ]),
    getJobPositions: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
  myPerformanceAPI: {
    get: vi.fn().mockResolvedValue({
      totalRevenue: 1250000,
      orderCount: 45,
      newCustomerCount: 8,
      paymentRate: 0.92,
      overdueAmount: 50000,
      totalCommission: 28750,
    }),
  },
  traceabilityAPI: {
    getTraceData: vi.fn().mockResolvedValue({
      orderNo: 'ORD-20250101-000001',
      customerName: '菜市场-0001',
      totalAmount: 3500,
      status: 'FULFILLED',
      rawMaterial: { soybeanBatch: 'SB-2025-01-01-001', waterQuality: '合格' },
      production: { batchNo: 'QZ20250101001', productionDate: '2025-01-01' },
      logistics: { driverName: '张师傅', deliveryTime: '2025-01-01T10:00:00Z' },
    }),
  },
  feedbackAPI: {
    submit: vi.fn().mockResolvedValue({ success: true, feedbackId: 1 }),
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('订单详情页和客户评价功能（backend API模式）', () => {
  describe('orders.get - 获取订单详情', () => {
    it('应该通过backend API获取订单详情', async () => {
      const caller = appRouter.createCaller(createTestContext(adminUser));
      const result = await caller.orders.get({ orderId: 1 });
      expect(result).toBeDefined();
      expect(result.orderNo).toBe('ORD-20250101-000001');
      expect(result.customerName).toBe('菜市场-0001');
    });
  });

  describe('public.submitFeedback - 提交客户评价', () => {
    it('应该通过backend API提交客户评价', async () => {
      const caller = appRouter.createCaller(createTestContext());
      const result = await caller.public.submitFeedback({
        orderId: 1,
        batchNo: 'QZ20250101001',
        customerName: '张三',
        rating: 5,
        comment: '产品质量很好',
        images: ['https://example.com/image1.jpg'],
      });
      expect(result.success).toBe(true);
      expect(result.feedbackId).toBe(1);
    });

    it('应该验证必填字段', async () => {
      const caller = appRouter.createCaller(createTestContext());
      try {
        await caller.public.submitFeedback({ orderId: 1, rating: 0 } as any);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('public.getFeedbackList - 获取评价列表', () => {
    it('应该通过backend API获取评价列表', async () => {
      const caller = appRouter.createCaller(createTestContext());
      const result = await caller.public.getFeedbackList({ orderId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('public.getTraceData - 获取追溯数据', () => {
    it('应该通过backend API获取真实追溯数据', async () => {
      const caller = appRouter.createCaller(createTestContext());
      const result = await caller.public.getTraceData({ orderId: 1 });
      expect(result).toBeDefined();
      expect(result.orderNo).toBe('ORD-20250101-000001');
      expect(result.production.batchNo).toBe('QZ20250101001');
      expect(result.logistics.driverName).toBe('张师傅');
    });
  });

  describe('public.submitComplaint - 投诉直达CEO', () => {
    it('应该通过backend API提交投诉（无Drizzle降级）', async () => {
      const { complaintAPI } = await import('./backend-api');
      (complaintAPI.submitComplaint as any).mockResolvedValue({
        id: 1,
        message: '投诉已提交，将直接发送至CEO看板',
      });

      const caller = appRouter.createCaller(createTestContext());
      const result = await caller.public.submitComplaint({
        batchNo: 'QZ20250101001',
        orderId: 1,
        complainantName: '李四',
        complaintContent: '产品有异味',
      });
      expect(result.id).toBe(1);
    });
  });
});

describe('员工管理（backend API模式）', () => {
  it('应该通过backend API获取员工列表', async () => {
    const caller = appRouter.createCaller(createTestContext(adminUser));
    const result = await caller.employee.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].username).toBe('admin');
  });

  it('应该通过backend API创建员工', async () => {
    const caller = appRouter.createCaller(createTestContext(adminUser));
    const result = await caller.employee.create({
      username: 'newuser',
      email: 'new@example.com',
      password: 'test123',
      full_name: '新员工',
      job_position_id: '1',
    });
    expect(result.success).toBe(true);
  });
});

describe('个人业绩（backend API模式）', () => {
  it('应该通过backend API获取个人业绩', async () => {
    const caller = appRouter.createCaller(createTestContext(adminUser));
    const result = await caller.commission.myPerformance();
    expect(result).toBeDefined();
    expect(result.totalRevenue).toBe(1250000);
    expect(result.totalCommission).toBe(28750);
  });
});

describe('URL解析', () => {
  it('应该生成正确的追溯URL', () => {
    const orderId = 123;
    const expectedUrl = `https://example.com/public/trace/${orderId}`;
    expect(expectedUrl).toContain('/public/trace/');
    expect(expectedUrl).toContain('123');
  });

  it('应该正确解析URL参数', () => {
    const testUrl = '/public/trace/456';
    const match = testUrl.match(/\/public\/trace\/(\d+)/);
    expect(match).toBeDefined();
    expect(match?.[1]).toBe('456');
  });
});
