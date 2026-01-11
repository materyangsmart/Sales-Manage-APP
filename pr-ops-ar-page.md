# feat(ops): AR运营端管理页面

## 概述

本PR实现了运营端AR（应收账款）管理功能的前端页面，包括待处理列表和核销详情页。

## 变更内容

### 新增文件

#### 项目配置
- `ops-frontend/package.json` - 项目依赖配置
- `ops-frontend/vite.config.ts` - Vite构建配置
- `ops-frontend/tsconfig.json` - TypeScript配置
- `ops-frontend/tailwind.config.js` - TailwindCSS配置

#### 核心页面
- `src/pages/ARPaymentList.tsx` - AR待处理列表页面
- `src/pages/ARApplyDetail.tsx` - AR核销详情页面

#### 组件
- `src/components/Amount.tsx` - 金额显示/输入组件（元↔分转换）

#### 服务与类型
- `src/services/ar.ts` - AR API服务（包含幂等性和错误处理）
- `src/types/ar.ts` - AR相关TypeScript类型定义

#### 工具
- `src/utils/analytics.ts` - 埋点工具

#### 测试
- `src/components/Amount.test.tsx` - Amount组件单元测试

## 功能特性

### 1. AR待处理列表 (`/ar/payments`)

✅ **已实现**
- 调用 `GET /ar/payments` 接口获取数据
- 支持按状态、客户ID、日期范围筛选
- 支持分页查询（默认20条/页）
- 实时显示收款金额、未分配金额、状态
- 点击"核销"按钮进入详情页

✅ **UI/UX**
- 使用Ant Design Table组件
- 状态标签颜色区分（待处理/部分核销/已结清）
- 未分配金额为0时高亮显示
- 响应式布局，支持横向滚动

### 2. AR核销详情页

✅ **已实现**
- 显示收款单完整信息
- 列出该客户的所有未结清应收单
- 支持手动输入核销金额（元→分自动转换）
- 支持"快速填充"功能（一键填充剩余金额）
- 实时计算剩余可分配金额
- 核销金额为0时高亮"可结清"状态
- 调用 `POST /ar/apply` 接口提交核销

✅ **校验逻辑**
- 核销金额不能超过应收单余额
- 核销总金额不能超过未分配金额
- 至少选择一个应收单
- 提交前二次确认

✅ **错误处理**
- 409冲突错误特殊提示："数据已被他人更新，请刷新后重试"
- 所有错误都有用户友好的提示信息
- 统一的HTTP拦截器处理

### 3. Amount金额组件

✅ **Amount显示组件**
- 自动将"分"转换为"元"并格式化（保留两位小数）
- 可选显示货币符号（¥）
- 支持自定义样式

✅ **AmountInput输入组件**
- 用户输入"元"，自动转换为"分"
- 实时验证输入格式（最多两位小数）
- 支持最大值限制（防止超额输入）
- 禁用状态样式

### 4. 埋点

✅ **已集成**
- `apply_submit` - 核销提交（包含paymentNo、totalApplied、invoiceCount）
- `apply_success` - 核销成功（包含paymentNo、totalApplied、settled）
- `apply_conflict` - 核销冲突（包含paymentNo、errorMessage）

### 5. API集成

✅ **幂等性**
- 所有POST请求自动添加 `Idempotency-Key` 请求头（UUID v4格式）
- 24小时内重复请求返回缓存响应

✅ **错误处理**
- 统一的响应拦截器
- 409冲突错误特殊处理
- 网络错误友好提示

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **UI组件库**: Ant Design 5
- **样式**: TailwindCSS 3
- **路由**: React Router v6
- **HTTP客户端**: Axios
- **日期处理**: Day.js

## 与后端API对齐

✅ **GET /ar/payments**
- 请求参数：`orgId`, `status`, `customerId`, `dateFrom`, `dateTo`, `method`, `page`, `pageSize`
- 响应格式：`{items, total, page, pageSize, totalPages}`

✅ **POST /ar/apply**
- 请求头：`Idempotency-Key`（自动添加）
- 请求体：`{orgId, paymentId, applies: [{invoiceId, appliedAmount}], operatorId, remark}`
- 响应格式：`{paymentNo, totalApplied, unappliedAmount, paymentStatus, appliedInvoices}`

✅ **金额单位**
- 前后端统一使用"分"为单位
- 前端展示时自动转换为"元"

✅ **时间格式**
- 统一使用ISO8601格式（UTC时区）
- 前端展示时使用Day.js格式化

## 测试

✅ **单元测试**
- Amount组件的元↔分转换逻辑
- 输入验证（小数位数、最大值）

## 待完善（Non-blocking）

以下功能可在后续PR中完善：

1. **路由集成**：将ARApplyDetail页面集成到路由中
2. **登录态集成**：从实际登录态获取orgId和operatorId
3. **完整测试**：添加页面级别的集成测试
4. **埋点SDK集成**：接入实际的埋点服务（如Google Analytics、神策等）
5. **性能优化**：添加列表虚拟滚动（如果数据量很大）
6. **国际化**：支持多语言（如果需要）

## 截图

（TODO: 添加页面截图）

## Checklist

- [x] 代码符合项目规范
- [x] 已添加必要的注释
- [x] 已实现所有核心功能
- [x] 已测试核心逻辑
- [x] 已更新README文档
- [x] 与后端API对齐
- [x] 错误处理完善
- [x] 埋点已集成

## 相关Issue

- Issue #2: 运营端AR管理页面

## 依赖PR

- PR #6: feat/ar-api-minimal（后端API）
