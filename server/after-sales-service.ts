/**
 * 售后处理引擎 (After-Sales & RMA Service)
 * Mega-Sprint 7 Epic 2
 *
 * 功能：
 * 1. 创建售后工单（货损/质量异常）
 * 2. 品质部审核工单
 * 3. 审核通过后一键生成 0 元补发订单
 * 4. 补发时自动扣减库存
 */
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  afterSalesTickets,
  replacementOrders,
  type InsertAfterSalesTicket,
  type InsertReplacementOrder,
} from "../drizzle/schema";

// ============================================================
// 工具函数
// ============================================================
function generateTicketNo(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `RMA${ts}${rand}`;
}

function generateReplacementNo(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `REP${ts}${rand}`;
}

// ============================================================
// 创建售后工单
// ============================================================
export async function createAfterSalesTicket(params: {
  orderId: number;
  orderNo: string;
  customerId: number;
  customerName: string;
  reportedBy?: number;
  reportedByName?: string;
  issueType: "DAMAGE" | "QUALITY" | "SHORT_DELIVERY" | "WRONG_ITEM" | "OTHER";
  description: string;
  evidenceImages?: string;
  claimAmount?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const ticketNo = generateTicketNo();
  const insertData: InsertAfterSalesTicket = {
    ticketNo,
    orderId: params.orderId,
    orderNo: params.orderNo,
    customerId: params.customerId,
    customerName: params.customerName,
    reportedBy: params.reportedBy,
    reportedByName: params.reportedByName,
    issueType: params.issueType,
    description: params.description,
    evidenceImages: params.evidenceImages,
    claimAmount: String(params.claimAmount ?? 0),
    status: "PENDING",
  };

  await db.insert(afterSalesTickets).values(insertData);
  const [ticket] = await db
    .select()
    .from(afterSalesTickets)
    .where(eq(afterSalesTickets.ticketNo, ticketNo))
    .limit(1);

  console.log(`[AfterSales] 工单创建成功: ${ticketNo}, 类型: ${params.issueType}`);
  return ticket;
}

// ============================================================
// 审核售后工单（品质部）
// ============================================================
export async function reviewAfterSalesTicket(params: {
  ticketId: number;
  reviewedBy: number;
  reviewedByName: string;
  approved: boolean;
  reviewRemark?: string;
  // 审核通过时，指定补发商品信息
  replacementItems?: Array<{
    productId: number;
    productName: string;
    quantity: number;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [ticket] = await db
    .select()
    .from(afterSalesTickets)
    .where(eq(afterSalesTickets.id, params.ticketId))
    .limit(1);

  if (!ticket) throw new Error(`工单 #${params.ticketId} 不存在`);
  if (ticket.status !== "PENDING" && ticket.status !== "UNDER_REVIEW") {
    throw new Error(`工单状态为 ${ticket.status}，无法审核`);
  }

  if (!params.approved) {
    // 拒绝工单
    await db
      .update(afterSalesTickets)
      .set({
        status: "REJECTED",
        reviewedBy: params.reviewedBy,
        reviewedByName: params.reviewedByName,
        reviewRemark: params.reviewRemark || "品质部审核不通过",
        reviewedAt: new Date(),
      })
      .where(eq(afterSalesTickets.id, params.ticketId));
    return { success: true, action: "REJECTED", ticketNo: ticket.ticketNo };
  }

  // 审核通过 → 生成 0 元补发订单
  const replacementItems = params.replacementItems || [];
  const replacementOrders_created: any[] = [];

  for (const item of replacementItems) {
    const replacementNo = generateReplacementNo();
    const insertRep: InsertReplacementOrder = {
      replacementNo,
      originalOrderId: ticket.orderId,
      originalOrderNo: ticket.orderNo,
      afterSalesTicketId: ticket.id,
      customerId: ticket.customerId,
      customerName: ticket.customerName,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: "0",      // 0 元补发
      totalAmount: "0",    // 0 元补发
      isCountedInRevenue: false,
      isCountedInAR: false,
      status: "PENDING",
    };
    await db.insert(replacementOrders).values(insertRep);

    // 扣减库存（通过 inventory_service）
    try {
      const { adjustInventory } = await import("./inventory-service");
      await adjustInventory(
        item.productId,
        "OUTBOUND",
        item.quantity,
        params.reviewedBy,
        params.reviewedByName,
        `售后补发 - 工单 ${ticket.ticketNo}`,
      );
      console.log(`[AfterSales] 库存扣减成功: productId=${item.productId}, qty=-${item.quantity}`);
    } catch (invErr: any) {
      console.warn(`[AfterSales] 库存扣减失败（非阻断）: ${invErr.message}`);
    }

    const [rep] = await db
      .select()
      .from(replacementOrders)
      .where(eq(replacementOrders.replacementNo, replacementNo))
      .limit(1);
    replacementOrders_created.push(rep);
  }

  // 更新工单状态
  const firstRepId = replacementOrders_created[0]?.id;
  await db
    .update(afterSalesTickets)
    .set({
      status: "REPLACEMENT_ISSUED",
      reviewedBy: params.reviewedBy,
      reviewedByName: params.reviewedByName,
      reviewRemark: params.reviewRemark || "审核通过，已生成补发单",
      reviewedAt: new Date(),
      replacementOrderId: firstRepId,
    })
    .where(eq(afterSalesTickets.id, params.ticketId));

  console.log(`[AfterSales] 审核通过，生成 ${replacementOrders_created.length} 笔 0 元补发单`);
  return {
    success: true,
    action: "APPROVED",
    ticketNo: ticket.ticketNo,
    replacementOrders: replacementOrders_created,
  };
}

// ============================================================
// 查询售后工单列表
// ============================================================
export async function listAfterSalesTickets(params?: {
  customerId?: number;
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
  if (params?.customerId) {
    conditions.push(eq(afterSalesTickets.customerId, params.customerId));
  }
  if (params?.status) {
    conditions.push(eq(afterSalesTickets.status, params.status as any));
  }

  const query = db
    .select()
    .from(afterSalesTickets)
    .orderBy(desc(afterSalesTickets.createdAt))
    .limit(pageSize)
    .offset(offset);

  if (conditions.length > 0) {
    query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const items = await query;
  return { items, total: items.length };
}

// ============================================================
// 查询补发订单列表
// ============================================================
export async function listReplacementOrders(params?: {
  customerId?: number;
  afterSalesTicketId?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions: any[] = [];
  if (params?.customerId) {
    conditions.push(eq(replacementOrders.customerId, params.customerId));
  }
  if (params?.afterSalesTicketId) {
    conditions.push(eq(replacementOrders.afterSalesTicketId, params.afterSalesTicketId));
  }

  const query = db
    .select()
    .from(replacementOrders)
    .orderBy(desc(replacementOrders.createdAt));

  if (conditions.length > 0) {
    query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const items = await query;
  return { items, total: items.length };
}
