/**
 * Mega-Sprint 10 强制沙箱 E2E 验收测试
 *
 * T1: 自助下单激励引擎 (Epic 1) - 6 个测试
 *   T1.1 销售代下单：提成乘数 0.8x，无补贴
 *   T1.2 微信H5自助下单（金额 < 100 元）：提成乘数 1.2x，无补贴
 *   T1.3 微信H5自助下单（金额 >= 100 元）：提成乘数 1.2x，补贴 5 元
 *   T1.4 客户门户自助下单（金额 >= 100 元）：提成乘数 1.2x，补贴 5 元
 *   T1.5 官网下单：提成乘数 1.0x，无补贴
 *   T1.6 持久化验证：保存后可从数据库查询到激励记录
 *
 * T2: B2B 裂变推荐系统 (Epic 2) - 6 个测试
 *   T2.1 生成邀请码：格式符合 REF-{userId}-{6位} 规范
 *   T2.2 幂等性：同一用户多次调用返回同一邀请码
 *   T2.3 接受邀请：成功绑定推荐关系
 *   T2.4 自我邀请防护：不能使用自己的邀请码
 *   T2.5 首单返佣：被推荐人首单付款后，推荐人获得 50 元信用额度
 *   T2.6 幂等返佣：同一 refereeId 只奖励一次
 *
 * T3: 智能流失预警雷达 (Epic 3) - 6 个测试
 *   T3.1 风险等级判断：daysSince > avg * 2.0 → HIGH
 *   T3.2 风险等级判断：daysSince > avg * 1.5 → MEDIUM
 *   T3.3 正常客户：daysSince < avg * 1.2 → null（无预警）
 *   T3.4 创建预警记录：HIGH 风险客户生成预警
 *   T3.5 幂等预警：同一客户同一天只创建一条
 *   T3.6 标记处理：resolveChurnAlert 更新 resolvedAt 字段
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  calculateIncentive,
  saveOrderIncentive,
  getOrderIncentive,
  getCommissionMultiplier,
  calculateSelfServiceDiscount,
} from "./services/growth-incentive-service";
import {
  generateReferralCode,
  getOrCreateReferralCode,
  acceptReferral,
  triggerReferralReward,
  getReferralStats,
} from "./services/referral-service";
import {
  assessRiskLevel,
  calcDaysSinceLastOrder,
  createChurnAlert,
  resolveChurnAlert,
  listChurnAlerts,
  buildAlertNotification,
} from "./services/churn-prediction-service";
import {
  referralRecords,
  customerProfiles,
  churnAlerts,
  orderSourceLog,
  orderDiscounts,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ============================================================
// 测试数据清理
// ============================================================
const TEST_PREFIX = `MS10_TEST_${Date.now()}`;
const testOrderIds: number[] = [];
const testReferralCodes: string[] = [];
const testChurnAlertIds: number[] = [];
const testCustomerProfileIds: number[] = [];

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  // 清理 order_source_log
  for (const orderId of testOrderIds) {
    await db.delete(orderSourceLog).where(eq(orderSourceLog.orderId, orderId));
    await db.delete(orderDiscounts).where(eq(orderDiscounts.orderId, orderId));
  }
  // 清理 referral_records
  for (const code of testReferralCodes) {
    await db.delete(referralRecords).where(eq(referralRecords.referralCode, code));
  }
  // 清理 churn_alerts
  for (const id of testChurnAlertIds) {
    await db.delete(churnAlerts).where(eq(churnAlerts.id, id));
  }
  // 清理 customer_profiles
  for (const userId of testCustomerProfileIds) {
    await db.delete(customerProfiles).where(eq(customerProfiles.userId, userId));
  }
});

// ============================================================
// T1: 自助下单激励引擎
// ============================================================
describe("T1: 自助下单激励引擎 - 提成差异化与线上补贴", () => {
  it("T1.1 销售代下单（SALES_PORTAL）：提成乘数 0.8x，无补贴", () => {
    const result = calculateIncentive({
      orderId: 10001,
      orderNo: `${TEST_PREFIX}_ORD_001`,
      source: "SALES_PORTAL",
      totalAmount: 200,
    });
    expect(result.commissionMultiplier).toBe(0.8);
    expect(result.discountApplied).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.finalAmount).toBe(200);
  });

  it("T1.2 微信H5自助下单（金额 80 元 < 100 元）：提成乘数 1.2x，无补贴", () => {
    const result = calculateIncentive({
      orderId: 10002,
      orderNo: `${TEST_PREFIX}_ORD_002`,
      source: "WECHAT_H5",
      totalAmount: 80,
    });
    expect(result.commissionMultiplier).toBe(1.2);
    expect(result.discountApplied).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.finalAmount).toBe(80);
  });

  it("T1.3 微信H5自助下单（金额 150 元 >= 100 元）：提成乘数 1.2x，补贴 5 元，实付 145 元", () => {
    const result = calculateIncentive({
      orderId: 10003,
      orderNo: `${TEST_PREFIX}_ORD_003`,
      source: "WECHAT_H5",
      totalAmount: 150,
    });
    expect(result.commissionMultiplier).toBe(1.2);
    expect(result.discountApplied).toBe(true);
    expect(result.discountAmount).toBe(5);
    expect(result.finalAmount).toBeCloseTo(145, 2);
  });

  it("T1.4 客户门户自助下单（金额 100 元，边界值）：补贴 5 元，实付 95 元", () => {
    const result = calculateIncentive({
      orderId: 10004,
      orderNo: `${TEST_PREFIX}_ORD_004`,
      source: "PORTAL",
      totalAmount: 100,
    });
    expect(result.commissionMultiplier).toBe(1.2);
    expect(result.discountApplied).toBe(true);
    expect(result.discountAmount).toBe(5);
    expect(result.finalAmount).toBeCloseTo(95, 2);
  });

  it("T1.5 官网下单（WEBSITE）：提成乘数 1.0x，无补贴", () => {
    const multiplier = getCommissionMultiplier("WEBSITE");
    const discount = calculateSelfServiceDiscount("WEBSITE", 500);
    expect(multiplier).toBe(1.0);
    expect(discount).toBe(0);
  });

  it("T1.6 持久化验证：saveOrderIncentive 写入数据库，getOrderIncentive 可查询到", async () => {
    const uniqueOrderId = 90001 + Math.floor(Math.random() * 9000);
    testOrderIds.push(uniqueOrderId);

    const saved = await saveOrderIncentive({
      orderId: uniqueOrderId,
      orderNo: `${TEST_PREFIX}_ORD_PERSIST`,
      source: "WECHAT_H5",
      totalAmount: 200,
      grossProfit: 50,
    });

    expect(saved.discountApplied).toBe(true);
    expect(saved.discountAmount).toBe(5);

    const fetched = await getOrderIncentive(uniqueOrderId);
    expect(fetched.sourceLog).not.toBeNull();
    expect(fetched.sourceLog!.source).toBe("WECHAT_H5");
    expect(parseFloat(String(fetched.sourceLog!.commissionMultiplier))).toBeCloseTo(1.2, 2);
    expect(fetched.discounts.length).toBe(1);
    expect(fetched.discounts[0].discountType).toBe("DIGITAL_SELF_SERVICE");
    expect(parseFloat(String(fetched.discounts[0].discountAmount))).toBeCloseTo(5, 2);
  });
});

// ============================================================
// T2: B2B 裂变推荐系统
// ============================================================
describe("T2: B2B 裂变推荐系统 - 邀请码生成与首单返佣", () => {
  const REFERRER_ID = 88001;
  const REFEREE_ID = 88002;
  const REFERRER_NAME = `推荐人_${TEST_PREFIX}`;
  const REFEREE_NAME = `被推荐人_${TEST_PREFIX}`;
  let referralCode: string;

  it("T2.1 生成邀请码：格式符合 REF-{userId}-{6位} 规范", () => {
    const code = generateReferralCode(REFERRER_ID);
    expect(code).toMatch(/^REF-\d+-[A-Z0-9]{6}$/);
    expect(code.startsWith(`REF-${REFERRER_ID}-`)).toBe(true);
  });

  it("T2.2 幂等性：同一用户多次调用 getOrCreateReferralCode 返回同一邀请码", async () => {
    // 先清理可能存在的旧记录
    const db = await getDb();
    if (db) {
      await db.delete(referralRecords).where(
        and(
          eq(referralRecords.referrerId, REFERRER_ID),
          eq(referralRecords.status, "PENDING")
        )
      );
    }

    const code1 = await getOrCreateReferralCode(REFERRER_ID, REFERRER_NAME);
    const code2 = await getOrCreateReferralCode(REFERRER_ID, REFERRER_NAME);
    referralCode = code1;
    testReferralCodes.push(code1);

    expect(code1).toBe(code2);
    expect(code1).toMatch(/^REF-\d+-[A-Z0-9]{6}$/);
  });

  it("T2.3 接受邀请：成功绑定推荐关系", async () => {
    const result = await acceptReferral(referralCode, REFEREE_ID, REFEREE_NAME);
    expect(result.success).toBe(true);
    expect(result.referrerId).toBe(REFERRER_ID);
    expect(result.message).toContain("成功绑定");
  });

  it("T2.4 自我邀请防护：推荐人不能使用自己的邀请码", async () => {
    // 创建一个新的邀请码（因为之前的已被绑定）
    const db = await getDb();
    if (!db) throw new Error("DB_UNAVAILABLE");

    const selfCode = `REF-${REFERRER_ID}-SELF01`;
    testReferralCodes.push(selfCode);
    await db.insert(referralRecords).values({
      referrerId: REFERRER_ID,
      referrerName: REFERRER_NAME,
      refereeId: 0,
      refereeName: "",
      referralCode: selfCode,
      status: "PENDING",
      rewardAmount: "50.00",
    });

    const result = await acceptReferral(selfCode, REFERRER_ID, REFERRER_NAME);
    expect(result.success).toBe(false);
    expect(result.message).toContain("不能使用自己的邀请码");
  });

  it("T2.5 首单返佣：被推荐人首单付款后，推荐人获得 50 元信用额度", async () => {
    // 先为推荐人创建客户档案（用于信用额度更新）
    const db = await getDb();
    if (!db) throw new Error("DB_UNAVAILABLE");

    testCustomerProfileIds.push(REFERRER_ID);
    // 清理可能存在的旧档案
    await db.delete(customerProfiles).where(eq(customerProfiles.userId, REFERRER_ID));
    await db.insert(customerProfiles).values({
      userId: REFERRER_ID,
      customerName: REFERRER_NAME,
      creditLimit: "100.00",
      creditUsed: "0",
      isActive: true,
    });

    const rewardResult = await triggerReferralReward(REFEREE_ID, 99001);
    expect(rewardResult.rewarded).toBe(true);
    expect(rewardResult.referrerId).toBe(REFERRER_ID);
    expect(rewardResult.rewardAmount).toBe(50);

    // 验证推荐人信用额度已增加 50 元（100 + 50 = 150）
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, REFERRER_ID));
    expect(parseFloat(String(profile.creditLimit))).toBeCloseTo(150, 2);
  });

  it("T2.6 幂等返佣：同一 refereeId 再次触发，返回 rewarded: false", async () => {
    const result = await triggerReferralReward(REFEREE_ID, 99002);
    expect(result.rewarded).toBe(false);
    expect(result.message).toContain("未找到待奖励");
  });
});

// ============================================================
// T3: 智能流失预警雷达
// ============================================================
describe("T3: 智能流失预警雷达 - 复购周期计算与预警触发", () => {
  const TEST_CUSTOMER_ID = 77001;
  const TEST_CUSTOMER_NAME = `流失测试客户_${TEST_PREFIX}`;

  it("T3.1 风险等级判断：daysSince = 60, avgDays = 20 → 比率 3.0 → HIGH", () => {
    const level = assessRiskLevel(60, 20);
    expect(level).toBe("HIGH");
  });

  it("T3.2 风险等级判断：daysSince = 35, avgDays = 20 → 比率 1.75 → MEDIUM", () => {
    const level = assessRiskLevel(35, 20);
    expect(level).toBe("MEDIUM");
  });

  it("T3.3 正常客户：daysSince = 18, avgDays = 20 → 比率 0.9 → null（无预警）", () => {
    const level = assessRiskLevel(18, 20);
    expect(level).toBeNull();
  });

  it("T3.4 创建预警记录：HIGH 风险客户生成预警，通知内容包含关键信息", async () => {
    const risk = {
      customerId: TEST_CUSTOMER_ID,
      customerName: TEST_CUSTOMER_NAME,
      salesId: 1,
      salesName: "测试销售员",
      regionDirectorId: 2,
      lastOrderAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 天前
      avgRepurchaseDays: 20,
      daysSinceLastOrder: 60,
      thresholdDays: 30,
      riskLevel: "HIGH" as const,
    };

    const result = await createChurnAlert(risk);
    expect(result.created).toBe(true);
    expect(result.alertId).toBeGreaterThan(0);
    testChurnAlertIds.push(result.alertId!);

    // 验证通知内容
    const notification = buildAlertNotification(risk);
    expect(notification).toContain("高风险");
    expect(notification).toContain(TEST_CUSTOMER_NAME);
    expect(notification).toContain("60");
    expect(notification).toContain("20.0");
  });

  it("T3.5 幂等预警：同一客户同一天再次触发，返回 created: false", async () => {
    const risk = {
      customerId: TEST_CUSTOMER_ID,
      customerName: TEST_CUSTOMER_NAME,
      salesId: 1,
      salesName: "测试销售员",
      regionDirectorId: 2,
      lastOrderAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      avgRepurchaseDays: 20,
      daysSinceLastOrder: 60,
      thresholdDays: 30,
      riskLevel: "HIGH" as const,
    };

    const result = await createChurnAlert(risk);
    expect(result.created).toBe(false);
    expect(result.message).toContain("今日已存在");
  });

  it("T3.6 标记处理：resolveChurnAlert 更新 resolvedAt 字段", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB_UNAVAILABLE");

    const alertId = testChurnAlertIds[0];
    expect(alertId).toBeGreaterThan(0);

    const success = await resolveChurnAlert(alertId);
    expect(success).toBe(true);

    // 验证数据库中 resolvedAt 已更新
    const [alert] = await db
      .select()
      .from(churnAlerts)
      .where(eq(churnAlerts.id, alertId));
    expect(alert.resolvedAt).not.toBeNull();
    expect(alert.resolvedAt).toBeInstanceOf(Date);
  });
});
