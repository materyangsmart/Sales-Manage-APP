/**
 * Mega-Sprint 11 - Epic 3: 流失挽回弹药库 (Win-back Toolkit)
 *
 * 业务规则：
 * 1. HIGH 风险流失预警触发时，系统自动为该销售员对该客户解锁一张"85折挽回券"
 * 2. 挽回券有效期 48 小时，一旦使用或过期，特权失效
 * 3. 销售员可用该券为客户下单，享受 85 折优惠
 * 4. 客户重新下单后，churn_alerts 状态自动标记为 RESOLVED_RETAINED
 */

import { getDb } from "../db";
import {
  winbackCoupons,
  churnAlerts,
  InsertWinbackCoupon,
} from "../../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";

// ---- 常量 ----
export const WINBACK_DISCOUNT_RATE = 0.85;       // 85 折
export const WINBACK_EXPIRY_HOURS = 48;           // 有效期 48 小时
export const COUPON_CODE_PREFIX = "WB";

// ============================================================
// 生成挽回券唯一码
// ============================================================
function generateCouponCode(customerId: number, salesId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${COUPON_CODE_PREFIX}-${customerId}-${salesId}-${suffix}`;
}

// ============================================================
// 为 HIGH 风险预警自动创建挽回券
// （在 createChurnAlert 后调用，仅对 HIGH 级别）
// ============================================================
export async function createWinbackCoupon(params: {
  churnAlertId: number;
  customerId: number;
  customerName: string;
  salesId: number;
}): Promise<{
  created: boolean;
  couponId?: number;
  couponCode?: string;
  expiresAt?: Date;
  message: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 幂等：检查该预警是否已有 ACTIVE 挽回券
  const existing = await db
    .select()
    .from(winbackCoupons)
    .where(
      and(
        eq(winbackCoupons.churnAlertId, params.churnAlertId),
        eq(winbackCoupons.status, "ACTIVE")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      created: false,
      couponId: existing[0].id,
      couponCode: existing[0].couponCode,
      expiresAt: existing[0].expiresAt,
      message: `已存在有效挽回券(${existing[0].couponCode})，跳过重复创建`,
    };
  }

  const couponCode = generateCouponCode(params.customerId, params.salesId);
  const expiresAt = new Date(Date.now() + WINBACK_EXPIRY_HOURS * 60 * 60 * 1000);

  const result = await db.insert(winbackCoupons).values({
    churnAlertId: params.churnAlertId,
    customerId: params.customerId,
    customerName: params.customerName,
    salesId: params.salesId,
    couponCode,
    discountRate: WINBACK_DISCOUNT_RATE.toFixed(2),
    status: "ACTIVE",
    expiresAt,
  } as InsertWinbackCoupon);

  const couponId = (result as any)[0]?.insertId ?? 0;

  return {
    created: true,
    couponId,
    couponCode,
    expiresAt,
    message: `已创建挽回券 ${couponCode}，有效期至 ${expiresAt.toISOString()}（${WINBACK_EXPIRY_HOURS}小时）`,
  };
}

// ============================================================
// 核销挽回券（销售员使用该券下单时调用）
// ============================================================
export async function redeemWinbackCoupon(
  couponCode: string,
  orderId: number
): Promise<{
  success: boolean;
  discountRate?: number;
  message: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const coupons = await db
    .select()
    .from(winbackCoupons)
    .where(eq(winbackCoupons.couponCode, couponCode))
    .limit(1);

  if (coupons.length === 0) {
    return { success: false, message: `挽回券 ${couponCode} 不存在` };
  }

  const coupon = coupons[0];

  // 检查状态
  if (coupon.status === "USED") {
    return { success: false, message: `挽回券 ${couponCode} 已使用` };
  }
  if (coupon.status === "EXPIRED") {
    return { success: false, message: `挽回券 ${couponCode} 已过期` };
  }

  // 检查是否超时（即使状态仍为 ACTIVE）
  if (new Date() > coupon.expiresAt) {
    await db
      .update(winbackCoupons)
      .set({ status: "EXPIRED" })
      .where(eq(winbackCoupons.id, coupon.id));
    return { success: false, message: `挽回券 ${couponCode} 已超过 ${WINBACK_EXPIRY_HOURS} 小时有效期，自动过期` };
  }

  // 核销
  await db
    .update(winbackCoupons)
    .set({
      status: "USED",
      usedOrderId: orderId,
      usedAt: new Date(),
    })
    .where(eq(winbackCoupons.id, coupon.id));

  // 自动解除关联的流失预警
  await resolveChurnAlertAsRetained(coupon.churnAlertId);

  return {
    success: true,
    discountRate: parseFloat(String(coupon.discountRate)),
    message: `挽回券 ${couponCode} 核销成功，折扣率 ${(parseFloat(String(coupon.discountRate)) * 100).toFixed(0)}%，关联预警已解除`,
  };
}

// ============================================================
// 自动解除流失预警（客户重新下单时调用）
// ============================================================
export async function resolveChurnAlertAsRetained(alertId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const alerts = await db
    .select()
    .from(churnAlerts)
    .where(eq(churnAlerts.id, alertId))
    .limit(1);

  if (alerts.length === 0) return false;
  if (alerts[0].resolvedAt !== null) return true; // 已解除

  await db
    .update(churnAlerts)
    .set({ resolvedAt: new Date() })
    .where(eq(churnAlerts.id, alertId));

  return true;
}

// ============================================================
// 通过客户 ID 解除该客户所有未解除的流失预警
// （客户自主下单时调用，无需券码）
// ============================================================
export async function resolveCustomerChurnAlerts(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const unresolved = await db
    .select()
    .from(churnAlerts)
    .where(
      and(
        eq(churnAlerts.customerId, customerId),
        eq(churnAlerts.resolvedAt, null as any)
      )
    );

  if (unresolved.length === 0) return 0;

  await db
    .update(churnAlerts)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(churnAlerts.customerId, customerId),
        eq(churnAlerts.resolvedAt, null as any)
      )
    );

  return unresolved.length;
}

// ============================================================
// 过期处理：将超时的 ACTIVE 券批量标记为 EXPIRED
// ============================================================
export async function expireStaleWinbackCoupons(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();
  const stale = await db
    .select()
    .from(winbackCoupons)
    .where(
      and(
        eq(winbackCoupons.status, "ACTIVE"),
        lt(winbackCoupons.expiresAt, now)
      )
    );

  if (stale.length === 0) return 0;

  for (const coupon of stale) {
    await db
      .update(winbackCoupons)
      .set({ status: "EXPIRED" })
      .where(eq(winbackCoupons.id, coupon.id));
  }

  return stale.length;
}

// ============================================================
// 查询某客户的有效挽回券
// ============================================================
export async function getActiveCouponForCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const coupons = await db
    .select()
    .from(winbackCoupons)
    .where(
      and(
        eq(winbackCoupons.customerId, customerId),
        eq(winbackCoupons.status, "ACTIVE")
      )
    )
    .limit(1);

  if (coupons.length === 0) return null;

  // 检查是否已超时
  if (new Date() > coupons[0].expiresAt) {
    await db
      .update(winbackCoupons)
      .set({ status: "EXPIRED" })
      .where(eq(winbackCoupons.id, coupons[0].id));
    return null;
  }

  return coupons[0];
}

// ============================================================
// 查询挽回券列表（管理台用）
// ============================================================
export async function listWinbackCoupons(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(winbackCoupons).limit(limit);
}

// ============================================================
// 查询某预警的挽回券
// ============================================================
export async function getCouponByAlertId(churnAlertId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(winbackCoupons)
    .where(eq(winbackCoupons.churnAlertId, churnAlertId))
    .limit(1);
  return rows[0] ?? null;
}
