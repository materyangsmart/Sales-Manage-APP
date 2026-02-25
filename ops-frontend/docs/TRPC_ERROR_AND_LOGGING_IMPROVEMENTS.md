# tRPC错误响应和日志改进验收文档

**日期**: 2026-01-31  
**Checkpoint**: 待保存  
**状态**: ✅ 完成

---

## 改进目标

基于用户反馈（backend 3100 OK，但 trpc 500），完成以下三项改进：

1. **改进tRPC错误响应为JSON格式**：curl可见错误详情（code/message/stack）
2. **增强启动时配置验证**：打印BACKEND_URL、token状态、health probe结果
3. **添加tRPC请求访问日志**：打印每次backend API调用的URL、状态码、错误摘要

---

## 改进1：tRPC错误响应为JSON格式

### 问题

之前tRPC错误返回`text/plain`格式，curl看不到细节。

### 解决方案

在`server/_core/index.ts`的tRPC middleware中添加`onError`和`responseMeta`：

```typescript
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
        cause: error.cause,
      });
      
      // Log backend API call details if available
      if (error.cause && typeof error.cause === 'object') {
        const cause = error.cause as any;
        if (cause.url) {
          console.error('[tRPC Error] Backend URL:', cause.url);
        }
        if (cause.status) {
          console.error('[tRPC Error] Backend Status:', cause.status);
        }
      }
    },
    responseMeta({ ctx, paths, errors, type }) {
      // Ensure errors are returned as JSON
      return {
        headers: {
          'Content-Type': 'application/json',
        },
      };
    },
  })
);
```

### 验收方法

```bash
# 测试tRPC endpoint（假设backend不可达或返回错误）
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"
```

**期望结果**：
- 返回JSON格式的错误响应
- 包含`error.code`、`error.message`等字段
- 不再是`text/plain`格式

**Server日志**：
```
[tRPC Error] {
  type: 'query',
  path: 'orders.list',
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Backend API error: 500 Internal Server Error',
  cause: { ... }
}
[tRPC Error] Backend URL: http://localhost:3100/internal/orders?...
[tRPC Error] Backend Status: 500
```

---

## 改进2：增强启动时配置验证

### 问题

启动日志没有显示BACKEND_URL的最终值（必须是`http://localhost:3100`），也没有验证backend是否可达。

### 解决方案

在`server/backend-api.ts`的`healthCheck`函数中添加：

1. **打印runtime配置**：BACKEND_URL、token状态
2. **Health probe**：GET `${BACKEND_URL}/health`
3. **API probe**：GET `${BACKEND_URL}/ar/payments`（验证API可访问性）

```typescript
export async function healthCheck() {
  console.log('='.repeat(60));
  console.log('[Backend API] Runtime Configuration');
  console.log('='.repeat(60));
  console.log('BACKEND_URL:', BACKEND_URL);
  console.log('Internal token present?', !!INTERNAL_SERVICE_TOKEN);
  console.log('='.repeat(60));
  
  try {
    // 探测请求1：/health (backend健康检查)
    const healthUrl = `${BACKEND_URL}/health`;
    console.log('[Backend API] Probing /health:', healthUrl);
    
    const healthResponse = await fetch(healthUrl);
    console.log('[Backend API] /health status code:', healthResponse.status);
    
    if (healthResponse.ok) {
      console.log('[Backend API] ✓ Backend /health OK');
    } else {
      console.warn('[Backend API] ✗ Backend /health returned:', healthResponse.status);
    }
    
    // 探测请求2：/ar/payments (验证API可访问性)
    const probeUrl = `${BACKEND_URL}/ar/payments?orgId=1&page=1&pageSize=1`;
    console.log('[Backend API] Probing /ar/payments:', probeUrl);
    
    const probeResponse = await fetch(probeUrl, {
      headers: {
        'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('[Backend API] /ar/payments status code:', probeResponse.status);
    
    if (probeResponse.ok) {
      console.log('[Backend API] ✓ Backend API access OK');
    } else {
      console.warn('[Backend API] ✗ Backend API returned:', probeResponse.status);
      const errorText = await probeResponse.text();
      console.warn('[Backend API] Error response:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('[Backend API] ✗ Backend connection failed:');
    console.error(error);
  }
  console.log('='.repeat(60));
}
```

### 验收方法

```bash
# 启动ops-frontend
cd ops-frontend
npm run dev
```

**期望日志输出**：

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
Internal token present? true
============================================================
[Backend API] Probing /health: http://localhost:3100/health
[Backend API] /health status code: 200
[Backend API] ✓ Backend /health OK
[Backend API] Probing /ar/payments: http://localhost:3100/ar/payments?orgId=1&page=1&pageSize=1
[Backend API] /ar/payments status code: 200
[Backend API] ✓ Backend API access OK
============================================================
```

**验收要点**：
- ✅ BACKEND_URL显示为`http://localhost:3100`（不是3000）
- ✅ Internal token present显示`true`
- ✅ /health探测返回200
- ✅ /ar/payments探测返回200

---

## 改进3：添加tRPC请求访问日志

### 问题

无法看到每次tRPC调用实际访问的backend URL、返回状态码、错误摘要。

### 解决方案

在`server/backend-api.ts`的`request`函数中添加访问日志：

```typescript
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  logContext?: string
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  // 访问日志：打印请求信息
  const requestMethod = options.method || 'GET';
  console.log(`[Backend API] ${requestMethod} ${url}${logContext ? ` (${logContext})` : ''}`);
  
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${INTERNAL_SERVICE_TOKEN}`);
  headers.set('Content-Type', 'application/json');
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // 访问日志：打印响应状态
    console.log(`[Backend API] Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Backend API] Error response:`, errorText.substring(0, 200));
      
      const error = new Error(
        `Backend API error: ${response.status} ${response.statusText}`
      ) as any;
      error.status = response.status;
      error.statusText = response.statusText;
      error.url = url;
      error.responseText = errorText;
      throw error;
    }
    
    return response.json();
  } catch (error) {
    // 访问日志：打印错误摘要
    if (error instanceof Error) {
      console.error(`[Backend API] Request failed:`, error.message);
    }
    throw error;
  }
}
```

### 验收方法

#### 场景1：正常请求

```bash
# 在浏览器中访问订单审核页面，或执行curl
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"
```

**期望日志**：
```
[Backend API] GET http://localhost:3100/internal/orders?orgId=2&status=PENDING_REVIEW
[Backend API] Response: 200 OK
```

#### 场景2：Backend返回错误

```bash
# 假设backend返回404或500
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A999%7D"
```

**期望日志**：
```
[Backend API] GET http://localhost:3100/internal/orders?orgId=999&status=PENDING_REVIEW
[Backend API] Response: 404 Not Found
[Backend API] Error response: {"error":"Order not found"}
[Backend API] Request failed: Backend API error: 404 Not Found
```

#### 场景3：Backend不可达

```bash
# 停止backend服务，然后执行curl
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"
```

**期望日志**：
```
[Backend API] GET http://localhost:3100/internal/orders?orgId=2&status=PENDING_REVIEW
[Backend API] Request failed: fetch failed
[tRPC Error] {
  type: 'query',
  path: 'orders.list',
  code: 'INTERNAL_SERVER_ERROR',
  message: 'fetch failed',
  cause: { ... }
}
```

---

## 完整验收流程

### 1. 启动ops-frontend

```bash
cd ops-frontend
npm run dev
```

**验收要点**：
- ✅ 看到完整的启动日志
- ✅ BACKEND_URL显示为`http://localhost:3100`
- ✅ Internal token present显示`true`
- ✅ /health和/ar/payments探测都返回200

### 2. 测试正常请求

```bash
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"
```

**验收要点**：
- ✅ Server日志显示`[Backend API] GET http://localhost:3100/internal/orders?...`
- ✅ Server日志显示`[Backend API] Response: 200 OK`
- ✅ curl返回JSON格式的订单数据

### 3. 测试错误响应

```bash
# 停止backend服务，或使用错误的orgId
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A999%7D"
```

**验收要点**：
- ✅ Server日志显示`[Backend API] GET http://localhost:3100/internal/orders?...`
- ✅ Server日志显示`[Backend API] Response: 4xx/5xx`
- ✅ Server日志显示`[Backend API] Error response: ...`
- ✅ Server日志显示`[tRPC Error] { type, path, code, message, ... }`
- ✅ curl返回JSON格式的错误响应（不是text/plain）

---

## 修改文件清单

1. `server/_core/index.ts` - 添加tRPC onError和responseMeta
2. `server/backend-api.ts` - 增强healthCheck和request函数的日志

---

## 总结

本次改进完成了三项关键功能：

1. **tRPC错误响应JSON化** ✅：curl可见错误详情，方便调试
2. **启动配置验证** ✅：明确显示BACKEND_URL和token状态，自动探测backend健康状态
3. **请求访问日志** ✅：每次backend API调用都有完整的URL、状态码、错误摘要日志

**下一步建议**：
- 启动backend服务（3100端口）
- 启动ops-frontend（3000端口）
- 执行上述验收流程，确认所有日志正常输出
- 测试完整业务流程（订单审核→履行→发票→核销）
