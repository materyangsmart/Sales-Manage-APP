/**
 * Mega-Sprint 11 - Epic 2: ROI 驱动的里程碑裂变奖励
 *
 * 业务规则（替代 MS10 的首单即发逻辑）：
 * 1. 废弃"首单即发 50 元"规则
 * 2. 里程碑奖励：被推荐新客户累计实际支付金额突破 500 元时，才发放 50 元额度给推荐人
 * 3. 幂等性：同一 refereeId 只奖励一次（milestone_reached = true 后不再重复）
 * 4. 每次新订单支付后，调用 onRefereePaidOrder 更新累计金额并检查里程碑
 */

import { getDb } from "../db";
import {
  refereePaymentMilestones,
  referralRecords,
  customerProfiles,
  InsertRefereePaymentMilestone,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ---- 常量 ----
export const MILESTONE_AMOUNT = 500; // 累计支付达到此金额触发奖励（元）
export const REFERRAL_REWARD_AMOUNT = 50; // 推荐人获得的信用额度奖励（元）

// ============================================================
// 初始化被推荐人里程碑追踪记录
// （在 acceptReferral 成功后调用）
// ============================================================
export async function initRefereeMilestone(
  refereeId: number,
  refereeName: string,
  referrerId: number
): Promise<{ created: boolean; milestoneId?: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 幂等：已存在则跳过
  const existing = await db
    .select()
    .from(refereePaymentMilestones)
    .where(eq(refereePaymentMilestones.refereeId, refereeId))
    .limit(1);

  if (existing.length > 0) {
    return { created: false, milestoneId: existing[0].id };
  }

  const result = await db.insert(refereePaymentMilestones).values({
    refereeId,
    refereeName,
    referrerId,
    totalPaidAmount: "0.00",
    milestoneReached: false,
    milestoneAmount: MILESTONE_AMOUNT.toFixed(2),
  } as InsertRefereePaymentMilestone);

  return { created: true, milestoneId: (result as any)[0]?.insertId ?? 0 };
}

// ============================================================
// 核心：被推荐人完成一笔支付后，更新累计金额并检查里程碑
// ============================================================
export async function onRefereePaidOrder(
  refereeId: number,
  paidAmount: number
): Promise<{
  totalPaidAmount: number;
  milestoneReached: boolean;
  rewardTriggered: boolean;
  referrerId?: number;
  message: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 查找里程碑追踪记录
  const milestones = await db
    .select()
    .from(refereePaymentMilestones)
    .where(eq(refereePaymentMilestones.refereeId, refereeId))
    .limit(1);

  if (milestones.length === 0) {
    // 该用户不是被推荐人，无需处理
    return {
      totalPaidAmount: paidAmount,
      milestoneReached: false,
      rewardTriggered: false,
      message: "该用户无推荐关系，跳过里程碑检查",
    };
  }

  const milestone = milestones[0];

  // 如果里程碑已达成，幂等返回
  if (milestone.milestoneReached) {
    return {
      totalPaidAmount: parseFloat(String(milestone.totalPaidAmount)),
      milestoneReached: true,
      rewardTriggered: false,
      referrerId: milestone.referrerId,
      message: "里程碑已达成，无需重复奖励",
    };
  }

  // 累加支付金额
  const prevTotal = parseFloat(String(milestone.totalPaidAmount));
  const newTotal = prevTotal + paidAmount;
  const milestoneAmount = parseFloat(String(milestone.milestoneAmount));
  const milestoneReached = newTotal >= milestoneAmount;

  // 更新里程碑记录
  await db
    .update(refereePaymentMilestones)
    .set({
      totalPaidAmount: newTotal.toFixed(2),
      milestoneReached,
      rewardTriggeredAt: milestoneReached ? new Date() : undefined,
    })
    .where(eq(refereePaymentMilestones.id, milestone.id));

  if (!milestoneReached) {
    return {
      totalPaidAmount: newTotal,
      milestoneReached: false,
      rewardTriggered: false,
      referrerId: milestone.referrerId,
      message: `累计支付 ¥${newTotal.toFixed(2)}，距里程碑 ¥${milestoneAmount} 还差 ¥${(milestoneAmount - newTotal).toFixed(2)}`,
    };
  }

  // 里程碑达成 → 给推荐人发放奖励
  const rewardResult = await grantReferralReward(milestone.referrerId, milestone.refereeId, REFERRAL_REWARD_AMOUNT);

  return {
    totalPaidAmount: newTotal,
    milestoneReached: true,
    rewardTriggered: rewardResult.rewarded,
    referrerId: milestone.referrerId,
    message: rewardResult.message,
  };
}

// ============================================================
// 给推荐人发放信用额度奖励
// ============================================================
export async function grantReferralReward(
  referrerId: number,
  refereeId: number,
  rewardAmount: number
): Promise<{ rewarded: boolean; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 更新推荐记录状态为 REWARDED
  await db
    .update(referralRecords)
    .set({
      status: "REWARDED",
      rewardedAt: new Date(),
    })
    .where(
      and(
        eq(referralRecords.referrerId, referrerId),
        eq(referralRecords.refereeId, refereeId)
      )
    );

  // 更新推荐人信用额度
  const profiles = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, referrerId))
    .limit(1);

  if (profiles.length > 0) {
    const currentLimit = parseFloat(String(profiles[0].creditLimit));
    await db
      .update(customerProfiles)
      .set({ creditLimit: (currentLimit + rewardAmount).toFixed(2) })
      .where(eq(customerProfiles.userId, referrerId));

    return {
      rewarded: true,
      message: `里程碑奖励已发放：推荐人(userId=${referrerId}) 信用额度 +¥${rewardAmount}，当前额度 ¥${(currentLimit + rewardAmount).toFixed(2)}`,
    };
  }

  return {
    rewarded: false,
    message: `推荐人(userId=${referrerId}) 无客户档案，无法发放奖励`,
  };
}

// ============================================================
// 查询被推荐人里程碑状态
// ============================================================
export async function getRefereeMilestone(refereeId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(refereePaymentMilestones)
    .where(eq(refereePaymentMilestones.refereeId, refereeId))
    .limit(1);
  return rows[0] ?? null;
}

// ============================================================
// 查询所有里程碑记录（管理台用）
// ============================================================
export async function listRefereeMilestones(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(refereePaymentMilestones).limit(limit);
}
