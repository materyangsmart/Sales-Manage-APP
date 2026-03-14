/**
 * Mega-Sprint 10 - Epic 1: 自助下单激励引擎
 *
 * 业务规则：
 * 1. 订单来源差异化提成乘数：
 *    - SALES_PORTAL（销售代下）: 0.8x
 *    - WECHAT_H5 / PORTAL（客户自助）: 1.2x
 *    - WEBSITE / MANUAL: 1.0x
 * 2. 线上自助下单补贴：订单金额 >= 100 元，自动减免 5 元
 *    - 仅适用于 WECHAT_H5 / PORTAL 来源
 * 3. 记录 order_source_log 和 order_discounts
 */

import { getDb } from "../db";
import { orderSourceLog, orderDiscounts, InsertOrderSourceLog, InsertOrderDiscount } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type OrderSource = "WECHAT_H5" | "PORTAL" | "SALES_PORTAL" | "WEBSITE" | "MANUAL";

export interface IncentiveCalculationInput {
  orderId: number;
  orderNo: string;
  source: OrderSource;
  salesId?: number;
  customerId?: number;
  totalAmount: number;  // 订单原始金额（元）
  grossProfit?: number; // 毛利润（元）
}

export interface IncentiveCalculationResult {
  source: OrderSource;
  commissionMultiplier: number;
  discountApplied: boolean;
  discountAmount: number;
  finalAmount: number;   // 实际应付金额（原始金额 - 补贴）
  description: string;
}

/**
 * 获取订单来源对应的提成乘数
 */
export function getCommissionMultiplier(source: OrderSource): number {
  switch (source) {
    case "SALES_PORTAL":
      return 0.8;  // 代下单：提成打 8 折
    case "WECHAT_H5":
    case "PORTAL":
      return 1.2;  // 自助下单：提成加 2 成
    default:
      return 1.0;  // 其他渠道：标准提成
  }
}

/**
 * 计算线上自助下单补贴
 * 规则：WECHAT_H5 / PORTAL 来源，订单金额 >= 100 元，减免 5 元
 */
export function calculateSelfServiceDiscount(source: OrderSource, totalAmount: number): number {
  const selfServiceSources: OrderSource[] = ["WECHAT_H5", "PORTAL"];
  if (selfServiceSources.includes(source) && totalAmount >= 100) {
    return 5.0;
  }
  return 0;
}

/**
 * 核心：计算订单激励（提成乘数 + 补贴）
 */
export function calculateIncentive(input: IncentiveCalculationInput): IncentiveCalculationResult {
  const { source, totalAmount } = input;
  const commissionMultiplier = getCommissionMultiplier(source);
  const discountAmount = calculateSelfServiceDiscount(source, totalAmount);
  const discountApplied = discountAmount > 0;
  const finalAmount = Math.max(0, totalAmount - discountAmount);

  let description = `来源：${source}，提成乘数：${commissionMultiplier}x`;
  if (discountApplied) {
    description += `，线上自助补贴：-${discountAmount}元（原价${totalAmount}元，实付${finalAmount}元）`;
  }

  return {
    source,
    commissionMultiplier,
    discountApplied,
    discountAmount,
    finalAmount,
    description,
  };
}

/**
 * 持久化订单激励记录到数据库
 */
export async function saveOrderIncentive(input: IncentiveCalculationInput): Promise<IncentiveCalculationResult> {
  const result = calculateIncentive(input);

  // 1. 写入 order_source_log
  const sourceLogData: InsertOrderSourceLog = {
    orderId: input.orderId,
    orderNo: input.orderNo,
    source: input.source,
    commissionMultiplier: result.commissionMultiplier.toFixed(2),
    discountApplied: result.discountApplied,
    discountAmount: result.discountAmount.toFixed(2),
    salesId: input.salesId,
    customerId: input.customerId,
    totalAmount: input.totalAmount.toFixed(2),
    grossProfit: (input.grossProfit ?? 0).toFixed(2),
  };
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orderSourceLog).values(sourceLogData);

  // 2. 如果有补贴，写入 order_discounts
  if (result.discountApplied) {
    const discountData: InsertOrderDiscount = {
      orderId: input.orderId,
      discountType: "DIGITAL_SELF_SERVICE",
      discountAmount: result.discountAmount.toFixed(2),
      discountReason: `线上自助下单满100元减5元优惠（来源：${input.source}）`,
      orderSource: input.source,
    };
    await db.insert(orderDiscounts).values(discountData);
  }


  return result;
}

/**
 * 查询订单激励记录
 */
export async function getOrderIncentive(orderId: number) {
  const db = await getDb();
  if (!db) return { sourceLog: null, discounts: [] };
  const logs = await db.select().from(orderSourceLog).where(eq(orderSourceLog.orderId, orderId));
  const discountList = await db.select().from(orderDiscounts).where(eq(orderDiscounts.orderId, orderId));
  return { sourceLog: logs[0] ?? null, discounts: discountList };
}

/**
 * 查询所有订单来源统计（用于管理台展示）
 */
export async function getOrderSourceStats() {
  const db = await getDb();
  if (!db) return {};
  const logs = await db.select().from(orderSourceLog);
  const stats: Record<string, { count: number; totalAmount: number; totalDiscount: number }> = {};
  for (const log of logs) {
    const src = log.source;
    if (!stats[src]) stats[src] = { count: 0, totalAmount: 0, totalDiscount: 0 };
    stats[src].count++;
    stats[src].totalAmount += parseFloat(String(log.totalAmount));
    stats[src].totalDiscount += parseFloat(String(log.discountAmount));
  }
  return stats;
}
