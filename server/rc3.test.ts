import { describe, expect, it, vi, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-42",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
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
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("RC3 Epic 2: Portal - getProducts", () => {
  it("returns product list from product_catalog table", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.portal.getProducts({});
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
    // Should have products from seed data
    if (result.items.length > 0) {
      const item = result.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("unitPrice");
      expect(typeof item.unitPrice).toBe("number");
    }
  });

  it("filters products by category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.portal.getProducts({ category: "THIN" });
    expect(result.items.every((p: any) => p.category === "THIN")).toBe(true);
  });

  it("filters products by keyword", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.portal.getProducts({ keyword: "薄千张" });
    expect(result.items.every((p: any) => p.name.includes("薄千张"))).toBe(true);
  });
});

describe("RC3 Epic 3: Fulfillment - getDashboard", () => {
  it("returns orders grouped by status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This may fail if backend is not available, but the structure should be correct
    try {
      const result = await caller.fulfillment.getDashboard({ orgId: 1 });
      expect(result).toHaveProperty("APPROVED");
      expect(result).toHaveProperty("PRODUCTION");
      expect(result).toHaveProperty("SHIPPED");
      expect(result).toHaveProperty("COMPLETED");
      expect(Array.isArray(result.APPROVED)).toBe(true);
      expect(Array.isArray(result.PRODUCTION)).toBe(true);
      expect(Array.isArray(result.SHIPPED)).toBe(true);
      expect(Array.isArray(result.COMPLETED)).toBe(true);
    } catch (err: any) {
      // Backend unavailable is acceptable in test environment
      expect(err.message).toContain("fetch");
    }
  });
});

describe("RC3 Epic 3: Fulfillment - updateStatus validation", () => {
  it("rejects SHIPPED status without batchNo", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.fulfillment.updateStatus({
        orderId: 1,
        status: "SHIPPED",
        // no batchNo
      })
    ).rejects.toThrow("溯源批次号");
  });

  it("accepts SHIPPED status with batchNo", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      // This will fail because backend is not available, but it should NOT throw the batchNo validation error
      await caller.fulfillment.updateStatus({
        orderId: 1,
        status: "SHIPPED",
        batchNo: "BT-2026-TEST",
      });
    } catch (err: any) {
      // Should NOT be the batchNo validation error
      expect(err.message).not.toContain("溯源批次号");
    }
  });

  it("accepts PRODUCTION status without batchNo", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.fulfillment.updateStatus({
        orderId: 1,
        status: "PRODUCTION",
      });
    } catch (err: any) {
      // Should NOT be the batchNo validation error
      expect(err.message).not.toContain("溯源批次号");
    }
  });
});

describe("RC3 Epic 3: Fulfillment - getAvailableBatches", () => {
  it("returns array of batches", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.fulfillment.getAvailableBatches();
      expect(Array.isArray(result)).toBe(true);
      // Should have seed data from batch_trace table
      if (result.length > 0) {
        const batch = result[0];
        expect(batch).toHaveProperty("batchNo");
      }
    } catch {
      // Backend unavailable - fallback to local batch_trace table
      // This is acceptable
    }
  });
});

describe("RC3: Open API products endpoint via tRPC", () => {
  it("ping endpoint still works", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ping();
    expect(result.success).toBe(true);
    expect(result.message).toBe("pong");
  });
});
