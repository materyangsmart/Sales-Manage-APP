/**
 * Mega-Sprint 11 - Epic 1: 防"假自助"反作弊引擎
 *
 * 业务规则：
 * 1. 数据捕获：所有 PORTAL/WECHAT_H5 订单记录 IP + UserAgent + DeviceID
 * 2. 风控规则 A（IP 重叠）：自助订单 IP 与该销售员近期登录 IP 高度重合 → 作弊熔断
 * 3. 风控规则 B（IP 爆发）：同一 IP 当天为 >3 个不同客户下了自助单 → 作弊熔断
 * 4. 惩罚机制：作弊订单提成乘数强制降为 0.5×，撤销 5 元补贴，生成审计告警
 */

import { getDb } from "../db";
import {
  orderFingerprints,
  salesLoginIps,
  fraudAlerts,
  InsertOrderFingerprint,
  InsertSalesLoginIp,
  InsertFraudAlert,
} from "../../drizzle/schema";
import { eq, and, gte, ne, sql } from "drizzle-orm";

// ---- 常量 ----
export const FRAUD_PENALTY_MULTIPLIER = 0.5;
export const IP_BURST_THRESHOLD = 3; // 同一 IP 当天超过此数量的不同客户 → 爆发告警
export const SALES_LOGIN_IP_LOOKBACK_DAYS = 7; // 销售员近期登录 IP 回溯天数

export type FraudCheckResult =
  | { fraud: false; commissionMultiplier: number; discountAmount: number }
  | {
      fraud: true;
      fraudType: "IP_OVERLAP" | "IP_BURST" | "DEVICE_OVERLAP";
      fraudDetail: string;
      commissionMultiplier: number; // 惩罚后 = 0.5
      discountAmount: number;       // 惩罚后 = 0（补贴撤销）
      originalMultiplier: number;
    };

// ============================================================
// 数据捕获：记录订单指纹
// ============================================================
export async function recordOrderFingerprint(data: {
  orderId: number;
  orderNo: string;
  source: string;
  ipAddress: string;
  userAgent?: string;
  deviceId?: string;
  salesId?: number;
  customerId?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // upsert：如果已存在则忽略
  const existing = await db
    .select()
    .from(orderFingerprints)
    .where(eq(orderFingerprints.orderId, data.orderId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(orderFingerprints).values({
      orderId: data.orderId,
      orderNo: data.orderNo,
      source: data.source,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceId: data.deviceId,
      salesId: data.salesId,
      customerId: data.customerId,
    } as InsertOrderFingerprint);
  }
}

// ============================================================
// 数据捕获：记录销售员登录 IP
// ============================================================
export async function recordSalesLoginIp(salesId: number, ipAddress: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(salesLoginIps).values({ salesId, ipAddress } as InsertSalesLoginIp);
}

// ============================================================
// 查询销售员近期登录 IP 列表
// ============================================================
export async function getSalesRecentIps(salesId: number, lookbackDays = SALES_LOGIN_IP_LOOKBACK_DAYS): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ ipAddress: salesLoginIps.ipAddress })
    .from(salesLoginIps)
    .where(and(eq(salesLoginIps.salesId, salesId), gte(salesLoginIps.loginAt, since)));

  const ipSet = new Set<string>();
  rows.forEach((r) => ipSet.add(r.ipAddress));
  const result: string[] = [];
  ipSet.forEach((ip) => result.push(ip));
  return result;
}

// ============================================================
// 规则 A：IP 重叠检测
// 自助订单 IP 是否与该销售员近期登录 IP 重合
// ============================================================
export function checkIpOverlap(orderIp: string, salesRecentIps: string[]): boolean {
  return salesRecentIps.includes(orderIp);
}

// ============================================================
// 规则 B：IP 爆发检测
// 同一 IP 当天是否为超过 3 个不同客户下了自助单
// ============================================================
export async function checkIpBurst(
  ipAddress: string,
  currentCustomerId: number,
  threshold = IP_BURST_THRESHOLD
): Promise<{ burst: boolean; distinctCustomers: number }> {
  const db = await getDb();
  if (!db) return { burst: false, distinctCustomers: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 查询今天该 IP 下的自助订单涉及的不同客户数
  const rows = await db
    .select({ customerId: orderFingerprints.customerId })
    .from(orderFingerprints)
    .where(
      and(
        eq(orderFingerprints.ipAddress, ipAddress),
        gte(orderFingerprints.createdAt, todayStart)
      )
    );

  // 统计不同客户 ID（包含当前这笔）
  const idSet = new Set<number>();
  rows.forEach((r) => { if (r.customerId !== null) idSet.add(r.customerId); });
  idSet.add(currentCustomerId);
  const allCustomerIds = idSet;

  return {
    burst: allCustomerIds.size > threshold,
    distinctCustomers: allCustomerIds.size,
  };
}

// ============================================================
// 核心风控检测：综合判断一笔自助订单是否作弊
// ============================================================
export async function detectFraud(params: {
  orderId: number;
  orderNo: string;
  source: string;
  ipAddress: string;
  salesId?: number;
  customerId?: number;
  originalMultiplier: number;
  originalDiscountAmount: number;
}): Promise<FraudCheckResult> {
  const {
    orderId,
    orderNo,
    source,
    ipAddress,
    salesId,
    customerId,
    originalMultiplier,
    originalDiscountAmount,
  } = params;

  // 只对自助渠道做风控
  const selfServiceSources = ["WECHAT_H5", "PORTAL"];
  if (!selfServiceSources.includes(source)) {
    return { fraud: false, commissionMultiplier: originalMultiplier, discountAmount: originalDiscountAmount };
  }

  // 规则 A：IP 与销售员登录 IP 重叠
  if (salesId) {
    const salesIps = await getSalesRecentIps(salesId);
    if (checkIpOverlap(ipAddress, salesIps)) {
      const detail = `自助订单 IP(${ipAddress}) 与销售员(id=${salesId})近${SALES_LOGIN_IP_LOOKBACK_DAYS}天登录 IP 高度重合`;
      await createFraudAlert({
        orderId,
        orderNo,
        fraudType: "IP_OVERLAP",
        fraudDetail: detail,
        originalMultiplier,
        salesId,
        customerId,
      });
      return {
        fraud: true,
        fraudType: "IP_OVERLAP",
        fraudDetail: detail,
        commissionMultiplier: FRAUD_PENALTY_MULTIPLIER,
        discountAmount: 0,
        originalMultiplier,
      };
    }
  }

  // 规则 B：IP 爆发（同一 IP 当天 >3 个不同客户）
  const burstResult = await checkIpBurst(ipAddress, customerId ?? 0);
  if (burstResult.burst) {
    const detail = `IP(${ipAddress}) 当天已为 ${burstResult.distinctCustomers} 个不同客户下自助单，超过阈值(${IP_BURST_THRESHOLD})`;
    await createFraudAlert({
      orderId,
      orderNo,
      fraudType: "IP_BURST",
      fraudDetail: detail,
      originalMultiplier,
      salesId,
      customerId,
    });
    return {
      fraud: true,
      fraudType: "IP_BURST",
      fraudDetail: detail,
      commissionMultiplier: FRAUD_PENALTY_MULTIPLIER,
      discountAmount: 0,
      originalMultiplier,
    };
  }

  return { fraud: false, commissionMultiplier: originalMultiplier, discountAmount: originalDiscountAmount };
}

// ============================================================
// 写入作弊告警记录
// ============================================================
export async function createFraudAlert(params: {
  orderId: number;
  orderNo: string;
  fraudType: "IP_OVERLAP" | "IP_BURST" | "DEVICE_OVERLAP";
  fraudDetail: string;
  originalMultiplier: number;
  salesId?: number;
  customerId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.insert(fraudAlerts).values({
    orderId: params.orderId,
    orderNo: params.orderNo,
    fraudType: params.fraudType,
    fraudDetail: params.fraudDetail,
    originalMultiplier: params.originalMultiplier.toFixed(2),
    penaltyMultiplier: FRAUD_PENALTY_MULTIPLIER.toFixed(2),
    discountRevoked: true,
    salesId: params.salesId,
    customerId: params.customerId,
  } as InsertFraudAlert);

  return (result as any)[0]?.insertId ?? 0;
}

// ============================================================
// 查询作弊告警列表（管理台用）
// ============================================================
export async function listFraudAlerts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fraudAlerts).limit(limit);
}

// ============================================================
// 查询某订单的作弊告警
// ============================================================
export async function getFraudAlertByOrder(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(fraudAlerts)
    .where(eq(fraudAlerts.orderId, orderId))
    .limit(1);
  return rows[0] ?? null;
}
