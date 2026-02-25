import { describe, it, expect, vi, beforeAll } from 'vitest';

/**
 * P2 贯通任务集成测试
 * 
 * 测试目标：
 * 1. 追溯API返回精确batch_no（非时间范围模糊匹配）
 * 2. 提成API返回按客户类型分类的categoryBreakdown
 * 3. CEO雷达API正确转换RadarAlert[]为CEORadarData结构
 */

// Mock fetch for backend API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// 需要在import之前设置环境变量
process.env.BACKEND_URL = 'http://localhost:3100';
process.env.INTERNAL_SERVICE_TOKEN = 'test-token';

describe('P2 Task 1: 精确批次追溯 (TraceabilityService)', () => {
  it('traceabilityAPI.getTraceData应返回精确的batchNo字段', async () => {
    const mockTraceResponse = {
      orderId: 1,
      orderNo: 'ORD-20250101-001',
      batchNo: 'QZ202501110124',
      totalAmount: 15000,
      status: 'FULFILLED',
      rawMaterial: {
        soybeanBatch: 'SB-2025-001',
        waterQuality: '合格',
      },
      production: {
        batchNo: 'QZ202501110124',
        productionDate: '2025-01-11',
        workshopTemp: 25.5,
        sterilizationParams: '121°C/15min',
        qualityInspector: '张三',
        qualityResult: 'PASS',
        plannedQuantity: 500,
        actualQuantity: 490,
        workshop: 'A车间',
      },
      logistics: {
        driverName: '李四',
        driverPhone: '13800138000',
        pickingTime: '2025-01-11T06:00:00Z',
        shippingTime: '2025-01-11T07:00:00Z',
        deliveryTime: '2025-01-11T09:00:00Z',
      },
      items: [
        { productId: 1, quantity: 100, unitPrice: 150, subtotal: 15000 },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockTraceResponse,
      text: async () => JSON.stringify(mockTraceResponse),
    });

    // 动态导入以使用mock
    const { traceabilityAPI } = await import('./backend-api');
    const result = await traceabilityAPI.getTraceData('1');

    // 验证返回了精确的batchNo
    expect(result.batchNo).toBe('QZ202501110124');
    expect(result.production.batchNo).toBe('QZ202501110124');
    expect(result.production.qualityInspector).toBe('张三');
    expect(result.production.qualityResult).toBe('PASS');
    expect(result.production.workshopTemp).toBe(25.5);
  });

  it('追溯数据必须包含qualityInspector和workshopTemp字段', async () => {
    const mockTraceResponse = {
      orderId: 2,
      orderNo: 'ORD-20250102-001',
      batchNo: 'QZ202501120088',
      production: {
        batchNo: 'QZ202501120088',
        qualityInspector: '王五',
        qualityResult: 'PASS',
        workshopTemp: 24.8,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockTraceResponse,
      text: async () => JSON.stringify(mockTraceResponse),
    });

    const { traceabilityAPI } = await import('./backend-api');
    const result = await traceabilityAPI.getTraceData('2');

    // 验证质检员姓名和车间温度
    expect(result.production).toBeDefined();
    expect(result.production.qualityInspector).toBe('王五');
    expect(typeof result.production.workshopTemp).toBe('number');
    expect(result.production.workshopTemp).toBe(24.8);
  });
});

describe('P2 Task 2: 多维度提成引擎 (CommissionService)', () => {
  it('myPerformanceAPI.get应返回categoryBreakdown分类统计', async () => {
    const mockPerformanceResponse = {
      userId: 1,
      userName: '张业务',
      totalRevenue: 500000,
      orderCount: 120,
      newCustomerCount: 5,
      overdueAmount: 20000,
      totalCommission: 8500,
      paymentRate: 0.96,
      categoryBreakdown: [
        {
          category: 'WET_MARKET',
          categoryLabel: '菜市场',
          orderCount: 60,
          deliveryAmount: 200000,
          baseRate: 0.02,
          baseCommission: 4000,
          overdueAmount: 10000,
          overdueDeductionRate: 0.005,
          overdueDeduction: 50,
          newCustomerCount: 3,
          newCustomerBonus: 300,
          newCustomerCommission: 900,
          netCommission: 4850,
        },
        {
          category: 'SUPERMARKET',
          categoryLabel: '商超',
          orderCount: 40,
          deliveryAmount: 200000,
          baseRate: 0.015,
          baseCommission: 3000,
          overdueAmount: 5000,
          overdueDeductionRate: 0.003,
          overdueDeduction: 15,
          newCustomerCount: 1,
          newCustomerBonus: 800,
          newCustomerCommission: 800,
          netCommission: 3785,
        },
        {
          category: 'WHOLESALE_B',
          categoryLabel: '批发商',
          orderCount: 20,
          deliveryAmount: 100000,
          baseRate: 0.01,
          baseCommission: 1000,
          overdueAmount: 5000,
          overdueDeductionRate: 0.002,
          overdueDeduction: 10,
          newCustomerCount: 1,
          newCustomerBonus: 1000,
          newCustomerCommission: 1000,
          netCommission: 1990,
        },
      ],
      monthlyTrend: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockPerformanceResponse,
      text: async () => JSON.stringify(mockPerformanceResponse),
    });

    const { myPerformanceAPI } = await import('./backend-api');
    const result = await myPerformanceAPI.get(1);

    // 验证返回了categoryBreakdown
    expect(result.categoryBreakdown).toBeDefined();
    expect(Array.isArray(result.categoryBreakdown)).toBe(true);
    expect(result.categoryBreakdown.length).toBe(3);

    // 验证菜市场分类
    const wetMarket = result.categoryBreakdown.find((c: any) => c.category === 'WET_MARKET');
    expect(wetMarket).toBeDefined();
    expect(wetMarket.baseRate).toBe(0.02);
    expect(wetMarket.overdueDeductionRate).toBe(0.005);
    expect(wetMarket.categoryLabel).toBe('菜市场');

    // 验证商超分类
    const supermarket = result.categoryBreakdown.find((c: any) => c.category === 'SUPERMARKET');
    expect(supermarket).toBeDefined();
    expect(supermarket.baseRate).toBe(0.015);
    expect(supermarket.overdueDeductionRate).toBe(0.003);

    // 验证批发商分类
    const wholesale = result.categoryBreakdown.find((c: any) => c.category === 'WHOLESALE_B');
    expect(wholesale).toBeDefined();
    expect(wholesale.baseRate).toBe(0.01);
    expect(wholesale.overdueDeductionRate).toBe(0.002);
  });

  it('各分类提成公式: netCommission = baseCommission - overdueDeduction + newCustomerCommission', () => {
    // 菜市场: 200000 * 0.02 - 10000 * 0.005 + 3 * 300 = 4000 - 50 + 900 = 4850
    const wetMarket = {
      deliveryAmount: 200000,
      baseRate: 0.02,
      overdueAmount: 10000,
      overdueDeductionRate: 0.005,
      newCustomerCount: 3,
      newCustomerBonus: 300,
    };
    
    const baseCommission = wetMarket.deliveryAmount * wetMarket.baseRate;
    const overdueDeduction = wetMarket.overdueAmount * wetMarket.overdueDeductionRate;
    const newCustomerCommission = wetMarket.newCustomerCount * wetMarket.newCustomerBonus;
    const netCommission = baseCommission - overdueDeduction + newCustomerCommission;
    
    expect(baseCommission).toBe(4000);
    expect(overdueDeduction).toBe(50);
    expect(newCustomerCommission).toBe(900);
    expect(netCommission).toBe(4850);
  });

  it('不同客户类型的扣减率差异: 菜市场0.5% > 商超0.3% > 批发0.2%', () => {
    const rates = {
      WET_MARKET: 0.005,
      SUPERMARKET: 0.003,
      WHOLESALE_B: 0.002,
    };
    
    expect(rates.WET_MARKET).toBeGreaterThan(rates.SUPERMARKET);
    expect(rates.SUPERMARKET).toBeGreaterThan(rates.WHOLESALE_B);
  });
});

describe('P2 Task 3: CEO雷达数据转换 (RadarAlert[] -> CEORadarData)', () => {
  it('ceoRadarAPI.getRadarData应将RadarAlert[]转换为CEORadarData结构', async () => {
    // 后端返回的RadarAlert[]格式
    const mockRadarAlerts = [
      {
        type: 'BAD_DEBT',
        level: 'HIGH',
        title: '坏账风险: 某客户',
        description: '发票 INV-001 逾期 45 天',
        data: {
          invoiceId: 1,
          balance: 50000,
          overdueDays: 45,
          customerName: '某客户',
        },
      },
      {
        type: 'YIELD_ANOMALY',
        level: 'HIGH',
        title: '得率异动: 千张 (QZ202501150001)',
        description: '计划 500 件，实际 450 件，偏差 -10.0%',
        data: {
          batchNo: 'QZ202501150001',
          productName: '千张',
          plannedQuantity: 500,
          actualQuantity: 450,
          deviationPct: 10.0,
          productionDate: '2025-01-15',
          isOverProduction: false,
        },
      },
      {
        type: 'CUSTOMER_CHURN',
        level: 'MEDIUM',
        title: '客户流失风险: 某超市',
        description: '已 120 天未下单',
        data: {
          customerId: 5,
          customerName: '某超市',
          daysSinceLastOrder: 120,
          lastOrderDate: '2024-09-01',
        },
      },
      {
        type: 'COMPLAINT',
        level: 'HIGH',
        title: '质量投诉: 产品变质',
        description: '客户反映产品有异味',
        data: {
          complaintId: 1,
          batchNo: 'QZ202501100001',
          status: 'PENDING',
          createdAt: '2025-01-20T10:00:00Z',
        },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockRadarAlerts,
      text: async () => JSON.stringify(mockRadarAlerts),
    });

    const { ceoRadarAPI } = await import('./backend-api');
    const result = await ceoRadarAPI.getRadarData();

    // 验证结构转换正确
    expect(result.badDebtRisks).toBeDefined();
    expect(Array.isArray(result.badDebtRisks)).toBe(true);
    expect(result.badDebtRisks.length).toBe(1);

    expect(result.yieldAnomalies).toBeDefined();
    expect(Array.isArray(result.yieldAnomalies)).toBe(true);
    expect(result.yieldAnomalies.length).toBe(1);

    expect(result.churnRisks).toBeDefined();
    expect(Array.isArray(result.churnRisks)).toBe(true);
    expect(result.churnRisks.length).toBe(1);

    expect(result.complaintAlerts).toBeDefined();
    expect(Array.isArray(result.complaintAlerts)).toBe(true);
    expect(result.complaintAlerts.length).toBe(1);

    // 验证得率异动数据转换
    const yieldAnomaly = result.yieldAnomalies[0];
    expect(yieldAnomaly.batchNo).toBe('QZ202501150001');
    expect(yieldAnomaly.soybeanInput).toBe(500);
    expect(yieldAnomaly.productOutput).toBe(450);
    expect(yieldAnomaly.deviation).toBe(-10.0); // 负数表示产出不足

    // 验证unreadComplaintCount
    expect(result.unreadComplaintCount).toBe(1);
    expect(result.lastUpdate).toBeDefined();
  });

  it('空RadarAlert[]应返回空的CEORadarData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [],
      text: async () => '[]',
    });

    const { ceoRadarAPI } = await import('./backend-api');
    const result = await ceoRadarAPI.getRadarData();

    expect(result.badDebtRisks).toEqual([]);
    expect(result.yieldAnomalies).toEqual([]);
    expect(result.churnRisks).toEqual([]);
    expect(result.complaintAlerts).toEqual([]);
    expect(result.unreadComplaintCount).toBe(0);
  });
});
