/**
 * Mega-Sprint 10 - Epic 2: B2B 裂变推荐系统
 *
 * 业务规则：
 * 1. 每个用户可生成唯一邀请码（referral_code），格式：REF-{userId}-{6位随机字母数字}
 * 2. 新客户注册时可填写邀请码，绑定推荐关系
 * 3. 被推荐人完成首笔付款订单后，推荐人自动获得 50 元信用额度奖励
 * 4. 奖励状态：PENDING → REWARDED（首单付款后触发）
 * 5. 每个推荐关系只奖励一次（幂等保护）
 */

import { getDb } from "../db";
import {
  referralRecords,
  customerProfiles,
  InsertReferralRecord,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * 生成唯一邀请码
 * 格式：REF-{userId}-{6位随机大写字母数字}
 */
export function generateReferralCode(userId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除易混淆字符 0/O/I/1
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `REF-${userId}-${suffix}`;
}

/**
 * 为用户创建邀请码（如果已存在则返回现有的）
 */
export async function getOrCreateReferralCode(
  referrerId: number,
  referrerName: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 检查是否已有待处理的邀请码（PENDING 状态的最新一条）
  const existing = await db
    .select()
    .from(referralRecords)
    .where(
      and(
        eq(referralRecords.referrerId, referrerId),
        eq(referralRecords.status, "PENDING")
      )
    );

  // 如果已有待处理邀请码，返回第一个
  if (existing.length > 0) {
    return existing[0].referralCode;
  }

  // 生成新邀请码（带重试以防碰撞）
  let code = generateReferralCode(referrerId);
  let attempts = 0;
  while (attempts < 5) {
    try {
      // 创建一条 PENDING 记录作为邀请码占位（referee 信息暂为空）
      // 注意：此处创建的是"邀请码持有记录"，referee 在接受邀请时才填入
      const insertData: InsertReferralRecord = {
        referrerId,
        referrerName,
        refereeId: 0,        // 占位，接受邀请时更新
        refereeName: "",     // 占位，接受邀请时更新
        referralCode: code,
        status: "PENDING",
        rewardAmount: "50.00",
      };
      await db.insert(referralRecords).values(insertData);
      return code;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        // 邀请码碰撞，重新生成
        code = generateReferralCode(referrerId);
        attempts++;
      } else {
        throw e;
      }
    }
  }
  throw new Error("Failed to generate unique referral code after 5 attempts");
}

/**
 * 被推荐人接受邀请（填写邀请码完成绑定）
 */
export async function acceptReferral(
  referralCode: string,
  refereeId: number,
  refereeName: string
): Promise<{ success: boolean; message: string; referrerId?: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 查找邀请码记录
  const records = await db
    .select()
    .from(referralRecords)
    .where(eq(referralRecords.referralCode, referralCode));

  if (records.length === 0) {
    return { success: false, message: "邀请码不存在或已失效" };
  }

  const record = records[0];

  if (record.status !== "PENDING") {
    return { success: false, message: "该邀请码已被使用或已过期" };
  }

  if (record.refereeId !== 0) {
    return { success: false, message: "该邀请码已被其他用户使用" };
  }

  if (record.referrerId === refereeId) {
    return { success: false, message: "不能使用自己的邀请码" };
  }

  // 检查该用户是否已经被推荐过
  const alreadyReferred = await db
    .select()
    .from(referralRecords)
    .where(eq(referralRecords.refereeId, refereeId));

  if (alreadyReferred.length > 0 && alreadyReferred.some(r => r.refereeId === refereeId && r.status !== "PENDING")) {
    return { success: false, message: "您已经通过邀请码注册，无法重复绑定" };
  }

  // 更新邀请码记录，绑定被推荐人
  await db
    .update(referralRecords)
    .set({ refereeId, refereeName })
    .where(eq(referralRecords.referralCode, referralCode));

  return {
    success: true,
    message: `成功绑定推荐关系，完成首单付款后推荐人将获得50元信用奖励`,
    referrerId: record.referrerId,
  };
}

/**
 * 触发首单返佣（在被推荐人首笔订单付款后调用）
 * 幂等：同一 refereeId 只奖励一次
 */
export async function triggerReferralReward(
  refereeId: number,
  firstOrderId: number
): Promise<{ rewarded: boolean; referrerId?: number; rewardAmount?: number; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 查找该被推荐人的 PENDING 推荐记录
  const pendingRecords = await db
    .select()
    .from(referralRecords)
    .where(
      and(
        eq(referralRecords.refereeId, refereeId),
        eq(referralRecords.status, "PENDING")
      )
    );

  if (pendingRecords.length === 0) {
    return { rewarded: false, message: "未找到待奖励的推荐记录" };
  }

  const record = pendingRecords[0];
  const rewardAmount = parseFloat(String(record.rewardAmount));

  // 更新推荐记录为 REWARDED
  await db
    .update(referralRecords)
    .set({
      status: "REWARDED",
      firstOrderId,
      rewardedAt: new Date(),
    })
    .where(eq(referralRecords.id, record.id));

  // 更新推荐人的信用额度（customerProfiles.credit_limit += rewardAmount）
  const referrerProfiles = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, record.referrerId));

  if (referrerProfiles.length > 0) {
    const currentLimit = parseFloat(String(referrerProfiles[0].creditLimit));
    await db
      .update(customerProfiles)
      .set({ creditLimit: (currentLimit + rewardAmount).toFixed(2) })
      .where(eq(customerProfiles.userId, record.referrerId));
  }

  return {
    rewarded: true,
    referrerId: record.referrerId,
    rewardAmount,
    message: `推荐奖励已发放：推荐人(userId=${record.referrerId})获得${rewardAmount}元信用额度`,
  };
}

/**
 * 查询推荐记录列表（管理台用）
 */
export async function listReferralRecords(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(referralRecords).limit(limit);
}

/**
 * 查询某用户的推荐统计
 */
export async function getReferralStats(referrerId: number) {
  const db = await getDb();
  if (!db) return { total: 0, rewarded: 0, pending: 0, totalReward: 0 };

  const records = await db
    .select()
    .from(referralRecords)
    .where(eq(referralRecords.referrerId, referrerId));

  const rewarded = records.filter(r => r.status === "REWARDED");
  const pending = records.filter(r => r.status === "PENDING");
  const totalReward = rewarded.reduce((sum, r) => sum + parseFloat(String(r.rewardAmount)), 0);

  return {
    total: records.length,
    rewarded: rewarded.length,
    pending: pending.length,
    totalReward,
  };
}
