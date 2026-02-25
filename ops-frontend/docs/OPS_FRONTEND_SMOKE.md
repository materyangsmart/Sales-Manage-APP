# ops-frontend Smoke Test 文档

## 目标

快速验证ops-frontend的核心功能是否正常工作，确保每次部署后关键路径不崩溃。

---

## 前置条件

1. **Backend服务运行**：Sales-Manage-APP backend必须运行在`http://localhost:3000`（或配置的BACKEND_URL）
2. **环境变量配置**：
   ```bash
   BACKEND_URL=http://localhost:3000
   INTERNAL_SERVICE_TOKEN=<your-internal-token>
   ```
3. **测试数据**：Backend数据库中需要有测试数据（订单、发票、收款等）

---

## 快速启动

```bash
# 1. 启动ops-frontend dev server
cd /path/to/ops-frontend
pnpm dev

# 2. 访问 http://localhost:3000（或Manus提供的预览URL）
```

---

## 核心功能验收清单

### 1. ✅ 订单审核流程

**路径**：`/order-review`

**验收步骤**：
1. 页面加载成功，显示待审核订单列表
2. 点击"查看"按钮，弹出订单详情对话框
3. 点击"批准"按钮，输入备注（可选），确认批准
4. Toast提示"订单已批准"
5. 订单从列表中消失（状态变为APPROVED）

**预期结果**：
- ✅ 列表正常加载（无loading卡死）
- ✅ 批准操作成功（200响应）
- ✅ 页面自动刷新，订单状态更新

**失败排查**：
- 如果loading一直转圈：检查BACKEND_URL和INTERNAL_SERVICE_TOKEN配置
- 如果403错误：检查token是否正确
- 如果500错误：检查backend服务是否运行

---

### 2. ✅ 订单履行流程

**路径**：`/order-fulfill`

**验收步骤**：
1. 页面加载成功，显示已审核订单列表（APPROVED状态）
2. 点击"履行订单"按钮
3. 确认对话框点击"确定"
4. Toast提示"订单履行成功，已生成发票"
5. 订单从列表中消失（状态变为FULFILLED）

**预期结果**：
- ✅ 履行操作成功
- ✅ 后端自动生成ARInvoice记录
- ✅ 页面自动刷新

---

### 3. ✅ 发票管理

**路径**：`/ar-invoices`

**验收步骤**：
1. 页面加载成功，显示发票列表
2. 切换状态过滤器（ALL / OPEN / CLOSED）
3. 列表根据过滤器更新

**预期结果**：
- ✅ 发票列表正常显示
- ✅ 状态过滤器工作正常
- ✅ 显示发票号、客户、金额、余额等信息

---

### 4. ✅ 收款管理

**路径**：`/ar-payments`

**验收步骤**：
1. 页面加载成功，显示收款列表
2. 切换状态过滤器（ALL / UNAPPLIED / PARTIAL / APPLIED）
3. 列表根据过滤器更新

**预期结果**：
- ✅ 收款列表正常显示
- ✅ 状态过滤器工作正常
- ✅ 显示收款号、客户、金额、未核销金额等信息

---

### 5. ✅ 核销操作

**路径**：`/ar-apply`

**验收步骤**：
1. 页面加载成功，显示收款和发票选择器
2. 选择一个收款（UNAPPLIED或PARTIAL状态）
3. 选择一个发票（OPEN状态）
4. 点击"智能建议"按钮，自动填充最大可核销金额
5. 点击"执行核销"按钮
6. Toast提示"核销成功"
7. 收款和发票的状态/余额更新

**预期结果**：
- ✅ 核销操作成功
- ✅ 收款的unappliedAmount减少
- ✅ 发票的balance减少
- ✅ 如果完全核销，发票状态变为CLOSED

---

### 6. ✅ 审计日志查询

**路径**：`/audit-logs`

**验收步骤**：
1. 页面加载成功，显示审计日志列表
2. 使用过滤器（资源类型、操作类型）
3. 点击"追踪"按钮，查看某个资源的完整事件链

**预期结果**：
- ✅ 审计日志列表正常显示
- ✅ 过滤器工作正常
- ✅ 追踪功能显示完整的事件链（CREATE → REVIEW → FULFILL → APPLY等）

---

## 完整业务流程验收（端到端）

### 场景：从订单创建到收款核销的完整流程

**前置条件**：
- Backend中已有一个PENDING_REVIEW状态的订单
- 或者通过backend API创建一个新订单

**验收步骤**：

```bash
# 1. 创建测试订单（通过backend API或SQL）
curl -X POST http://localhost:3000/api/internal/orders \
  -H "Authorization: Bearer <internal-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "orgId": 2,
    "orderDate": "2026-01-30",
    "items": [
      {"productId": 1, "quantity": 10, "unitPrice": 100}
    ]
  }'
```

**前端操作流程**：

1. **订单审核** (`/order-review`)
   - 找到刚创建的订单
   - 点击"批准"
   - ✅ 订单状态变为APPROVED

2. **订单履行** (`/order-fulfill`)
   - 找到刚批准的订单
   - 点击"履行订单"
   - ✅ 订单状态变为FULFILLED
   - ✅ 自动生成ARInvoice

3. **发票查看** (`/ar-invoices`)
   - 切换到"OPEN"过滤器
   - ✅ 找到刚生成的发票
   - ✅ 发票金额 = 订单金额
   - ✅ 发票余额 = 订单金额（未核销）

4. **创建收款** (通过backend API或SQL)
   ```bash
   curl -X POST http://localhost:3000/api/internal/ar/payments \
     -H "Authorization: Bearer <internal-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "customerId": 1,
       "orgId": 2,
       "amount": 1000,
       "paymentMethod": "BANK_TRANSFER",
       "paymentDate": "2026-01-30"
     }'
   ```

5. **收款查看** (`/ar-payments`)
   - 切换到"UNAPPLIED"过滤器
   - ✅ 找到刚创建的收款
   - ✅ 未核销金额 = 收款金额

6. **核销操作** (`/ar-apply`)
   - 选择刚创建的收款
   - 选择刚生成的发票
   - 点击"智能建议"
   - 点击"执行核销"
   - ✅ Toast提示"核销成功"

7. **验证结果**：
   - 返回`/ar-invoices`
     - ✅ 发票余额减少（或变为0）
     - ✅ 如果完全核销，发票状态变为CLOSED
   - 返回`/ar-payments`
     - ✅ 收款的未核销金额减少（或变为0）
     - ✅ 如果完全核销，收款状态变为APPLIED

8. **审计日志验证** (`/audit-logs`)
   - 切换资源类型为"ORDER"
   - ✅ 找到REVIEW和FULFILL事件
   - 切换资源类型为"INVOICE"
   - ✅ 找到CREATE和APPLY事件
   - 点击"追踪"按钮
   - ✅ 看到完整的事件链

---

## 自动化验证脚本（未来）

**目标**：使用Playwright或Cypress实现E2E自动化测试

**优先级**：
1. 订单审核 → 履行流程
2. 核销操作流程
3. 审计日志追踪

**示例（Playwright）**：
```typescript
// tests/e2e/order-flow.spec.ts
import { test, expect } from '@playwright/test';

test('订单审核到履行流程', async ({ page }) => {
  // 1. 访问订单审核页
  await page.goto('http://localhost:3000/order-review');
  
  // 2. 等待列表加载
  await page.waitForSelector('table');
  
  // 3. 点击第一个订单的"批准"按钮
  await page.click('button:has-text("批准")');
  
  // 4. 输入备注并确认
  await page.fill('textarea', '测试批准');
  await page.click('button:has-text("确认批准")');
  
  // 5. 等待toast提示
  await expect(page.locator('text=订单已批准')).toBeVisible();
  
  // 6. 访问订单履行页
  await page.goto('http://localhost:3000/order-fulfill');
  
  // 7. 点击"履行订单"按钮
  await page.click('button:has-text("履行订单")');
  
  // 8. 确认对话框
  await page.click('button:has-text("确定")');
  
  // 9. 等待toast提示
  await expect(page.locator('text=订单履行成功')).toBeVisible();
});
```

---

## 常见问题排查

### 1. 页面一直loading

**原因**：
- Backend服务未运行
- BACKEND_URL配置错误
- INTERNAL_SERVICE_TOKEN未配置或错误

**排查**：
```bash
# 检查backend服务
curl http://localhost:3000/health

# 检查环境变量
echo $BACKEND_URL
echo $INTERNAL_SERVICE_TOKEN

# 检查dev server日志
# 查看是否有tRPC错误
```

### 2. 403 Forbidden错误

**原因**：
- INTERNAL_SERVICE_TOKEN错误或过期

**排查**：
```bash
# 手动测试token
curl http://localhost:3000/api/internal/orders \
  -H "Authorization: Bearer <your-token>"

# 应该返回200，而不是403
```

### 3. Token泄露到前端

**验证**：
1. 打开浏览器DevTools → Network标签
2. 刷新页面
3. 查看所有请求的Headers
4. ✅ 不应该看到`Authorization: Bearer <token>`
5. ✅ 只应该看到`/api/trpc/*`请求

**如果发现token泄露**：
- 检查是否有代码直接在frontend调用backend API
- 检查是否使用了`VITE_INTERNAL_SERVICE_TOKEN`（错误！）
- 应该使用`INTERNAL_SERVICE_TOKEN`（server-side only）

---

## 性能基准

**预期加载时间**（本地开发环境）：
- 订单列表（20条）：< 500ms
- 发票列表（50条）：< 800ms
- 核销操作：< 300ms
- 审计日志追踪：< 1s

**如果超过这些时间**：
- 检查backend性能
- 检查数据库查询是否有索引
- 检查网络延迟

---

## 总结

**核心验收路径**：
1. 订单审核 → 批准 ✅
2. 订单履行 → 生成发票 ✅
3. 收款核销 → 更新余额 ✅
4. 审计日志 → 追踪事件链 ✅

**一键验收命令**（未来）：
```bash
# 运行所有smoke tests
pnpm test:e2e:smoke

# 预期输出：
# ✓ 订单审核流程 (2.3s)
# ✓ 订单履行流程 (1.8s)
# ✓ 核销操作流程 (3.1s)
# ✓ 审计日志追踪 (1.2s)
#
# 4 passed (8.4s)
```

---

## 下一步

1. **实现E2E自动化测试**：使用Playwright编写上述验收场景的自动化测试
2. **CI集成**：将smoke tests集成到CI/CD流程中
3. **性能监控**：添加性能基准测试，确保每次部署后性能不退化
