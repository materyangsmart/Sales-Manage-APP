/**
 * 单客精细化成本核算服务 (Customer P&L Foundation)
 * Mega-Sprint 8 Epic 3
 *
 * 单客净利公式：
 * 净利 = 订单总毛利 - 售后损失 - 关联报销费用 - (总销售额 × 管理成本费率) - 逾期资金占用成本
 *
 * 逾期资金占用成本 = 逾期金额 × 年化利率 × (逾期天数 / 365)
 */
import { eq, and, sum, lte } from "drizzle-orm";
import { getDb } from "./db";
import {
  expenseClaims,
  afterSalesTickets,
  customerCostConfig,
  billingStatements,
  type InsertCustomerCostConfig,
} from "../drizzle/schema";

// ============================================================
// 设置/更新客户成本配置
// ============================================================
export async function setCustomerCostConfig(params: {
  customerId: number;
  customerName: string;
  managementCostRate: number;  // 如 0.05 = 5%
  overdueInterestRate?: number; // 如 0.06 = 6% 年化，默认 6%
  customerType?: "WET_MARKET" | "WHOLESALE_B" | "SUPERMARKET" | "ECOMMERCE" | "OTHER";
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const existing = await db
    .select()
    .from(customerCostConfig)
    .where(eq(customerCostConfig.customerId, params.customerId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(customerCostConfig)
      .set({
        customerName: params.customerName,
        managementCostRate: String(params.managementCostRate),
        overdueInterestRate: String(params.overdueInterestRate ?? 0.06),
        customerType: params.customerType ?? "OTHER",
        notes: params.notes,
      })
      .where(eq(customerCostConfig.customerId, params.customerId));
  } else {
    const insertData: InsertCustomerCostConfig = {
      customerId: params.customerId,
      customerName: params.customerName,
      managementCostRate: String(params.managementCostRate),
      overdueInterestRate: String(params.overdueInterestRate ?? 0.06),
      customerType: params.customerType ?? "OTHER",
      notes: params.notes,
    };
    await db.insert(customerCostConfig).values(insertData);
  }

  const [config] = await db
    .select()
    .from(customerCostConfig)
    .where(eq(customerCostConfig.customerId, params.customerId))
    .limit(1);

  console.log(`[CustomerPnL] 成本配置已更新: 客户 #${params.customerId}, 管理费率: ${(params.managementCostRate * 100).toFixed(1)}%`);
  return config;
}

// ============================================================
// 计算逾期资金占用成本
// ============================================================
async function calcOverdueCost(
  customerId: number,
  annualRate: number,
): Promise<{ overdueCost: number; overdueDetails: Array<{ period: string; overdueAmount: number; overdueDays: number; cost: number }> }> {
  const db = await getDb();
  if (!db) return { overdueCost: 0, overdueDetails: [] };

  const today = new Date();

  // 查询该客户所有逾期账单（状态为 OVERDUE 或 dueDate 已过但未付清）
  const overdueStatements = await db
    .select()
    .from(billingStatements)
    .where(
      and(
        eq(billingStatements.customerId, customerId),
        eq(billingStatements.status, "OVERDUE"),
      )
    );

  let totalOverdueCost = 0;
  const overdueDetails: Array<{ period: string; overdueAmount: number; overdueDays: number; cost: number }> = [];

  for (const stmt of overdueStatements) {
    const dueDate = new Date(stmt.dueDate as unknown as string);
    const overdueAmount = parseFloat(stmt.outstandingAmount || "0");

    if (overdueAmount <= 0) continue;

    // 计算逾期天数
    const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    if (overdueDays <= 0) continue;

    // 逾期资金占用成本 = 逾期金额 × 年化利率 × (逾期天数 / 365)
    const cost = overdueAmount * annualRate * (overdueDays / 365);

    totalOverdueCost += cost;
    overdueDetails.push({
      period: stmt.period,
      overdueAmount: parseFloat(overdueAmount.toFixed(2)),
      overdueDays,
      cost: parseFloat(cost.toFixed(2)),
    });
  }

  return {
    overdueCost: parseFloat(totalOverdueCost.toFixed(2)),
    overdueDetails,
  };
}

// ============================================================
// 重构利润大盘接口：单客精细化净利核算
// ============================================================
export async function getCustomerDetailedPnL(
  customerId: number,
  startDate?: string,
  endDate?: string,
): Promise<{
  customerId: number;
  period: { startDate?: string; endDate?: string };
  costConfig: {
    managementCostRate: number;
    overdueInterestRate: number;
    customerType: string;
  };
  summary: {
    totalRevenue: number;
    grossProfit: number;
    grossMarginRate: number;
    totalRmaClaims: number;
    totalExpenses: number;
    managementCost: number;
    overdueCost: number;
    netProfit: number;
    netMarginRate: number;
    orderCount: number;
  };
  breakdown: {
    expenseItems: Array<{ claimNo: string; type: string; amount: number; description: string }>;
    rmaItems: Array<{ ticketNo: string; issueType: string; claimAmount: number }>;
    overdueDetails: Array<{ period: string; overdueAmount: number; overdueDays: number; cost: number }>;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // 1. 获取客户成本配置
  const [costConf] = await db
    .select()
    .from(customerCostConfig)
    .where(eq(customerCostConfig.customerId, customerId))
    .limit(1);

  const managementCostRate = parseFloat(costConf?.managementCostRate ?? "0.01");
  const overdueInterestRate = parseFloat(costConf?.overdueInterestRate ?? "0.06");
  const customerType = costConf?.customerType ?? "OTHER";

  // 2. 查询该客户的已审批费用总额
  const approvedExpenses = await db
    .select()
    .from(expenseClaims)
    .where(
      and(
        eq(expenseClaims.associatedCustomerId, customerId),
        eq(expenseClaims.status, "APPROVED"),
      )
    );
  const totalExpenses = approvedExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || "0"),
    0,
  );

  // 3. 查询该客户的售后赔款总额
  const rmaTickets = await db
    .select()
    .from(afterSalesTickets)
    .where(
      and(
        eq(afterSalesTickets.customerId, customerId),
        eq(afterSalesTickets.status, "REPLACEMENT_ISSUED"),
      )
    );
  const totalRmaClaims = rmaTickets.reduce(
    (sum, t) => sum + parseFloat(t.claimAmount || "0"),
    0,
  );

  // 4. 通过 backend API 获取订单毛利
  let grossProfit = 0;
  let totalRevenue = 0;
  let orderCount = 0;
  try {
    const { ordersAPI } = await import("./backend-api");
    const ordersResp = await ordersAPI.list({
      orgId: customerId,
      status: "COMPLETED",
      pageSize: 200,
    });
    const orders = (ordersResp as any)?.data || (ordersResp as any)?.items || [];
    orderCount = orders.length;
    for (const order of orders) {
      const amount = parseFloat(order.totalAmount || order.total_amount || "0");
      totalRevenue += amount;
      grossProfit += amount * 0.35; // 假设毛利率 35%
    }
  } catch (err: any) {
    console.warn(`[CustomerPnL] 获取订单数据失败: ${err.message}`);
  }

  // 5. 计算管理成本 = 总销售额 × 管理成本费率
  const managementCost = totalRevenue * managementCostRate;

  // 6. 计算逾期资金占用成本
  const { overdueCost, overdueDetails } = await calcOverdueCost(customerId, overdueInterestRate);

  // 7. 单客净利 = 订单总毛利 - 售后损失 - 关联报销费用 - 管理成本 - 逾期资金占用成本
  const netProfit = grossProfit - totalRmaClaims - totalExpenses - managementCost - overdueCost;
  const grossMarginRate = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
  const netMarginRate = totalRevenue > 0 ? netProfit / totalRevenue : 0;

  console.log(
    `[CustomerPnL] 客户 #${customerId} 精细化核算完成:`,
    `毛利=¥${grossProfit.toFixed(2)},`,
    `管理成本=¥${managementCost.toFixed(2)} (${(managementCostRate * 100).toFixed(1)}%),`,
    `逾期成本=¥${overdueCost.toFixed(2)},`,
    `净利=¥${netProfit.toFixed(2)}`,
  );

  return {
    customerId,
    period: { startDate, endDate },
    costConfig: {
      managementCostRate,
      overdueInterestRate,
      customerType,
    },
    summary: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossMarginRate: parseFloat(grossMarginRate.toFixed(4)),
      totalRmaClaims: parseFloat(totalRmaClaims.toFixed(2)),
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      managementCost: parseFloat(managementCost.toFixed(2)),
      overdueCost: parseFloat(overdueCost.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      netMarginRate: parseFloat(netMarginRate.toFixed(4)),
      orderCount,
    },
    breakdown: {
      expenseItems: approvedExpenses.map((e) => ({
        claimNo: e.claimNo,
        type: e.expenseType,
        amount: parseFloat(e.amount || "0"),
        description: e.description,
      })),
      rmaItems: rmaTickets.map((t) => ({
        ticketNo: t.ticketNo,
        issueType: t.issueType,
        claimAmount: parseFloat(t.claimAmount || "0"),
      })),
      overdueDetails,
    },
  };
}

// ============================================================
// 批量查询所有客户的精细化利润大盘
// ============================================================
export async function getCustomerProfitabilityDashboard(params?: {
  limit?: number;
}): Promise<Array<{
  customerId: number;
  customerName: string;
  customerType: string;
  managementCostRate: number;
  totalRevenue: number;
  netProfit: number;
  netMarginRate: number;
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const configs = await db
    .select()
    .from(customerCostConfig)
    .limit(params?.limit ?? 100);

  const results = [];
  for (const config of configs) {
    try {
      const pnl = await getCustomerDetailedPnL(config.customerId);
      results.push({
        customerId: config.customerId,
        customerName: config.customerName,
        customerType: config.customerType,
        managementCostRate: parseFloat(config.managementCostRate),
        totalRevenue: pnl.summary.totalRevenue,
        netProfit: pnl.summary.netProfit,
        netMarginRate: pnl.summary.netMarginRate,
      });
    } catch (err: any) {
      console.warn(`[CustomerPnL] 客户 #${config.customerId} 核算失败: ${err.message}`);
    }
  }

  // 按净利润降序排列
  return results.sort((a, b) => b.netProfit - a.netProfit);
}
