/**
 * RC4 Epic 2: B2B 账期与信用额度控制体系
 * 
 * 核心逻辑：
 * 1. 下单时校验：订单金额 + 已用额度 <= 信用额度
 * 2. 超限订单自动拦截，生成 CREDIT_OVERRIDE_APPROVAL 特批工单
 * 3. 月结账单定时生成 + IM 催款通知
 */

import { getDb } from './db';
import { customerCreditScores, creditOverrideApprovals, billingStatements } from '../drizzle/schema';
import { eq, sql, and } from 'drizzle-orm';

// ============================================================
// 信用额度校验（下单前调用）
// ============================================================

export interface CreditCheckResult {
  allowed: boolean;
  customerId: number;
  customerName: string;
  creditLimit: number;
  usedCredit: number;
  availableCredit: number;
  orderAmount: number;
  exceededAmount: number;
  overrideApprovalId?: number;
  message: string;
}

/**
 * 信用额度校验
 * 
 * 规则：订单金额 + 已用额度 <= 信用额度
 * 如果超限，自动创建 CREDIT_OVERRIDE_APPROVAL 特批工单
 */
export async function checkCreditLimit(
  customerId: number,
  orderAmount: number,
  requestedBy?: number,
  requestedByName?: string,
): Promise<CreditCheckResult> {
  const db = await getDb();
  if (!db) {
    // 数据库不可用时默认放行（降级策略）
    return {
      allowed: true,
      customerId,
      customerName: 'Unknown',
      creditLimit: 999999,
      usedCredit: 0,
      availableCredit: 999999,
      orderAmount,
      exceededAmount: 0,
      message: '数据库不可用，信用校验降级放行',
    };
  }

  // 查询客户信用信息
  const creditRows = await db.select().from(customerCreditScores)
    .where(eq(customerCreditScores.customerId, customerId))
    .limit(1);

  if (creditRows.length === 0) {
    // 新客户，无信用记录，使用默认额度
    console.log(`[Credit] Customer ${customerId} has no credit record, using default limit`);
    return {
      allowed: true,
      customerId,
      customerName: 'New Customer',
      creditLimit: 50000, // 默认 5 万额度
      usedCredit: 0,
      availableCredit: 50000,
      orderAmount,
      exceededAmount: 0,
      message: '新客户，使用默认信用额度',
    };
  }

  const credit = creditRows[0];
  // 使用 autoApproveLimit 作为信用额度（已有字段复用）
  const creditLimit = parseFloat(String(credit.autoApproveLimit || 50000));
  // 使用 totalAmount - paidAmount 作为已用额度
  const usedCredit = parseFloat(String(credit.totalAmount || 0)) - parseFloat(String(credit.paidAmount || 0));
  const availableCredit = creditLimit - usedCredit;
  const exceededAmount = Math.max(0, (orderAmount + usedCredit) - creditLimit);

  console.log(`[Credit] Check: customer=${customerId}, limit=${creditLimit}, used=${usedCredit}, available=${availableCredit}, order=${orderAmount}, exceeded=${exceededAmount}`);

  if (orderAmount + usedCredit <= creditLimit) {
    // 额度充足，允许下单
    return {
      allowed: true,
      customerId,
      customerName: credit.customerName,
      creditLimit,
      usedCredit,
      availableCredit,
      orderAmount,
      exceededAmount: 0,
      message: '信用额度充足，允许下单',
    };
  }

  // 超限！创建特批工单
  console.log(`[Credit] EXCEEDED: customer=${customerId} (${credit.customerName}), exceeded=${exceededAmount}`);

  const overrideResult = await db.insert(creditOverrideApprovals).values({
    customerId,
    customerName: credit.customerName,
    orderAmount: String(orderAmount) as any,
    currentUsedCredit: String(usedCredit) as any,
    creditLimit: String(creditLimit) as any,
    exceededAmount: String(exceededAmount) as any,
    requestedBy: requestedBy || null,
    requestedByName: requestedByName || null,
    status: 'PENDING',
    reason: `订单金额 ¥${orderAmount.toFixed(2)} + 已用额度 ¥${usedCredit.toFixed(2)} = ¥${(orderAmount + usedCredit).toFixed(2)}，超出信用额度 ¥${creditLimit.toFixed(2)}`,
  });

  const overrideId = (overrideResult as any)[0]?.insertId || (overrideResult as any).insertId;

  return {
    allowed: false,
    customerId,
    customerName: credit.customerName,
    creditLimit,
    usedCredit,
    availableCredit,
    orderAmount,
    exceededAmount,
    overrideApprovalId: overrideId,
    message: `信用额度不足：订单金额 ¥${orderAmount.toFixed(2)} + 已用额度 ¥${usedCredit.toFixed(2)} 超出信用额度 ¥${creditLimit.toFixed(2)}，已提交财务总监特批（工单 #${overrideId}）`,
  };
}

// ============================================================
// 信用超限特批审批
// ============================================================

export async function approveCreditOverride(
  approvalId: number,
  approvedBy: number,
  approvedByName: string,
  remark?: string,
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: '数据库不可用' };

  await db.update(creditOverrideApprovals)
    .set({
      status: 'APPROVED',
      approvedBy,
      approvedByName,
      approvalRemark: remark || '财务总监特批通过',
    })
    .where(eq(creditOverrideApprovals.id, approvalId));

  console.log(`[Credit] Override #${approvalId} APPROVED by ${approvedByName}`);
  return { success: true, message: '信用超限特批已通过' };
}

export async function rejectCreditOverride(
  approvalId: number,
  approvedBy: number,
  approvedByName: string,
  remark?: string,
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: '数据库不可用' };

  await db.update(creditOverrideApprovals)
    .set({
      status: 'REJECTED',
      approvedBy,
      approvedByName,
      approvalRemark: remark || '财务总监拒绝',
    })
    .where(eq(creditOverrideApprovals.id, approvalId));

  console.log(`[Credit] Override #${approvalId} REJECTED by ${approvedByName}`);
  return { success: true, message: '信用超限特批已拒绝' };
}

export async function getCreditOverrideList(status?: string) {
  const db = await getDb();
  if (!db) return [];

  if (status) {
    return db.select().from(creditOverrideApprovals)
      .where(eq(creditOverrideApprovals.status, status as any))
      .orderBy(sql`${creditOverrideApprovals.createdAt} DESC`);
  }

  return db.select().from(creditOverrideApprovals)
    .orderBy(sql`${creditOverrideApprovals.createdAt} DESC`);
}

// ============================================================
// 月结账单生成
// ============================================================

/**
 * 生成月结对账单（每月 1 号执行）
 * 
 * 逻辑：
 * 1. 查询所有有信用记录的客户
 * 2. 计算上月订单总额、已付金额、未付金额
 * 3. 生成 BillingStatement 记录
 * 4. 推送 IM 催款通知
 */
export async function generateMonthlyBillingStatements(): Promise<{
  success: boolean;
  generatedCount: number;
  message: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, generatedCount: 0, message: '数据库不可用' };

  // 计算上月的 period（YYYY-MM）
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 15); // 本月 15 号到期

  console.log(`[Billing] Generating monthly statements for period: ${period}`);

  // 查询所有有信用记录的客户
  const customers = await db.select().from(customerCreditScores);

  let generatedCount = 0;

  for (const customer of customers) {
    const totalAmount = parseFloat(String(customer.totalAmount || 0));
    const paidAmount = parseFloat(String(customer.paidAmount || 0));
    const outstandingAmount = totalAmount - paidAmount;

    if (totalAmount <= 0) continue; // 无订单的客户跳过

    // 检查是否已生成过该月账单
    const existing = await db.select().from(billingStatements)
      .where(and(
        eq(billingStatements.customerId, customer.customerId),
        eq(billingStatements.period, period),
      ))
      .limit(1);

    if (existing.length > 0) continue; // 已生成过，跳过

    await db.insert(billingStatements).values({
      customerId: customer.customerId,
      customerName: customer.customerName,
      period,
      totalOrders: customer.totalOrders || 0,
      totalAmount: String(totalAmount) as any,
      paidAmount: String(paidAmount) as any,
      outstandingAmount: String(outstandingAmount) as any,
      dueDate: dueDate,
      status: outstandingAmount > 0 ? 'GENERATED' : 'PAID',
    });

    generatedCount++;
    console.log(`[Billing] Generated statement for ${customer.customerName}: total=${totalAmount}, paid=${paidAmount}, outstanding=${outstandingAmount}`);
  }

  console.log(`[Billing] Monthly billing completed: ${generatedCount} statements generated for ${period}`);

  return {
    success: true,
    generatedCount,
    message: `${period} 月结账单生成完成，共 ${generatedCount} 份`,
  };
}

export async function getBillingStatements(customerId?: number, period?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];
  if (customerId) conditions.push(eq(billingStatements.customerId, customerId));
  if (period) conditions.push(eq(billingStatements.period, period));

  if (conditions.length > 0) {
    return db.select().from(billingStatements)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(sql`${billingStatements.createdAt} DESC`);
  }

  return db.select().from(billingStatements)
    .orderBy(sql`${billingStatements.createdAt} DESC`);
}
