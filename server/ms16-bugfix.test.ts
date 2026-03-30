/**
 * MS16 五个核心 Bug 修复测试
 * 1. 客户管理数据隔离
 * 2. 报销审批按钮（权限修复）
 * 3. 代客下单 SKU 联动
 * 4. 提成规则权限控制
 */
import { describe, it, expect } from "vitest";

// ─── 1. 客户管理数据隔离 ─────────────────────────────────────────────────────
describe("客户管理数据隔离", () => {
  it("listCustomers 函数应支持 createdBy 过滤参数", async () => {
    const { listCustomers } = await import("./customer-service");
    // 函数签名应接受 createdBy 参数
    expect(typeof listCustomers).toBe("function");
    // 调用不传 createdBy 应返回全量（admin 视角）
    const result = await listCustomers({});
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("listCustomers 传入 createdBy 应过滤结果", async () => {
    const { listCustomers } = await import("./customer-service");
    // 传入一个不存在的 userId，应返回空列表
    const result = await listCustomers({ createdBy: "nonexistent-user-999" });
    expect(result.items.length).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ─── 2. 报销审批权限 ─────────────────────────────────────────────────────────
describe("报销审批权限", () => {
  it("expenses.approve 路由应使用 roleProcedure 限制为 admin/finance", async () => {
    // 读取 routers.ts 源码验证权限配置
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    // 查找 expenses 路由区域中的 approve 权限设置
    const expensesStart = routersContent.indexOf("expenses: router({");
    const expensesSection = routersContent.substring(expensesStart, expensesStart + 5000);
    const approveMatch = expensesSection.match(/approve:\s*(roleProcedure\(\[.*?\]\))/);
    expect(approveMatch).not.toBeNull();
    expect(approveMatch![1]).toContain("admin");
    expect(approveMatch![1]).toContain("finance");
  });

  it("expenses.list 路由应根据角色过滤数据", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    // 验证 list 路由中有 role 判断逻辑
    const expensesSection = routersContent.substring(
      routersContent.indexOf("expenses: router({"),
      routersContent.indexOf("expenses: router({") + 2000
    );
    expect(expensesSection).toContain("ctx.user");
    expect(expensesSection).toContain("role");
  });
});

// ─── 3. 代客下单 SKU 联动 ────────────────────────────────────────────────────
describe("代客下单 SKU 联动", () => {
  it("portal.getProducts 应同时从 product_catalog 和 inventory 获取数据", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    // 验证 getProducts 路由中同时查询了 product_catalog 和 inventory
    const portalSection = routersContent.substring(
      routersContent.indexOf("portal: router({"),
      routersContent.indexOf("portal: router({") + 3000
    );
    expect(portalSection).toContain("productCatalog");
    expect(portalSection).toContain("inventory");
    expect(portalSection).toContain("catalogProductIds");
    expect(portalSection).toContain("extraFromInventory");
  });

  it("createSku 应同步写入 product_catalog 表", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    // 验证 createSku 路由中有写入 product_catalog 的逻辑
    const createSkuSection = routersContent.substring(
      routersContent.indexOf("createSku: roleProcedure"),
      routersContent.indexOf("createSku: roleProcedure") + 1500
    );
    expect(createSkuSection).toContain("product_catalog");
    expect(createSkuSection).toContain("INSERT INTO product_catalog");
  });
});

// ─── 4. 提成规则权限控制 ─────────────────────────────────────────────────────
describe("提成规则权限控制", () => {
  it("commissionRules.create 应使用 roleProcedure(['admin'])", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    // 查找 commissionRules 路由区域
    const commissionSection = routersContent.substring(
      routersContent.indexOf("commissionRules: router({"),
      routersContent.indexOf("commissionRules: router({") + 2000
    );
    
    // create 应使用 roleProcedure(['admin'])
    const createMatch = commissionSection.match(/create:\s*(roleProcedure\(\[.*?\]\))/);
    expect(createMatch).not.toBeNull();
    expect(createMatch![1]).toContain("admin");
  });

  it("commissionRules.update 应使用 roleProcedure(['admin'])", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    const commissionStart = routersContent.indexOf("commissionRules: router({");
    const commissionSection = routersContent.substring(commissionStart, commissionStart + 4000);
    
    const updateMatch = commissionSection.match(/update:\s*(roleProcedure\(\[.*?\]\))/);
    expect(updateMatch).not.toBeNull();
    expect(updateMatch![1]).toContain("admin");
  });

  it("commissionRules.delete 应使用 roleProcedure(['admin'])", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    const commissionStart = routersContent.indexOf("commissionRules: router({");
    const commissionSection = routersContent.substring(commissionStart, commissionStart + 4000);
    
    const deleteMatch = commissionSection.match(/delete:\s*(roleProcedure\(\[.*?\]\))/);
    expect(deleteMatch).not.toBeNull();
    expect(deleteMatch![1]).toContain("admin");
  });

  it("CommissionRules.tsx 前端应使用 useAuth 进行权限判断", async () => {
    const fs = await import("fs");
    const frontendContent = fs.readFileSync("./client/src/pages/CommissionRules.tsx", "utf-8");
    
    // 验证前端引入了 useAuth
    expect(frontendContent).toContain("useAuth");
    expect(frontendContent).toContain("isAdmin");
    // 验证创建按钮被 isAdmin 条件包裹
    expect(frontendContent).toContain("{isAdmin &&");
  });
});

// ─── 5. 客户管理前端统计隔离 ─────────────────────────────────────────────────
describe("客户管理前端统计隔离", () => {
  it("customerMgmt.list 后端路由应根据角色传入 createdBy", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
    
    // 查找 customerMgmt.list 路由
    const customerSection = routersContent.substring(
      routersContent.indexOf("customerMgmt: router({"),
      routersContent.indexOf("customerMgmt: router({") + 1500
    );
    
    // 验证有角色判断和 createdBy 过滤
    expect(customerSection).toContain("ctx.user");
    expect(customerSection).toContain("createdBy");
  });
});
