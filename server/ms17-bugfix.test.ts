import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const routersPath = path.resolve(__dirname, "routers.ts");
const routersCode = fs.readFileSync(routersPath, "utf-8");

const salesCreateOrderPath = path.resolve(
  __dirname,
  "../client/src/pages/SalesCreateOrder.tsx"
);
const salesCreateOrderCode = fs.readFileSync(salesCreateOrderPath, "utf-8");

const customerServicePath = path.resolve(__dirname, "customer-service.ts");
const customerServiceCode = fs.readFileSync(customerServicePath, "utf-8");

describe("MS17: 代客下单数据联动 + 客户管理数据隔离加固", () => {
  // ─── 一、代客下单页面修复 ───────────────────────────────

  it("代客下单页面不再包含快捷创建客户按钮", () => {
    // 不应包含 showCreateCustomer 状态
    expect(salesCreateOrderCode).not.toContain("showCreateCustomer");
    // 不应包含 createCustomer mutation
    expect(salesCreateOrderCode).not.toContain("salesOrder.createCustomer");
    // 不应包含 handleCreateCustomer 函数
    expect(salesCreateOrderCode).not.toContain("handleCreateCustomer");
  });

  it("代客下单页面使用 customerMgmt.listForOrder 获取客户数据", () => {
    expect(salesCreateOrderCode).toContain("customerMgmt.listForOrder");
    // 不再使用旧的 salesOrder.getCustomers
    expect(salesCreateOrderCode).not.toContain("salesOrder.getCustomers");
  });

  it("代客下单页面包含无客户时的引导提示", () => {
    // 应该有引导用户去客户管理模块的提示
    expect(salesCreateOrderCode).toContain("客户管理");
  });

  // ─── 二、客户管理数据隔离 ───────────────────────────────

  it("customerMgmt.list 路由包含角色判断和 createdBy 数据隔离", () => {
    // 查找 customerMgmt.list 路由附近的代码
    const listRouteIdx = routersCode.indexOf("customerMgmt: router({");
    expect(listRouteIdx).toBeGreaterThan(-1);

    const listRouteCode = routersCode.substring(
      listRouteIdx,
      listRouteIdx + 1000
    );

    // 必须包含角色判断
    expect(listRouteCode).toContain("role === 'admin'");
    expect(listRouteCode).toContain("role === 'finance'");
    // 必须包含 createdBy 传递
    expect(listRouteCode).toContain("createdBy");
  });

  it("customerMgmt.listForOrder 路由包含数据隔离", () => {
    const listForOrderIdx = routersCode.indexOf("listForOrder:");
    expect(listForOrderIdx).toBeGreaterThan(-1);

    const listForOrderCode = routersCode.substring(
      listForOrderIdx,
      listForOrderIdx + 800
    );

    // 必须包含角色判断
    expect(listForOrderCode).toContain("role === 'admin'");
    expect(listForOrderCode).toContain("createdBy");
  });

  it("customer-service.ts listCustomers 函数支持 createdBy 过滤", () => {
    expect(customerServiceCode).toContain("createdBy");
    // 应该有 WHERE 条件
    expect(customerServiceCode).toContain(
      "eq(customers.createdBy, params.createdBy)"
    );
  });

  it("customer-service.ts listCustomersForOrder 仅返回已授信的活跃客户", () => {
    // 必须包含 creditLimit > 0 的过滤
    expect(customerServiceCode).toContain("creditLimit");
    // 必须包含 status = ACTIVE 的过滤
    expect(customerServiceCode).toContain("ACTIVE");
    // 必须包含 > 0 的判断
    expect(customerServiceCode).toContain("> 0");
  });

  // ─── 三、后端路由权限验证 ───────────────────────────────

  it("customerMgmt.list 使用 roleProcedure 限制访问角色", () => {
    const listRouteIdx = routersCode.indexOf("customerMgmt: router({");
    const listRouteCode = routersCode.substring(
      listRouteIdx,
      listRouteIdx + 500
    );
    expect(listRouteCode).toContain("roleProcedure");
  });

  it("customerMgmt.create 记录 createdBy 信息", () => {
    const createIdx = routersCode.indexOf("customerMgmt: router({");
    const createCode = routersCode.substring(createIdx, createIdx + 3000);
    expect(createCode).toContain("createdBy: ctx.user?.id");
    expect(createCode).toContain("createdByName");
  });
});
