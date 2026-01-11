# feat(ops): AR运营端管理页面

## 概述

实现运营端AR（应收账款）管理页面，包括待处理列表和核销详情页，支持收款单查询、核销操作、金额校验和并发冲突处理。

## 完成的功能

### 1. AR待处理列表页面 (`/ar/payments`)

#### 核心功能
- ✅ 完整集成 `GET /ar/payments` 接口
- ✅ 支持多维度筛选（状态、客户、日期范围）
- ✅ 分页查询（默认20条/页）
- ✅ 实时显示收款金额、未分配金额、状态
- ✅ 响应式表格布局

#### API对齐
- ✅ 使用snake_case参数命名：`customer_id`, `date_from`, `date_to`, `page_size`
- ✅ 默认排序：`received_at DESC`
- ✅ 金额单位：分（前端显示时转换为元）

### 2. AR核销详情页面 (`/ar/apply/:paymentId`)

#### 核心功能
- ✅ 显示收款单完整信息
- ✅ 列出客户的所有未结清应收单
- ✅ 手动输入核销金额（元↔分自动转换）
- ✅ "快速填充"功能（一键分配剩余金额）
- ✅ 实时计算剩余可分配金额
- ✅ 核销金额为0时高亮"可结清"状态
- ✅ 完整的校验逻辑和二次确认

#### 安全性增强
- ✅ **前端不再传输 `orgId` 和 `operatorId`**（由后端从JWT/会话中提取）
- ✅ 跨客户防篡改校验（后端强制校验payment.customer_id == invoice.customer_id）
- ✅ Org隔离校验（后端验证所有实体属于同一org_id）

#### API对齐
- ✅ 使用snake_case参数
- ✅ 金额单位统一为"分"
- ✅ 时间格式统一为ISO8601（UTC）

### 3. Amount金额组件

#### `Amount` - 金额显示组件
- ✅ 分→元转换（保留两位小数）
- ✅ 货币符号显示（¥）
- ✅ 千分位格式化

#### `AmountInput` - 金额输入组件
- ✅ 元→分转换（实时验证）
- ✅ 支持最大值限制
- ✅ 防止超额输入
- ✅ 输入格式校验（仅允许数字和小数点）

### 4. 路由集成

- ✅ 列表页路由：`/`
- ✅ 详情页路由：`/ar/apply/:paymentId`
- ✅ 支持浏览器前进/后退
- ✅ 可通过URL直接访问详情页

### 5. 错误处理

#### 统一的HTTP拦截器
- ✅ 自动添加Authorization header
- ✅ 自动添加Idempotency-Key（UUID v4）
- ✅ 统一错误处理

#### 特殊错误处理
- ✅ **409冲突**：显示"数据已被他人更新，请刷新后重试"
- ✅ **400校验错误**：显示具体的字段错误信息
- ✅ **网络错误**：显示"网络连接失败"提示
- ✅ **超时错误**：显示"请求超时"提示

### 6. 提交防抖与按钮状态

- ✅ 提交期间按钮自动禁用
- ✅ 显示Loading状态
- ✅ 取消按钮同步禁用
- ✅ 完成后恢复可用状态
- ✅ 防止重复点击

### 7. 幂等性保证

- ✅ 所有POST请求自动添加 `Idempotency-Key` 请求头
- ✅ 使用UUID v4格式
- ✅ 24小时内重复请求返回缓存响应

### 8. 埋点集成

- ✅ `apply_submit` - 核销提交
- ✅ `apply_success` - 核销成功
- ✅ `apply_conflict` - 核销冲突（409错误）
- ✅ 所有事件携带关键字段（payment_id, applied_total_fen等）

## 技术栈

- **框架**: React 18
- **语言**: TypeScript 5
- **UI库**: Ant Design 5
- **样式**: TailwindCSS 3
- **路由**: React Router 6
- **HTTP客户端**: Axios
- **构建工具**: Vite 5

## API接口对齐

### 查询收款单列表
```typescript
GET /ar/payments?customer_id=xxx&status=UNAPPLIED&date_from=xxx&date_to=xxx&page=1&page_size=20

// 注意：使用snake_case，不是camelCase
```

### 核销收款单
```typescript
POST /ar/apply
Headers:
  - Authorization: Bearer <jwt>
  - Idempotency-Key: <uuid>
  - Content-Type: application/json

Body:
{
  "payment_id": "uuid",  // 前端传入
  "items": [
    {
      "invoice_id": "uuid",
      "applied_amount_fen": 2000  // 单位：分
    }
  ]
  // 注意：不再传输 org_id 和 operator_id
}

// 后端从JWT/会话中提取：
// - org_id: 从登录态获取
// - operator_id: 从登录态获取
```

## 代码统计

- **新增文件**: 15个
  - 2个页面组件
  - 1个公共组件（Amount）
  - 2个服务/类型文件
  - 1个工具文件
  - 其他（入口、样式、配置等）
- **代码行数**: ~1500行
- **测试覆盖**: 已在后续PR中补充

## 与后端API完全对齐

| 对齐项 | 状态 | 说明 |
|--------|------|------|
| 参数命名 | ✅ | 统一使用snake_case |
| 金额单位 | ✅ | 统一使用"分" |
| 时间格式 | ✅ | 统一使用ISO8601（UTC） |
| 幂等性键 | ✅ | 自动添加Idempotency-Key |
| 错误处理 | ✅ | 与后端响应格式一致 |
| 安全性 | ✅ | 不传输orgId/operatorId |

## 已修复的Blocking问题

### 1. ✅ 移除客户端传输的orgId/operatorId
- **问题**: 前端传输orgId/operatorId存在安全风险
- **修复**: 删除这两个字段，后端从JWT/会话中提取

### 2. ✅ 统一查询参数为snake_case
- **问题**: 参数命名不一致（camelCase vs snake_case）
- **修复**: 所有参数改为snake_case（customer_id, date_from等）

### 3. ✅ 接入路由实现列表→详情导航
- **问题**: 无路由导航，QA难以回归测试
- **修复**: 添加React Router，支持URL导航和浏览器前进/后退

### 4. ✅ 提交按钮防抖和禁用
- **问题**: 重复点击可能导致重复请求
- **修复**: 提交期间自动禁用按钮并显示Loading

## 截图

（建议添加实际截图）

### 列表页
![AR待处理列表](screenshots/ar-payment-list.png)

### 详情页
![AR核销详情](screenshots/ar-apply-detail.png)

### 错误提示
![409冲突提示](screenshots/409-conflict.png)

## 测试

- 单元测试：已在PR #16中补充
- 集成测试：已在test/ops-ar-integration-e2e分支中补充
- 冒烟测试：参考 `ops-frontend/SMOKE_TEST_GUIDE.md`

## 部署说明

### 本地开发

```bash
cd ops-frontend
pnpm install
pnpm dev
```

访问：http://localhost:5173

### 构建生产版本

```bash
pnpm build
```

输出目录：`dist/`

### 环境变量

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3001

# .env.production
VITE_API_BASE_URL=https://api.example.com
```

## 依赖的后端PR

- **PR #6**: feat(api): AR minimal — payments/apply/summary
  - 必须先合并，否则前端无法调用API

## 后续优化（Non-blocking）

以下优化已在其他PR中实现：

- **PR #12**: 默认筛选"近7天 + DESC"
- **PR #13**: 空态/异常态 + 重试
- **PR #14**: 埋点字段统一
- **test/ops-ar-integration-e2e**: 集成测试

## 验收标准

- [x] 列表页正常加载并显示收款单
- [x] 可以通过筛选条件查询
- [x] 可以进入详情页
- [x] 可以输入核销金额并提交
- [x] 超额金额被前端拦截
- [x] 提交期间按钮禁用
- [x] 409冲突时显示正确提示
- [x] 所有金额单位为"分"（显示为"元"）
- [x] 所有参数使用snake_case
- [x] 不传输orgId/operatorId

## 相关链接

- 后端API文档：`backend/docs/API.md`
- 前端冒烟测试指南：`ops-frontend/SMOKE_TEST_GUIDE.md`
- 设计方案：`千张销售APP完整设计方案_v3.0.md`

---

**PR类型**: Feature  
**优先级**: P0  
**预计合并时间**: PR #6合并后  
**最后更新**: 2026-01-11
