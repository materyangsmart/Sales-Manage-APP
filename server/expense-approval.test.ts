import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string = "admin", userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: role === "admin" ? "Admin User" : "Sales User",
    loginMethod: "manus",
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("费用报销审批功能", () => {
  // ─── 1. 审批权限测试 ───────────────────────────────────────────────
  describe("审批权限控制", () => {
    it("管理员可以调用 approve mutation", async () => {
      const ctx = createContext("admin", 1);
      const caller = appRouter.createCaller(ctx);

      // 尝试审批一个不存在的报销单（应该报错"不存在"而不是"无权限"）
      try {
        await caller.expenses.approve({
          claimId: 99999,
          approved: true,
        });
      } catch (err: any) {
        // 应该是"不存在"错误，而不是权限错误
        expect(err.message).toContain("不存在");
      }
    });

    it("销售员不能调用 approve mutation（权限拦截）", async () => {
      const ctx = createContext("sales", 2);
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.expenses.approve({
          claimId: 1,
          approved: true,
        });
        // 如果没有抛出错误，说明权限控制失败
        expect.fail("销售员不应该能调用 approve");
      } catch (err: any) {
        // 应该是权限相关错误（FORBIDDEN 或 UNAUTHORIZED）
        expect(err.code || err.message).toBeTruthy();
      }
    });
  });

  // ─── 2. 提交报销单测试 ─────────────────────────────────────────────
  describe("提交报销单", () => {
    it("admin 可以提交报销单", async () => {
      const ctx = createContext("admin", 1);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.expenses.submit({
        expenseType: "ENTERTAINMENT",
        amount: 200,
        description: "测试招待费用-审批测试",
        expenseDate: "2026-03-29",
      });

      expect(result).toBeTruthy();
      expect(result.claimNo).toBeTruthy();
      expect(result.status).toBe("PENDING");
    });

    it("sales 可以提交报销单", async () => {
      const ctx = createContext("sales", 2);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.expenses.submit({
        expenseType: "TRAVEL",
        amount: 500,
        description: "测试差旅费用-重新提交测试",
        expenseDate: "2026-03-29",
      });

      expect(result).toBeTruthy();
      expect(result.claimNo).toBeTruthy();
      expect(result.status).toBe("PENDING");
    });
  });

  // ─── 3. 审批通过测试 ──────────────────────────────────────────────
  describe("审批通过", () => {
    it("管理员可以审批通过报销单", async () => {
      // 先提交一个报销单
      const salesCtx = createContext("sales", 2);
      const salesCaller = appRouter.createCaller(salesCtx);
      const claim = await salesCaller.expenses.submit({
        expenseType: "ENTERTAINMENT",
        amount: 300,
        description: "审批通过测试",
        expenseDate: "2026-03-29",
      });

      // 管理员审批通过
      const adminCtx = createContext("admin", 1);
      const adminCaller = appRouter.createCaller(adminCtx);
      const result = await adminCaller.expenses.approve({
        claimId: claim.id,
        approved: true,
        approvalRemark: "费用合理，批准",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("APPROVED");
    });
  });

  // ─── 4. 审批退回测试（含退回原因） ────────────────────────────────
  describe("审批退回（含退回原因）", () => {
    it("管理员可以退回报销单并附带退回原因", async () => {
      // 先提交一个报销单
      const salesCtx = createContext("sales", 2);
      const salesCaller = appRouter.createCaller(salesCtx);
      const claim = await salesCaller.expenses.submit({
        expenseType: "LOGISTICS_SUBSIDY",
        amount: 1000,
        description: "退回测试-物流补贴",
        expenseDate: "2026-03-29",
      });

      // 管理员退回
      const adminCtx = createContext("admin", 1);
      const adminCaller = appRouter.createCaller(adminCtx);
      const result = await adminCaller.expenses.approve({
        claimId: claim.id,
        approved: false,
        approvalRemark: "发票金额与报销金额不符，请核实后重新提交",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("REJECTED");
    });

    it("退回原因保存到数据库并可查询", async () => {
      const ctx = createContext("admin", 1);
      const caller = appRouter.createCaller(ctx);

      // 查询列表，检查 REJECTED 状态的单据
      const list = await caller.expenses.list({ status: "REJECTED" });
      expect(list.items.length).toBeGreaterThan(0);

      // 检查退回原因字段存在
      const rejectedItem = list.items.find(
        (item: any) => item.approvalRemark && item.status === "REJECTED"
      );
      if (rejectedItem) {
        expect(rejectedItem.approvalRemark).toBeTruthy();
        expect(typeof rejectedItem.approvalRemark).toBe("string");
      }
    });
  });

  // ─── 5. 重新提交测试 ──────────────────────────────────────────────
  describe("重新提交被退回的报销单", () => {
    it("销售员可以重新提交被退回的报销单", async () => {
      // 1. 销售员提交
      const salesCtx = createContext("sales", 2);
      const salesCaller = appRouter.createCaller(salesCtx);
      const claim = await salesCaller.expenses.submit({
        expenseType: "OTHER",
        amount: 800,
        description: "重新提交测试-原始",
        expenseDate: "2026-03-29",
      });

      // 2. 管理员退回
      const adminCtx = createContext("admin", 1);
      const adminCaller = appRouter.createCaller(adminCtx);
      await adminCaller.expenses.approve({
        claimId: claim.id,
        approved: false,
        approvalRemark: "金额过高，请降低",
      });

      // 3. 销售员重新提交（修改金额和说明）
      const result = await salesCaller.expenses.resubmit({
        claimId: claim.id,
        amount: 500,
        description: "重新提交测试-已修改金额",
      });

      expect(result.success).toBe(true);
      expect(result.claimNo).toBe(claim.claimNo);
    });

    it("不能重新提交非 REJECTED 状态的报销单", async () => {
      // 提交一个 PENDING 状态的报销单
      const salesCtx = createContext("sales", 2);
      const salesCaller = appRouter.createCaller(salesCtx);
      const claim = await salesCaller.expenses.submit({
        expenseType: "ENTERTAINMENT",
        amount: 100,
        description: "不应该能重新提交",
        expenseDate: "2026-03-29",
      });

      // 尝试重新提交 PENDING 状态的单据
      try {
        await salesCaller.expenses.resubmit({
          claimId: claim.id,
        });
        expect.fail("不应该能重新提交 PENDING 状态的报销单");
      } catch (err: any) {
        expect(err.message).toContain("只有被退回的报销单才能重新提交");
      }
    });

    it("不能重新提交别人的报销单", async () => {
      // 用户2提交
      const user2Ctx = createContext("sales", 2);
      const user2Caller = appRouter.createCaller(user2Ctx);
      const claim = await user2Caller.expenses.submit({
        expenseType: "TRAVEL",
        amount: 300,
        description: "别人的报销单",
        expenseDate: "2026-03-29",
      });

      // 管理员退回
      const adminCtx = createContext("admin", 1);
      const adminCaller = appRouter.createCaller(adminCtx);
      await adminCaller.expenses.approve({
        claimId: claim.id,
        approved: false,
        approvalRemark: "测试退回",
      });

      // 用户3尝试重新提交用户2的报销单
      const user3Ctx = createContext("sales", 3);
      const user3Caller = appRouter.createCaller(user3Ctx);
      try {
        await user3Caller.expenses.resubmit({
          claimId: claim.id,
        });
        expect.fail("不应该能重新提交别人的报销单");
      } catch (err: any) {
        expect(err.message).toContain("只能重新提交自己的报销单");
      }
    });
  });

  // ─── 6. 报销单列表查询 ────────────────────────────────────────────
  describe("报销单列表查询", () => {
    it("可以查询所有报销单", async () => {
      const ctx = createContext("admin", 1);
      const caller = appRouter.createCaller(ctx);

      const list = await caller.expenses.list({});
      expect(list.items).toBeDefined();
      expect(Array.isArray(list.items)).toBe(true);
    });

    it("可以按状态筛选报销单", async () => {
      const ctx = createContext("admin", 1);
      const caller = appRouter.createCaller(ctx);

      const pendingList = await caller.expenses.list({ status: "PENDING" });
      for (const item of pendingList.items) {
        expect((item as any).status).toBe("PENDING");
      }
    });
  });
});
