/**
 * MS14 测试：客户管理 CRUD + 字段级权限 + 费用报销修复
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string = "admin", userId: number = 1, name: string = "Test User"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-${role}-${userId}`,
    email: `${role}@test.com`,
    name,
    loginMethod: "manus",
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ─── 客户管理模块 ──────────────────────────────────────────────────────────────

describe("customerMgmt", () => {
  it("admin can create a customer with auto-generated code", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.customerMgmt.create({
      name: "测试企业客户",
      customerType: "ENTERPRISE",
      contactName: "张三",
      contactPhone: "13800138000",
    });
    expect(result).toBeDefined();
    expect(result.customerCode).toMatch(/^ENT-\d{4}$/);
    expect(result.name).toBe("测试企业客户");
    expect(result.customerType).toBe("ENTERPRISE");
  });

  it("sales can create a customer", async () => {
    const caller = appRouter.createCaller(createContext("sales", 2, "Sales Rep"));
    const result = await caller.customerMgmt.create({
      name: "渠道客户A",
      customerType: "CHANNEL",
      contactPhone: "13900139000",
    });
    expect(result).toBeDefined();
    expect(result.customerCode).toMatch(/^CH-\d{4}$/);
    expect(result.name).toBe("渠道客户A");
  });

  it("admin can list customers", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.customerMgmt.list({
      page: 1,
      pageSize: 20,
    });
    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("admin can update customer finance info", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    // 先创建一个客户
    const customer = await caller.customerMgmt.create({
      name: "财务测试客户",
      customerType: "INDIVIDUAL",
      contactPhone: "13700137000",
    });
    // 更新财务信息
    const updated = await caller.customerMgmt.updateFinance({
      id: customer.id,
      creditLimit: 50000,
      discountRate: 0.95,
    });
    expect(updated).toBeDefined();
    expect(Number(updated.creditLimit)).toBe(50000);
    expect(Number(updated.discountRate)).toBe(0.95);
  });

  it("sales CANNOT update customer finance info", async () => {
    const adminCaller = appRouter.createCaller(createContext("admin"));
    const customer = await adminCaller.customerMgmt.create({
      name: "权限测试客户",
      customerType: "RESTAURANT",
      contactPhone: "13600136000",
    });

    const salesCaller = appRouter.createCaller(createContext("sales", 3));
    await expect(
      salesCaller.customerMgmt.updateFinance({
        id: customer.id,
        creditLimit: 99999,
      })
    ).rejects.toThrow();
  });

  it("finance can update customer finance info", async () => {
    const adminCaller = appRouter.createCaller(createContext("admin"));
    const customer = await adminCaller.customerMgmt.create({
      name: "财务角色测试",
      customerType: "WHOLESALE",
      contactPhone: "13500135000",
    });

    const financeCaller = appRouter.createCaller(createContext("finance", 4));
    const updated = await financeCaller.customerMgmt.updateFinance({
      id: customer.id,
      creditLimit: 30000,
      discountRate: 0.9,
    });
    expect(Number(updated.creditLimit)).toBe(30000);
    expect(Number(updated.discountRate)).toBe(0.9);
  });

  it("admin can deactivate a customer", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const customer = await caller.customerMgmt.create({
      name: "待停用客户",
      customerType: "OTHER",
      contactPhone: "13400134000",
    });
    const result = await caller.customerMgmt.deactivate({ id: customer.id });
    expect(result.success).toBe(true);
  });

  it("customer code prefix matches customer type", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    const types = [
      { type: "ENTERPRISE", prefix: "ENT" },
      { type: "INDIVIDUAL", prefix: "IND" },
      { type: "CHANNEL", prefix: "CH" },
      { type: "RESTAURANT", prefix: "RST" },
      { type: "FACTORY", prefix: "FAC" },
    ];

    for (const { type, prefix } of types) {
      const result = await caller.customerMgmt.create({
        name: `编号测试-${type}`,
        customerType: type as any,
        contactPhone: "10000000000",
      });
      expect(result.customerCode.startsWith(prefix + "-")).toBe(true);
    }
  });
});

// ─── 费用报销模块 ──────────────────────────────────────────────────────────────

describe("expenses", () => {
  it("submit requires associatedCustomerName (non-empty)", async () => {
    const caller = appRouter.createCaller(createContext("sales", 10, "Sales A"));
    await expect(
      caller.expenses.submit({
        associatedCustomerName: "",
        expenseType: "TRAVEL",
        amount: 100,
        description: "出差报销",
        expenseDate: "2026-03-30",
      })
    ).rejects.toThrow();
  });

  it("sales can submit expense with customer name", async () => {
    const caller = appRouter.createCaller(createContext("sales", 10, "Sales A"));
    const result = await caller.expenses.submit({
      associatedCustomerName: "测试客户",
      expenseType: "ENTERTAINMENT",
      amount: 500,
      description: "客户招待费",
      expenseDate: "2026-03-30",
    });
    expect(result).toBeDefined();
  });

  it("sales can only see their own expenses", async () => {
    const salesCaller = appRouter.createCaller(createContext("sales", 10, "Sales A"));
    const result = await salesCaller.expenses.list({ page: 1, pageSize: 50 });
    expect(result).toBeDefined();
    // 所有记录的 submittedBy 都应该是当前用户
    for (const item of result.items) {
      expect(item.submittedBy).toBe(10);
    }
  });

  it("admin can see all expenses", async () => {
    const adminCaller = appRouter.createCaller(createContext("admin", 1));
    const result = await adminCaller.expenses.list({ page: 1, pageSize: 50 });
    expect(result).toBeDefined();
    // admin 不受 submittedBy 限制
    expect(Array.isArray(result.items)).toBe(true);
  });
});
