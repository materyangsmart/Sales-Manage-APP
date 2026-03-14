/**
 * Mega-Sprint 8 强制沙箱 E2E 验收测试
 *
 * T1: 风控拦截测试 - 无出差申请时提交差旅报销必须被拦截
 * T2: 全链路测试 - 出差申请 → 总监审批 → 提交报销 → 财务打款
 * T3: 成本核算精确性测试 - 5% 管理费率下净利计算绝对精确
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";

// ============================================================
// 辅助函数
// ============================================================
async function cleanupTestData(prefix: string) {
  const db = await getDb();
  if (!db) return;
  const { expenseClaims, businessTrips, customerCostConfig, expenseClaimsExtension } = await import("../drizzle/schema");
  const { like } = await import("drizzle-orm");
  // 清理测试数据（按前缀匹配）
  try {
    await db.delete(expenseClaimsExtension).where(like(expenseClaimsExtension.businessTripNo, `${prefix}%`));
  } catch {}
  try {
    await db.delete(expenseClaims).where(like(expenseClaims.claimNo, `${prefix}%`));
  } catch {}
  try {
    await db.delete(businessTrips).where(like(businessTrips.tripNo, `${prefix}%`));
  } catch {}
}

// ============================================================
// T1: 风控拦截测试
// ============================================================
describe("T1: 差旅报销风控拦截测试", () => {
  it("T1.1 - 差旅类报销在没有出差申请时必须被拦截（抛出 TRAVEL_EXPENSE_BLOCKED 错误）", async () => {
    const { submitTravelExpenseClaim } = await import("./business-trip-service");

    let errorThrown = false;
    let errorCode = "";
    let errorMessage = "";

    try {
      await submitTravelExpenseClaim({
        submittedBy: 9001,
        submittedByName: "测试业务员-风控",
        expenseType: "TRAVEL",
        amount: 800,
        description: "出差住宿费（无申请单）",
        expenseDate: "2026-03-14",
        // 故意不传 businessTripId
      });
    } catch (err: any) {
      errorThrown = true;
      errorCode = err.code || "";
      errorMessage = err.message || "";
    }

    expect(errorThrown).toBe(true);
    expect(errorCode).toBe("TRAVEL_EXPENSE_BLOCKED");
    console.log(`✅ T1.1 PASS: 风控拦截成功 - "${errorMessage}"`);
  });

  it("T1.2 - 差旅类报销关联 PENDING 状态的出差申请时也必须被拦截", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const { businessTrips } = await import("../drizzle/schema");
    const { submitTravelExpenseClaim, submitBusinessTrip } = await import("./business-trip-service");

    // 提交一个 PENDING 状态的出差申请
    const trip = await submitBusinessTrip({
      applicantId: 9001,
      applicantName: "测试业务员-风控",
      destination: "测试目的地",
      plannedWork: "测试拜访",
      startDate: "2026-03-15",
      endDate: "2026-03-16",
    });

    expect(trip.status).toBe("PENDING");

    let errorThrown = false;
    let errorCode = "";

    try {
      await submitTravelExpenseClaim({
        submittedBy: 9001,
        submittedByName: "测试业务员-风控",
        expenseType: "TRAVEL",
        amount: 500,
        description: "出差住宿费（申请单未批准）",
        expenseDate: "2026-03-16",
        businessTripId: trip.id,
      });
    } catch (err: any) {
      errorThrown = true;
      errorCode = err.code || "";
    }

    expect(errorThrown).toBe(true);
    expect(errorCode).toBe("TRAVEL_EXPENSE_BLOCKED");

    // 清理
    await db.delete(businessTrips).where((await import("drizzle-orm")).eq(businessTrips.id, trip.id));
    console.log(`✅ T1.2 PASS: PENDING 状态出差申请也被正确拦截`);
  });

  it("T1.3 - 非差旅类报销（ENTERTAINMENT）无需出差申请，可以直接提交", async () => {
    const { submitExpenseClaim } = await import("./expense-service");

    const claim = await submitExpenseClaim({
      submittedBy: 9001,
      submittedByName: "测试业务员-风控",
      expenseType: "ENTERTAINMENT",
      amount: 300,
      description: "客户招待费（无需出差申请）",
      expenseDate: "2026-03-14",
    });

    expect(claim).toBeDefined();
    expect(claim.claimNo).toBeTruthy();
    expect(claim.status).toBe("PENDING");

    // 清理
    const db = await getDb();
    if (db) {
      const { expenseClaims } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(expenseClaims).where(eq(expenseClaims.id, claim.id));
    }
    console.log(`✅ T1.3 PASS: 非差旅类报销可以直接提交，单号: ${claim.claimNo}`);
  });
});

// ============================================================
// T2: 全链路测试
// ============================================================
describe("T2: 出差申请全链路测试", () => {
  let tripId: number;
  let tripNo: string;
  let claimId: number;
  let claimNo: string;

  it("T2.1 - 业务员提交出差申请，状态为 PENDING", async () => {
    const { submitBusinessTrip } = await import("./business-trip-service");

    const trip = await submitBusinessTrip({
      applicantId: 9002,
      applicantName: "张三-全链路测试",
      destination: "上海浦东新区",
      visitedCustomers: JSON.stringify(["客户A", "客户B"]),
      plannedWork: "拜访重点商超客户，洽谈 Q2 铺货计划",
      startDate: "2026-03-20",
      endDate: "2026-03-22",
      estimatedAccommodation: 600,
      estimatedMeals: 200,
      estimatedTransport: 300,
      coTravelerId: 9003,
      coTravelerName: "李四-同行",
    });

    expect(trip).toBeDefined();
    expect(trip.status).toBe("PENDING");
    expect(trip.tripNo).toMatch(/^TRIP/);
    expect(trip.destination).toBe("上海浦东新区");

    tripId = trip.id;
    tripNo = trip.tripNo;
    console.log(`✅ T2.1 PASS: 出差申请提交成功，单号: ${tripNo}, 预估费用: ¥${trip.estimatedTotal}`);
  });

  it("T2.2 - 销售总监审批通过，状态变为 APPROVED", async () => {
    expect(tripId).toBeDefined();
    const { reviewBusinessTrip } = await import("./business-trip-service");

    const updated = await reviewBusinessTrip({
      tripId,
      approverId: 8001,
      approverName: "王总-销售总监",
      approved: true,
      approvalRemark: "同意，注意控制住宿费用",
    });

    expect(updated).toBeDefined();
    expect(updated.status).toBe("APPROVED");
    expect(updated.approverName).toBe("王总-销售总监");
    console.log(`✅ T2.2 PASS: 总监审批通过，状态: ${updated.status}`);
  });

  it("T2.3 - 业务员提交带发票附件的差旅报销单（关联已批准的出差申请）", async () => {
    expect(tripId).toBeDefined();
    const { submitTravelExpenseClaim } = await import("./business-trip-service");

    const claim = await submitTravelExpenseClaim({
      submittedBy: 9002,
      submittedByName: "张三-全链路测试",
      expenseType: "TRAVEL",
      amount: 1050,
      description: "上海出差：住宿费 ¥600 + 餐费 ¥150 + 交通费 ¥300",
      expenseDate: "2026-03-22",
      invoiceImageUrl: "https://example.com/invoice-test-ms8.jpg",
      businessTripId: tripId,
    });

    expect(claim).toBeDefined();
    expect(claim.claimNo).toBeTruthy();
    expect(claim.status).toBe("PENDING");

    claimId = claim.id;
    claimNo = claim.claimNo;
    console.log(`✅ T2.3 PASS: 差旅报销单提交成功，单号: ${claimNo}, 金额: ¥${claim.amount}`);
  });

  it("T2.4 - 部门主管审批通过报销单，状态变为 APPROVED", async () => {
    expect(claimId).toBeDefined();
    const { approveExpenseClaim } = await import("./expense-service");

    const result = await approveExpenseClaim({
      claimId,
      approvedBy: 8002,
      approvedByName: "陈经理-部门主管",
      approved: true,
      approvalRemark: "发票清晰，金额合理，审批通过",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("APPROVED");
    console.log(`✅ T2.4 PASS: 部门审批通过，状态: ${result.status}`);
  });

  it("T2.5 - 财务查看报销单并确认打款，状态变为 PAID", async () => {
    expect(claimId).toBeDefined();
    const { financeApproveClaim } = await import("./business-trip-service");

    const result = await financeApproveClaim({
      claimId,
      paidBy: 7001,
      paidByName: "赵会计-财务部",
      financeRemark: "已转账至员工银行卡，流水号 TEST-MS8-001",
    });

    expect(result.success).toBe(true);
    expect(result.claimNo).toBe(claimNo);
    expect(parseFloat(result.amount as string)).toBe(1050);

    // 验证扩展表中 isPaid = true
    const db = await getDb();
    if (db) {
      const { expenseClaimsExtension } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [ext] = await db
        .select()
        .from(expenseClaimsExtension)
        .where(eq(expenseClaimsExtension.expenseClaimId, claimId))
        .limit(1);
      expect(ext).toBeDefined();
      expect(ext.isPaid).toBe(true);
      expect(ext.businessTripNo).toBe(tripNo);
    }

    console.log(`✅ T2.5 PASS: 财务打款完成，单号: ${result.claimNo}, 金额: ¥${result.amount}`);
  });

  it("T2.6 - 清理全链路测试数据", async () => {
    const db = await getDb();
    if (!db) return;
    const { expenseClaims, businessTrips, expenseClaimsExtension } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    if (claimId) {
      await db.delete(expenseClaimsExtension).where(eq(expenseClaimsExtension.expenseClaimId, claimId));
      await db.delete(expenseClaims).where(eq(expenseClaims.id, claimId));
    }
    if (tripId) {
      await db.delete(businessTrips).where(eq(businessTrips.id, tripId));
    }
    console.log(`✅ T2.6 PASS: 全链路测试数据已清理`);
  });
});

// ============================================================
// T3: 成本核算精确性测试
// ============================================================
describe("T3: 单客精细化成本核算精确性测试", () => {
  const TEST_CUSTOMER_ID = 99001;
  const TEST_CUSTOMER_NAME = "MS8-测试商超客户";
  const MANAGEMENT_COST_RATE = 0.05; // 5%

  let expenseClaimId: number;

  it("T3.1 - 设置客户成本配置（5% 管理费率）", async () => {
    const { setCustomerCostConfig } = await import("./customer-pnl-service");

    const config = await setCustomerCostConfig({
      customerId: TEST_CUSTOMER_ID,
      customerName: TEST_CUSTOMER_NAME,
      managementCostRate: MANAGEMENT_COST_RATE,
      overdueInterestRate: 0.06,
      customerType: "SUPERMARKET",
      notes: "MS8 E2E 测试用商超客户",
    });

    expect(config).toBeDefined();
    expect(parseFloat(config.managementCostRate)).toBe(MANAGEMENT_COST_RATE);
    expect(config.customerType).toBe("SUPERMARKET");
    console.log(`✅ T3.1 PASS: 客户成本配置已设置，管理费率: ${(MANAGEMENT_COST_RATE * 100).toFixed(0)}%`);
  });

  it("T3.2 - 提交一笔 ¥500 招待费并绑定到测试客户", async () => {
    const { submitExpenseClaim } = await import("./expense-service");

    const claim = await submitExpenseClaim({
      submittedBy: 9003,
      submittedByName: "测试业务员-成本核算",
      associatedCustomerId: TEST_CUSTOMER_ID,
      associatedCustomerName: TEST_CUSTOMER_NAME,
      expenseType: "ENTERTAINMENT",
      amount: 500,
      description: "拜访商超客户招待费 MS8 E2E Test",
      expenseDate: "2026-03-14",
    });

    expect(claim).toBeDefined();
    expect(claim.status).toBe("PENDING");
    expenseClaimId = claim.id;
    console.log(`✅ T3.2 PASS: 招待费报销单提交成功，单号: ${claim.claimNo}`);
  });

  it("T3.3 - 审批通过 ¥500 招待费（变为 APPROVED 才计入成本）", async () => {
    expect(expenseClaimId).toBeDefined();
    const { approveExpenseClaim } = await import("./expense-service");

    const result = await approveExpenseClaim({
      claimId: expenseClaimId,
      approvedBy: 8001,
      approvedByName: "审批人-成本核算测试",
      approved: true,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("APPROVED");
    console.log(`✅ T3.3 PASS: 招待费审批通过`);
  });

  it("T3.4 - 调用精细化利润大盘接口，验证管理成本精确扣减", async () => {
    const { getCustomerDetailedPnL } = await import("./customer-pnl-service");

    const pnl = await getCustomerDetailedPnL(TEST_CUSTOMER_ID);

    expect(pnl).toBeDefined();
    expect(pnl.costConfig.managementCostRate).toBe(MANAGEMENT_COST_RATE);

    // 验证招待费 ¥500 已计入 totalExpenses
    expect(pnl.summary.totalExpenses).toBeGreaterThanOrEqual(500);

    // 验证管理成本 = 总销售额 × 5%（精确计算）
    const expectedManagementCost = pnl.summary.totalRevenue * MANAGEMENT_COST_RATE;
    expect(Math.abs(pnl.summary.managementCost - expectedManagementCost)).toBeLessThan(0.01);

    // 验证净利公式：净利 = 毛利 - 售后损失 - 报销费用 - 管理成本 - 逾期成本
    const expectedNetProfit =
      pnl.summary.grossProfit
      - pnl.summary.totalRmaClaims
      - pnl.summary.totalExpenses
      - pnl.summary.managementCost
      - pnl.summary.overdueCost;
    expect(Math.abs(pnl.summary.netProfit - expectedNetProfit)).toBeLessThan(0.01);

    console.log(`✅ T3.4 PASS: 净利核算精确`);
    console.log(`   总销售额: ¥${pnl.summary.totalRevenue}`);
    console.log(`   毛利润:   ¥${pnl.summary.grossProfit} (毛利率 ${(pnl.summary.grossMarginRate * 100).toFixed(1)}%)`);
    console.log(`   售后损失: ¥${pnl.summary.totalRmaClaims}`);
    console.log(`   报销费用: ¥${pnl.summary.totalExpenses} (含 ¥500 招待费)`);
    console.log(`   管理成本: ¥${pnl.summary.managementCost} (${(MANAGEMENT_COST_RATE * 100).toFixed(0)}% × ¥${pnl.summary.totalRevenue})`);
    console.log(`   逾期成本: ¥${pnl.summary.overdueCost}`);
    console.log(`   净利润:   ¥${pnl.summary.netProfit} (净利率 ${(pnl.summary.netMarginRate * 100).toFixed(2)}%)`);
  });

  it("T3.5 - 验证 ¥500 招待费精确扣减：净利 = 毛利 - ¥500 - 管理成本（无其他费用时）", async () => {
    const { getCustomerDetailedPnL } = await import("./customer-pnl-service");

    const pnl = await getCustomerDetailedPnL(TEST_CUSTOMER_ID);

    // 确认 ¥500 招待费在 breakdown 中可见
    const entertainmentExpenses = pnl.breakdown.expenseItems.filter(
      (e) => e.type === "ENTERTAINMENT" && e.amount === 500
    );
    expect(entertainmentExpenses.length).toBeGreaterThanOrEqual(1);

    // 净利公式精确验证（允许浮点误差 < 0.01）
    const formulaResult =
      pnl.summary.grossProfit
      - pnl.summary.totalRmaClaims
      - pnl.summary.totalExpenses
      - pnl.summary.managementCost
      - pnl.summary.overdueCost;

    expect(Math.abs(pnl.summary.netProfit - formulaResult)).toBeLessThan(0.01);

    console.log(`✅ T3.5 PASS: ¥500 招待费已精确计入成本，净利公式验证通过`);
    console.log(`   招待费明细: ${entertainmentExpenses.map(e => `¥${e.amount} (${e.description})`).join(', ')}`);
  });

  it("T3.6 - 清理成本核算测试数据", async () => {
    const db = await getDb();
    if (!db) return;
    const { expenseClaims, customerCostConfig } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    if (expenseClaimId) {
      await db.delete(expenseClaims).where(eq(expenseClaims.id, expenseClaimId));
    }
    await db.delete(customerCostConfig).where(eq(customerCostConfig.customerId, TEST_CUSTOMER_ID));
    console.log(`✅ T3.6 PASS: 成本核算测试数据已清理`);
  });
});
