# Playwright E2E 测试执行指南

**目标**: 验证ops-frontend的完整功能链路，确保订单审核→履行→发票→核销→审计日志的业务流程正常工作。

---

## 前提条件

### 1. Backend服务运行

```bash
# 在backend项目目录
cd E:\work\Sales-Manage-APP-git\backend

# 启动开发服务器
npm run start:dev

# 验证服务健康状态
curl http://localhost:3001/health/ready
# 期望输出: {"status":"ok"}

curl http://localhost:3001/version
# 期望输出: {"version":"1.0.0",...}
```

### 2. ops-frontend服务运行

```bash
# 在ops-frontend项目目录
cd /home/ubuntu/ops-frontend

# 启动开发服务器
pnpm dev

# 验证服务运行
curl https://3000-i96c9pg6s6pwm8hgpfyuo-1619b2ec.sg1.manus.computer
# 期望输出: HTML页面
```

### 3. 环境变量配置

确保以下环境变量已正确配置（在Manus平台自动注入）：

- `BACKEND_URL`: backend服务地址
- `INTERNAL_SERVICE_TOKEN`: 内部服务token

---

## 运行E2E测试

### 方式1: 命令行运行（推荐）

```bash
cd /home/ubuntu/ops-frontend

# 运行所有E2E测试
pnpm test:e2e

# 期望输出:
# Running 3 tests using 1 worker
# 
#   ✓  tests/e2e/order-flow.spec.ts:完整流程：审核 → 批准 → 履行 → 发票生成 (15s)
#   ✓  tests/e2e/order-flow.spec.ts:订单审核页：拒绝订单 (5s)
#   ✓  tests/e2e/apply-flow.spec.ts:完整流程：选择收款和发票 → 核销 → 验证状态 (10s)
# 
#   3 passed (30s)
```

### 方式2: 有头模式运行（可见浏览器）

```bash
cd /home/ubuntu/ops-frontend

# 运行有头模式（可以看到浏览器操作）
pnpm test:e2e:headed

# 浏览器会自动打开，执行测试步骤
```

### 方式3: UI模式运行（可视化调试）

```bash
cd /home/ubuntu/ops-frontend

# 运行UI模式（可视化调试界面）
pnpm test:e2e:ui

# 会打开Playwright UI，可以逐步执行测试
```

---

## 测试覆盖的功能链路

### 测试1: 订单审核 → 批准 → 履行 → 发票生成

**文件**: `tests/e2e/order-flow.spec.ts`

**步骤**:
1. 访问订单审核页 (`/order-review`)
2. 检查是否有待审核订单
3. 批准第一个订单（输入备注）
4. 验证toast提示"订单已批准"
5. 访问订单履行页 (`/order-fulfill`)
6. 履行刚批准的订单
7. 验证toast提示"订单履行成功"
8. 访问发票页 (`/ar-invoices`)
9. 验证发票已生成，状态为"未结清"
10. 访问审计日志页 (`/audit-logs`)
11. 验证REVIEW和FULFILL事件已记录

**期望输出**:
```
Step 1: 访问订单审核页
✓ 页面加载成功

Step 2: 批准订单
✓ 找到 5 个待审核订单
✓ 订单已批准

Step 3: 履行订单
✓ 找到 3 个已批准订单
✓ 订单履行成功

Step 4: 验证发票生成
✓ 找到 10 个发票
✓ 发票列表正常

Step 5: 验证审计日志
✓ 找到 2 个REVIEW事件
✓ 找到 1 个FULFILL事件

========================================
✅ 订单流程测试通过！
========================================
```

### 测试2: 订单审核页：拒绝订单

**文件**: `tests/e2e/order-flow.spec.ts`

**步骤**:
1. 访问订单审核页
2. 拒绝第一个订单（输入备注）
3. 验证toast提示"订单已拒绝"
4. 验证订单从列表中消失

**期望输出**:
```
Step 1: 访问订单审核页
✓ 页面加载成功

Step 2: 拒绝订单
✓ 订单已拒绝

========================================
✅ 订单拒绝测试通过！
========================================
```

### 测试3: 收款核销流程

**文件**: `tests/e2e/apply-flow.spec.ts`

**步骤**:
1. 访问核销页 (`/ar-apply`)
2. 选择收款（从下拉列表）
3. 选择发票（从下拉列表）
4. 点击"智能建议"自动填充金额
5. 执行核销
6. 验证toast提示"核销成功"
7. 访问收款页，验证收款状态更新
8. 访问发票页，验证发票状态更新
9. 访问审计日志页，验证APPLY事件已记录

**期望输出**:
```
Step 1: 访问核销页
✓ 页面加载成功

Step 2: 选择收款
✓ 找到 5 个可用收款
✓ 已选择收款

Step 3: 选择发票
✓ 找到 8 个可用发票
✓ 已选择发票

Step 4: 智能建议金额
✓ 建议金额: 1000
✓ 金额已自动填充

Step 5: 执行核销
✓ 核销成功

Step 6: 验证收款状态
✓ 找到 5 个收款
✓ 收款列表正常

Step 7: 验证发票状态
✓ 找到 10 个发票
✓ 发票列表正常

Step 8: 验证审计日志
✓ 找到 3 个APPLY事件
✓ 核销事件已记录

========================================
✅ 核销流程测试通过！
========================================
```

---

## 测试失败处理

### 常见失败原因

1. **Backend服务未运行**
   ```
   Error: connect ECONNREFUSED
   ```
   **解决**: 启动backend服务

2. **没有测试数据**
   ```
   ⚠️ 没有可用订单，跳过测试
   ```
   **解决**: 使用seed脚本插入测试数据

3. **Token未配置**
   ```
   Backend API error: 403 Forbidden
   ```
   **解决**: 检查`INTERNAL_SERVICE_TOKEN`环境变量

4. **页面加载超时**
   ```
   Error: Timeout 10000ms exceeded
   ```
   **解决**: 检查网络连接，或增加timeout时间

### 调试方法

1. **查看测试截图**
   ```bash
   # 测试失败时会自动截图
   ls test-results/
   ```

2. **查看测试报告**
   ```bash
   pnpm test:e2e:report
   ```

3. **运行单个测试**
   ```bash
   pnpm test:e2e tests/e2e/order-flow.spec.ts
   ```

4. **运行有头模式调试**
   ```bash
   pnpm test:e2e:headed
   ```

---

## CI/CD集成

### GitHub Actions示例

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Start backend service
        run: |
          cd ../backend
          npm run start:dev &
          sleep 5
      
      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          BACKEND_URL: http://localhost:3001
          INTERNAL_SERVICE_TOKEN: ${{ secrets.INTERNAL_SERVICE_TOKEN }}
      
      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 验收标准

### 最低要求（必须通过）

- ✅ 所有3个测试用例通过
- ✅ 无timeout错误
- ✅ 无network错误
- ✅ 审计日志正确记录所有事件

### 理想状态（建议达到）

- ✅ 测试执行时间 < 60秒
- ✅ 测试覆盖率 > 80%
- ✅ 集成到CI/CD流程
- ✅ 每次PR都自动运行E2E测试

---

## 手动验收清单

如果无法运行Playwright测试，可以手动执行以下步骤验收：

### 1. 订单审核 → 批准
- [ ] 访问 `/order-review`
- [ ] 点击第一个订单的"批准"按钮
- [ ] 输入备注："测试批准"
- [ ] 点击"确认批准"
- [ ] 看到toast提示"订单已批准"

### 2. 订单履行 → 发票生成
- [ ] 访问 `/order-fulfill`
- [ ] 点击第一个订单的"履行订单"按钮
- [ ] 确认对话框，点击"确定"
- [ ] 看到toast提示"订单履行成功"
- [ ] 访问 `/ar-invoices`
- [ ] 看到新生成的发票，状态为"未结清"

### 3. 收款 → 核销
- [ ] 访问 `/ar-apply`
- [ ] 选择收款（从下拉列表）
- [ ] 选择发票（从下拉列表）
- [ ] 点击"智能建议"
- [ ] 看到金额自动填充
- [ ] 点击"执行核销"
- [ ] 看到toast提示"核销成功"

### 4. 审计日志
- [ ] 访问 `/audit-logs`
- [ ] 过滤action为"REVIEW"
- [ ] 看到订单审核事件
- [ ] 过滤action为"FULFILL"
- [ ] 看到订单履行事件
- [ ] 过滤action为"APPLY"
- [ ] 看到核销事件

---

## 常见问题

### Q: 测试运行很慢怎么办？

A: 可以并行运行测试：
```bash
pnpm test:e2e --workers=4
```

### Q: 如何只运行特定测试？

A: 使用test.only：
```typescript
test.only('完整流程：审核 → 批准 → 履行 → 发票生成', async ({ page }) => {
  // ...
});
```

### Q: 如何跳过某个测试？

A: 使用test.skip：
```typescript
test.skip('订单审核页：拒绝订单', async ({ page }) => {
  // ...
});
```

### Q: 如何增加timeout时间？

A: 在playwright.config.ts中修改：
```typescript
export default defineConfig({
  timeout: 60000, // 60秒
});
```

---

## 联系支持

如果遇到问题，请查看：
- `docs/OPS_FRONTEND_SMOKE.md` - Smoke测试文档
- `docs/SECURITY_ACCEPTANCE_REPORT.md` - 安全验收报告
- `docs/TOKEN_SECURITY_VERIFICATION.md` - Token安全验证指南

或联系开发团队。
