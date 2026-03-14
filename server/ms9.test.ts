/**
 * Mega-Sprint 9 强制沙箱 E2E 验收测试
 * 
 * T1: MRP 短缺计算测试
 *   - 注册原材料（黄豆，库存 200kg，安全库存 50kg）
 *   - 注册 BOM（每件成品消耗 500kg 黄豆，损耗率 2%）
 *   - 运行 MRP（需求 1 件成品）
 *   - 验证：需求 510kg，库存 200kg，短缺 310kg（MRP 不减安全库存，安全库存由采购员决策）
 *   - 验证：数据库中生成 DRAFT 采购建议单
 * 
 * T2: SRM 客诉穿透扣款测试
 *   - 创建供应商
 *   - 记录原料入库批次
 *   - 创建客诉单（issueType: "QUALITY"）
 *   - 触发供应商扣款（根据批次号反查供应商）
 *   - 验证：扣款单已生成，供应商质量评分已降低，批次状态已更新
 * 
 * T3: AR 账龄分桶精确性测试
 *   - 创建 5 笔不同逾期天数的账单
 *   - 调用账龄分析接口
 *   - 验证每笔账单精确落入正确的账龄区间
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  upsertMaterial,
  upsertBomItem,
  runMrp,
  getDraftPurchaseOrders,
} from "./mrp-service";
import {
  createSupplier,
  recordMaterialReceipt,
  triggerSupplierPenaltyFromAfterSales,
} from "./srm-service";
import {
  generateArAgingReport,
  createTestBillingStatement,
} from "./ar-aging-service";
import {
  materials,
  bomItems,
  purchaseOrders,
  suppliers,
  materialReceipts,
  supplierPenalties,
  billingStatements,
  afterSalesTickets,
} from "../drizzle/schema";
import { eq, like } from "drizzle-orm";

// ============================================================
// 测试数据清理辅助
// ============================================================
const TEST_PREFIX = `MS9_TEST_${Date.now()}`;
let testMaterialId: number;
let testBomId: number;
let testSupplierId: number;
let testReceiptId: number;
let testTicketId: number;
let testPenaltyId: number;
const testBillingIds: number[] = [];

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  // 清理测试数据（按依赖顺序）
  if (testPenaltyId) await db.delete(supplierPenalties).where(eq(supplierPenalties.id, testPenaltyId));
  if (testTicketId) await db.delete(afterSalesTickets).where(eq(afterSalesTickets.id, testTicketId));
  if (testReceiptId) await db.delete(materialReceipts).where(eq(materialReceipts.id, testReceiptId));
  if (testSupplierId) await db.delete(suppliers).where(eq(suppliers.id, testSupplierId));
  for (const id of testBillingIds) {
    await db.delete(billingStatements).where(eq(billingStatements.id, id));
  }
  // 清理 MRP 测试数据（用 triggerSource 字段过滤）
  await db.delete(purchaseOrders).where(like(purchaseOrders.triggerSource, `%${TEST_PREFIX}%`));
  if (testBomId) await db.delete(bomItems).where(eq(bomItems.id, testBomId));
  if (testMaterialId) await db.delete(materials).where(eq(materials.id, testMaterialId));
});

// ============================================================
// T1: MRP 短缺计算测试
// ============================================================
describe("T1: MRP 物料需求引擎 - 短缺计算与采购建议生成", () => {
  it("T1.1 注册原材料（黄豆，库存 200kg，安全库存 50kg）", async () => {
    testMaterialId = await upsertMaterial({
      materialCode: `${TEST_PREFIX}_SOYBEAN`,
      materialName: "黄豆（测试）",
      unit: "kg",
      stockQty: 200,
      safetyStock: 50,
      unitCost: 3.5,
    });
    expect(testMaterialId).toBeGreaterThan(0);
  });

  it("T1.2 注册 BOM 条目（每件成品消耗 500kg 黄豆，损耗率 2%）", async () => {
    testBomId = await upsertBomItem({
      productCode: `${TEST_PREFIX}_TOFU_SKIN`,
      productName: "千张豆皮（测试）",
      materialId: testMaterialId,
      materialName: "黄豆（测试）",
      qtyPerUnit: 500,
      unit: "kg",
      wasteRate: 0.02,
    });
    expect(testBomId).toBeGreaterThan(0);
  });

  it("T1.3 运行 MRP：需求 1 件成品，应计算出黄豆短缺", async () => {
    const result = await runMrp({
      orderNo: `${TEST_PREFIX}_ORD_001`,
      productCode: `${TEST_PREFIX}_TOFU_SKIN`,
      productName: "千张豆皮（测试）",
      requiredQty: 1,
    });

    // 需求量 = 500 * 1 * (1 + 0.02) = 510kg
    // 库存 = 200kg
    // 短缺 = 510 - 200 = 310kg（MRP 直接比对物理库存，安全库存由采购员决策）
    expect(result.lines.length).toBeGreaterThan(0);
    const soybeanItem = result.lines.find(
      (b) => b.materialCode === `${TEST_PREFIX}_SOYBEAN`
    );
    expect(soybeanItem).toBeDefined();
    expect(soybeanItem!.requiredQty).toBeCloseTo(510, 0); // 500 * 1.02
    expect(soybeanItem!.shortageQty).toBeGreaterThan(0);
    expect(soybeanItem!.shortageQty).toBeCloseTo(310, 0); // 510 - 200 = 310
    expect(soybeanItem!.status).toBe("SHORTAGE");
  });

  it("T1.4 验证数据库中已生成 DRAFT 状态的采购建议单", async () => {
    const draftOrders = await getDraftPurchaseOrders();
    const ourOrder = draftOrders.find(
      (o) => o.triggerSource?.includes(`${TEST_PREFIX}_ORD_001`)
    );
    expect(ourOrder).toBeDefined();
    expect(ourOrder!.status).toBe("DRAFT");
    expect(parseFloat(ourOrder!.requiredQty as string)).toBeGreaterThan(0);
    // 验证采购量 = 短缺量 310kg
    expect(parseFloat(ourOrder!.requiredQty as string)).toBeCloseTo(310, 0);
  });
});

// ============================================================
// T2: SRM 客诉穿透扣款测试
// ============================================================
describe("T2: SRM 供应商闭环 - 客诉穿透与扣款单自动生成", () => {
  const BATCH_NO = `BATCH_${TEST_PREFIX}_001`;

  it("T2.1 创建供应商（黄豆供应商）", async () => {
    testSupplierId = await createSupplier({
      supplierCode: `SUP_${TEST_PREFIX}`,
      supplierName: "测试黄豆供应商",
      contactPerson: "张三",
      phone: "13800138000",
    });
    expect(testSupplierId).toBeGreaterThan(0);
  });

  it("T2.2 记录原料入库批次（绑定供应商 + 批次号）", async () => {
    const receipt = await recordMaterialReceipt({
      supplierId: testSupplierId,
      supplierName: "测试黄豆供应商",
      materialId: testMaterialId ?? 1,
      materialName: "黄豆（测试）",
      batchNo: BATCH_NO,
      receivedQty: 1000,
      unit: "kg",
      unitCost: 3.5,
    });
    testReceiptId = receipt.id;
    expect(testReceiptId).toBeGreaterThan(0);
    expect(receipt.receiptNo).toMatch(/^RCP-/);
  });

  it("T2.3 创建客诉单（模拟货损投诉）", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB_UNAVAILABLE");

    const ticketNo = `AST_${TEST_PREFIX}_001`;
    await db.insert(afterSalesTickets).values({
      ticketNo,
      orderId: 0,
      orderNo: `ORD_${TEST_PREFIX}`,
      customerId: 1,
      customerName: "测试客户",
      issueType: "QUALITY",  // 枚举值：DAMAGE | QUALITY | SHORT_DELIVERY | WRONG_ITEM | OTHER
      description: "黄豆发霉，疑似原料问题",
      status: "PENDING",
      reportedBy: 1,
      reportedByName: "测试业务员",
    });
    // 通过 ticketNo 查询得到 ID
    const [inserted] = await db
      .select()
      .from(afterSalesTickets)
      .where(eq(afterSalesTickets.ticketNo, ticketNo))
      .limit(1);
    testTicketId = inserted.id;
    expect(testTicketId).toBeGreaterThan(0);
  });

  it("T2.4 触发供应商穿透：根据批次号反查供应商并生成扣款单", async () => {
    const penalty = await triggerSupplierPenaltyFromAfterSales({
      afterSalesTicketId: testTicketId,
      rawMaterialBatchNo: BATCH_NO,
      penaltyAmount: 2000,
      penaltyReason: "原料发霉导致成品质量问题，扣款 2000 元",
    });

    testPenaltyId = penalty.penaltyId;
    expect(penalty.penaltyId).toBeGreaterThan(0);
    expect(penalty.penaltyNo).toMatch(/^PNL-/);
    expect(penalty.supplierId).toBe(testSupplierId);
    expect(penalty.supplierName).toBe("测试黄豆供应商");
    expect(penalty.batchNo).toBe(BATCH_NO);
    expect(penalty.penaltyAmount).toBe(2000);
    expect(penalty.status).toBe("DRAFT");
  });

  it("T2.5 验证供应商质量评分已降低（5.0 → 4.5）", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB_UNAVAILABLE");

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, testSupplierId))
      .limit(1);

    expect(supplier).toBeDefined();
    // 初始 5.0，扣款后降低 0.5
    expect(parseFloat(supplier.qualityRating as string)).toBeCloseTo(4.5, 1);
    // 累计扣款金额应为 2000
    expect(parseFloat(supplier.totalPenaltyAmount as string)).toBeCloseTo(2000, 0);
  });

  it("T2.6 验证批次质量状态已更新为 REJECTED", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB_UNAVAILABLE");

    const [receipt] = await db
      .select()
      .from(materialReceipts)
      .where(eq(materialReceipts.id, testReceiptId))
      .limit(1);

    expect(receipt.qualityStatus).toBe("REJECTED");
  });

  it("T2.7 验证错误批次号触发 RECEIPT_NOT_FOUND 错误", async () => {
    await expect(
      triggerSupplierPenaltyFromAfterSales({
        afterSalesTicketId: testTicketId,
        rawMaterialBatchNo: "NONEXISTENT_BATCH_XYZ",
        penaltyAmount: 500,
        penaltyReason: "测试错误批次",
      })
    ).rejects.toThrow("RECEIPT_NOT_FOUND");
  });
});

// ============================================================
// T3: AR 账龄分桶精确性测试
// ============================================================
describe("T3: AR 账龄分析 - 分桶精确性验证", () => {
  // 使用固定的基准日期（2026-03-14）来确保测试可重复
  const AS_OF_DATE = "2026-03-14";

  // 5 笔账单，分别对应 5 个账龄区间
  // daysOffset: 正数 = 未来（未逾期），负数 = 过去（已逾期）
  const TEST_CASES = [
    {
      label: "未逾期（到期日 = 明天）",
      daysOffset: 1,   // 到期日 = 2026-03-15，未逾期
      expectedBucket: "CURRENT",
      amount: 10000,
    },
    {
      label: "逾期 15 天（1-30 Days）",
      daysOffset: -15,
      expectedBucket: "1_30_DAYS",
      amount: 20000,
    },
    {
      label: "逾期 45 天（31-60 Days）",
      daysOffset: -45,
      expectedBucket: "31_60_DAYS",
      amount: 30000,
    },
    {
      label: "逾期 75 天（61-90 Days）",
      daysOffset: -75,
      expectedBucket: "61_90_DAYS",
      amount: 40000,
    },
    {
      label: "逾期 100 天（90+ Days）",
      daysOffset: -100,
      expectedBucket: "90_PLUS_DAYS",
      amount: 50000,
    },
  ];

  beforeAll(async () => {
    // 使用固定基准日期计算 dueDate（避免时区问题）
    for (const tc of TEST_CASES) {
      // 直接用字符串计算，避免 new Date() 时区偏移
      const baseParts = AS_OF_DATE.split("-").map(Number);
      const baseMs = Date.UTC(baseParts[0], baseParts[1] - 1, baseParts[2]);
      const dueDateMs = baseMs + tc.daysOffset * 24 * 60 * 60 * 1000;
      const d = new Date(dueDateMs);
      const dueDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      const id = await createTestBillingStatement({
        customerId: 9990 + TEST_CASES.indexOf(tc),
        customerName: `AR测试客户_${TEST_PREFIX}_${tc.expectedBucket}`,
        period: "2026-01",
        totalAmount: tc.amount,
        outstandingAmount: tc.amount,
        dueDate: dueDateStr,
        status: tc.daysOffset < 0 ? "OVERDUE" : "GENERATED",
      });
      testBillingIds.push(id);
    }
  });

  it("T3.1 生成账龄报告（基准日期 2026-03-14）", async () => {
    const report = await generateArAgingReport(AS_OF_DATE);
    expect(report).toBeDefined();
    expect(report.asOfDate).toBe(AS_OF_DATE);
    expect(report.totalStatements).toBeGreaterThanOrEqual(5);
    expect(report.buckets).toHaveLength(5);
  });

  it("T3.2 验证 CURRENT 分桶：¥10,000 精确落入未逾期区间", async () => {
    const report = await generateArAgingReport(AS_OF_DATE);
    const ourDetail = report.details.find(
      (d) => d.customerName.includes(`AR测试客户_${TEST_PREFIX}_CURRENT`)
    );
    expect(ourDetail).toBeDefined();
    expect(ourDetail!.bucket).toBe("CURRENT");
    expect(ourDetail!.overdueDays).toBeLessThanOrEqual(0);
  });

  it("T3.3 验证 1-30 Days 分桶：¥20,000 精确落入 1-30 天区间", async () => {
    const report = await generateArAgingReport(AS_OF_DATE);
    const ourDetail = report.details.find(
      (d) => d.customerName.includes(`AR测试客户_${TEST_PREFIX}_1_30_DAYS`)
    );
    expect(ourDetail).toBeDefined();
    expect(ourDetail!.bucket).toBe("1_30_DAYS");
    expect(ourDetail!.overdueDays).toBeGreaterThanOrEqual(1);
    expect(ourDetail!.overdueDays).toBeLessThanOrEqual(30);
  });

  it("T3.4 验证 31-60 Days 分桶：¥30,000 精确落入 31-60 天区间", async () => {
    const report = await generateArAgingReport(AS_OF_DATE);
    const ourDetail = report.details.find(
      (d) => d.customerName.includes(`AR测试客户_${TEST_PREFIX}_31_60_DAYS`)
    );
    expect(ourDetail).toBeDefined();
    expect(ourDetail!.bucket).toBe("31_60_DAYS");
    expect(ourDetail!.overdueDays).toBeGreaterThanOrEqual(31);
    expect(ourDetail!.overdueDays).toBeLessThanOrEqual(60);
  });

  it("T3.5 验证 61-90 Days 分桶：¥40,000 精确落入 61-90 天区间", async () => {
    const report = await generateArAgingReport(AS_OF_DATE);
    const ourDetail = report.details.find(
      (d) => d.customerName.includes(`AR测试客户_${TEST_PREFIX}_61_90_DAYS`)
    );
    expect(ourDetail).toBeDefined();
    expect(ourDetail!.bucket).toBe("61_90_DAYS");
    expect(ourDetail!.overdueDays).toBeGreaterThanOrEqual(61);
    expect(ourDetail!.overdueDays).toBeLessThanOrEqual(90);
  });

  it("T3.6 验证 90+ Days 分桶：¥50,000 精确落入高风险区间", async () => {
    const report = await generateArAgingReport(AS_OF_DATE);
    const ourDetail = report.details.find(
      (d) => d.customerName.includes(`AR测试客户_${TEST_PREFIX}_90_PLUS_DAYS`)
    );
    expect(ourDetail).toBeDefined();
    expect(ourDetail!.bucket).toBe("90_PLUS_DAYS");
    expect(ourDetail!.overdueDays).toBeGreaterThan(90);
  });

  it("T3.7 验证高风险客户列表中包含 90+ 天逾期客户", async () => {
    const report = await generateArAgingReport(AS_OF_DATE);
    const riskyCustomer = report.topRiskyCustomers.find(
      (c) => c.customerName.includes(`AR测试客户_${TEST_PREFIX}_90_PLUS_DAYS`)
    );
    expect(riskyCustomer).toBeDefined();
    expect(riskyCustomer!.riskLevel).toBe("HIGH");
    expect(riskyCustomer!.maxOverdueDays).toBeGreaterThan(90);
  });
});
