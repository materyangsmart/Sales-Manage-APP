/**
 * MS9 Epic 3: AR 账龄分析与现金流预测
 * 
 * 核心逻辑：
 * 扫描所有未核销的 billing_statements（status != 'PAID'），
 * 按当前日期与 due_date 的差值分类为 5 个账龄区间：
 *   - Current: 未逾期（due_date >= today）
 *   - 1-30 Days: 逾期 1-30 天
 *   - 31-60 Days: 逾期 31-60 天
 *   - 61-90 Days: 逾期 61-90 天
 *   - 90+ Days: 逾期超过 90 天（高坏账风险）
 */

import { getDb } from "./db";
import { billingStatements } from "../drizzle/schema";
import { ne } from "drizzle-orm";

// ============================================================
// 类型定义
// ============================================================

export type AgingBucket =
  | "CURRENT"
  | "1_30_DAYS"
  | "31_60_DAYS"
  | "61_90_DAYS"
  | "90_PLUS_DAYS";

export interface AgingBucketSummary {
  bucket: AgingBucket;
  label: string;
  count: number;
  totalOutstanding: number;
  percentage: number; // 占总应收的百分比
}

export interface CustomerAgingEntry {
  customerId: number;
  customerName: string;
  period: string;
  dueDate: string;
  outstandingAmount: number;
  overdueDays: number;
  bucket: AgingBucket;
  status: string;
}

export interface ArAgingReport {
  asOfDate: string;
  totalOutstanding: number;
  totalStatements: number;
  buckets: AgingBucketSummary[];
  topRiskyCustomers: {
    customerId: number;
    customerName: string;
    totalOutstanding: number;
    maxOverdueDays: number;
    riskLevel: "HIGH" | "MEDIUM" | "LOW";
  }[];
  details: CustomerAgingEntry[];
}

// ============================================================
// 账龄分桶算法
// ============================================================

function classifyBucket(overdueDays: number): AgingBucket {
  if (overdueDays <= 0) return "CURRENT";
  if (overdueDays <= 30) return "1_30_DAYS";
  if (overdueDays <= 60) return "31_60_DAYS";
  if (overdueDays <= 90) return "61_90_DAYS";
  return "90_PLUS_DAYS";
}

const BUCKET_LABELS: Record<AgingBucket, string> = {
  CURRENT: "Current（未逾期）",
  "1_30_DAYS": "1-30 天",
  "31_60_DAYS": "31-60 天",
  "61_90_DAYS": "61-90 天",
  "90_PLUS_DAYS": "90+ 天（高风险）",
};

const BUCKET_ORDER: AgingBucket[] = [
  "CURRENT",
  "1_30_DAYS",
  "31_60_DAYS",
  "61_90_DAYS",
  "90_PLUS_DAYS",
];

/**
 * 生成 AR 账龄分析报告
 * @param asOfDate 基准日期（默认今天），格式 YYYY-MM-DD
 */
export async function generateArAgingReport(
  asOfDate?: string
): Promise<ArAgingReport> {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  // 直接使用传入的日期字符串，避免时区偏移问题
  const todayStr = asOfDate ?? (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // 使用中午时间避免时区边界问题
  const today = new Date(todayStr + 'T12:00:00.000Z');

  // 查询所有未核销账单（排除 PAID 状态）
  const unpaidStatements = await db
    .select()
    .from(billingStatements)
    .where(ne(billingStatements.status, "PAID"));

  // 计算每条账单的逾期天数和分桶
  const details: CustomerAgingEntry[] = unpaidStatements.map((stmt) => {
    const dueDate = new Date(String(stmt.dueDate));
    dueDate.setHours(0, 0, 0, 0);
    const overdueDays = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const bucket = classifyBucket(overdueDays);
    const outstandingAmount = parseFloat(stmt.outstandingAmount as string);

    return {
      customerId: stmt.customerId,
      customerName: stmt.customerName,
      period: stmt.period,
      dueDate: String(stmt.dueDate),
      outstandingAmount,
      overdueDays,
      bucket,
      status: stmt.status,
    };
  });

  // 汇总各分桶数据
  const totalOutstanding = details.reduce(
    (sum, d) => sum + d.outstandingAmount,
    0
  );
  const totalStatements = details.length;

  const bucketMap = new Map<AgingBucket, { count: number; total: number }>();
  for (const bucket of BUCKET_ORDER) {
    bucketMap.set(bucket, { count: 0, total: 0 });
  }
  for (const d of details) {
    const b = bucketMap.get(d.bucket)!;
    b.count++;
    b.total += d.outstandingAmount;
  }

  const buckets: AgingBucketSummary[] = BUCKET_ORDER.map((bucket) => {
    const { count, total } = bucketMap.get(bucket)!;
    return {
      bucket,
      label: BUCKET_LABELS[bucket],
      count,
      totalOutstanding: parseFloat(total.toFixed(2)),
      percentage:
        totalOutstanding > 0
          ? parseFloat(((total / totalOutstanding) * 100).toFixed(2))
          : 0,
    };
  });

  // 汇总高风险客户（逾期 30 天以上）
  const customerRiskMap = new Map<
    number,
    {
      customerId: number;
      customerName: string;
      totalOutstanding: number;
      maxOverdueDays: number;
    }
  >();

  for (const d of details) {
    if (d.overdueDays > 30) {
      const existing = customerRiskMap.get(d.customerId);
      if (existing) {
        existing.totalOutstanding += d.outstandingAmount;
        existing.maxOverdueDays = Math.max(
          existing.maxOverdueDays,
          d.overdueDays
        );
      } else {
        customerRiskMap.set(d.customerId, {
          customerId: d.customerId,
          customerName: d.customerName,
          totalOutstanding: d.outstandingAmount,
          maxOverdueDays: d.overdueDays,
        });
      }
    }
  }

  const topRiskyCustomers = Array.from(customerRiskMap.values())
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .slice(0, 10)
    .map((c) => ({
      ...c,
      totalOutstanding: parseFloat(c.totalOutstanding.toFixed(2)),
      riskLevel: (
        c.maxOverdueDays > 90
          ? "HIGH"
          : c.maxOverdueDays > 60
          ? "MEDIUM"
          : "LOW"
      ) as "HIGH" | "MEDIUM" | "LOW",
    }));

  return {
    asOfDate: todayStr,
    totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
    totalStatements,
    buckets,
    topRiskyCustomers,
    details: details.sort((a, b) => b.overdueDays - a.overdueDays),
  };
}

/**
 * 创建测试用账单（用于 E2E 测试）
 */
export async function createTestBillingStatement(data: {
  customerId: number;
  customerName: string;
  period: string;
  totalAmount: number;
  outstandingAmount: number;
  dueDate: string; // YYYY-MM-DD
  status?: "GENERATED" | "SENT" | "PARTIALLY_PAID" | "OVERDUE";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  const [result] = await db.insert(billingStatements).values({
    customerId: data.customerId,
    customerName: data.customerName,
    period: data.period,
    totalOrders: 1,
    totalAmount: data.totalAmount.toFixed(2),
    paidAmount: (data.totalAmount - data.outstandingAmount).toFixed(2),
    outstandingAmount: data.outstandingAmount.toFixed(2),
    dueDate: data.dueDate as any,
    status: data.status ?? "OVERDUE",
  });
  return Number((result as any).insertId);
}
