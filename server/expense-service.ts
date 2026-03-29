/**
 * 费用报销与单客P&L核算服务 (Expense Claim & Customer P&L Service)
 * Mega-Sprint 7 Epic 3
 *
 * 功能：
 * 1. 提交费用报销单（差旅/招待/物流补贴），支持发票图片上传
 * 2. 审批报销单
 * 3. 单客真实毛利核算：订单总毛利 - 售后赔款 - 归属该客户的费用
 */
import { eq, desc, and, sum } from "drizzle-orm";
import { getDb } from "./db";
import {
  expenseClaims,
  afterSalesTickets,
  type InsertExpenseClaim,
} from "../drizzle/schema";

// ============================================================
// 工具函数
// ============================================================
function generateClaimNo(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `EXP${ts}${rand}`;
}

// ============================================================
// 提交报销单
// ============================================================
export async function submitExpenseClaim(params: {
  submittedBy: number;
  submittedByName: string;
  associatedCustomerId?: number;
  associatedCustomerName?: string;
  expenseType: "TRAVEL" | "ENTERTAINMENT" | "LOGISTICS_SUBSIDY" | "OTHER";
  amount: number;
  description: string;
  invoiceImageUrl?: string;
  invoiceImageKey?: string;
  expenseDate: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const claimNo = generateClaimNo();
  const insertData: InsertExpenseClaim = {
    claimNo,
    submittedBy: params.submittedBy,
    submittedByName: params.submittedByName,
    associatedCustomerId: params.associatedCustomerId,
    associatedCustomerName: params.associatedCustomerName,
    expenseType: params.expenseType,
    amount: String(params.amount),
    description: params.description,
    invoiceImageUrl: params.invoiceImageUrl,
    invoiceImageKey: params.invoiceImageKey,
    expenseDate: params.expenseDate as unknown as Date,
    status: "PENDING",
  };

  await db.insert(expenseClaims).values(insertData);
  const [claim] = await db
    .select()
    .from(expenseClaims)
    .where(eq(expenseClaims.claimNo, claimNo))
    .limit(1);

  console.log(`[Expense] 报销单创建成功: ${claimNo}, 金额: ¥${params.amount}, 类型: ${params.expenseType}`);
  return claim;
}

// ============================================================
// 审批报销单
// ============================================================
export async function approveExpenseClaim(params: {
  claimId: number;
  approvedBy: number;
  approvedByName: string;
  approved: boolean;
  approvalRemark?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [claim] = await db
    .select()
    .from(expenseClaims)
    .where(eq(expenseClaims.id, params.claimId))
    .limit(1);

  if (!claim) throw new Error(`报销单 #${params.claimId} 不存在`);
  if (claim.status !== "PENDING") {
    throw new Error(`报销单状态为 ${claim.status}，无法审批`);
  }

  await db
    .update(expenseClaims)
    .set({
      status: params.approved ? "APPROVED" : "REJECTED",
      approvedBy: params.approvedBy,
      approvedByName: params.approvedByName,
      approvalRemark: params.approvalRemark,
      approvedAt: new Date(),
    })
    .where(eq(expenseClaims.id, params.claimId));

  console.log(`[Expense] 报销单 ${claim.claimNo} ${params.approved ? "审批通过" : "审批拒绝"}`);
  return { success: true, claimNo: claim.claimNo, status: params.approved ? "APPROVED" : "REJECTED" };
}

// ============================================================
// 查询报销单列表
// ============================================================
export async function listExpenseClaims(params?: {
  submittedBy?: number;
  associatedCustomerId?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [];
  if (params?.submittedBy) {
    conditions.push(eq(expenseClaims.submittedBy, params.submittedBy));
  }
  if (params?.associatedCustomerId) {
    conditions.push(eq(expenseClaims.associatedCustomerId, params.associatedCustomerId));
  }
  if (params?.status) {
    conditions.push(eq(expenseClaims.status, params.status as any));
  }

  const query = db
    .select()
    .from(expenseClaims)
    .orderBy(desc(expenseClaims.createdAt))
    .limit(pageSize)
    .offset(offset);

  if (conditions.length > 0) {
    query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const items = await query;
  return { items, total: items.length };
}

// ============================================================
// 重新提交被退回的报销单
// ============================================================
export async function resubmitExpenseClaim(params: {
  claimId: number;
  submittedBy: number;
  amount?: number;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [claim] = await db
    .select()
    .from(expenseClaims)
    .where(eq(expenseClaims.id, params.claimId))
    .limit(1);

  if (!claim) throw new Error(`报销单 #${params.claimId} 不存在`);
  if (claim.status !== "REJECTED") {
    throw new Error(`报销单状态为 ${claim.status}，只有被退回的报销单才能重新提交`);
  }
  if (claim.submittedBy !== params.submittedBy) {
    throw new Error("只能重新提交自己的报销单");
  }

  const updateData: any = {
    status: "PENDING" as const,
    approvedBy: null,
    approvedByName: null,
    approvalRemark: null,
    approvedAt: null,
  };
  if (params.amount !== undefined) {
    updateData.amount = String(params.amount);
  }
  if (params.description !== undefined) {
    updateData.description = params.description;
  }

  await db
    .update(expenseClaims)
    .set(updateData)
    .where(eq(expenseClaims.id, params.claimId));

  console.log(`[Expense] 报销单 ${claim.claimNo} 重新提交，状态恢复为 PENDING`);
  return { success: true, claimNo: claim.claimNo };
}

// ============================================================
// 单客真实毛利核算
// 公式：单客真实利润 = 订单总毛利 - 售后赔款 - 归属该客户的差旅招待费用
// ============================================================
export async function getCustomerPnL(
  customerId: number,
  startDate?: string,
  endDate?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // 1. 查询该客户的已审批费用总额
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

  // 2. 查询该客户的售后赔款总额（已审核通过的工单）
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

  // 3. 通过 backend API 获取订单毛利（使用 ordersAPI）
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
      // 假设毛利率 35%（实际应从产品成本表计算）
      grossProfit += amount * 0.35;
    }
  } catch (err: any) {
    console.warn(`[Expense] 获取订单数据失败: ${err.message}`);
  }

  // 4. 计算真实净利润
  const netProfit = grossProfit - totalRmaClaims - totalExpenses;

  return {
    customerId,
    period: { startDate, endDate },
    summary: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      totalRmaClaims: parseFloat(totalRmaClaims.toFixed(2)),
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      orderCount,
    },
    breakdown: {
      expenseItems: approvedExpenses.map((e) => ({
        claimNo: e.claimNo,
        type: e.expenseType,
        amount: parseFloat(e.amount || "0"),
        description: e.description,
        expenseDate: e.expenseDate,
      })),
      rmaItems: rmaTickets.map((t) => ({
        ticketNo: t.ticketNo,
        issueType: t.issueType,
        claimAmount: parseFloat(t.claimAmount || "0"),
        createdAt: t.createdAt,
      })),
    },
  };
}
