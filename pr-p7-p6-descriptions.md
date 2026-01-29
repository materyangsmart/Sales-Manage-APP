# P7: 审计查询能力 - 让审计日志可用

## 🎯 目标

让审计不是"有表"，而是"可用工具"。

---

## ✅ 完成内容

### 1. 新增4个审计日志查询API

#### GET /audit-logs - 查询审计日志（分页、过滤）

**功能**:
- 支持多维度过滤（userId, action, resourceType, resourceId, time）
- 分页查询
- 性能优化（<500ms）

**请求参数**:
```typescript
{
  userId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startTime?: string; // ISO 8601
  endTime?: string; // ISO 8601
  page?: number; // 默认1
  pageSize?: number; // 默认20
}
```

**响应示例**:
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

---

#### GET /audit-logs/trace - 关键事件追溯

**功能**:
- 按资源类型和ID拉取完整事件链路
- 按时间正序排列
- 显示每次操作的变更内容

**请求参数**:
```typescript
{
  resourceType: string;
  resourceId: string;
}
```

**响应示例**:
```json
{
  "resourceType": "ARPayment",
  "resourceId": "1",
  "events": [
    {
      "id": 1,
      "action": "createPayment",
      "userId": 1,
      "oldValue": null,
      "newValue": { "id": 1, "status": "UNAPPLIED" },
      "createdAt": "2024-01-01T10:00:00Z"
    },
    {
      "id": 2,
      "action": "applyPayment",
      "userId": 1,
      "oldValue": { "status": "UNAPPLIED" },
      "newValue": { "status": "PARTIAL" },
      "createdAt": "2024-01-01T11:00:00Z"
    }
  ],
  "totalEvents": 2
}
```

---

#### GET /audit-logs/recent - 最近的审计日志

**功能**:
- 快速查看最近的操作
- 按时间倒序排列

**请求参数**:
```typescript
{
  limit?: number; // 默认10
}
```

---

#### GET /audit-logs/stats - 统计信息

**功能**:
- 操作类型统计
- 资源类型统计
- Top用户统计

**响应示例**:
```json
{
  "totalLogs": 1000,
  "byAction": {
    "createPayment": 300,
    "applyPayment": 500
  },
  "byResourceType": {
    "ARPayment": 800,
    "ARInvoice": 200
  },
  "topUsers": [
    { "userId": 1, "count": 500 }
  ]
}
```

---

### 2. 性能优化

**索引**:
```sql
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_time ON audit_logs(created_at);
```

**QueryBuilder**:
- 使用TypeORM QueryBuilder避免N+1查询
- 分页优化
- 条件过滤优化

---

## ✅ 验收标准

- [x] 可以用API查出createPayment/applyPayment对应审计记录
- [x] 过滤条件有效且性能可接受（<500ms）
- [x] 支持事件链路追溯
- [x] 支持统计分析

---

## 📋 关键代码

<details>
<summary>点击查看Controller代码</summary>

\`\`\`typescript
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async queryAuditLogs(@Query() dto: QueryAuditLogsDto) {
    return this.auditLogService.queryAuditLogs(dto);
  }

  @Get('trace')
  async traceAuditLogs(@Query() dto: TraceAuditLogsDto) {
    return this.auditLogService.traceAuditLogs(dto);
  }

  @Get('recent')
  async getRecentAuditLogs(@Query('limit') limit?: number) {
    return this.auditLogService.getRecentAuditLogs(limit);
  }

  @Get('stats')
  async getAuditLogStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLogService.getAuditLogStats(startDate, endDate);
  }
}
\`\`\`

</details>

---

## 🧪 测试

**单元测试**: 10个用例
- queryAuditLogs测试（4个）
- traceAuditLogs测试（2个）
- getRecentAuditLogs测试（2个）
- getAuditLogStats测试（2个）

---

---

# P6: 最小业务骨架 - 订单域接口预留

## 🎯 目标

为未来客户端交互留口，但不做客户端。只做中台侧的数据交互"接口边界预留"。

---

## ✅ 完成内容

### 1. 定义并落库最小字典

#### customers表 - 客户信息
- id, org_id, customer_code, customer_name
- contact_person, contact_phone, contact_email
- credit_limit, used_credit, status

#### products表 - 产品信息
- id, org_id, sku, product_name, category
- unit, unit_price, stock_quantity, status

---

### 2. 定义最小订单域与状态机

#### orders表 - 订单主表
- id, org_id, order_no, customer_id, total_amount
- status, order_date, delivery_address

#### order_items表 - 订单明细表
- id, order_id, product_id, product_name, sku
- unit_price, quantity, subtotal

#### 状态机
```
PENDING_REVIEW → APPROVED/REJECTED
APPROVED → FULFILLED
任何状态 → CANCELLED
```

---

### 3. ops端API

#### POST /orders - 创建订单
- 验证客户和产品存在
- 计算订单总金额
- 生成订单编号
- 使用事务创建订单和订单项

#### GET /orders - 查询订单
- 分页查询
- 按组织、客户、状态、时间范围过滤

#### GET /orders/:id - 获取订单详情
- 包含订单项

#### POST /orders/review - 审核订单
- 验证订单状态为PENDING_REVIEW
- 更新订单状态
- 记录审核人和审核时间

---

### 4. 外部客户端权限模型文档

**文件**: `backend/EXTERNAL_CLIENT_AUTH_MODEL.md`

**内容**:
1. 认证架构（内部/外部Token分离）
2. 权限模型（角色定义、资源权限矩阵）
3. API设计（内部/外部API边界）
4. 实现策略（AuthGuard, RoleGuard, CustomerScopeGuard）
5. 数据隔离策略
6. 安全最佳实践
7. DTO设计
8. 未来扩展

---

## ⚠️ 需要修正的问题

**当前问题**: 订单模块API路径没有统一到 `/api/internal/orders`

**需要修正**:
- POST /orders → POST /api/internal/orders
- GET /orders → GET /api/internal/orders
- GET /orders/:id → GET /api/internal/orders/:id
- POST /orders/review → POST /api/internal/orders/review

**原因**: 未来做网关、权限与审计策略时需要统一前缀

**修正方案**: 见P8任务

---

## ✅ 验收标准

- [x] 后端能以最小方式跑通：创建订单→审核→查询
- [x] 明确未来外部侧的token/权限模型（文档）
- [ ] API路径统一到internal前缀（P8修正）
- [ ] 触发生成invoice（P10实现）

---

## 📝 后续工作

1. **P8**: 统一API前缀 + 身份注入规范
2. **P9**: 外部权限模型安全落地
3. **P10**: 订单与AR挂接（fulfill→生成invoice）

---

## 📄 创建PR的方法

### P7 PR

**分支**: `feat/audit-query-api`

**PR标题**: `feat(ar): add audit log query API`

**创建链接**:
```
https://github.com/materyangsmart/Sales-Manage-APP/compare/main...feat/audit-query-api?expand=1
```

---

### P6 PR

**分支**: `feat/minimal-order-skeleton`

**PR标题**: `feat(backend): add minimal order skeleton`

**创建链接**:
```
https://github.com/materyangsmart/Sales-Manage-APP/compare/main...feat/minimal-order-skeleton?expand=1
```

---

**注意**: P6的PR创建后，请立即开始P8任务修正API路径问题。
