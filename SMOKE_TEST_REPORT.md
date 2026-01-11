# AR运营端冒烟测试报告

**测试日期**: 2026-01-12  
**测试人员**: [待填写]  
**测试环境**: 
- 前端: http://localhost:5173
- 后端: http://localhost:3001
- 浏览器: Chrome [版本号]

---

## 一、测试概述

本次冒烟测试旨在验证AR运营端的核心功能，包括：
1. 后端API的基本功能（收款单创建、核销、查询）
2. 前端11条关键用例（列表、详情、埋点等）
3. 根据测试结果决定是否需要补充PR #14（埋点统一）

---

## 二、后端API测试结果

### 测试执行

**脚本**: `backend/scripts/smoke-test-improved.sh`  
**执行命令**:
```bash
cd backend
export API_BASE=http://localhost:3001
export JWT=your_jwt_token_here
export CUSTOMER_ID=CUST001
export INVOICE_ID=INV001
bash scripts/smoke-test-improved.sh
```

### 测试结果

| 测试项 | 状态 | HTTP状态码 | 备注 |
|--------|------|-----------|------|
| 创建收款单 | ⬜ | ___ | |
| 幂等性测试 | ⬜ | ___ | |
| 幂等性断言 | ⬜ | N/A | 两次响应payment_id是否一致 |
| 核销收款单 | ⬜ | ___ | |
| 查询账本汇总 | ⬜ | ___ | |
| 查询收款单列表（默认排序） | ⬜ | ___ | |
| 查询收款单列表（近7天） | ⬜ | ___ | |
| 查询收款单列表（蛇形命名） | ⬜ | ___ | |

**通过**: ___ / 8  
**失败**: ___ / 8

### 发现的问题

1. _____________
2. _____________

---

## 三、前端测试结果

### 3.1 测试用例汇总

| 用例编号 | 测试项 | 状态 | 备注 |
|---------|--------|------|------|
| 1 | 默认筛选"近7天 + DESC" | ⬜ | PR-12 |
| 2 | 用户偏好记忆 | ⬜ | PR-12 |
| 3 | 空态展示 | ⬜ | PR-13 |
| 4 | 异常态展示与重试 | ⬜ | PR-13 |
| 5 | 进入详情页 | ⬜ | PR-7 |
| 6 | 金额输入校验 | ⬜ | PR-7 |
| 7 | 提交按钮禁用与Loading | ⬜ | PR-7 |
| 8 | 409并发冲突提示 | ⬜ | PR-7 |
| 9 | ⭐ 埋点事件验证 | ⬜ | **PR-14决策关键** |
| 10 | 快速填充功能 | ⬜ | PR-7 |
| 11 | 金额显示格式 | ⬜ | PR-7 |

**必须通过（Blocking）**: ___ / 9  
**建议通过（Non-blocking）**: ___ / 2  
**总计**: ___ / 11

### 3.2 测试用例详情

#### 测试用例 1: 默认筛选"近7天 + DESC"

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 日期筛选器自动设置为"近7天"
- [ ] 列表按"到款时间"降序排列
- [ ] 状态筛选默认为"全部"或"未分配"

**截图**: `ops-frontend/screenshots/test-case-1-default-filters.png`

**备注**: _____________

---

#### 测试用例 2: 用户偏好记忆

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 刷新后，筛选条件仍为用户自定义值
- [ ] 列表数据与刷新前一致

**截图**: `ops-frontend/screenshots/test-case-2-filter-memory.png`

**备注**: _____________

---

#### 测试用例 3: 空态展示

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 显示空态图标和文案
- [ ] 显示"修改筛选"或"重试"按钮
- [ ] 无白屏或加载中状态

**截图**: `ops-frontend/screenshots/test-case-3-empty-state.png`

**备注**: _____________

---

#### 测试用例 4: 异常态展示与重试

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 断网时显示错误提示
- [ ] 显示"重试"按钮
- [ ] 点击"重试"后，成功加载数据
- [ ] 弱网时显示Loading骨架

**截图**: 
- `ops-frontend/screenshots/test-case-4-error-state.png`
- `ops-frontend/screenshots/test-case-4-retry-success.png`

**备注**: _____________

---

#### 测试用例 5: 进入详情页

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 页面跳转到详情页
- [ ] 详情页显示收款单信息
- [ ] 显示该客户的未结清应收单列表
- [ ] 浏览器后退按钮可用

**截图**: `ops-frontend/screenshots/test-case-5-detail-page.png`

**备注**: _____________

---

#### 测试用例 6: 金额输入校验

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 输入框显示红色边框
- [ ] 显示错误提示
- [ ] "提交核销"按钮禁用

**截图**: `ops-frontend/screenshots/test-case-6-amount-validation.png`

**备注**: _____________

---

#### 测试用例 7: 提交按钮禁用与Loading

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 按钮立即变为禁用状态
- [ ] 按钮文字变为"提交中..."
- [ ] "取消"按钮也被禁用
- [ ] 提交完成后按钮恢复

**截图**: `ops-frontend/screenshots/test-case-7-submit-loading.png`

**备注**: _____________

---

#### 测试用例 8: 409并发冲突提示

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 显示Toast提示
- [ ] 提示框为红色或警告样式
- [ ] 按钮恢复可用状态
- [ ] 页面数据自动刷新

**截图**: `ops-frontend/screenshots/test-case-8-409-conflict.png`

**备注**: _____________

---

#### ⭐ 测试用例 9: 埋点事件验证（关键）

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] `apply_submit` 事件包含 `payment_id`
- [ ] `apply_submit` 事件包含 `applied_total_fen`
- [ ] `apply_submit` 事件包含 `remain_fen_after`
- [ ] `apply_submit` 事件包含 `invoice_count`
- [ ] `apply_success` 事件包含相同字段
- [ ] `apply_conflict` 事件包含相同字段

**截图**: `ops-frontend/screenshots/test-case-9-analytics.png`

**Console日志示例**:
```
[Analytics] apply_submit: {payment_id: "P1", applied_total_fen: 2000, remain_fen_after: 3000, invoice_count: 1}
```

**备注**: _____________

**决策**:
- [ ] ✅ 通过 - 埋点字段完整，不需要新PR
- [ ] ❌ 失败 - 需要创建PR fix(ops-ar): unify analytics fields

---

#### 测试用例 10: 快速填充功能

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 金额输入框自动填充
- [ ] 填充逻辑正确（取min(剩余金额, 应收单余额)）
- [ ] "剩余可分配金额"实时更新

**截图**: `ops-frontend/screenshots/test-case-10-quick-fill.png`

**备注**: _____________

---

#### 测试用例 11: 金额显示格式

**状态**: ⬜ 未测试 / ✅ 通过 / ❌ 失败

**验收点**:
- [ ] 所有金额显示为"元"（保留两位小数）
- [ ] 例如：5000分显示为"¥50.00"
- [ ] 输入框中输入"50"，提交时转换为5000分

**截图**: `ops-frontend/screenshots/test-case-11-amount-format.png`

**备注**: _____________

---

## 四、PR #14决策

### 决策依据

根据测试用例9（埋点事件验证）的结果：

**测试结果**: ⬜ 通过 / ⬜ 失败

### 决策结论

- [ ] **不需要新PR** - 埋点字段完整，功能已存在
- [ ] **需要新PR** - 缺失以下字段，需要补充：
  - [ ] `payment_id`
  - [ ] `applied_total_fen`
  - [ ] `remain_fen_after`
  - [ ] `invoice_count`

### 行动计划

如果需要新PR：
1. 创建分支：`fix/ops-ar-analytics-fields`
2. 修改文件：`ops-frontend/src/pages/ARApplyDetail.tsx`
3. 补充埋点字段
4. 提交PR：`fix(ops-ar): unify analytics fields`

---

## 五、PR #16（E2E测试）处理

**决策**: 作为P1任务，在主干稳定且冒烟通过后再补

**建议**:
- 使用Playwright或Vitest+MSW
- 优先覆盖 list→detail→409 这条链路
- 在所有功能PR合并后再创建

---

## 六、发现的问题

### 6.1 后端问题

1. _____________
2. _____________

### 6.2 前端问题

1. _____________
2. _____________

### 6.3 工程化问题

1. _____________
2. _____________

---

## 七、测试结论

### 7.1 后端API

- [ ] ✅ 所有测试通过，后端功能正常
- [ ] ⚠️ 部分测试失败，需要修复
- [ ] ❌ 关键测试失败，不建议上线

### 7.2 前端功能

- [ ] ✅ 所有必须通过的测试用例通过，建议合并
- [ ] ⚠️ 部分测试用例失败，需要修复后重新测试
- [ ] ❌ 关键测试用例失败，不建议合并

### 7.3 总体结论

**状态**: ⬜ 通过 / ⬜ 有条件通过 / ⬜ 不通过

**建议**: _____________

---

## 八、附录

### 8.1 测试环境信息

- Node.js版本: _____________
- npm/pnpm版本: _____________
- 数据库版本: _____________
- 操作系统: _____________

### 8.2 测试数据

- 客户ID: `CUST001`
- 发票ID: `INV001`
- 收款单ID: _____________
- 测试金额: 5000分（50元）
- 核销金额: 2000分（20元）

### 8.3 截图清单

1. ⬜ `test-case-1-default-filters.png`
2. ⬜ `test-case-2-filter-memory.png`
3. ⬜ `test-case-3-empty-state.png`
4. ⬜ `test-case-4-error-state.png`
5. ⬜ `test-case-4-retry-success.png`
6. ⬜ `test-case-5-detail-page.png`
7. ⬜ `test-case-6-amount-validation.png`
8. ⬜ `test-case-7-submit-loading.png`
9. ⬜ `test-case-8-409-conflict.png`
10. ⬜ `test-case-9-analytics.png`
11. ⬜ `test-case-10-quick-fill.png`
12. ⬜ `test-case-11-amount-format.png`

---

**测试人员签名**: _____________  
**审核人签名**: _____________  
**日期**: 2026-01-12

---

**文档版本**: v1.0  
**最后更新**: 2026-01-12
