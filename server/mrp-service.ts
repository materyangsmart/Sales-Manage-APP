/**
 * MS9 Epic 1: MRP 物料需求引擎
 * 
 * 核心逻辑：
 * 1. 接收成品订单（产品编码 + 数量）
 * 2. 展开 BOM，计算各原材料需求量（含损耗率）
 * 3. 比对原材料库存
 * 4. 对库存不足的原材料，自动生成 DRAFT 状态的采购建议单
 */

import { getDb } from "./db";
import { materials, bomItems, purchaseOrders } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface MrpInput {
  orderNo: string;       // 触发 MRP 的销售订单号
  productCode: string;   // 成品编码
  productName: string;   // 成品名称
  requiredQty: number;   // 需要生产的成品数量
}

export interface MrpLineResult {
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  requiredQty: number;         // 需求量（含损耗）
  currentStock: number;        // 当前库存
  shortageQty: number;         // 短缺量（0 表示库存充足）
  purchaseOrderId?: number;    // 若生成了采购单，记录 ID
  purchaseOrderNo?: string;
  status: "SUFFICIENT" | "SHORTAGE";
}

export interface MrpResult {
  orderNo: string;
  productCode: string;
  productName: string;
  requiredQty: number;
  lines: MrpLineResult[];
  totalShortageItems: number;
  purchaseOrdersCreated: number;
  calculatedAt: Date;
}

/**
 * 运行 MRP 计算
 */
export async function runMrp(input: MrpInput): Promise<MrpResult> {
  const db = await getDb();
  if (!db) throw new Error('DB_UNAVAILABLE');

  // 1. 查询 BOM 展开
  const boms = await db
    .select()
    .from(bomItems)
    .where(and(eq(bomItems.productCode, input.productCode), eq(bomItems.isActive, true)));

  if (boms.length === 0) {
    throw new Error(`BOM_NOT_FOUND: 产品 ${input.productCode} 未配置物料清单`);
  }

  const lines: MrpLineResult[] = [];
  let purchaseOrdersCreated = 0;

  for (const bom of boms) {
    // 2. 计算需求量 = 成品数量 × 单位用量 × (1 + 损耗率)
    const qtyPerUnit = parseFloat(bom.qtyPerUnit as string);
    const wasteRate = parseFloat(bom.wasteRate as string);
    const requiredQty = input.requiredQty * qtyPerUnit * (1 + wasteRate);

    // 3. 查询原材料库存
    const [material] = await db
      .select()
      .from(materials)
      .where(eq(materials.id, bom.materialId))
      .limit(1);

    if (!material) {
      throw new Error(`MATERIAL_NOT_FOUND: 原材料 ID ${bom.materialId} 不存在`);
    }

    const currentStock = parseFloat(material.stockQty as string);
    const shortageQty = Math.max(0, requiredQty - currentStock);
    const status: "SUFFICIENT" | "SHORTAGE" = shortageQty > 0 ? "SHORTAGE" : "SUFFICIENT";

    let purchaseOrderId: number | undefined;
    let purchaseOrderNo: string | undefined;

    // 4. 库存不足时，自动生成 DRAFT 采购建议单
    if (status === "SHORTAGE") {
      purchaseOrderNo = `PO-${Date.now()}-${bom.materialId}`;
      const [inserted] = await db.insert(purchaseOrders).values({
        poNo: purchaseOrderNo,
        supplierId: material.supplierId ?? undefined,
        supplierName: material.supplierId ? "待确认供应商" : undefined,
        materialId: bom.materialId,
        materialName: material.materialName,
        requiredQty: shortageQty.toFixed(3),
        unit: bom.unit,
        unitPrice: material.unitCost,
        totalAmount: (shortageQty * parseFloat(material.unitCost as string)).toFixed(2),
        status: "DRAFT",
        triggerSource: `MRP-${input.orderNo}`,
        notes: `MRP 自动生成：订单 ${input.orderNo} 需 ${requiredQty.toFixed(3)} ${bom.unit}，库存仅 ${currentStock.toFixed(3)} ${bom.unit}，短缺 ${shortageQty.toFixed(3)} ${bom.unit}`,
      });
      purchaseOrderId = Number((inserted as any).insertId);
      purchaseOrdersCreated++;
    }

    lines.push({
      materialId: bom.materialId,
      materialCode: material.materialCode,
      materialName: material.materialName,
      unit: bom.unit,
      requiredQty: parseFloat(requiredQty.toFixed(3)),
      currentStock,
      shortageQty: parseFloat(shortageQty.toFixed(3)),
      purchaseOrderId,
      purchaseOrderNo,
      status,
    });
  }

  return {
    orderNo: input.orderNo,
    productCode: input.productCode,
    productName: input.productName,
    requiredQty: input.requiredQty,
    lines,
    totalShortageItems: lines.filter((l) => l.status === "SHORTAGE").length,
    purchaseOrdersCreated,
    calculatedAt: new Date(),
  };
}

/**
 * 注册原材料（或更新库存）
 */
export async function upsertMaterial(data: {
  materialCode: string;
  materialName: string;
  unit: string;
  stockQty: number;
  safetyStock?: number;
  unitCost?: number;
  supplierId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB_UNAVAILABLE');
  const [existing] = await db
    .select()
    .from(materials)
    .where(eq(materials.materialCode, data.materialCode))
    .limit(1);

  if (existing) {
    await db
      .update(materials)
      .set({
        stockQty: data.stockQty.toFixed(3),
        safetyStock: (data.safetyStock ?? parseFloat(existing.safetyStock as string)).toFixed(3),
        unitCost: (data.unitCost ?? parseFloat(existing.unitCost as string)).toFixed(4),
      })
      .where(eq(materials.materialCode, data.materialCode));
    return existing.id;
  }

  const [result] = await db.insert(materials).values({
    materialCode: data.materialCode,
    materialName: data.materialName,
    unit: data.unit,
    stockQty: data.stockQty.toFixed(3),
    safetyStock: (data.safetyStock ?? 0).toFixed(3),
    unitCost: (data.unitCost ?? 0).toFixed(4),
    supplierId: data.supplierId,
  });
  return Number((result as any).insertId);
}

/**
 * 注册 BOM 条目
 */
export async function upsertBomItem(data: {
  productCode: string;
  productName: string;
  materialId: number;
  materialName: string;
  qtyPerUnit: number;
  unit: string;
  wasteRate?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB_UNAVAILABLE');
  const [result] = await db.insert(bomItems).values({
    productCode: data.productCode,
    productName: data.productName,
    materialId: data.materialId,
    materialName: data.materialName,
    qtyPerUnit: data.qtyPerUnit.toFixed(4),
    unit: data.unit,
    wasteRate: (data.wasteRate ?? 0).toFixed(4),
    isActive: true,
  });
  return Number((result as any).insertId);
}

/**
 * 查询采购建议列表
 */
export async function getDraftPurchaseOrders(): Promise<typeof purchaseOrders.$inferSelect[]> {
  const db = await getDb();
  if (!db) throw new Error('DB_UNAVAILABLE');
  return db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.status, "DRAFT"));
}
