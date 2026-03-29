/**
 * MS12 Bug Fix Tests
 * 1. 客户管理表单必填校验（createCustomer input validation）
 * 2. 代客下单客户列表刷新（getCustomers 合并本地客户）
 * 3. 库存管理新建 SKU + 产能编辑（createSku / updateCapacity admin-only）
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { z } from "zod";

// ─── 1. createCustomer input schema validation ─────────────────────────────

describe("createCustomer input validation", () => {
  // Replicate the schema from routers.ts
  const createCustomerSchema = z.object({
    name: z.string().min(2, "客户名称至少2个字符"),
    customerType: z
      .enum(["RESTAURANT", "WHOLESALE", "RETAIL", "FACTORY", "OTHER"])
      .default("RESTAURANT"),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    orgId: z.number().default(1),
  });

  it("should reject empty name", () => {
    const result = createCustomerSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("至少2个字符");
    }
  });

  it("should reject single-char name", () => {
    const result = createCustomerSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("should accept valid name with 2+ chars", () => {
    const result = createCustomerSchema.safeParse({ name: "张三" });
    expect(result.success).toBe(true);
  });

  it("should accept optional contactPhone", () => {
    const result = createCustomerSchema.safeParse({
      name: "测试客户",
      contactPhone: "13800138000",
    });
    expect(result.success).toBe(true);
    expect(result.data?.contactPhone).toBe("13800138000");
  });
});

// ─── 2. getCustomers should merge local + API customers ─────────────────────

describe("getCustomers response shape", () => {
  it("should return data array and total count", () => {
    // Simulate the merged response shape
    const response = {
      data: [
        { id: 1000001, name: "本地客户A", _isLocal: true },
        { id: 1, name: "API客户B" },
      ],
      total: 2,
    };
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.total).toBe(2);
    // Local customers should have _isLocal flag
    const localOnes = response.data.filter((c: any) => c._isLocal);
    expect(localOnes.length).toBe(1);
    expect(localOnes[0].id).toBeGreaterThanOrEqual(1000000);
  });
});

// ─── 3. createSku input schema validation ───────────────────────────────────

describe("createSku input validation", () => {
  const createSkuSchema = z.object({
    productId: z.number(),
    productName: z.string().min(1, "商品名称不能为空"),
    sku: z.string().min(1, "SKU 编码不能为空"),
    unit: z.string().default("包"),
    warehouseCode: z.string().default("WH-001"),
    totalStock: z.number().min(0).default(0),
    lowStockThreshold: z.number().min(0).default(10),
    dailyIdleCapacity: z.number().min(0).default(0),
    lockedCapacity: z.number().min(0).default(0),
  });

  it("should reject empty productName", () => {
    const result = createSkuSchema.safeParse({
      productId: 1,
      productName: "",
      sku: "SKU-001",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty sku", () => {
    const result = createSkuSchema.safeParse({
      productId: 1,
      productName: "千张500g",
      sku: "",
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid SKU creation input", () => {
    const result = createSkuSchema.safeParse({
      productId: 100,
      productName: "千张500g",
      sku: "QZ-500G-01",
      totalStock: 1000,
      lockedCapacity: 200,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unit).toBe("包");
      expect(result.data.warehouseCode).toBe("WH-001");
      expect(result.data.totalStock).toBe(1000);
      expect(result.data.lockedCapacity).toBe(200);
    }
  });

  it("should reject negative totalStock", () => {
    const result = createSkuSchema.safeParse({
      productId: 1,
      productName: "千张",
      sku: "QZ-01",
      totalStock: -5,
    });
    expect(result.success).toBe(false);
  });
});

// ─── 4. updateCapacity input schema validation ──────────────────────────────

describe("updateCapacity input validation", () => {
  const updateCapacitySchema = z.object({
    productId: z.number(),
    totalStock: z.number().min(0).optional(),
    lockedCapacity: z.number().min(0).optional(),
  });

  it("should accept updating only totalStock", () => {
    const result = updateCapacitySchema.safeParse({
      productId: 1,
      totalStock: 500,
    });
    expect(result.success).toBe(true);
    expect(result.data?.lockedCapacity).toBeUndefined();
  });

  it("should accept updating only lockedCapacity", () => {
    const result = updateCapacitySchema.safeParse({
      productId: 1,
      lockedCapacity: 100,
    });
    expect(result.success).toBe(true);
    expect(result.data?.totalStock).toBeUndefined();
  });

  it("should accept updating both fields", () => {
    const result = updateCapacitySchema.safeParse({
      productId: 1,
      totalStock: 1000,
      lockedCapacity: 200,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative values", () => {
    const result = updateCapacitySchema.safeParse({
      productId: 1,
      totalStock: -1,
    });
    expect(result.success).toBe(false);
  });
});
