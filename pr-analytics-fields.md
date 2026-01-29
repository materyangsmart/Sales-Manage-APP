# fix(ops-ar): unify analytics fields

## 🎯 目标

统一AR运营端埋点字段，确保所有埋点事件包含一致的字段格式，便于后续数据分析和监控。

---

## 🐛 问题

当前埋点字段不统一，存在以下问题：

### 1. 字段命名不一致
- 使用 `paymentNo`（收款单编号）而不是 `payment_id`（收款单ID）
- 使用 `totalApplied` 而不是明确的 `applied_total_fen`（单位：分）
- 使用 `invoiceCount` 而不是统一的 `invoice_count`

### 2. 缺少关键字段
- ❌ `remain_fen_after`: 核销后剩余金额（分）- **完全缺失**
- ❌ `invoice_count`: 核销的发票数量 - **仅在部分事件中存在**

### 3. 字段不完整
| 事件 | 当前字段 | 缺失字段 |
|------|---------|---------|
| `apply_submit` | paymentNo, totalApplied, invoiceCount | payment_id, applied_total_fen, remain_fen_after |
| `apply_success` | paymentNo, totalApplied, settled | payment_id, applied_total_fen, remain_fen_after, invoice_count |
| `apply_conflict` | paymentNo, errorMessage | payment_id, applied_total_fen, remain_fen_after, invoice_count |

---

## ✅ 解决方案

统一所有埋点事件的字段格式，使用蛇形命名（snake_case）和明确的单位。

### 统一后的字段

#### 必需字段（所有事件）
- ✅ `payment_id`: 收款单ID（string）
- ✅ `applied_total_fen`: 总核销金额，单位：分（number）
- ✅ `remain_fen_after`: 核销后剩余金额，单位：分（number）
- ✅ `invoice_count`: 核销的发票数量（number）

#### 可选字段
- ✅ `settled`: 是否结清（boolean）- 仅 `apply_success`
- ✅ `error_message`: 错误信息（string）- 仅 `apply_conflict`

---

## 📝 修改详情

### 1. apply_submit 事件

**修改前**:
```typescript
trackEvent('apply_submit', {
  paymentNo: payment.paymentNo,
  totalApplied,
  invoiceCount: applyRows.filter((r) => r.appliedAmount > 0).length,
});
```

**修改后**:
```typescript
const invoiceCount = applyRows.filter((r) => r.appliedAmount > 0).length;
const remainFenAfter = payment.unappliedAmount - totalApplied;

trackEvent('apply_submit', {
  payment_id: payment.id,
  applied_total_fen: totalApplied,
  remain_fen_after: remainFenAfter,
  invoice_count: invoiceCount,
});
```

---

### 2. apply_success 事件

**修改前**:
```typescript
trackEvent('apply_success', {
  paymentNo: payment.paymentNo,
  totalApplied,
  settled: canSettle,
});
```

**修改后**:
```typescript
trackEvent('apply_success', {
  payment_id: payment.id,
  applied_total_fen: totalApplied,
  remain_fen_after: remainFenAfter,
  invoice_count: invoiceCount,
  settled: canSettle,
});
```

---

### 3. apply_conflict 事件

**修改前**:
```typescript
trackEvent('apply_conflict', {
  paymentNo: payment.paymentNo,
  errorMessage: error.userMessage,
});
```

**修改后**:
```typescript
trackEvent('apply_conflict', {
  payment_id: payment.id,
  applied_total_fen: totalApplied,
  remain_fen_after: remainFenAfter,
  invoice_count: invoiceCount,
  error_message: error.userMessage,
});
```

---

## 🧪 测试

### 新增单元测试

**文件**: `ops-frontend/src/pages/ARApplyDetail.test.tsx`

**测试用例**:
1. ✅ `apply_submit` 包含所有必需字段
2. ✅ `apply_success` 包含所有必需字段 + `settled`
3. ✅ `apply_conflict` 包含所有必需字段 + `error_message`
4. ✅ 所有事件不包含旧字段（`paymentNo`, `totalApplied`, `invoiceCount`）

**测试方法**:
- Mock `trackEvent` 函数
- 模拟用户操作（填写金额、提交核销）
- 断言埋点调用包含正确的字段

**运行测试**:
```bash
cd ops-frontend
pnpm install
pnpm test
```

---

## 📊 字段对比

### 修改前 vs 修改后

| 字段 | 修改前 | 修改后 | 说明 |
|------|--------|--------|------|
| 收款单标识 | `paymentNo` | `payment_id` | 使用ID而不是编号 |
| 核销金额 | `totalApplied` | `applied_total_fen` | 明确单位为"分" |
| 剩余金额 | ❌ 缺失 | `remain_fen_after` | 新增 |
| 发票数量 | `invoiceCount` | `invoice_count` | 统一命名，所有事件都有 |
| 是否结清 | `settled` | `settled` | 保留 |
| 错误信息 | `errorMessage` | `error_message` | 统一命名 |

---

## 🎯 验证方法

### 手动验证（前端冒烟测试用例9）

1. 启动前后端服务
2. 打开Chrome DevTools → Console
3. 在详情页填写核销金额并提交
4. 检查Console中的埋点日志

**期望输出**:
```javascript
[Analytics] apply_submit: {
  payment_id: "P1",
  applied_total_fen: 2000,
  remain_fen_after: 3000,
  invoice_count: 1
}

[Analytics] apply_success: {
  payment_id: "P1",
  applied_total_fen: 2000,
  remain_fen_after: 3000,
  invoice_count: 1,
  settled: false
}
```

### 自动化验证

```bash
cd ops-frontend
pnpm install
pnpm test
```

**期望结果**: 4个测试用例全部通过

---

## 📂 文件修改清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `ops-frontend/src/pages/ARApplyDetail.tsx` | 修改 | 统一埋点字段 |
| `ops-frontend/src/pages/ARApplyDetail.test.tsx` | 新增 | 单元测试 |
| `ops-frontend/vitest.config.ts` | 新增 | Vitest配置 |
| `ops-frontend/src/test/setup.ts` | 新增 | 测试环境setup |
| `ops-frontend/package.json` | 修改 | 添加测试依赖和脚本 |

---

## 🔗 相关文档

- **决策分析**: `PR14_DECISION_ANALYSIS.md`
- **冒烟测试指南**: `ops-frontend/SMOKE_TEST_CHECKLIST.md`（用例9）
- **测试报告模板**: `SMOKE_TEST_REPORT.md`

---

## ✅ 验收标准

### 必须通过
- [ ] 所有单元测试通过（`pnpm test`）
- [ ] 前端冒烟测试用例9通过（Console日志包含所有必需字段）
- [ ] CI检查通过

### 建议验证
- [ ] 在实际环境中提交核销，验证埋点日志
- [ ] 触发409冲突，验证`apply_conflict`事件
- [ ] 核销至结清，验证`settled: true`

---

## 📈 影响范围

### 影响的功能
- ✅ AR核销详情页（`ARApplyDetail.tsx`）
- ✅ 埋点数据收集

### 不影响的功能
- ✅ 核销业务逻辑（无变化）
- ✅ 页面UI和交互（无变化）
- ✅ 后端API（无变化）

### 向后兼容性
- ⚠️ **不兼容**: 旧字段已移除（`paymentNo`, `totalApplied`, `invoiceCount`）
- ✅ **新字段**: 所有事件包含统一的字段格式

---

## 🚀 部署建议

1. **合并PR后**:
   - 通知数据分析团队字段变更
   - 更新埋点字段文档
   - 更新数据分析脚本（如有）

2. **监控**:
   - 检查埋点数据是否正常上报
   - 验证新字段是否包含正确的值

3. **回滚计划**:
   - 如果埋点数据异常，可以快速回滚到上一版本
   - 回滚后需要重新修复字段问题

---

## 📝 后续工作

### 立即需要做的
1. ✅ Review并合并本PR
2. ✅ 执行前端冒烟测试用例9
3. ✅ 验证埋点日志包含所有必需字段

### 后续改进
1. 为其他页面的埋点统一字段格式
2. 建立埋点字段规范文档
3. 添加埋点字段的TypeScript类型定义

---

**PR类型**: fix  
**优先级**: P0  
**Blocking**: Yes（冒烟测试用例9依赖此PR）

---

**相关PR**:
- #30: P1工程化改进 - 已合并
- #29: 空状态/错误边界 - 已合并
- #25: 默认筛选和排序 - 已合并
- #20: AR基础页面 - 已合并
