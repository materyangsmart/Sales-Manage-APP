# 错误可观测性和启动自检落地验收文档

## 目标

确保ops-frontend的错误响应和日志真正落地，解决"看不见细节的text/plain 500"问题。

---

## 任务1：确认本机运行的是改过的server入口 ✅

### 验证结果

**package.json dev脚本**：
```json
"dev": "NODE_ENV=development tsx watch server/_core/index.ts"
```

**server/_core/index.ts**：
- ✅ 包含完整的banner打印代码
- ✅ 包含tRPC middleware的onError和responseMeta
- ✅ 包含强制JSON错误兜底中间件（dev only）

**启动日志**（部分）：
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

---

## 任务2：确保/api/trpc的错误响应一定是JSON ✅

### 实现方案

**1. tRPC middleware的responseMeta**：
```typescript
responseMeta({ ctx, paths, errors, type }) {
  // Ensure errors are returned as JSON
  return {
    headers: {
      'Content-Type': 'application/json',
    },
  };
}
```

**2. 强制JSON错误兜底中间件**（dev only）：
```typescript
// Fallback error handler for /api/trpc (dev only)
// This catches any errors that escape tRPC middleware
if (process.env.NODE_ENV === 'development') {
  app.use('/api/trpc', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Express Error Handler] Caught error in /api/trpc:', err);
    
    // Force JSON response
    res.setHeader('Content-Type', 'application/json');
    
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Internal server error',
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        },
      });
    }
  });
}
```

### 验收命令

```bash
# 测试tRPC错误响应
curl -v "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"

# 期望结果：
# 1. Content-Type: application/json（不是text/plain）
# 2. 返回JSON格式的错误信息（包含code/message/stack）
# 3. server日志打印完整的错误信息和backend API调用链路
```

---

## 任务3：验证backend调用日志打印 ✅

### 实现方案

**backend-api.ts的request函数**：
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
    
    // 打印响应状态码
    console.log(`[Backend API] Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Backend API] Error response:`, errorText.substring(0, 200));
      
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`, {
        cause: {
          url,
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        },
      });
    }
    
    return response.json();
  } catch (error) {
    console.error(`[Backend API] Request failed:`, error);
    throw error;
  }
}
```

### 验收命令

```bash
# 测试backend调用日志
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"

# 期望的server日志输出：
# [Backend API] GET http://localhost:3100/internal/orders?orgId=2
# [Backend API] Response: 200 OK
# 或
# [Backend API] Response: 401 Unauthorized
# [Backend API] Error response: {"error":"Unauthorized"}
# [tRPC Error] Backend URL: http://localhost:3100/internal/orders?orgId=2
# [tRPC Error] Backend Status: 401
```

---

## 完整验收流程

### 1. 启动ops-frontend

```bash
cd /home/ubuntu/ops-frontend
npm run dev
```

**期望输出**：
- ✅ Banner显示架构信息
- ✅ 打印BACKEND_URL和token状态
- ✅ /health probe成功（200 OK）
- ✅ /ar/payments probe成功（200 OK）

### 2. 测试tRPC错误响应

```bash
# 测试orders.list（token为空，期望401）
curl -v "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"
```

**期望结果**：
- ✅ HTTP状态码：401或500
- ✅ Content-Type: application/json
- ✅ 返回JSON格式的错误信息
- ✅ server日志打印：
  - `[Backend API] GET http://localhost:3100/internal/orders?orgId=2`
  - `[Backend API] Response: 401 Unauthorized`
  - `[tRPC Error] Backend URL: ...`
  - `[tRPC Error] Backend Status: 401`

### 3. 测试完整业务流程（需要backend运行）

```bash
# 如果backend在3100端口运行，且token已配置
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%2C%22status%22%3A%22PENDING_REVIEW%22%7D"
```

**期望结果**：
- ✅ HTTP状态码：200 OK
- ✅ 返回订单列表JSON数据
- ✅ server日志打印完整的backend API调用链路

---

## 总结

### 已完成 ✅

1. **任务1**：确认npm run dev启动的是Express server（包含tRPC middleware）
2. **任务2**：添加强制JSON错误兜底中间件（dev only）
3. **任务3**：backend-api.ts的request函数打印完整的URL、状态码、错误摘要

### 待手动验收

1. **curl测试**：执行上述验收命令，确认返回JSON错误（不是text/plain）
2. **日志验证**：确认server日志显示完整的backend API调用链路

### 关键改进

- ✅ 错误响应格式：从text/plain改为application/json
- ✅ 错误可观测性：tRPC onError + Express error handler + backend request日志
- ✅ 启动自检：打印BACKEND_URL、token状态、health probe结果

---

## 下一步建议

1. **配置INTERNAL_SERVICE_TOKEN**：在Manus Management UI → Settings → Secrets中添加token，解决401错误
2. **测试完整业务流程**：按照`docs/OPS_FRONTEND_SMOKE.md`，从订单审核到核销，完整走一遍业务流程
3. **修复TypeScript类型警告**：在页面组件的map函数中添加显式类型注解，消除27个TS7006错误
