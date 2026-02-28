/**
 * RC1 Epic 1: 动态财务提成核算引擎 (Commission Engine v2)
 *
 * 功能：
 * 1. calculateTieredCommission — 阶梯利润率提成计算器
 * 2. getMockSalesProfitData    — 获取销售毛利数据（生产环境替换为真实 DB 查询）
 * 3. runMonthlyCommissionSettlement — 月末 Cron Job 核算主函数
 * 4. paymentReceiptService     — 打款凭证 CRUD 服务
 */

import { getDb } from "./db";
import { salesCommissions, paymentReceipts } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ============================================================
// 类型定义
// ============================================================

export interface TieredRule {
  /** 阶梯下限（毛利，单位：元）*/
  from: number;
  /** 阶梯上限（毛利，单位：元），null 表示无上限 */
  to: number | null;
  /** 该阶梯的提成率，如 0.03 = 3% */
  rate: number;
}

export interface SalesProfitData {
  salesId: number;
  salesName: string;
  grossProfit: number; // 元
}

export interface CommissionResult {
  salesId: number;
  salesName: string;
  period: string;        // YYYY-MM
  grossProfit: number;
  commissionRate: number; // 最终有效税率（最高档）
  commissionAmount: number;
  ruleId?: number;
}

// ============================================================
// 默认阶梯规则（4 档）
// ============================================================

export const DEFAULT_TIERED_RULES: TieredRule[] = [
  { from: 0,      to: 10000,  rate: 0.03 }, // 0-1万：3%
  { from: 10000,  to: 50000,  rate: 0.05 }, // 1-5万：5%
  { from: 50000,  to: 200000, rate: 0.08 }, // 5-20万：8%
  { from: 200000, to: null,   rate: 0.10 }, // 20万以上：10%
];

// ============================================================
// 1. 阶梯利润率提成计算器
// ============================================================

/**
 * 按阶梯规则计算提成金额（累进制，类似个税计算方式）
 *
 * @param grossProfit 销售毛利（元）
 * @param rules 阶梯规则数组（按 from 升序排列）
 * @returns { commissionAmount, effectiveRate } 提成金额和最终有效税率
 */
export function calculateTieredCommission(
  grossProfit: number,
  rules: TieredRule[] = DEFAULT_TIERED_RULES
): { commissionAmount: number; effectiveRate: number } {
  if (grossProfit <= 0) {
    return { commissionAmount: 0, effectiveRate: 0 };
  }

  let remaining = grossProfit;
  let totalCommission = 0;
  let effectiveRate = 0;

  for (const rule of rules) {
    if (remaining <= 0) break;

    const bandWidth = rule.to !== null
      ? Math.min(remaining, rule.to - rule.from)
      : remaining;

    const bandAmount = Math.max(0, bandWidth);
    totalCommission += bandAmount * rule.rate;
    effectiveRate = rule.rate; // 记录最高档税率
    remaining -= bandAmount;
  }

  return {
    commissionAmount: Math.round(totalCommission * 100) / 100, // 保留两位小数
    effectiveRate,
  };
}

// ============================================================
// 2. 获取销售毛利数据（Mock 实现，生产替换为真实查询）
// ============================================================

/**
 * 获取指定周期内各销售的毛利汇总
 * 生产环境中应查询 order_items 表，关联回款状态过滤
 */
export async function getMockSalesProfitData(
  _period: string // YYYY-MM，生产环境用于过滤订单
): Promise<SalesProfitData[]> {
  // Mock 数据：模拟 4 名销售的月度毛利
  return [
    { salesId: 1, salesName: "张三（菜市场销售）", grossProfit: 8500 },
    { salesId: 2, salesName: "李四（商超销售）",   grossProfit: 45000 },
    { salesId: 3, salesName: "王五（钉钉销售）",   grossProfit: 120000 },
    { salesId: 4, salesName: "赵六（高级销售）",   grossProfit: 280000 },
  ];
}

// ============================================================
// 3. 月末 Cron Job 核算主函数
// ============================================================

/**
 * 获取上个月的周期字符串（YYYY-MM）
 */
export function getPreviousMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 获取当前月的周期字符串（YYYY-MM）
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 月末提成结算主函数（Cron Job 入口）
 *
 * 流程：
 * 1. 确定结算周期（默认上个月）
 * 2. 获取各销售毛利数据
 * 3. 按阶梯规则计算提成
 * 4. 幂等写入 sales_commissions 表（已存在则跳过）
 *
 * @param period 可选，指定结算周期（YYYY-MM），默认为上个月
 * @param rules  可选，自定义阶梯规则
 */
export async function runMonthlyCommissionSettlement(
  period?: string,
  rules: TieredRule[] = DEFAULT_TIERED_RULES
): Promise<CommissionResult[]> {
  const targetPeriod = period ?? getPreviousMonth();
  console.log(`[Commission Cron] Starting settlement for period: ${targetPeriod}`);

  // 1. 获取销售毛利数据
  const salesData = await getMockSalesProfitData(targetPeriod);

  const results: CommissionResult[] = [];

  for (const sales of salesData) {
    // 2. 计算提成
    const { commissionAmount, effectiveRate } = calculateTieredCommission(
      sales.grossProfit,
      rules
    );

    console.log(
      `[Commission Cron] ✓ salesId=${sales.salesId} (${sales.salesName}): ` +
      `grossProfit=${sales.grossProfit}, rate=${(effectiveRate * 100).toFixed(1)}%, ` +
      `commissionAmount=${commissionAmount}`
    );

    // 3. 幂等写入（检查是否已存在该销售该周期的记录）
    const existing = await (await getDb())!
      .select({ id: salesCommissions.id })
      .from(salesCommissions)
      .where(
        and(
          eq(salesCommissions.salesId, sales.salesId),
          eq(salesCommissions.period, targetPeriod)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await (await getDb())!.insert(salesCommissions).values({
        salesId: sales.salesId,
        salesName: sales.salesName,
        period: targetPeriod,
        grossProfit: String(sales.grossProfit),
        commissionRate: String(effectiveRate),
        commissionAmount: String(commissionAmount),
        status: "PENDING",
      });
    } else {
      console.log(
        `[Commission Cron] ⚠ salesId=${sales.salesId} period=${targetPeriod} already exists, skipping`
      );
    }

    results.push({
      salesId: sales.salesId,
      salesName: sales.salesName,
      period: targetPeriod,
      grossProfit: sales.grossProfit,
      commissionRate: effectiveRate,
      commissionAmount,
    });
  }

  console.log(
    `[Commission Cron] Settlement complete. Processed ${results.length} records for ${targetPeriod}`
  );

  return results;
}

// ============================================================
// 4. 打款凭证 CRUD 服务
// ============================================================

export const paymentReceiptService = {
  /**
   * 提交打款凭证（销售上传）
   */
  async submit(params: {
    orderId: number;
    amount: number;
    paidAt: Date;
    receiptUrl?: string;
    remark?: string;
    submittedBy: number;
    submittedByName: string;
  }) {
    const [result] = await (await getDb())!.insert(paymentReceipts).values({
      orderId: params.orderId,
      amount: String(params.amount),
      paidAt: params.paidAt,
      receiptUrl: params.receiptUrl,
      remark: params.remark,
      submittedBy: params.submittedBy,
      submittedByName: params.submittedByName,
      status: "PENDING",
    });

    console.log(`[PaymentReceipt] Submitted: orderId=${params.orderId}, amount=${params.amount}`);

    const [record] = await (await getDb())!
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, result.insertId))
      .limit(1);

    return record;
  },

  /**
   * 查询订单的打款凭证列表
   */
  async listByOrder(orderId: number) {
    return (await getDb())!
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.orderId, orderId));
  },

  /**
   * 核销打款凭证（财务审核通过）
   */
  async verify(id: number, verifiedBy: number, verifiedByName: string) {
    await (await getDb())!
      .update(paymentReceipts)
      .set({
        status: "VERIFIED",
        verifiedBy,
        verifiedByName,
        verifiedAt: new Date(),
      })
      .where(eq(paymentReceipts.id, id));

    console.log(`[PaymentReceipt] Verified: id=${id}, by=${verifiedBy}`);

    const [record] = await (await getDb())!
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, id))
      .limit(1);

    return record;
  },

  /**
   * 拒绝打款凭证（财务审核拒绝）
   */
  async reject(id: number, verifiedBy: number, verifiedByName: string, rejectReason: string) {
    await (await getDb())!
      .update(paymentReceipts)
      .set({
        status: "REJECTED",
        verifiedBy,
        verifiedByName,
        verifiedAt: new Date(),
        rejectReason,
      })
      .where(eq(paymentReceipts.id, id));

    console.log(`[PaymentReceipt] Rejected: id=${id}, by=${verifiedBy}`);

    const [record] = await (await getDb())!
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, id))
      .limit(1);

    return record;
  },
};
