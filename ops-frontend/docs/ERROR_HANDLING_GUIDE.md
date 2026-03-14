# 错误处理实施指南

**目标**: 确保ops-frontend页面能对401/403错误做正确提示，而不是"转圈"卡死。

---

## 统一错误处理Hook

已创建`client/src/hooks/useErrorHandler.ts`，提供统一的错误处理功能。

### 功能特性

1. **自动识别HTTP状态码**：401、403、404、500等
2. **友好的用户提示**：使用toast显示错误信息
3. **401错误自动跳转登录**：提供"重新登录"按钮
4. **403错误提示权限不足**：建议联系管理员
5. **避免空转圈**：错误发生时立即显示提示，不会一直loading

### API说明

```typescript
/**
 * 统一的错误处理hook
 * @param error - tRPC错误对象或普通Error
 * @param context - 错误上下文描述（例如："加载订单列表"）
 */
export function useErrorHandler(error: unknown, context?: string): void

/**
 * 从tRPC错误中提取HTTP状态码
 */
export function getErrorStatusCode(error: unknown): number | undefined

/**
 * 判断是否为认证错误（401/403）
 */
export function isAuthError(error: unknown): boolean

/**
 * 判断是否为网络错误
 */
export function isNetworkError(error: unknown): boolean
```

---

## 使用方法

### 1. 在页面组件中导入

```typescript
import { useErrorHandler } from "@/hooks/useErrorHandler";
```

### 2. 处理查询错误（useQuery）

```typescript
// 查询订单列表
const { data, isLoading, error, refetch } = trpc.orders.list.useQuery({
  orgId: 2,
  status: "PENDING_REVIEW",
});

// 统一错误处理
useErrorHandler(error, "加载订单列表");
```

### 3. 处理mutation错误（useMutation）

```typescript
// 批准订单mutation
const approveMutation = trpc.orders.approve.useMutation({
  onSuccess: () => {
    toast.success("订单已批准");
    refetch();
  },
  onError: () => {
    // 错误处理由useErrorHandler统一处理
    // 不需要在这里写toast.error
  },
});

// 统一错误处理
useErrorHandler(approveMutation.error, "批准订单");
```

---

## 已实现的页面

### OrderReview.tsx ✅

**修改内容**:
1. 导入`useErrorHandler`
2. 在`trpc.orders.list.useQuery`中添加`error: listError`
3. 添加`useErrorHandler(listError, "加载订单列表")`
4. 在`approveMutation`和`rejectMutation`的`onError`中移除`toast.error`
5. 添加`useErrorHandler(approveMutation.error, "批准订单")`
6. 添加`useErrorHandler(rejectMutation.error, "拒绝订单")`

**效果**:
- 401错误：显示"需要登录"toast，提供"重新登录"按钮
- 403错误：显示"权限不足"toast
- 其他错误：显示具体错误信息
- 不会一直转圈

---

## 待实现的页面

### OrderFulfill.tsx

**需要修改的地方**:

```typescript
// 1. 导入hook
import { useErrorHandler } from "@/hooks/useErrorHandler";

// 2. 查询错误处理
const { data, isLoading, error, refetch } = trpc.orders.list.useQuery({
  orgId: 2,
  status: "APPROVED",
});
useErrorHandler(error, "加载订单列表");

// 3. Mutation错误处理
const fulfillMutation = trpc.orders.fulfill.useMutation({
  onSuccess: () => {
    toast.success("订单履行成功");
    refetch();
  },
  onError: () => {
    // 移除toast.error，由useErrorHandler处理
  },
});
useErrorHandler(fulfillMutation.error, "履行订单");
```

### ARInvoices.tsx

**需要修改的地方**:

```typescript
// 1. 导入hook
import { useErrorHandler } from "@/hooks/useErrorHandler";

// 2. 查询错误处理
const { data, isLoading, error } = trpc.invoices.list.useQuery({
  orgId: 2,
  status: statusFilter,
  page: currentPage,
  pageSize: 20,
});
useErrorHandler(error, "加载发票列表");
```

### ARPayments.tsx

**需要修改的地方**:

```typescript
// 1. 导入hook
import { useErrorHandler } from "@/hooks/useErrorHandler";

// 2. 查询错误处理
const { data, isLoading, error } = trpc.payments.list.useQuery({
  orgId: 2,
  appliedStatus: statusFilter,
  page: currentPage,
  pageSize: 20,
});
useErrorHandler(error, "加载收款列表");
```

### ARApply.tsx

**需要修改的地方**:

```typescript
// 1. 导入hook
import { useErrorHandler } from "@/hooks/useErrorHandler";

// 2. 查询错误处理
const { data: paymentsData, isLoading: paymentsLoading, error: paymentsError } = trpc.payments.list.useQuery({
  orgId: 2,
  appliedStatus: "UNAPPLIED,PARTIAL",
});
useErrorHandler(paymentsError, "加载收款列表");

const { data: invoicesData, isLoading: invoicesLoading, error: invoicesError } = trpc.invoices.list.useQuery({
  orgId: 2,
  status: "OPEN",
});
useErrorHandler(invoicesError, "加载发票列表");

// 3. Mutation错误处理
const applyMutation = trpc.arApply.apply.useMutation({
  onSuccess: () => {
    toast.success("核销成功");
    // 重置表单
  },
  onError: () => {
    // 移除toast.error，由useErrorHandler处理
  },
});
useErrorHandler(applyMutation.error, "执行核销");
```

### AuditLogs.tsx

**需要修改的地方**:

```typescript
// 1. 导入hook
import { useErrorHandler } from "@/hooks/useErrorHandler";

// 2. 查询错误处理
const { data, isLoading, error, refetch } = trpc.auditLogs.list.useQuery({
  page: currentPage,
  pageSize: 20,
  resourceType: resourceTypeFilter || undefined,
  action: actionFilter || undefined,
});
useErrorHandler(error, "加载审计日志");

// 3. Trace错误处理
const traceMutation = trpc.auditLogs.trace.useMutation({
  onSuccess: (data) => {
    setTraceData(data);
    setShowTraceDialog(true);
  },
  onError: () => {
    // 移除toast.error，由useErrorHandler处理
  },
});
useErrorHandler(traceMutation.error, "追踪审计链路");
```

---

## 错误提示示例

### 401 Unauthorized（需要登录）

```
┌─────────────────────────────────────┐
│ ❌ 需要登录                          │
│                                     │
│ 您的登录已过期，请重新登录           │
│                                     │
│              [重新登录]              │
└─────────────────────────────────────┘
```

点击"重新登录"按钮会跳转到`/api/oauth/login`。

### 403 Forbidden（权限不足）

```
┌─────────────────────────────────────┐
│ ❌ 权限不足                          │
│                                     │
│ 您没有权限执行此操作，请联系管理员   │
└─────────────────────────────────────┘
```

### 404 Not Found（资源不存在）

```
┌─────────────────────────────────────┐
│ ❌ 资源不存在                        │
│                                     │
│ 加载订单列表：资源不存在             │
└─────────────────────────────────────┘
```

### 500 Internal Server Error（服务器错误）

```
┌─────────────────────────────────────┐
│ ❌ 服务器错误                        │
│                                     │
│ 服务器遇到错误，请稍后重试           │
└─────────────────────────────────────┘
```

### 其他错误

```
┌─────────────────────────────────────┐
│ ❌ 请求失败                          │
│                                     │
│ Backend API error: 400 Bad Request  │
└─────────────────────────────────────┘
```

---

## 避免空转圈的技巧

### 1. 使用isLoading显示loading状态

```typescript
if (isLoading) {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">加载中...</span>
    </div>
  );
}
```

### 2. 使用error显示错误状态

```typescript
// 不需要手动显示错误，useErrorHandler会自动toast
useErrorHandler(error, "加载订单列表");

// 但可以显示友好的错误UI
if (error) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">加载失败，请刷新页面重试</p>
    </div>
  );
}
```

### 3. 在mutation中禁用按钮

```typescript
<Button
  onClick={handleApprove}
  disabled={approveMutation.isPending}
>
  {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  批准
</Button>
```

### 4. 使用timeout避免长时间等待

在`client/src/lib/trpc.ts`中配置：

```typescript
export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      fetch(url, options) {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30秒超时
        });
      },
    }),
  ],
});
```

---

## 测试错误处理

### 1. 模拟401错误

```bash
# 清除session cookie
# 在浏览器DevTools → Application → Cookies → 删除session cookie

# 然后访问任意页面，应该看到"需要登录"toast
```

### 2. 模拟403错误

```bash
# 修改backend代码，强制返回403
# 或者使用错误的token

# 应该看到"权限不足"toast
```

### 3. 模拟网络错误

```bash
# 停止backend服务
# 访问任意页面，应该看到网络错误toast
```

### 4. 模拟超时错误

```bash
# 在backend代码中添加延迟
await new Promise(resolve => setTimeout(resolve, 35000)); // 超过30秒

# 应该看到超时错误toast
```

---

## 最佳实践

1. **始终使用useErrorHandler**：不要在onError中直接toast.error
2. **提供有意义的context**：例如"加载订单列表"而不是"加载数据"
3. **显示loading状态**：使用isLoading和isPending
4. **禁用按钮防止重复提交**：使用disabled={mutation.isPending}
5. **提供友好的错误UI**：不仅仅是toast，还可以显示错误页面
6. **记录错误日志**：在生产环境中使用Sentry等工具

---

## 验收标准

- [ ] 所有页面都使用useErrorHandler
- [ ] 401错误显示"需要登录"toast并提供重新登录按钮
- [ ] 403错误显示"权限不足"toast
- [ ] 其他错误显示具体错误信息
- [ ] 不会一直转圈（loading状态有明确的结束）
- [ ] mutation按钮在pending时禁用
- [ ] 错误发生后用户可以重试（refetch或重新提交）

---

## 快速实施清单

```bash
# 1. 检查所有页面是否导入useErrorHandler
grep -r "useErrorHandler" client/src/pages/

# 2. 检查所有useQuery是否添加error处理
grep -r "useQuery" client/src/pages/ | grep -v "error"

# 3. 检查所有useMutation是否添加error处理
grep -r "useMutation" client/src/pages/ | grep -v "error"

# 4. 运行TypeScript检查
pnpm check

# 5. 手动测试每个页面的错误场景
```

---

## 联系支持

如果遇到问题，请查看：
- `client/src/hooks/useErrorHandler.ts` - 错误处理hook实现
- `client/src/pages/OrderReview.tsx` - 参考实现示例

或联系开发团队。
