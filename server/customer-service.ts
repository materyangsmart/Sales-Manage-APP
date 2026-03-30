/**
 * 客户管理服务 (Customer Management Service)
 * MS14 - 全新独立 CRUD + 编号自动生成 + 字段级权限
 */
import { eq, desc, and, like, sql, count } from "drizzle-orm";
import { getDb } from "./db";
import { customers, type InsertCustomer } from "../drizzle/schema";

// ============================================================
// 客户类型 → 编号前缀映射
// ============================================================
const TYPE_PREFIX: Record<string, string> = {
  ENTERPRISE: "ENT",
  INDIVIDUAL: "IND",
  CHANNEL: "CH",
  RESTAURANT: "RST",
  WHOLESALE: "WS",
  RETAIL: "RT",
  FACTORY: "FAC",
  OTHER: "OTH",
};

/**
 * 根据客户类型自动生成编号
 * 格式：{PREFIX}-{4位序号}，如 ENT-0001, CH-0012
 */
async function generateCustomerCode(customerType: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const prefix = TYPE_PREFIX[customerType] || "OTH";

  // 查询同类型最大编号
  const [result] = await db
    .select({ cnt: count() })
    .from(customers)
    .where(eq(customers.customerType, customerType as any));

  const nextSeq = (result?.cnt || 0) + 1;
  const seqStr = String(nextSeq).padStart(4, "0");
  return `${prefix}-${seqStr}`;
}

// ============================================================
// 创建客户（销售可调用，但不能设置财务字段）
// ============================================================
export async function createCustomer(params: {
  name: string;
  customerType: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  remark?: string;
  createdBy?: number;
  createdByName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const customerCode = await generateCustomerCode(params.customerType);

  const insertData: InsertCustomer = {
    customerCode,
    name: params.name,
    customerType: params.customerType as any,
    contactName: params.contactName || null,
    contactPhone: params.contactPhone || null,
    address: params.address || null,
    remark: params.remark || null,
    createdBy: params.createdBy || null,
    createdByName: params.createdByName || null,
    creditLimit: "0",
    usedCredit: "0",
    discountRate: "1.0000",
    status: "ACTIVE",
  };

  await db.insert(customers).values(insertData);

  // 返回刚创建的客户
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.customerCode, customerCode))
    .limit(1);

  console.log(`[Customer] 客户创建成功: ${customerCode} (${params.name}), 类型: ${params.customerType}`);
  return customer;
}

// ============================================================
// 更新客户基本信息（销售可调用）
// ============================================================
export async function updateCustomerBasic(params: {
  id: number;
  name?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  remark?: string;
  status?: "ACTIVE" | "INACTIVE";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, params.id))
    .limit(1);

  if (!existing) throw new Error(`客户 #${params.id} 不存在`);

  const updateData: any = {};
  if (params.name !== undefined) updateData.name = params.name;
  if (params.contactName !== undefined) updateData.contactName = params.contactName;
  if (params.contactPhone !== undefined) updateData.contactPhone = params.contactPhone;
  if (params.address !== undefined) updateData.address = params.address;
  if (params.remark !== undefined) updateData.remark = params.remark;
  if (params.status !== undefined) updateData.status = params.status;

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  await db.update(customers).set(updateData).where(eq(customers.id, params.id));

  const [updated] = await db.select().from(customers).where(eq(customers.id, params.id)).limit(1);
  return updated;
}

// ============================================================
// 更新客户财务信息（仅 admin/finance 可调用）
// ============================================================
export async function updateCustomerFinance(params: {
  id: number;
  creditLimit?: number;
  discountRate?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, params.id))
    .limit(1);

  if (!existing) throw new Error(`客户 #${params.id} 不存在`);

  const updateData: any = {};
  if (params.creditLimit !== undefined) updateData.creditLimit = String(params.creditLimit);
  if (params.discountRate !== undefined) updateData.discountRate = String(params.discountRate);

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  await db.update(customers).set(updateData).where(eq(customers.id, params.id));

  const [updated] = await db.select().from(customers).where(eq(customers.id, params.id)).limit(1);
  console.log(`[Customer] 客户 ${existing.customerCode} 财务信息更新: creditLimit=${params.creditLimit}, discountRate=${params.discountRate}`);
  return updated;
}

// ============================================================
// 查询客户列表（支持搜索、分页、类型过滤）
// ============================================================
export async function listCustomers(params?: {
  keyword?: string;
  customerType?: string;
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
  if (params?.keyword) {
    conditions.push(
      sql`(${customers.name} LIKE ${`%${params.keyword}%`} OR ${customers.customerCode} LIKE ${`%${params.keyword}%`} OR ${customers.contactPhone} LIKE ${`%${params.keyword}%`})`
    );
  }
  if (params?.customerType) {
    conditions.push(eq(customers.customerType, params.customerType as any));
  }
  if (params?.status) {
    conditions.push(eq(customers.status, params.status as any));
  }

  const whereClause = conditions.length > 0
    ? (conditions.length === 1 ? conditions[0] : and(...conditions))
    : undefined;

  // 查询总数
  const [countResult] = await db
    .select({ cnt: count() })
    .from(customers)
    .where(whereClause);

  const total = countResult?.cnt || 0;

  // 查询列表
  const items = await db
    .select()
    .from(customers)
    .where(whereClause)
    .orderBy(desc(customers.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total, page, pageSize };
}

// ============================================================
// 获取单个客户详情
// ============================================================
export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (!customer) throw new Error(`客户 #${id} 不存在`);
  return customer;
}

// ============================================================
// 删除客户（软删除：设为 INACTIVE）
// ============================================================
export async function deactivateCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (!existing) throw new Error(`客户 #${id} 不存在`);

  await db.update(customers).set({ status: "INACTIVE" }).where(eq(customers.id, id));
  return { success: true, customerCode: existing.customerCode };
}
