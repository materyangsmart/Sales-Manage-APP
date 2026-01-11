# 运营端前端冒烟测试指南

## 概述

本文档提供了运营端AR管理页面的完整冒烟测试流程，用于验证PR-7、PR-12、PR-13、PR-14的功能正确性。

## 测试环境

- **前端地址**: http://localhost:5173（本地开发）或测试站点
- **后端地址**: http://localhost:3001（需要先启动后端服务）
- **浏览器**: Chrome/Edge（推荐，支持DevTools）

## 前置准备

### 1. 启动后端服务

```bash
cd backend
npm install
npm run migration:run  # 执行数据库迁移
npm run dev            # 启动开发服务器
```

### 2. 启动前端服务

```bash
cd ops-frontend
pnpm install
pnpm dev
```

### 3. 准备测试数据

使用后端冒烟测试脚本创建测试数据：

```bash
cd backend
export API_BASE=http://localhost:3001
export JWT=your_jwt_token_here
bash scripts/smoke-test.sh
```

## 测试用例

### 测试用例 1: 默认筛选"近7天 + DESC"（PR-12）

**目的**: 验证列表页默认加载近7天数据并按received_at降序排列

**步骤**:
1. 打开浏览器，访问 `http://localhost:5173`
2. 进入"AR待处理列表"页面
3. 观察筛选条件和列表数据

**预期结果**:
- ✅ 日期筛选器自动设置为"近7天"（今天-7天 至 今天）
- ✅ 列表按"到款时间"降序排列（最新的在最上面）
- ✅ 状态筛选默认为"全部"或"未分配"

**验证方法**:
```javascript
// 在浏览器Console中检查localStorage
console.log(localStorage.getItem('ar-payment-filters'));
// 应该看到类似：{"date_from":"2026-01-04","date_to":"2026-01-11","status":"UNAPPLIED"}
```

**截图位置**: `screenshots/test-case-1-default-filters.png`

---

### 测试用例 2: 用户偏好记忆（PR-12）

**目的**: 验证用户修改筛选条件后，刷新页面仍保留用户选择

**步骤**:
1. 在"AR待处理列表"页面
2. 修改筛选条件：
   - 状态改为"已分配"
   - 日期改为"2026-01-01 至 2026-01-05"
3. 点击"查询"按钮
4. 刷新页面（F5或Ctrl+R）

**预期结果**:
- ✅ 刷新后，筛选条件仍为"已分配"和"2026-01-01 至 2026-01-05"
- ✅ 列表数据与刷新前一致

**验证方法**:
```javascript
// 修改筛选后检查localStorage
console.log(localStorage.getItem('ar-payment-filters'));
// 应该看到用户的自定义筛选条件
```

**截图位置**: `screenshots/test-case-2-filter-memory.png`

---

### 测试用例 3: 空态展示（PR-13）

**目的**: 验证无数据时的空态提示

**步骤**:
1. 在"AR待处理列表"页面
2. 修改筛选条件，使结果为空（例如：日期设置为未来某天）
3. 点击"查询"按钮

**预期结果**:
- ✅ 显示空态图标和文案："暂无数据"
- ✅ 显示"修改筛选"或"重试"按钮
- ✅ 无白屏或加载中状态

**截图位置**: `screenshots/test-case-3-empty-state.png`

---

### 测试用例 4: 异常态展示与重试（PR-13）

**目的**: 验证网络错误时的异常态提示和重试功能

**步骤**:
1. 打开Chrome DevTools（F12）
2. 切换到"Network"标签
3. 勾选"Offline"模拟断网
4. 在"AR待处理列表"页面点击"查询"按钮
5. 观察错误提示
6. 取消"Offline"勾选
7. 点击"重试"按钮

**预期结果**:
- ✅ 断网时显示错误提示："网络错误，请检查网络连接"
- ✅ 显示"重试"按钮
- ✅ 点击"重试"后，成功加载数据
- ✅ 弱网（慢3G）时显示Loading骨架，无白屏

**截图位置**: 
- `screenshots/test-case-4-error-state.png`
- `screenshots/test-case-4-retry-success.png`

---

### 测试用例 5: 进入详情页（PR-7）

**目的**: 验证列表→详情的路由导航

**步骤**:
1. 在"AR待处理列表"页面
2. 点击任意一条收款单的"核销"按钮
3. 观察页面跳转

**预期结果**:
- ✅ 页面跳转到详情页（URL: `/ar/apply/:paymentId`）
- ✅ 详情页显示收款单信息（客户、金额、到款时间等）
- ✅ 显示该客户的未结清应收单列表
- ✅ 浏览器后退按钮可用

**截图位置**: `screenshots/test-case-5-detail-page.png`

---

### 测试用例 6: 金额输入校验（PR-7）

**目的**: 验证超额金额的前端拦截

**步骤**:
1. 在详情页
2. 在某个应收单的"核销金额"输入框中输入超过"剩余可分配金额"的数值
3. 尝试提交

**预期结果**:
- ✅ 输入框显示红色边框
- ✅ 显示错误提示："核销金额不能超过剩余可分配金额"
- ✅ "提交核销"按钮禁用（灰色）

**截图位置**: `screenshots/test-case-6-amount-validation.png`

---

### 测试用例 7: 提交按钮禁用与Loading（PR-7）

**目的**: 验证提交期间的按钮禁用和Loading状态

**步骤**:
1. 在详情页
2. 正确填写核销金额
3. 点击"提交核销"按钮
4. 观察按钮状态

**预期结果**:
- ✅ 点击后，按钮立即变为禁用状态（灰色）
- ✅ 按钮文字变为"提交中..."并显示Loading图标
- ✅ "取消"按钮也被禁用
- ✅ 提交成功或失败后，按钮恢复可用状态

**截图位置**: `screenshots/test-case-7-submit-loading.png`

---

### 测试用例 8: 409并发冲突提示（PR-7）

**目的**: 验证并发冲突时的错误提示和刷新机制

**步骤**:
1. 在详情页（Payment ID: P1）
2. 打开第二个浏览器窗口，访问同一个详情页
3. 在第二个窗口中先提交核销（成功）
4. 回到第一个窗口，再次提交核销
5. 观察错误提示

**预期结果**:
- ✅ 显示Toast提示："数据已被他人更新，请刷新后重试"
- ✅ 提示框为红色或警告样式
- ✅ 按钮恢复可用状态
- ✅ 页面数据自动刷新（或提示用户手动刷新）

**截图位置**: `screenshots/test-case-8-409-conflict.png`

---

### 测试用例 9: 埋点事件验证（PR-14）

**目的**: 验证埋点事件的字段完整性

**步骤**:
1. 打开Chrome DevTools（F12）
2. 切换到"Console"标签
3. 在详情页填写核销金额并提交
4. 观察Console中的埋点日志

**预期结果**:
- ✅ `apply_submit` 事件包含以下字段：
  - `payment_id`: 收款单ID
  - `applied_total_fen`: 总核销金额（分）
  - `remain_fen_after`: 核销后剩余金额（分）
  - `invoice_count`: 核销的发票数量
- ✅ `apply_success` 事件包含相同字段
- ✅ `apply_conflict` 事件（409错误时）包含相同字段

**验证方法**:
```javascript
// 在Console中查看埋点日志
// 应该看到类似：
// [Analytics] apply_submit: {payment_id: "P1", applied_total_fen: 2000, remain_fen_after: 3000, invoice_count: 1}
```

**截图位置**: `screenshots/test-case-9-analytics.png`

---

### 测试用例 10: 快速填充功能（PR-7）

**目的**: 验证"快速填充"按钮的功能

**步骤**:
1. 在详情页
2. 点击某个应收单旁边的"快速填充"按钮
3. 观察金额输入框

**预期结果**:
- ✅ 金额输入框自动填充为"剩余可分配金额"
- ✅ 如果剩余金额大于应收单余额，则填充应收单余额
- ✅ 填充后，"剩余可分配金额"实时更新

**截图位置**: `screenshots/test-case-10-quick-fill.png`

---

### 测试用例 11: 金额显示格式（PR-7）

**目的**: 验证金额显示的正确性（分→元转换）

**步骤**:
1. 在列表页和详情页观察所有金额字段

**预期结果**:
- ✅ 所有金额显示为"元"（保留两位小数）
- ✅ 例如：5000分显示为"¥50.00"
- ✅ 输入框中输入"50"，提交时转换为5000分

**截图位置**: `screenshots/test-case-11-amount-format.png`

---

## 测试通过标准

### 必须通过（Blocking）

- [x] 测试用例 1: 默认筛选"近7天 + DESC"
- [x] 测试用例 2: 用户偏好记忆
- [x] 测试用例 3: 空态展示
- [x] 测试用例 4: 异常态展示与重试
- [x] 测试用例 5: 进入详情页
- [x] 测试用例 6: 金额输入校验
- [x] 测试用例 7: 提交按钮禁用与Loading
- [x] 测试用例 8: 409并发冲突提示
- [x] 测试用例 9: 埋点事件验证

### 建议通过（Non-blocking）

- [ ] 测试用例 10: 快速填充功能
- [ ] 测试用例 11: 金额显示格式

## 性能测试（可选）

### 弱网测试

1. 打开Chrome DevTools → Network
2. 选择"Slow 3G"
3. 执行所有测试用例
4. 验证：
   - ✅ 无白屏
   - ✅ 显示Loading骨架
   - ✅ 超时后显示错误提示

### 并发测试

1. 打开5个浏览器标签页
2. 同时访问列表页
3. 验证：
   - ✅ 所有标签页正常加载
   - ✅ 无接口报错

## 截图清单

请在测试过程中截图并保存到 `ops-frontend/screenshots/` 目录：

1. `test-case-1-default-filters.png`
2. `test-case-2-filter-memory.png`
3. `test-case-3-empty-state.png`
4. `test-case-4-error-state.png`
5. `test-case-4-retry-success.png`
6. `test-case-5-detail-page.png`
7. `test-case-6-amount-validation.png`
8. `test-case-7-submit-loading.png`
9. `test-case-8-409-conflict.png`
10. `test-case-9-analytics.png`
11. `test-case-10-quick-fill.png`
12. `test-case-11-amount-format.png`

## 测试报告模板

```markdown
# AR运营端前端冒烟测试报告

**测试日期**: 2026-01-11
**测试人员**: [您的名字]
**测试环境**: 
- 前端: http://localhost:5173
- 后端: http://localhost:3001
- 浏览器: Chrome 120.0.0

## 测试结果汇总

| 测试用例 | 状态 | 备注 |
|---------|------|------|
| 测试用例 1 | ✅ 通过 | |
| 测试用例 2 | ✅ 通过 | |
| 测试用例 3 | ✅ 通过 | |
| 测试用例 4 | ✅ 通过 | |
| 测试用例 5 | ✅ 通过 | |
| 测试用例 6 | ✅ 通过 | |
| 测试用例 7 | ✅ 通过 | |
| 测试用例 8 | ✅ 通过 | |
| 测试用例 9 | ✅ 通过 | |
| 测试用例 10 | ✅ 通过 | |
| 测试用例 11 | ✅ 通过 | |

## 发现的问题

无

## 建议

无

## 结论

✅ 所有测试用例通过，建议合并PR。
```

## 附录：常见问题

### Q1: 如何模拟JWT Token？

A: 可以使用以下方法：
1. 使用Postman或curl调用登录接口获取真实Token
2. 在浏览器Console中手动设置：`localStorage.setItem('token', 'your_token_here')`
3. 使用后端提供的测试Token

### Q2: 如何查看埋点事件？

A: 
1. 打开Chrome DevTools → Console
2. 埋点事件会以 `[Analytics]` 前缀打印
3. 也可以在Network标签查看发送到埋点服务的请求

### Q3: 如何清除用户偏好？

A:
```javascript
localStorage.removeItem('ar-payment-filters');
location.reload();
```

### Q4: 测试数据如何清理？

A: 执行数据库迁移的down脚本：
```bash
cd backend
npm run migration:revert
npm run migration:run
```

---

**文档版本**: v1.0
**最后更新**: 2026-01-11
