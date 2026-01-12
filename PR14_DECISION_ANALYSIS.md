# PR #14决策分析：埋点字段统一

**分析日期**: 2026-01-12  
**分析人员**: Manus AI

---

## 一、背景

原始PR #14的目标是"统一埋点字段格式，添加payment_id到所有相关埋点"。

需要根据**测试用例9（埋点事件验证）**的结果，决定是否需要创建新的PR来补充埋点字段。

---

## 二、当前埋点实现分析

### 2.1 代码位置

文件：`ops-frontend/src/pages/ARApplyDetail.tsx`

### 2.2 当前埋点字段

#### `apply_submit` 事件（第58-62行）

```typescript
trackEvent('apply_submit', {
  paymentNo: payment.paymentNo,        // ✅ 收款单编号
  totalApplied,                         // ✅ 总核销金额
  invoiceCount: applyRows.filter((r) => r.appliedAmount > 0).length,  // ✅ 发票数量
});
```

**当前字段**:
- ✅ `paymentNo`: 收款单编号（string）
- ✅ `totalApplied`: 总核销金额（number，单位：分）
- ✅ `invoiceCount`: 核销的发票数量（number）

**缺失字段**:
- ❌ `payment_id`: 收款单ID（应该使用`payment.id`而不是`payment.paymentNo`）
- ❌ `applied_total_fen`: 总核销金额（应该明确单位为"分"）
- ❌ `remain_fen_after`: 核销后剩余金额（分）

---

#### `apply_success` 事件（第115-119行）

```typescript
trackEvent('apply_success', {
  paymentNo: payment.paymentNo,        // ✅ 收款单编号
  totalApplied,                         // ✅ 总核销金额
  settled: canSettle,                   // ✅ 是否结清
});
```

**当前字段**:
- ✅ `paymentNo`: 收款单编号
- ✅ `totalApplied`: 总核销金额
- ✅ `settled`: 是否结清（boolean）

**缺失字段**:
- ❌ `payment_id`: 收款单ID
- ❌ `applied_total_fen`: 总核销金额（明确单位）
- ❌ `remain_fen_after`: 核销后剩余金额
- ❌ `invoice_count`: 核销的发票数量

---

#### `apply_conflict` 事件（第125-128行）

```typescript
trackEvent('apply_conflict', {
  paymentNo: payment.paymentNo,        // ✅ 收款单编号
  errorMessage: error.userMessage,      // ✅ 错误信息
});
```

**当前字段**:
- ✅ `paymentNo`: 收款单编号
- ✅ `errorMessage`: 错误信息

**缺失字段**:
- ❌ `payment_id`: 收款单ID
- ❌ `applied_total_fen`: 总核销金额
- ❌ `remain_fen_after`: 核销后剩余金额
- ❌ `invoice_count`: 核销的发票数量

---

## 三、测试用例9的期望字段

根据`SMOKE_TEST_GUIDE.md`，测试用例9期望以下字段：

### 必须字段

1. ✅/❌ `payment_id`: 收款单ID
   - 当前状态：❌ 缺失（使用的是`paymentNo`）
   - 应该使用：`payment.id`

2. ✅/❌ `applied_total_fen`: 总核销金额（分）
   - 当前状态：⚠️ 部分存在（使用的是`totalApplied`，但字段名不明确）
   - 应该改为：`applied_total_fen`

3. ✅/❌ `remain_fen_after`: 核销后剩余金额（分）
   - 当前状态：❌ 完全缺失
   - 应该计算：`payment.unappliedAmount - totalApplied`

4. ✅/❌ `invoice_count`: 核销的发票数量
   - 当前状态：⚠️ 部分存在（仅在`apply_submit`中有）
   - 应该在所有事件中统一

---

## 四、问题总结

### 4.1 字段命名不统一

| 期望字段 | 当前字段 | 问题 |
|---------|---------|------|
| `payment_id` | `paymentNo` | 应该使用ID而不是编号 |
| `applied_total_fen` | `totalApplied` | 字段名不明确单位 |
| `remain_fen_after` | 缺失 | 完全缺失 |
| `invoice_count` | `invoiceCount` | 仅在`apply_submit`中有 |

### 4.2 字段缺失

| 事件 | 缺失字段 |
|------|---------|
| `apply_submit` | `payment_id`, `applied_total_fen`, `remain_fen_after` |
| `apply_success` | `payment_id`, `applied_total_fen`, `remain_fen_after`, `invoice_count` |
| `apply_conflict` | `payment_id`, `applied_total_fen`, `remain_fen_after`, `invoice_count` |

---

## 五、决策建议

### 5.1 决策结论

**❌ 测试用例9不会通过**

原因：
1. 缺少`payment_id`字段（使用的是`paymentNo`）
2. 缺少`remain_fen_after`字段
3. 字段命名不统一（`totalApplied` vs `applied_total_fen`）
4. `invoice_count`字段不完整（仅在`apply_submit`中有）

### 5.2 需要创建新PR

**PR标题**: `fix(ops-ar): unify analytics fields`

**PR描述**:
```markdown
## 问题

埋点字段不统一，缺少关键字段：
- 使用`paymentNo`而不是`payment_id`
- 缺少`remain_fen_after`（核销后剩余金额）
- 字段命名不明确（`totalApplied` vs `applied_total_fen`）
- `invoice_count`仅在部分事件中存在

## 解决方案

统一所有埋点事件的字段格式：

### apply_submit
- ✅ `payment_id`: 收款单ID
- ✅ `applied_total_fen`: 总核销金额（分）
- ✅ `remain_fen_after`: 核销后剩余金额（分）
- ✅ `invoice_count`: 核销的发票数量

### apply_success
- ✅ `payment_id`
- ✅ `applied_total_fen`
- ✅ `remain_fen_after`
- ✅ `invoice_count`
- ✅ `settled`: 是否结清

### apply_conflict
- ✅ `payment_id`
- ✅ `applied_total_fen`
- ✅ `remain_fen_after`
- ✅ `invoice_count`
- ✅ `error_message`: 错误信息

## 测试

执行测试用例9，验证Console中的埋点日志包含所有必需字段。
```

---

## 六、修复方案

### 6.1 修改文件

`ops-frontend/src/pages/ARApplyDetail.tsx`

### 6.2 修改内容

#### 修改1: apply_submit事件（第58-62行）

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

#### 修改2: apply_success事件（第115-119行）

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
const invoiceCount = validApplies.length;
const remainFenAfter = payment.unappliedAmount - totalApplied;

trackEvent('apply_success', {
  payment_id: payment.id,
  applied_total_fen: totalApplied,
  remain_fen_after: remainFenAfter,
  invoice_count: invoiceCount,
  settled: canSettle,
});
```

---

#### 修改3: apply_conflict事件（第125-128行）

**修改前**:
```typescript
trackEvent('apply_conflict', {
  paymentNo: payment.paymentNo,
  errorMessage: error.userMessage,
});
```

**修改后**:
```typescript
const invoiceCount = validApplies.length;
const remainFenAfter = payment.unappliedAmount - totalApplied;

trackEvent('apply_conflict', {
  payment_id: payment.id,
  applied_total_fen: totalApplied,
  remain_fen_after: remainFenAfter,
  invoice_count: invoiceCount,
  error_message: error.userMessage,
});
```

---

## 七、验证方法

### 7.1 手动测试

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

### 7.2 自动化测试

可以添加单元测试验证埋点调用：

```typescript
// ops-frontend/src/pages/ARApplyDetail.test.tsx
import { vi } from 'vitest';
import { trackEvent } from '../utils/analytics';

vi.mock('../utils/analytics');

test('should track apply_submit with correct fields', () => {
  // ... 触发提交
  
  expect(trackEvent).toHaveBeenCalledWith('apply_submit', {
    payment_id: expect.any(String),
    applied_total_fen: expect.any(Number),
    remain_fen_after: expect.any(Number),
    invoice_count: expect.any(Number),
  });
});
```

---

## 八、总结

### 8.1 决策

**❌ 测试用例9不会通过，需要创建新PR**

### 8.2 行动计划

1. ✅ 创建分支：`fix/ops-ar-analytics-fields`
2. ✅ 修改文件：`ops-frontend/src/pages/ARApplyDetail.tsx`
3. ✅ 统一埋点字段：
   - 使用`payment_id`而不是`paymentNo`
   - 添加`remain_fen_after`字段
   - 重命名`totalApplied`为`applied_total_fen`
   - 统一`invoice_count`字段
4. ✅ 提交PR：`fix(ops-ar): unify analytics fields`
5. ✅ 执行测试用例9验证

### 8.3 优先级

**P0** - 必须在冒烟测试通过前完成

---

**文档版本**: v1.0  
**最后更新**: 2026-01-12
