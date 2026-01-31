# P17-Blocker #1 解决方案

## 问题描述

用户报告：`GET http://localhost:5173/api/trpc/orders.list?...` 返回 500 ECONNREFUSED

## 根本原因

**误解架构**：用户以为项目使用独立的Vite dev server（5173端口），但实际使用的是**Vite middleware mode**（集成到Express）。

## 架构说明

### 当前架构：Vite middleware mode（架构A）

```
ops-frontend Node Server (port 3000)
├── Express app
│   ├── /api/oauth/callback → OAuth routes
│   ├── /api/trpc → tRPC middleware
│   └── /* → Vite middleware (HMR + SPA)
└── HTTP server
```

**关键代码**：

1. **server/_core/vite.ts**：
```typescript
const vite = await createViteServer({
  ...viteConfig,
  server: { middlewareMode: true, hmr: { server } },  // ← middleware mode
});
app.use(vite.middlewares);  // ← 集成到Express
```

2. **server/_core/index.ts**：
```typescript
// tRPC API
app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// Vite middleware
await setupVite(app, server);
```

3. **vite.config.ts**：
```typescript
// 没有配置 server.proxy
// 因为使用middleware mode，不需要proxy
```

## 解决方案

### 任务1：确认Vite proxy配置 ✅

**证据**：
- vite.config.ts中没有`server.proxy`配置
- server/_core/vite.ts使用`middlewareMode: true`
- 架构是A（tRPC handler在Node server，不是独立Vite）

### 任务2：确保tRPC server启动 ✅

**启动命令**：
```bash
npm run dev  # 启动Node server（集成Vite middleware）
```

**监听端口**：3000（可能动态分配3000-3019）

**探测命令**：
```bash
# 正确的访问地址
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"

# 错误的访问地址（用户之前使用的）
curl "http://localhost:5173/api/trpc/orders.list?..."  # ← 5173是独立Vite端口，不适用
```

### 任务3：添加proxy target启动日志 ✅

**修改**：server/_core/index.ts

**新增启动日志**：
```
============================================================
✓ ops-frontend Server running on http://localhost:3000/
============================================================
Architecture: Vite middleware mode (integrated with Express)
tRPC endpoint: http://localhost:3000/api/trpc
OAuth callback: http://localhost:3000/api/oauth/callback
Frontend: Vite HMR enabled
============================================================
[Backend API] Health Check
[Backend API] BACKEND_URL: http://localhost:3000
[Backend API] Token configured: true
[Backend API] Probing: http://localhost:3000/ar/payments?orgId=1&page=1&pageSize=1
[Backend API] Probe result: 200 OK
[Backend API] ✓ Backend connection OK
============================================================
```

## 验收命令

### 1. 启动ops-frontend
```bash
cd ops-frontend
npm run dev
```

**期望输出**：
- 看到完整的启动日志（包含tRPC endpoint地址）
- Backend health check显示200 OK

### 2. 测试tRPC endpoint
```bash
# 测试orders.list
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%2C%22status%22%3A%22PENDING_REVIEW%22%7D"
```

**期望结果**：
- 状态码：200 OK（如果backend正常）
- 或者：明确的tRPC JSON错误（如果backend不可达或参数错误）
- **不再是**：500 ECONNREFUSED

### 3. 浏览器访问
```
http://localhost:3000
```

**期望结果**：
- 页面正常加载
- 订单审核页面能正常调用tRPC
- DevTools Network中看到`/api/trpc/*`请求

## 常见问题

### Q: 为什么不能访问localhost:5173？

A: 项目使用Vite middleware mode，不是独立的Vite dev server。所有请求都由Node server（3000端口）处理。

### Q: 如果想使用独立的Vite dev server怎么办？

A: 需要修改架构：
1. 在vite.config.ts中添加`server.proxy`配置
2. 将`/api/trpc`代理到Node server
3. 分别启动Node server和Vite dev server

但**不建议**这样做，当前的middleware mode更简单、更高效。

## 总结

- ✅ 任务1：确认Vite proxy配置（middleware mode，无需proxy）
- ✅ 任务2：确保tRPC server启动（npm run dev，端口3000）
- ✅ 任务3：添加proxy target启动日志（明确显示tRPC endpoint）
- ✅ 验收：curl http://localhost:3000/api/trpc/orders.list 不再500
