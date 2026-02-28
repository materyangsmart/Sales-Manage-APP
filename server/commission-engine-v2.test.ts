/**
 * RC1 Epic 1 验收测试：动态财务提成核算引擎
 *
 * 验收标准：
 * 1. 阶梯提成计算器正确性（多档位）
 * 2. 月末 Cron Job 核算主函数（插入规则 + 触发 + 验证提成金额）
 * 3. 幂等性（重复触发不重复写入）
 * 4. PaymentReceipt CRUD（提交、查询、核销、拒绝）
 * 5. tRPC 路由注册验证（triggerSettlement / listBySales / listByPeriod / paymentReceipt）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateTieredCommission,
  runMonthlyCommissionSettlement,
  paymentReceiptService,
  getMockSalesProfitData,
  getPreviousMonth,
  getCurrentMonth,
  DEFAULT_TIERED_RULES,
  type TieredRule,
} from "./commission-engine-v2";

// ============================================================
// Mock getDb 以隔离数据库依赖
// ============================================================

// 使用 vi.hoisted 避免 vi.mock 提升导致的 TDZ 错误
const { mockInsert, mockSelect, mockUpdate, mockDb } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockDb = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  };
  return { mockInsert, mockSelect, mockUpdate, mockDb };
});

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

// ============================================================
// 第一部分：阶梯提成计算器单元测试
// ============================================================

describe("calculateTieredCommission — 阶梯提成计算器", () => {
  it("毛利为 0 时提成为 0", () => {
    const result = calculateTieredCommission(0);
    expect(result.commissionAmount).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it("负数毛利时提成为 0", () => {
    const result = calculateTieredCommission(-5000);
    expect(result.commissionAmount).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it("第一档：毛利 8500 元 → 3% → 提成 255 元", () => {
    const result = calculateTieredCommission(8500);
    expect(result.commissionAmount).toBe(255);
    expect(result.effectiveRate).toBe(0.03);
  });

  it("第一档上限：毛利 10000 元 → 3% → 提成 300 元", () => {
    const result = calculateTieredCommission(10000);
    expect(result.commissionAmount).toBe(300);
    expect(result.effectiveRate).toBe(0.03);
  });

  it("第二档：毛利 45000 元 → 累进 → 正确提成", () => {
    // 前 10000 × 3% = 300
    // 后 35000 × 5% = 1750
    // 合计 = 2050
    const result = calculateTieredCommission(45000);
    expect(result.commissionAmount).toBe(2050);
    expect(result.effectiveRate).toBe(0.05);
  });

  it("第三档：毛利 120000 元 → 累进 → 正确提成", () => {
    // 前 10000 × 3% = 300
    // 10000-50000: 40000 × 5% = 2000
    // 50000-120000: 70000 × 8% = 5600
    // 合计 = 7900
    const result = calculateTieredCommission(120000);
    expect(result.commissionAmount).toBe(7900);
    expect(result.effectiveRate).toBe(0.08);
  });

  it("第四档：毛利 280000 元 → 累进 → 正确提成", () => {
    // 前 10000 × 3% = 300
    // 10000-50000: 40000 × 5% = 2000
    // 50000-200000: 150000 × 8% = 12000
    // 200000-280000: 80000 × 10% = 8000
    // 合计 = 22300
    const result = calculateTieredCommission(280000);
    expect(result.commissionAmount).toBe(22300);
    expect(result.effectiveRate).toBe(0.10);
  });

  it("支持自定义阶梯规则", () => {
    const customRules: TieredRule[] = [
      { from: 0, to: 5000, rate: 0.02 },
      { from: 5000, to: null, rate: 0.06 },
    ];
    // 3000 × 2% = 60
    const result1 = calculateTieredCommission(3000, customRules);
    expect(result1.commissionAmount).toBe(60);

    // 5000 × 2% + 5000 × 6% = 100 + 300 = 400
    const result2 = calculateTieredCommission(10000, customRules);
    expect(result2.commissionAmount).toBe(400);
  });

  it("提成金额精确到分（两位小数）", () => {
    // 毛利 1 元 × 3% = 0.03 元
    const result = calculateTieredCommission(1);
    expect(result.commissionAmount).toBe(0.03);
  });
});

// ============================================================
// 第二部分：月末 Cron Job 核算主函数测试
// ============================================================

describe("runMonthlyCommissionSettlement — Cron Job 核算", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 默认 select 返回空（表示尚未结算，允许写入）
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // 空 = 未结算
    };
    mockSelect.mockReturnValue(selectChain);

    // insert 返回成功
    const insertChain = {
      values: vi.fn().mockResolvedValue({ insertId: 1 }),
    };
    mockInsert.mockReturnValue(insertChain);
  });

  it("应为 4 名销售生成提成记录", async () => {
    const results = await runMonthlyCommissionSettlement("2026-01");
    expect(results).toHaveLength(4);
  });

  it("张三（毛利 8500）→ 提成 255 元", async () => {
    const results = await runMonthlyCommissionSettlement("2026-01");
    const zhangsan = results.find((r) => r.salesId === 1);
    expect(zhangsan).toBeDefined();
    expect(zhangsan!.commissionAmount).toBe(255);
    expect(zhangsan!.grossProfit).toBe(8500);
  });

  it("李四（毛利 45000）→ 提成 2050 元", async () => {
    const results = await runMonthlyCommissionSettlement("2026-01");
    const lisi = results.find((r) => r.salesId === 2);
    expect(lisi!.commissionAmount).toBe(2050);
  });

  it("王五（毛利 120000）→ 提成 7900 元", async () => {
    const results = await runMonthlyCommissionSettlement("2026-01");
    const wangwu = results.find((r) => r.salesId === 3);
    expect(wangwu!.commissionAmount).toBe(7900);
  });

  it("赵六（毛利 280000）→ 提成 22300 元", async () => {
    const results = await runMonthlyCommissionSettlement("2026-01");
    const zhaoliu = results.find((r) => r.salesId === 4);
    expect(zhaoliu!.commissionAmount).toBe(22300);
  });

  it("结算结果包含正确的 period 字段", async () => {
    const results = await runMonthlyCommissionSettlement("2026-02");
    expect(results.every((r) => r.period === "2026-02")).toBe(true);
  });

  it("幂等性：已存在记录时跳过写入（不重复 insert）", async () => {
    // 模拟 select 返回已存在的记录
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 99 }]), // 已存在
    };
    mockSelect.mockReturnValue(selectChain);

    const results = await runMonthlyCommissionSettlement("2026-01");
    // 仍然返回计算结果
    expect(results).toHaveLength(4);
    // 但 insert 不应被调用
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("不传 period 时默认使用上个月", async () => {
    const results = await runMonthlyCommissionSettlement();
    const expectedPeriod = getPreviousMonth();
    expect(results.every((r) => r.period === expectedPeriod)).toBe(true);
  });
});

// ============================================================
// 第三部分：辅助函数测试
// ============================================================

describe("辅助函数", () => {
  it("getPreviousMonth 返回 YYYY-MM 格式", () => {
    const period = getPreviousMonth();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });

  it("getCurrentMonth 返回 YYYY-MM 格式", () => {
    const period = getCurrentMonth();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });

  it("getMockSalesProfitData 返回 4 条记录", async () => {
    const data = await getMockSalesProfitData("2026-01");
    expect(data).toHaveLength(4);
    expect(data[0]).toHaveProperty("salesId");
    expect(data[0]).toHaveProperty("salesName");
    expect(data[0]).toHaveProperty("grossProfit");
  });

  it("DEFAULT_TIERED_RULES 包含 4 档阶梯", () => {
    expect(DEFAULT_TIERED_RULES).toHaveLength(4);
    expect(DEFAULT_TIERED_RULES[0].rate).toBe(0.03);
    expect(DEFAULT_TIERED_RULES[3].to).toBeNull(); // 最高档无上限
  });
});

// ============================================================
// 第四部分：PaymentReceipt CRUD 测试
// ============================================================

describe("paymentReceiptService — 打款凭证 CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 模拟 insert 返回 insertId（注意： Drizzle MySQL insert 返回数组 [{insertId}]）
    const insertChain = {
      values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
    };
    mockInsert.mockReturnValue(insertChain);

    // 模拟 select 返回凭证记录
    const mockRecord = {
      id: 42,
      orderId: 100,
      amount: "5000.00",
      paidAt: new Date("2026-01-15"),
      status: "PENDING",
      submittedBy: 1,
      submittedByName: "张三",
    };
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockRecord]),
    };
    mockSelect.mockReturnValue(selectChain);

    // 模拟 update
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };
    mockUpdate.mockReturnValue(updateChain);
  });

  it("submit 应成功提交打款凭证并返回记录", async () => {
    const result = await paymentReceiptService.submit({
      orderId: 100,
      amount: 5000,
      paidAt: new Date("2026-01-15"),
      receiptUrl: "https://oss.example.com/receipt.jpg",
      submittedBy: 1,
      submittedByName: "张三",
    });
    expect(result).toBeDefined();
    expect(result.orderId).toBe(100);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("listByOrder 应返回订单的凭证列表", async () => {
    // listByOrder 不调用 limit，重新 mock
    const selectChainNoLimit = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 42, orderId: 100 }]),
    };
    mockSelect.mockReturnValue(selectChainNoLimit);

    const result = await paymentReceiptService.listByOrder(100);
    expect(Array.isArray(result)).toBe(true);
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it("verify 应将凭证状态更新为 VERIFIED", async () => {
    // verify 先 update 后 select
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };
    mockUpdate.mockReturnValue(updateChain);

    const mockVerifiedRecord = {
      id: 42,
      orderId: 100,
      status: "VERIFIED",
      verifiedBy: 2,
      verifiedByName: "财务李四",
    };
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockVerifiedRecord]),
    };
    mockSelect.mockReturnValue(selectChain);

    const result = await paymentReceiptService.verify(42, 2, "财务李四");
    expect(result.status).toBe("VERIFIED");
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it("reject 应将凭证状态更新为 REJECTED 并记录原因", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };
    mockUpdate.mockReturnValue(updateChain);

    const mockRejectedRecord = {
      id: 42,
      orderId: 100,
      status: "REJECTED",
      rejectReason: "金额不符",
    };
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockRejectedRecord]),
    };
    mockSelect.mockReturnValue(selectChain);

    const result = await paymentReceiptService.reject(42, 2, "财务李四", "金额不符");
    expect(result.status).toBe("REJECTED");
    expect(result.rejectReason).toBe("金额不符");
  });
});

// ============================================================
// 第五部分：tRPC 路由注册验证
// ============================================================

describe("tRPC 路由注册验证", () => {
  it("routers.ts 包含 commission.triggerSettlement 路由", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers.ts", "utf-8");
    expect(content).toContain("triggerSettlement");
    expect(content).toContain("runMonthlyCommissionSettlement");
  });

  it("routers.ts 包含 commission.listBySales 路由", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers.ts", "utf-8");
    expect(content).toContain("listBySales");
  });

  it("routers.ts 包含 commission.listByPeriod 路由", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers.ts", "utf-8");
    expect(content).toContain("listByPeriod");
  });

  it("routers.ts 包含独立的 paymentReceipt 路由（submit/verify/reject）", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers.ts", "utf-8");
    expect(content).toContain("paymentReceipt: router(");
    expect(content).toContain("submit: protectedProcedure");
    expect(content).toContain("verify: protectedProcedure");
    expect(content).toContain("reject: protectedProcedure");
  });

  it("commission-engine-v2.ts 导出所有必要函数", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/commission-engine-v2.ts", "utf-8");
    expect(content).toContain("export function calculateTieredCommission");
    expect(content).toContain("export async function runMonthlyCommissionSettlement");
    expect(content).toContain("export const paymentReceiptService");
    expect(content).toContain("export const DEFAULT_TIERED_RULES");
  });

  it("schema.ts 包含 sales_commissions 和 payment_receipts 表定义", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./drizzle/schema.ts", "utf-8");
    expect(content).toContain("sales_commissions");
    expect(content).toContain("payment_receipts");
    expect(content).toContain("SalesCommission");
    expect(content).toContain("PaymentReceipt");
  });
});
