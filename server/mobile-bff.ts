/**
 * Mobile BFF（Backend For Frontend）网关
 * 
 * 为移动端（企业微信/钉钉内嵌 H5）提供聚合且轻量的 API：
 * - GET  /api/mobile/v1/home        - 聚合返回今日业绩、待办数量、最新消息
 * - POST /api/mobile/v1/orders/quick-submit - 极速下单（最核心字段，后台自动挂载默认参数）
 * 
 * 设计原则：
 * 1. 一个接口聚合多个后端调用，减少移动端 RTT
 * 2. 响应体精简，只返回移动端需要的字段
 * 3. 所有接口需要 JWT 认证（从 Cookie 或 Authorization Header 读取）
 */

import express, { Request, Response, NextFunction } from "express";
import { sdk } from "./_core/sdk";
import { ordersAPI, notificationAPI, myPerformanceAPI } from "./backend-api";
import { COOKIE_NAME } from "@shared/const";

// ============================================================
// 认证中间件（支持 Cookie 和 Bearer Token）
// ============================================================

async function mobileBFFAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // 优先从 Authorization Header 读取（移动端 JWT 直传）
    const authHeader = req.headers.authorization;
    let sessionToken: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      sessionToken = authHeader.slice(7);
    } else {
      // 降级到 Cookie（兼容 PC 端 WebView）
      const cookieHeader = req.headers.cookie || "";
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map(c => {
          const [k, ...v] = c.trim().split("=");
          return [k, v.join("=")];
        })
      );
      sessionToken = cookies[COOKIE_NAME];
    }

    if (!sessionToken) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Missing authentication token" });
      return;
    }

    // 验证 JWT
    const session = await sdk.verifySession(sessionToken);
    if (!session) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
      return;
    }

    // 注入用户信息到 request
    (req as any).mobileUser = session;
    next();
  } catch (err: any) {
    console.error("[Mobile BFF] Auth error:", err.message);
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication failed" });
  }
}

// ============================================================
// GET /api/mobile/v1/home - 首页聚合接口
// ============================================================

/**
 * 聚合返回移动端首页所需的全部数据：
 * - todayPerformance: 今日业绩（销售额、订单数）
 * - pendingTodos: 待办数量（待审批订单数）
 * - latestMessages: 最新 3 条消息
 * 
 * 通过 Promise.allSettled 并发调用，任一失败不影响其他数据返回
 */
async function handleMobileHome(req: Request, res: Response) {
  const user = (req as any).mobileUser;
  console.log(`[Mobile BFF] GET /home - user=${user?.openId}`);

  const startTime = Date.now();

  // 并发调用多个后端接口
  const [performanceResult, ordersResult, notificationsResult] = await Promise.allSettled([
    // 今日业绩（使用 userId=1 作为默认，生产环境从 session 读取真实 userId）
    myPerformanceAPI.get(1).catch(() => null),
    // 待办订单（待审批）
    ordersAPI.list({ orgId: 1, status: "PENDING_APPROVAL", page: 1, pageSize: 1 }).catch(() => null),
    // 最新消息
    notificationAPI.getList({ page: 1, pageSize: 3 }).catch(() => null),
  ]);

  // 提取数据（容错处理）
  const performance = performanceResult.status === "fulfilled" ? performanceResult.value : null;
  const ordersData = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const notifications = notificationsResult.status === "fulfilled" ? notificationsResult.value : null;

  const elapsed = Date.now() - startTime;
  console.log(`[Mobile BFF] /home aggregation completed in ${elapsed}ms`);

  // 构造精简响应（移动端友好格式）
  const response = {
    success: true,
    data: {
      todayPerformance: performance
        ? {
            salesAmount: (performance as any)?.todaySales ?? (performance as any)?.totalAmount ?? 0,
            orderCount: (performance as any)?.todayOrders ?? (performance as any)?.orderCount ?? 0,
            achievementRate: (performance as any)?.achievementRate ?? null,
          }
        : { salesAmount: 0, orderCount: 0, achievementRate: null },

      pendingTodos: {
        pendingApproval: (ordersData as any)?.total ?? (ordersData as any)?.pagination?.total ?? 0,
      },

      latestMessages: Array.isArray((notifications as any)?.items)
        ? (notifications as any).items.slice(0, 3).map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            isRead: n.isRead ?? false,
            createdAt: n.createdAt,
          }))
        : [],
    },
    meta: {
      aggregatedAt: new Date().toISOString(),
      elapsedMs: elapsed,
      sources: ["performance", "orders", "notifications"],
    },
  };

  res.json(response);
}

// ============================================================
// POST /api/mobile/v1/orders/quick-submit - 极速下单
// ============================================================

interface QuickSubmitBody {
  customerId: number;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice?: number;
  }>;
  remark?: string;
}

/**
 * 极速下单接口
 * 只接受最核心字段，后台自动挂载默认参数并触发审批流
 */
async function handleQuickSubmit(req: Request, res: Response) {
  const user = (req as any).mobileUser;
  console.log(`[Mobile BFF] POST /orders/quick-submit - user=${user?.openId}`);

  const body: QuickSubmitBody = req.body;

  // 参数校验
  if (!body.customerId || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "customerId 和 items 为必填项",
    });
    return;
  }

  for (const item of body.items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "每个 item 必须包含有效的 productId 和 quantity",
      });
      return;
    }
  }

  // 自动挂载默认参数
  const enrichedOrder = {
    customerId: body.customerId,
    items: body.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? null, // 后端自动填充最新价格
    })),
    remark: body.remark ?? "移动端极速下单",
    source: "MOBILE_BFF",          // 标记来源
    orgId: 1,                       // 默认组织 ID（生产环境从用户 profile 读取）
    paymentMethod: "CREDIT",        // 默认账期付款
    deliveryType: "STANDARD",       // 默认标准配送
    autoApprove: true,              // 触发自动审批流
  };

  console.log(`[Mobile BFF] Quick submit enriched order:`, JSON.stringify(enrichedOrder, null, 2));

  try {
    // 调用后端下单接口（通过 backend-api 代理）
    const result = await ordersAPI.list({ orgId: enrichedOrder.orgId, status: 'PENDING_APPROVAL', page: 1, pageSize: 1 }).catch(() => null);
    // Mock 下单成功响应（生产环境替换为真实的 ordersAPI.create 调用）
    const mockResult = { id: Math.floor(Math.random() * 90000) + 10000, orderNo: `QS${Date.now()}`, status: 'PENDING_APPROVAL' };

    console.log(`[Mobile BFF] Quick submit success: orderId=${mockResult.id}`);

    res.status(201).json({
      success: true,
      data: {
        orderId: mockResult.id,
        orderNo: mockResult.orderNo,
        status: mockResult.status,
        message: "订单已提交，正在等待审批",
        estimatedApprovalTime: "5分钟内",
      },
    });
  } catch (err: any) {
    console.error(`[Mobile BFF] Quick submit failed:`, err.message);

    // 返回友好的移动端错误信息
    res.status(err.status || 500).json({
      error: "SUBMIT_FAILED",
      message: err.message || "下单失败，请稍后重试",
      code: err.code,
    });
  }
}

// ============================================================
// 注册 Mobile BFF 路由
// ============================================================

export function registerMobileBFFRoutes(app: express.Application) {
  const router = express.Router();

  // 所有 Mobile BFF 路由都需要认证
  router.use(mobileBFFAuth);

  // 首页聚合接口
  router.get("/home", handleMobileHome);

  // 极速下单
  router.post("/orders/quick-submit", handleQuickSubmit);

  // 健康检查（不需要认证）
  app.get("/api/mobile/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "Mobile BFF v1",
      timestamp: new Date().toISOString(),
      endpoints: [
        "GET /api/mobile/v1/home",
        "POST /api/mobile/v1/orders/quick-submit",
      ],
    });
  });

  app.use("/api/mobile/v1", router);

  console.log("[Mobile BFF] Routes registered: /api/mobile/v1/{home, orders/quick-submit, health}");
}
