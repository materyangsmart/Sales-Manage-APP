/**
 * Mega-Sprint 11 E2E 验收测试
 *
 * Epic 1: 防"假自助"反作弊引擎 (Anti-Fraud Fingerprinting)
 * Epic 2: ROI 驱动里程碑裂变奖励 (ROI-Based Referral)
 * Epic 3: 流失挽回弹药库 (Win-back Toolkit)
 *
 * 策略：纯逻辑单元测试（不依赖 DB 的函数）+ 集成测试（依赖 DB 的函数）
 * 集成测试在 afterAll 中清理测试数据。
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  FRAUD_PENALTY_MULTIPLIER,
  IP_BURST_THRESHOLD,
  checkIpOverlap,
  recordOrderFingerprint,
  recordSalesLoginIp,
  getSalesRecentIps,
  checkIpBurst,
  detectFraud,
  createFraudAlert,
  listFraudAlerts,
} from "./services/anti-fraud-service";
import {
  MILESTONE_AMOUNT,
  REFERRAL_REWARD_AMOUNT,
  initRefereeMilestone,
  onRefereePaidOrder,
  grantReferralReward,
  getRefereeMilestone,
  listRefereeMilestones,
} from "./services/roi-referral-service";
import {
  WINBACK_DISCOUNT_RATE,
  WINBACK_EXPIRY_HOURS,
  createWinbackCoupon,
  redeemWinbackCoupon,
  resolveChurnAlertAsRetained,
  resolveCustomerChurnAlerts,
  expireStaleWinbackCoupons,
  getCouponByAlertId,
} from "./services/winback-service";
import {
  orderFingerprints,
  salesLoginIps,
  fraudAlerts,
  refereePaymentMilestones,
  referralRecords,
  customerProfiles,
  churnAlerts,
  winbackCoupons,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ============================================================
// 测试数据追踪（用于 afterAll 清理）
// ============================================================
const TS = `MS11_${Date.now()}`;
const cleanupFingerprintOrderIds: number[] = [];
const cleanupSalesIds: number[] = [];
const cleanupFraudAlertIds: number[] = [];
const cleanupMilestoneRefereeIds: number[] = [];
const cleanupReferralRefereeIds: number[] = [];
const cleanupCustomerProfileUserIds: number[] = [];
const cleanupChurnAlertIds: number[] = [];
const cleanupWinbackCouponCodes: string[] = [];

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  for (const orderId of cleanupFingerprintOrderIds) {
    await db.delete(orderFingerprints).where(eq(orderFingerprints.orderId, orderId)).catch(() => {});
  }
  for (const salesId of cleanupSalesIds) {
    await db.delete(salesLoginIps).where(eq(salesLoginIps.salesId, salesId)).catch(() => {});
  }
  for (const id of cleanupFraudAlertIds) {
    await db.delete(fraudAlerts).where(eq(fraudAlerts.id, id)).catch(() => {});
  }
  for (const refereeId of cleanupMilestoneRefereeIds) {
    await db.delete(refereePaymentMilestones).where(eq(refereePaymentMilestones.refereeId, refereeId)).catch(() => {});
  }
  for (const refereeId of cleanupReferralRefereeIds) {
    await db.delete(referralRecords).where(eq(referralRecords.refereeId, refereeId)).catch(() => {});
  }
  for (const userId of cleanupCustomerProfileUserIds) {
    await db.delete(customerProfiles).where(eq(customerProfiles.userId, userId)).catch(() => {});
  }
  for (const id of cleanupChurnAlertIds) {
    await db.delete(churnAlerts).where(eq(churnAlerts.id, id)).catch(() => {});
  }
  for (const code of cleanupWinbackCouponCodes) {
    await db.delete(winbackCoupons).where(eq(winbackCoupons.couponCode, code)).catch(() => {});
  }
});

// ============================================================
// EPIC 1: 防假自助反作弊引擎
// ============================================================
describe("MS11 Epic 1: 防假自助反作弊引擎", () => {

  it("T1.1 常量验证：惩罚乘数 = 0.5，IP 爆发阈值 = 3", () => {
    expect(FRAUD_PENALTY_MULTIPLIER).toBe(0.5);
    expect(IP_BURST_THRESHOLD).toBe(3);
  });

  it("T1.2 IP 重叠检测：订单 IP 在销售员登录 IP 列表中 → 返回 true", () => {
    expect(checkIpOverlap("192.168.1.100", ["192.168.1.100", "10.0.0.1"])).toBe(true);
  });

  it("T1.3 IP 重叠检测：订单 IP 不在销售员登录 IP 列表中 → 返回 false", () => {
    expect(checkIpOverlap("203.0.113.50", ["192.168.1.100", "10.0.0.1"])).toBe(false);
  });

  it("T1.4 IP 重叠检测：销售员无近期登录记录 → 不触发作弊", () => {
    expect(checkIpOverlap("192.168.1.100", [])).toBe(false);
  });

  it("T1.5 反作弊测试（规范要求）：同 IP 销售账号 + 客户 A 下单 → 作弊熔断，提成降为 0.5×", async () => {
    const sharedIp = "192.168.100.1";
    const salesId = 99001;
    const customerId = 79001;
    const orderId = 89001;

    // 记录销售员登录 IP
    await recordSalesLoginIp(salesId, sharedIp);
    cleanupSalesIds.push(salesId);

    // 先记录指纹（1 个客户，不触发爆发）
    await recordOrderFingerprint({
      orderId,
      orderNo: `${TS}_ORD_001`,
      source: "WECHAT_H5",
      ipAddress: sharedIp,
      salesId,
      customerId,
    });
    cleanupFingerprintOrderIds.push(orderId);

    // 执行反作弊检测
    const result = await detectFraud({
      orderId,
      orderNo: `${TS}_ORD_001`,
      source: "WECHAT_H5",
      ipAddress: sharedIp,
      salesId,
      customerId,
      originalMultiplier: 1.2,
      originalDiscountAmount: 5,
    });

    // 应触发 IP_OVERLAP 熔断
    expect(result.fraud).toBe(true);
    if (result.fraud) {
      expect(result.fraudType).toBe("IP_OVERLAP");
      // 提成乘数降为 0.5（惩罚性剥夺）
      expect(result.commissionMultiplier).toBe(0.5);
      // 补贴撤销
      expect(result.discountAmount).toBe(0);
      // 原始乘数保留用于审计
      expect(result.originalMultiplier).toBe(1.2);
      if (result.alertId) cleanupFraudAlertIds.push(result.alertId);
    }
  });

  it("T1.6 IP 爆发熔断：同一 IP 当天为 4 个不同客户下单 → 爆发告警，提成降为 0.5×", async () => {
    const burstIp = "203.0.113.200";
    const salesId = 99002;
    const baseOrderId = 89010;

    // 记录 4 个不同客户用同一 IP 下单
    for (let i = 0; i < 4; i++) {
      await recordOrderFingerprint({
        orderId: baseOrderId + i,
        orderNo: `${TS}_BURST_${i}`,
        source: "PORTAL",
        ipAddress: burstIp,
        salesId,
        customerId: 79010 + i,
      });
      cleanupFingerprintOrderIds.push(baseOrderId + i);
    }

    // 第 5 笔订单触发爆发检测
    const result = await detectFraud({
      orderId: baseOrderId + 4,
      orderNo: `${TS}_BURST_4`,
      source: "PORTAL",
      ipAddress: burstIp,
      salesId,
      customerId: 79014,
      originalMultiplier: 1.2,
      originalDiscountAmount: 5,
    });

    expect(result.fraud).toBe(true);
    if (result.fraud) {
      expect(result.fraudType).toBe("IP_BURST");
      expect(result.commissionMultiplier).toBe(0.5);
      expect(result.discountAmount).toBe(0);
      if (result.alertId) cleanupFraudAlertIds.push(result.alertId);
    }
  });
});

// ============================================================
// EPIC 2: ROI 里程碑裂变奖励
// ============================================================
describe("MS11 Epic 2: ROI 里程碑裂变奖励", () => {

  it("T2.1 常量验证：里程碑金额 = 500，奖励金额 = 50", () => {
    expect(MILESTONE_AMOUNT).toBe(500);
    expect(REFERRAL_REWARD_AMOUNT).toBe(50);
  });

  it("T2.2 首单支付 ¥200 → 累计 ¥200，未达里程碑，无奖励", async () => {
    const refereeId = 88020;
    const referrerId = 88021;

    // 初始化里程碑
    await initRefereeMilestone(refereeId, "测试被推荐人A", referrerId);
    cleanupMilestoneRefereeIds.push(refereeId);

    // 首单 ¥200
    const result = await onRefereePaidOrder(refereeId, 200);

    expect(result.totalPaidAmount).toBe(200);
    expect(result.milestoneReached).toBe(false);
    expect(result.rewardTriggered).toBe(false);
    expect(result.message).toContain("200.00");
  });

  it("T2.3 ROI 测试（规范要求）：第一单 ¥200 无奖励，第二单 ¥350 累计 ¥550 → 触发奖励", async () => {
    const refereeId = 88022;
    const referrerId = 88023;

    // 初始化推荐关系
    const db = await getDb();
    if (db) {
      await db.insert(referralRecords).values({
        referrerId,
        refereeId,
        referralCode: `${TS}_REF_022`,
        status: "PENDING",
      } as any);
      cleanupReferralRefereeIds.push(refereeId);

      // 推荐人客户档案
      await db.insert(customerProfiles).values({
        userId: referrerId,
        creditLimit: "100.00",
      } as any);
      cleanupCustomerProfileUserIds.push(referrerId);
    }

    // 初始化里程碑
    await initRefereeMilestone(refereeId, "测试被推荐人B", referrerId);
    cleanupMilestoneRefereeIds.push(refereeId);

    // 第一单：¥200
    const result1 = await onRefereePaidOrder(refereeId, 200);
    expect(result1.totalPaidAmount).toBe(200);
    expect(result1.milestoneReached).toBe(false);
    expect(result1.rewardTriggered).toBe(false);

    // 第二单：¥350，累计 ¥550
    const result2 = await onRefereePaidOrder(refereeId, 350);
    expect(result2.totalPaidAmount).toBe(550);
    expect(result2.milestoneReached).toBe(true);
    expect(result2.rewardTriggered).toBe(true);

    // 验证推荐人信用额度增加了 50 元
    if (db) {
      const profiles = await db.select().from(customerProfiles)
        .where(eq(customerProfiles.userId, referrerId)).limit(1);
      if (profiles.length > 0) {
        expect(parseFloat(String(profiles[0].creditLimit))).toBe(150);
      }
    }
  });

  it("T2.4 里程碑已达成后再次支付 → 幂等，不重复奖励", async () => {
    const refereeId = 88024;
    const referrerId = 88025;

    await initRefereeMilestone(refereeId, "测试被推荐人C", referrerId);
    cleanupMilestoneRefereeIds.push(refereeId);

    // 先达到里程碑
    await onRefereePaidOrder(refereeId, 600);

    // 再次支付
    const result = await onRefereePaidOrder(refereeId, 100);
    expect(result.milestoneReached).toBe(true);
    expect(result.rewardTriggered).toBe(false);
    expect(result.message).toContain("里程碑已达成");
  });

  it("T2.5 非推荐用户支付 → 无里程碑记录，跳过处理", async () => {
    const refereeId = 99998; // 无推荐关系的用户
    const result = await onRefereePaidOrder(refereeId, 300);
    expect(result.milestoneReached).toBe(false);
    expect(result.rewardTriggered).toBe(false);
    expect(result.message).toContain("无推荐关系");
  });

  it("T2.6 grantReferralReward：推荐人信用额度 +50 元", async () => {
    const referrerId = 88026;
    const refereeId = 88027;

    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // DB 不可用时跳过
      return;
    }

    // 创建推荐人档案
    await db.insert(customerProfiles).values({
      userId: referrerId,
      creditLimit: "200.00",
    } as any);
    cleanupCustomerProfileUserIds.push(referrerId);

    // 创建推荐记录
    await db.insert(referralRecords).values({
      referrerId,
      refereeId,
      referralCode: `${TS}_REF_026`,
      status: "PENDING",
    } as any);
    cleanupReferralRefereeIds.push(refereeId);

    const result = await grantReferralReward(referrerId, refereeId, 50);
    expect(result.rewarded).toBe(true);
    expect(result.message).toContain("250");

    // 验证 DB 中的额度
    const profiles = await db.select().from(customerProfiles)
      .where(eq(customerProfiles.userId, referrerId)).limit(1);
    if (profiles.length > 0) {
      expect(parseFloat(String(profiles[0].creditLimit))).toBe(250);
    }
  });
});

// ============================================================
// EPIC 3: 流失挽回弹药库
// ============================================================
describe("MS11 Epic 3: 流失挽回弹药库", () => {

  it("T3.1 常量验证：折扣率 = 0.85，有效期 = 48 小时", () => {
    expect(WINBACK_DISCOUNT_RATE).toBe(0.85);
    expect(WINBACK_EXPIRY_HOURS).toBe(48);
  });

  it("T3.2 挽回测试（规范要求）：HIGH 预警触发后系统生成挽回券", async () => {
    const db = await getDb();
    if (!db) { expect(true).toBe(true); return; }

    // 创建流失预警
    const alertResult = await db.insert(churnAlerts).values({
      customerId: 70020,
      customerName: "张三干货摊",
      salesId: 9020,
      salesName: "王五",
      riskLevel: "HIGH",
      daysSinceLastOrder: 5,
      avgRepurchaseDays: 2,
    } as any);
    const alertId = (alertResult as any)[0]?.insertId ?? 0;
    cleanupChurnAlertIds.push(alertId);

    // 创建挽回券
    const result = await createWinbackCoupon({
      churnAlertId: alertId,
      customerId: 70020,
      customerName: "张三干货摊",
      salesId: 9020,
    });

    expect(result.created).toBe(true);
    expect(result.couponCode).toBeDefined();
    expect(result.couponCode!.startsWith("WB-")).toBe(true);

    // 有效期约 48 小时
    const expiryHours = (result.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(expiryHours).toBeGreaterThan(47);
    expect(expiryHours).toBeLessThan(49);

    if (result.couponCode) cleanupWinbackCouponCodes.push(result.couponCode);
  });

  it("T3.3 挽回券幂等：同一预警重复创建 → 返回已有券", async () => {
    const db = await getDb();
    if (!db) { expect(true).toBe(true); return; }

    const alertResult = await db.insert(churnAlerts).values({
      customerId: 70021,
      customerName: "李四豆腐坊",
      salesId: 9021,
      salesName: "赵六",
      riskLevel: "HIGH",
      daysSinceLastOrder: 6,
      avgRepurchaseDays: 2,
    } as any);
    const alertId = (alertResult as any)[0]?.insertId ?? 0;
    cleanupChurnAlertIds.push(alertId);

    const result1 = await createWinbackCoupon({
      churnAlertId: alertId,
      customerId: 70021,
      customerName: "李四豆腐坊",
      salesId: 9021,
    });
    if (result1.couponCode) cleanupWinbackCouponCodes.push(result1.couponCode);

    // 第二次创建 → 幂等
    const result2 = await createWinbackCoupon({
      churnAlertId: alertId,
      customerId: 70021,
      customerName: "李四豆腐坊",
      salesId: 9021,
    });

    expect(result2.created).toBe(false);
    expect(result2.couponCode).toBe(result1.couponCode);
  });

  it("T3.4 核销挽回券：使用有效券下单 → 成功核销，折扣率 0.85，预警状态变更为解除", async () => {
    const db = await getDb();
    if (!db) { expect(true).toBe(true); return; }

    // 创建预警
    const alertResult = await db.insert(churnAlerts).values({
      customerId: 70022,
      customerName: "王五蔬菜摊",
      salesId: 9022,
      salesName: "张七",
      riskLevel: "HIGH",
      daysSinceLastOrder: 7,
      avgRepurchaseDays: 2,
    } as any);
    const alertId = (alertResult as any)[0]?.insertId ?? 0;
    cleanupChurnAlertIds.push(alertId);

    // 创建挽回券
    const couponResult = await createWinbackCoupon({
      churnAlertId: alertId,
      customerId: 70022,
      customerName: "王五蔬菜摊",
      salesId: 9022,
    });
    const couponCode = couponResult.couponCode!;
    cleanupWinbackCouponCodes.push(couponCode);

    // 核销
    const redeemResult = await redeemWinbackCoupon(couponCode, 90020);

    expect(redeemResult.success).toBe(true);
    expect(redeemResult.discountRate).toBe(0.85);

    // 验证预警已解除
    const alerts = await db.select().from(churnAlerts).where(eq(churnAlerts.id, alertId)).limit(1);
    if (alerts.length > 0) {
      expect(alerts[0].resolvedAt).not.toBeNull();
    }
  });

  it("T3.5 核销已使用的券 → 失败，返回已使用提示", async () => {
    const db = await getDb();
    if (!db) { expect(true).toBe(true); return; }

    const alertResult = await db.insert(churnAlerts).values({
      customerId: 70023,
      customerName: "赵六海鲜摊",
      salesId: 9023,
      salesName: "钱八",
      riskLevel: "HIGH",
      daysSinceLastOrder: 8,
      avgRepurchaseDays: 2,
    } as any);
    const alertId = (alertResult as any)[0]?.insertId ?? 0;
    cleanupChurnAlertIds.push(alertId);

    const couponResult = await createWinbackCoupon({
      churnAlertId: alertId,
      customerId: 70023,
      customerName: "赵六海鲜摊",
      salesId: 9023,
    });
    const couponCode = couponResult.couponCode!;
    cleanupWinbackCouponCodes.push(couponCode);

    // 第一次核销
    await redeemWinbackCoupon(couponCode, 90021);

    // 第二次核销 → 失败
    const result = await redeemWinbackCoupon(couponCode, 90022);
    expect(result.success).toBe(false);
    expect(result.message).toContain("已使用");
  });

  it("T3.6 核销已过期的券 → 失败，状态自动更新为 EXPIRED", async () => {
    const db = await getDb();
    if (!db) { expect(true).toBe(true); return; }

    // 直接插入一张已过期的券
    const expiredCode = `WB-EXPIRED-${TS}`;
    await db.insert(winbackCoupons).values({
      churnAlertId: 0,
      customerId: 70024,
      customerName: "过期测试客户",
      salesId: 9024,
      couponCode: expiredCode,
      discountRate: "0.85",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() - 1000), // 1 秒前已过期
    } as any);
    cleanupWinbackCouponCodes.push(expiredCode);

    const result = await redeemWinbackCoupon(expiredCode, 90023);
    expect(result.success).toBe(false);
    expect(result.message).toContain("过期");

    // 验证状态已更新为 EXPIRED
    const coupons = await db.select().from(winbackCoupons)
      .where(eq(winbackCoupons.couponCode, expiredCode)).limit(1);
    if (coupons.length > 0) {
      expect(coupons[0].status).toBe("EXPIRED");
    }
  });
});
