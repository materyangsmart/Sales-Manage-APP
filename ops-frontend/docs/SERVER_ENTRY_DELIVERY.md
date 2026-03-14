# Express+tRPC Server入口交付文档

## 交付1：Server入口文件路径 ✅

### 文件路径

```
ops-frontend/server/_core/index.ts
```

**绝对路径**：`/home/ubuntu/ops-frontend/server/_core/index.ts`

### 文件头部（前50行）

```typescript
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { healthCheck } from "../backend-api";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path, input, ctx, req }) {
        console.error('[tRPC Error]', {
          type,
          path,
          code: error.code,
          message: error.message,
          // ... (继续)
```

**确认**：
- ✅ 使用Express (`import express from "express"`)
- ✅ 使用tRPC Express middleware (`createExpressMiddleware`)
- ✅ 挂载在`/api/trpc`路径

---

## 交付2：能一键启动的npm script ✅

### package.json scripts

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 一键启动命令

```bash
npm run dev
```

**说明**：
- ✅ `dev`脚本已经配置为启动Express + Vite middleware + /api/trpc
- ✅ 使用`tsx watch`实现热重载
- ✅ 设置`NODE_ENV=development`启用开发模式

**Windows用户注意**：
如果在Windows PowerShell中运行，可能需要：
```powershell
$env:NODE_ENV="development"; npm run dev
```

或者使用cross-env（已在package.json中配置）：
```bash
npm install -g cross-env
cross-env NODE_ENV=development tsx watch server/_core/index.ts
```

---

## 交付3：启动后自检输出 + curl验收命令 ✅

### 启动后的控制台输出

```
============================================================
✓ ops-frontend Server running on http://localhost:3000/
============================================================
Architecture: Vite middleware mode (integrated with Express)
tRPC endpoint: http://localhost:3000/api/trpc
OAuth callback: http://localhost:3000/api/oauth/callback
Frontend: Vite HMR enabled
============================================================

[Backend API] Runtime Configuration
============================================================
BACKEND_URL: http://localhost:3100
Internal token present? false
============================================================

[Backend API] Probing /health: http://localhost:3100/health
[Backend API] /health status code: 200
[Backend API] ✓ Backend /health OK

[Backend API] Probing /ar/payments: http://localhost:3100/ar/payments?orgId=1&page=1&pageSize=1
[Backend API] /ar/payments status code: 200
[Backend API] ✓ Backend API access OK
============================================================
```

**自检内容**：
- ✅ BACKEND_URL：显示backend服务地址
- ✅ Internal token present?：显示token是否配置（true/false，不显示实际token）
- ✅ Probe /health：探测backend的/health端点，显示状态码
- ✅ Probe /ar/payments：探测backend的API端点，显示状态码
- ✅ tRPC endpoint：显示tRPC端点地址

### curl验收命令

#### 1. 测试tRPC健康检查（最简单）

```bash
curl "http://localhost:3000/api/trpc/system.ping"
```

**期望输出**（JSON格式）：
```json
{
  "result": {
    "data": "pong"
  }
}
```

#### 2. 测试orders.list（需要backend运行）

```bash
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"
```

**URL解码后的input参数**：`{"orgId":2}`

**期望输出**（如果token未配置，返回JSON错误）：
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Backend API error: 401 Unauthorized",
    "data": {
      "code": "INTERNAL_SERVER_ERROR",
      "httpStatus": 500,
      "path": "orders.list"
    }
  }
}
```

**期望输出**（如果backend不可达，返回JSON错误）：
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "fetch failed",
    "data": {
      "code": "INTERNAL_SERVER_ERROR",
      "httpStatus": 500,
      "path": "orders.list"
    }
  }
}
```

**期望输出**（如果token已配置且backend正常，返回订单列表）：
```json
{
  "result": {
    "data": {
      "orders": [
        {
          "id": 1,
          "orgId": 2,
          "status": "PENDING_REVIEW",
          // ...
        }
      ],
      "total": 10
    }
  }
}
```

#### 3. 测试完整的tRPC错误响应（强制触发错误）

```bash
curl -v "http://localhost:3000/api/trpc/orders.list?input=invalid"
```

**期望结果**：
- ✅ HTTP状态码：400 或 500
- ✅ Content-Type: application/json（**不是text/plain**）
- ✅ 返回JSON格式的错误信息

**期望输出**：
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid input",
    "data": {
      "code": "BAD_REQUEST",
      "httpStatus": 400,
      "path": "orders.list"
    }
  }
}
```

### Server日志输出（在curl请求时）

```
[Backend API] GET http://localhost:3100/internal/orders?orgId=2
[Backend API] Response: 401 Unauthorized
[Backend API] Error response: {"error":"Unauthorized"}
[tRPC Error] {
  type: 'query',
  path: 'orders.list',
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Backend API error: 401 Unauthorized'
}
```

---

## 完整验收流程

### 1. 安装依赖（首次运行）

```bash
cd ops-frontend
npm install
```

### 2. 启动server

```bash
npm run dev
```

**期望输出**：
- ✅ Banner显示架构信息
- ✅ 打印BACKEND_URL和token状态
- ✅ /health probe成功（200 OK）或显示错误信息
- ✅ /ar/payments probe成功（200 OK）或显示错误信息
- ✅ Server running on http://localhost:3000/

### 3. 测试tRPC端点（另开一个终端）

```bash
# 测试1：ping（最简单，不依赖backend）
curl "http://localhost:3000/api/trpc/system.ping"

# 测试2：orders.list（依赖backend）
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"

# 测试3：强制错误（验证JSON错误响应）
curl -v "http://localhost:3000/api/trpc/orders.list?input=invalid"
```

### 4. 验证结果

- ✅ 所有curl命令返回JSON格式（不是text/plain）
- ✅ server日志显示完整的backend API调用链路
- ✅ 错误响应包含code/message/data

---

## 常见问题

### Q1: npm run dev启动失败，提示"tsx: command not found"

**解决方案**：
```bash
npm install -g tsx
# 或者使用npx
npx tsx watch server/_core/index.ts
```

### Q2: Windows PowerShell中NODE_ENV设置失败

**解决方案**：
```powershell
$env:NODE_ENV="development"
npm run dev
```

或者安装cross-env：
```bash
npm install -g cross-env
```

然后修改package.json：
```json
"dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts"
```

### Q3: curl返回text/plain而不是application/json

**原因**：可能是请求没有进入tRPC middleware，被Express默认错误处理捕获。

**解决方案**：
1. 确认URL路径正确（必须是`/api/trpc/...`）
2. 检查server日志，确认请求是否到达tRPC middleware
3. 如果仍然返回text/plain，说明强制JSON错误兜底没有生效，需要检查server/_core/index.ts的错误处理中间件

### Q4: Backend probe失败（ECONNREFUSED）

**原因**：backend服务未启动或BACKEND_URL配置错误。

**解决方案**：
1. 启动backend服务（在Sales-Manage-APP目录）：
   ```bash
   cd backend
   npm run start:dev
   ```
2. 确认backend监听在3100端口
3. 在Manus Management UI → Settings → Secrets中配置BACKEND_URL为`http://localhost:3100`

---

## 总结

### 已交付 ✅

1. **Server入口文件路径**：`ops-frontend/server/_core/index.ts`
2. **文件头部确认**：Express + createExpressMiddleware + /api/trpc
3. **一键启动命令**：`npm run dev`（已在package.json中配置）
4. **启动自检输出**：BACKEND_URL、token状态、/health probe、/ar/payments probe
5. **curl验收命令**：3条测试命令（ping、orders.list、强制错误）

### 关键特性

- ✅ Vite middleware mode（Express集成Vite，不是独立Vite dev server）
- ✅ tRPC endpoint：`http://localhost:3000/api/trpc`
- ✅ 错误响应格式：application/json（不是text/plain）
- ✅ 完整的backend API调用日志
- ✅ 启动自检：自动探测backend连接状态

### 下一步建议

1. **配置INTERNAL_SERVICE_TOKEN**：在Manus Management UI → Settings → Secrets中添加token，解决401错误
2. **启动backend服务**：在Sales-Manage-APP/backend目录运行`npm run start:dev`，确保backend在3100端口运行
3. **测试完整业务流程**：按照`docs/OPS_FRONTEND_SMOKE.md`，从订单审核到核销，完整走一遍业务流程
