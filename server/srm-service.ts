/**
 * MS9 Epic 2: SRM 供应商闭环与客诉穿透
 * 
 * 核心逻辑：
 * 1. 记录原料入库批次（供应商 + 批次号）
 * 2. 当客诉单确认为"原料导致"时，根据成品批次号反查 MaterialReceipt
 * 3. 自动生成对该供应商的 SupplierPenalty（扣款单）
 * 4. 更新供应商质量评分和累计扣款金额
 */

import { getDb } from "./db";
import {
  suppliers,
  materialReceipts,
  supplierPenalties,
  afterSalesTickets,
} from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

// ============================================================
// 供应商管理
// ============================================================

export async function createSupplier(data: {
  supplierCode: string;
  supplierName: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  const [result] = await db.insert(suppliers).values({
    supplierCode: data.supplierCode,
    supplierName: data.supplierName,
    contactPerson: data.contactPerson,
    phone: data.phone,
    address: data.address,
    qualityRating: "5.0",
    status: "ACTIVE",
    totalPenaltyAmount: "0.00",
  });
  return Number((result as any).insertId);
}

export async function getSupplier(supplierId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  return supplier ?? null;
}

// ============================================================
// 原料入库批次管理
// ============================================================

export async function recordMaterialReceipt(data: {
  supplierId: number;
  supplierName: string;
  materialId: number;
  materialName: string;
  batchNo: string;
  receivedQty: number;
  unit: string;
  unitCost: number;
  productionDate?: string;
  expiryDate?: string;
}): Promise<{ id: number; receiptNo: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  const receiptNo = `RCP-${Date.now()}-${data.supplierId}`;
  const [result] = await db.insert(materialReceipts).values({
    receiptNo,
    supplierId: data.supplierId,
    supplierName: data.supplierName,
    materialId: data.materialId,
    materialName: data.materialName,
    batchNo: data.batchNo,
    receivedQty: data.receivedQty.toFixed(3),
    unit: data.unit,
    unitCost: data.unitCost.toFixed(4),
    qualityStatus: "PENDING",
    productionDate: data.productionDate as any,
    expiryDate: data.expiryDate as any,
  });

  return { id: Number((result as any).insertId), receiptNo };
}

export async function getMaterialReceiptByBatch(batchNo: string) {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  const [receipt] = await db
    .select()
    .from(materialReceipts)
    .where(eq(materialReceipts.batchNo, batchNo))
    .limit(1);
  return receipt ?? null;
}

// ============================================================
// 客诉穿透：确认原料责任 → 自动生成供应商扣款单
// ============================================================

export interface SupplierPenaltyResult {
  penaltyId: number;
  penaltyNo: string;
  supplierId: number;
  supplierName: string;
  batchNo: string;
  penaltyAmount: number;
  status: string;
}

/**
 * 当品质部确认客诉为"原料导致"时调用此函数：
 * 1. 根据 batchNo 反查 MaterialReceipt 找到责任供应商
 * 2. 自动生成 DRAFT 状态的 SupplierPenalty
 * 3. 更新供应商累计扣款金额和质量评分
 */
export async function triggerSupplierPenaltyFromAfterSales(data: {
  afterSalesTicketId: number;
  rawMaterialBatchNo: string;  // 原料批次号（从成品批次反查）
  penaltyAmount: number;
  penaltyReason: string;
}): Promise<SupplierPenaltyResult> {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  // 1. 根据批次号反查入库记录
  const receipt = await getMaterialReceiptByBatch(data.rawMaterialBatchNo);
  if (!receipt) {
    throw new Error(
      `RECEIPT_NOT_FOUND: 批次号 ${data.rawMaterialBatchNo} 未找到入库记录，无法追溯供应商`
    );
  }

  // 2. 验证客诉单存在
  const [ticket] = await db
    .select()
    .from(afterSalesTickets)
    .where(eq(afterSalesTickets.id, data.afterSalesTicketId))
    .limit(1);
  if (!ticket) {
    throw new Error(`TICKET_NOT_FOUND: 客诉单 ID ${data.afterSalesTicketId} 不存在`);
  }

  // 3. 生成供应商扣款单
  const penaltyNo = `PNL-${Date.now()}-${receipt.supplierId}`;
  const [result] = await db.insert(supplierPenalties).values({
    penaltyNo,
    supplierId: receipt.supplierId,
    supplierName: receipt.supplierName,
    materialReceiptId: receipt.id,
    afterSalesTicketId: data.afterSalesTicketId,
    batchNo: data.rawMaterialBatchNo,
    penaltyReason: data.penaltyReason,
    penaltyAmount: data.penaltyAmount.toFixed(2),
    status: "DRAFT",
  });
  const penaltyId = Number((result as any).insertId);

  // 4. 更新供应商累计扣款金额 + 降低质量评分
  await db
    .update(suppliers)
    .set({
      totalPenaltyAmount: sql`total_penalty_amount + ${data.penaltyAmount}`,
      // 每次扣款降低 0.5 分，最低 1.0
      qualityRating: sql`GREATEST(1.0, quality_rating - 0.5)`,
    })
    .where(eq(suppliers.id, receipt.supplierId));

  // 5. 更新入库批次质量状态
  await db
    .update(materialReceipts)
    .set({ qualityStatus: "REJECTED" })
    .where(eq(materialReceipts.id, receipt.id));

  return {
    penaltyId,
    penaltyNo,
    supplierId: receipt.supplierId,
    supplierName: receipt.supplierName,
    batchNo: data.rawMaterialBatchNo,
    penaltyAmount: data.penaltyAmount,
    status: "DRAFT",
  };
}

/**
 * 确认供应商扣款单（DRAFT → CONFIRMED）
 */
export async function confirmSupplierPenalty(penaltyId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  await db
    .update(supplierPenalties)
    .set({
      status: "CONFIRMED",
      confirmedAt: new Date(),
    })
    .where(eq(supplierPenalties.id, penaltyId));
}

/**
 * 获取供应商扣款单列表
 */
export async function getSupplierPenalties(supplierId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  if (supplierId) {
    return db
      .select()
      .from(supplierPenalties)
      .where(eq(supplierPenalties.supplierId, supplierId));
  }
  return db.select().from(supplierPenalties);
}
