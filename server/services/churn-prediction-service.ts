/**
 * Mega-Sprint 10 - Epic 3: 智能流失预警雷达
 *
 * 业务规则：
 * 1. 计算每个客户的平均复购周期（avgRepurchaseDays）
 *    - 基于 customer_profiles.avg_repurchase_days（手动维护或历史订单计算）
 * 2. 预警触发条件：当前距离上次下单天数 > avgRepurchaseDays * 1.5
 * 3. 风险等级：
 *    - HIGH: daysSinceLastOrder > avgRepurchaseDays * 2.0
 *    - MEDIUM: daysSinceLastOrder > avgRepurchaseDays * 1.5
 *    - LOW: daysSinceLastOrder > avgRepurchaseDays * 1.2（仅预警，不推送）
 * 4. 推送通知：HIGH/MEDIUM 级别推送给负责销售员 + 大区总监
 * 5. 幂等：同一客户同一天只创建一条预警记录
 */

import { getDb } from "../db";
import {
  customerProfiles,
  churnAlerts,
  InsertChurnAlert,
} from "../../drizzle/schema";
import { eq, and, gte, lt, isNotNull } from "drizzle-orm";

export interface ChurnRiskCustomer {
  customerId: number;
  customerName: string;
  salesId?: number;
  salesName?: string;
  regionDirectorId?: number;
  lastOrderAt: Date;
  avgRepurchaseDays: number;
  daysSinceLastOrder: number;
  thresholdDays: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * 计算距离上次下单的天数
 */
export function calcDaysSinceLastOrder(lastOrderAt: Date | null): number {
  if (!lastOrderAt) return 9999; // 从未下单，视为最高风险
  const now = new Date();
  const diffMs = now.getTime() - lastOrderAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 判断风险等级
 */
export function assessRiskLevel(
  daysSinceLastOrder: number,
  avgRepurchaseDays: number
): "HIGH" | "MEDIUM" | "LOW" | null {
  if (avgRepurchaseDays <= 0) return null;
  const ratio = daysSinceLastOrder / avgRepurchaseDays;
  if (ratio >= 2.0) return "HIGH";
  if (ratio >= 1.5) return "MEDIUM";
  if (ratio >= 1.2) return "LOW";
  return null; // 正常，无需预警
}

/**
 * 扫描所有客户，识别流失风险
 */
export async function scanChurnRisks(): Promise<ChurnRiskCustomer[]> {
  const db = await getDb();
  if (!db) return [];

  // 获取所有有历史下单记录且设置了平均复购周期的客户
  const profiles = await db
    .select()
    .from(customerProfiles)
    .where(
      and(
        eq(customerProfiles.isActive, true),
        isNotNull(customerProfiles.avgRepurchaseDays)
      )
    );

  const risks: ChurnRiskCustomer[] = [];

  for (const profile of profiles) {
    const avgDays = parseFloat(String(profile.avgRepurchaseDays ?? 0));
    if (avgDays <= 0) continue;

    const daysSince = calcDaysSinceLastOrder(profile.lastOrderAt ?? null);
    const riskLevel = assessRiskLevel(daysSince, avgDays);

    if (riskLevel && (riskLevel === "HIGH" || riskLevel === "MEDIUM")) {
      risks.push({
        customerId: profile.userId,
        customerName: profile.customerName,
        salesId: profile.salesId ?? undefined,
        salesName: profile.salesName ?? undefined,
        regionDirectorId: profile.regionDirectorId ?? undefined,
        lastOrderAt: profile.lastOrderAt ?? new Date(0),
        avgRepurchaseDays: avgDays,
        daysSinceLastOrder: daysSince,
        thresholdDays: avgDays * 1.5,
        riskLevel,
      });
    }
  }

  return risks;
}

/**
 * 生成预警通知内容
 */
export function buildAlertNotification(risk: ChurnRiskCustomer): string {
  const lastOrderStr = risk.lastOrderAt.getTime() === 0
    ? "从未下单"
    : risk.lastOrderAt.toLocaleDateString("zh-CN");

  return [
    `【流失预警 - ${risk.riskLevel === "HIGH" ? "高风险" : "中风险"}】`,
    `客户：${risk.customerName}`,
    `上次下单：${lastOrderStr}`,
    `距今：${risk.daysSinceLastOrder}天`,
    `平均复购周期：${risk.avgRepurchaseDays.toFixed(1)}天`,
    `预警阈值：${risk.thresholdDays.toFixed(1)}天（复购周期×1.5）`,
    `负责销售：${risk.salesName ?? "未分配"}`,
    `请及时跟进，挽回客户！`,
  ].join("\n");
}

/**
 * 创建流失预警记录（幂等：同一客户同一天只创建一条）
 */
export async function createChurnAlert(risk: ChurnRiskCustomer): Promise<{
  created: boolean;
  alertId?: number;
  message: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 检查今天是否已有该客户的预警记录
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existing = await db
    .select()
    .from(churnAlerts)
    .where(
      and(
        eq(churnAlerts.customerId, risk.customerId),
        gte(churnAlerts.createdAt, todayStart)
      )
    );

  if (existing.length > 0) {
    return {
      created: false,
      alertId: existing[0].id,
      message: `今日已存在预警记录(id=${existing[0].id})，跳过重复创建`,
    };
  }

  const notificationContent = buildAlertNotification(risk);

  const alertData: InsertChurnAlert = {
    customerId: risk.customerId,
    customerName: risk.customerName,
    salesId: risk.salesId,
    salesName: risk.salesName,
    regionDirectorId: risk.regionDirectorId,
    daysSinceLastOrder: risk.daysSinceLastOrder.toFixed(1),
    avgRepurchaseDays: risk.avgRepurchaseDays.toFixed(2),
    thresholdDays: risk.thresholdDays.toFixed(2),
    riskLevel: risk.riskLevel,
    notificationSent: false,
    notificationContent,
  };

  const result = await db.insert(churnAlerts).values(alertData);
  const insertId = (result as any)[0]?.insertId ?? 0;

  return {
    created: true,
    alertId: insertId,
    message: `已创建${risk.riskLevel === "HIGH" ? "高风险" : "中风险"}预警记录`,
  };
}

/**
 * 批量执行流失预警扫描（定时任务入口）
 * 返回：扫描结果摘要
 */
export async function runChurnScan(): Promise<{
  scanned: number;
  highRisk: number;
  mediumRisk: number;
  alertsCreated: number;
  alertsSkipped: number;
}> {
  const risks = await scanChurnRisks();
  let alertsCreated = 0;
  let alertsSkipped = 0;

  for (const risk of risks) {
    const result = await createChurnAlert(risk);
    if (result.created) {
      alertsCreated++;
    } else {
      alertsSkipped++;
    }
  }

  return {
    scanned: risks.length,
    highRisk: risks.filter(r => r.riskLevel === "HIGH").length,
    mediumRisk: risks.filter(r => r.riskLevel === "MEDIUM").length,
    alertsCreated,
    alertsSkipped,
  };
}

/**
 * 查询流失预警列表（管理台用）
 */
export async function listChurnAlerts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(churnAlerts).limit(limit);
}

/**
 * 标记预警为已处理（resolved）
 */
export async function resolveChurnAlert(alertId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(churnAlerts)
    .set({ resolvedAt: new Date() })
    .where(eq(churnAlerts.id, alertId));

  return true;
}

/**
 * 更新客户档案的复购周期和最后下单时间
 * （在新订单付款后调用）
 */
export async function updateCustomerRepurchaseProfile(
  userId: number,
  customerName: string,
  newOrderAt: Date,
  salesId?: number,
  salesName?: string,
  regionDirectorId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const profiles = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId));

  if (profiles.length === 0) {
    // 首次创建客户档案
    await db.insert(customerProfiles).values({
      userId,
      customerName,
      salesId,
      salesName,
      regionDirectorId,
      lastOrderAt: newOrderAt,
      avgRepurchaseDays: null, // 首单无法计算复购周期
    });
    return;
  }

  const profile = profiles[0];
  const lastOrderAt = profile.lastOrderAt;
  let newAvgDays = profile.avgRepurchaseDays
    ? parseFloat(String(profile.avgRepurchaseDays))
    : null;

  if (lastOrderAt) {
    const daysDiff = Math.floor(
      (newOrderAt.getTime() - lastOrderAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 0) {
      // 指数移动平均（EMA），α=0.3，平滑历史数据
      if (newAvgDays === null) {
        newAvgDays = daysDiff;
      } else {
        newAvgDays = 0.3 * daysDiff + 0.7 * newAvgDays;
      }
    }
  }

  await db
    .update(customerProfiles)
    .set({
      lastOrderAt: newOrderAt,
      avgRepurchaseDays: newAvgDays !== null ? newAvgDays.toFixed(2) : null,
      salesId: salesId ?? profile.salesId,
      salesName: salesName ?? profile.salesName,
      regionDirectorId: regionDirectorId ?? profile.regionDirectorId,
    })
    .where(eq(customerProfiles.userId, userId));
}
