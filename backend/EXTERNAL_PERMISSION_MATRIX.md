# 外部端权限矩阵

## 🎯 目标

明确外部客户（CUSTOMER角色）的API访问权限，确保数据隔离和安全。

---

## 📋 权限矩阵

### 订单API

| API | 内部端 | 外部端 | 说明 |
|-----|--------|--------|------|
| POST /api/internal/orders | ✅ ADMIN, OPERATOR | ❌ | 创建订单（内部用） |
| POST /api/internal/orders/review | ✅ ADMIN, OPERATOR | ❌ | 审核订单（内部用） |
| GET /api/internal/orders | ✅ ADMIN, OPERATOR, AUDITOR | ❌ | 查询所有订单（内部用） |
| GET /api/internal/orders/:id | ✅ ADMIN, OPERATOR, AUDITOR | ❌ | 查询订单详情（内部用） |
| GET /api/external/orders | ❌ | ✅ CUSTOMER | 查询我的订单（外部用） |
| GET /api/external/orders/:id | ❌ | ✅ CUSTOMER | 查询我的订单详情（外部用） |

---

### 审计日志API

| API | 内部端 | 外部端 | 说明 |
|-----|--------|--------|------|
| GET /audit-logs | ✅ ADMIN, AUDITOR | ❌ | 查询审计日志（内部工具） |
| GET /audit-logs/trace | ✅ ADMIN, AUDITOR | ❌ | 事件追溯（内部工具） |
| GET /audit-logs/recent | ✅ ADMIN, AUDITOR | ❌ | 最近日志（内部工具） |
| GET /audit-logs/stats | ✅ ADMIN, AUDITOR | ❌ | 统计信息（内部工具） |

**原因**: 审计日志是内部追责工具，不应该对外开放。

---

### AR（应收账款）API

| API | 内部端 | 外部端 | 说明 |
|-----|--------|--------|------|
| POST /ar/payments | ✅ ADMIN, OPERATOR | ❌ | 创建收款单（内部用） |
| POST /ar/apply | ✅ ADMIN, OPERATOR | ❌ | 核销应收（内部用） |
| GET /ar/payments | ✅ ADMIN, OPERATOR, AUDITOR | ❌ | 查询收款单（内部用） |
| GET /ar/summary | ✅ ADMIN, OPERATOR, AUDITOR | ❌ | 应收汇总（内部用） |

**未来扩展**: 可以考虑为外部客户提供只读的AR查询API，但需要强制执行CustomerScope。

---

## 🔒 数据隔离策略

### 内部端（/api/internal/*）

**特点**:
- 可以访问所有组织、所有客户的数据
- 通过orgId参数过滤数据
- 不强制执行CustomerScope

**角色**:
- ADMIN: 全部权限（读写）
- OPERATOR: 运营权限（读写）
- AUDITOR: 审计权限（只读）

---

### 外部端（/api/external/*）

**特点**:
- 只能访问自己的数据
- 强制执行CustomerScope（customerId = token.customerId）
- 客户端传入的customerId参数会被忽略
- 只读API（不允许创建、修改、删除）

**角色**:
- CUSTOMER: 外部客户（只读自己的数据）

---

## 🛡️ 安全机制

### 1. CustomerScope强制执行

**实现方式**:
```typescript
@Controller('api/external/orders')
@UseGuards(RolesGuard, CustomerScopeGuard)
@Roles(Role.CUSTOMER)
@CustomerScope()
export class ExternalOrderController {
  @Get()
  async getMyOrders(@Query() dto: QueryOrdersDto, @Request() req) {
    // 强制使用token中的customerId
    const customerId = req.user?.customerId;
    return this.orderService.queryOrders({ ...dto, customerId });
  }
}
```

**效果**:
- ✅ 客户端传入`customerId=2`会被忽略
- ✅ 强制使用`token.customerId`
- ✅ 防止越权访问

---

### 2. 资源归属校验

**实现方式**:
```typescript
@Get(':id')
async getMyOrderById(@Param('id') id: number, @Request() req) {
  const order = await this.orderService.getOrderById(id);
  
  // 验证订单归属
  if (order.customerId !== req.user.customerId) {
    throw new ForbiddenException('You do not have permission to access this order');
  }
  
  return order;
}
```

**效果**:
- ✅ customer A 无法访问 customer B 的订单详情
- ✅ 返回403 Forbidden

---

### 3. API边界隔离

**内部API**: `/api/internal/*`
- 只允许内部角色（ADMIN, OPERATOR, AUDITOR）访问
- 外部客户访问返回403

**外部API**: `/api/external/*`
- 只允许外部客户（CUSTOMER）访问
- 内部角色不需要访问（直接用内部API）

---

## 🧪 测试覆盖

### 越权访问测试

1. ✅ customer A 访问 customer B 的订单列表 => 只返回 customer A 的数据
2. ✅ customer A 访问 customer B 的订单详情 => 403 Forbidden
3. ✅ customer B 访问 customer A 的订单详情 => 403 Forbidden

### CustomerScope强制执行测试

4. ✅ 客户端传入`customerId=2`被忽略 => 只返回token.customerId的数据
5. ✅ token缺少customerId => 403 Forbidden

### 外部端权限矩阵测试

6. ✅ 外部客户访问审计日志 => 403 Forbidden
7. ✅ 外部客户创建订单 => 404 Not Found（API不存在）
8. ✅ 外部客户审核订单 => 404 Not Found（API不存在）

### 内部API隔离测试

9. ✅ 外部客户访问内部订单API => 403 Forbidden
10. ✅ 外部客户创建内部订单 => 403 Forbidden

---

## 📝 未来扩展

### 1. 外部客户创建订单

**场景**: 允许外部客户自助下单

**实现**:
```typescript
@Controller('api/external/orders')
export class ExternalOrderController {
  @Post()
  @Roles(Role.CUSTOMER)
  @CustomerScope()
  async createMyOrder(@Body() dto: CreateOrderDto, @Request() req) {
    // 强制使用token中的customerId
    const customerId = req.user?.customerId;
    return this.orderService.createOrder({ ...dto, customerId });
  }
}
```

**权限矩阵更新**:
| API | 外部端 | 说明 |
|-----|--------|------|
| POST /api/external/orders | ✅ CUSTOMER | 创建我的订单 |

---

### 2. 外部客户查询AR

**场景**: 允许外部客户查询自己的应收账款

**实现**:
```typescript
@Controller('api/external/ar')
@UseGuards(RolesGuard, CustomerScopeGuard)
@Roles(Role.CUSTOMER)
@CustomerScope()
export class ExternalARController {
  @Get('payments')
  async getMyPayments(@Query() dto: QueryPaymentsDto, @Request() req) {
    const customerId = req.user?.customerId;
    return this.arService.queryPayments({ ...dto, customerId });
  }
}
```

**权限矩阵更新**:
| API | 外部端 | 说明 |
|-----|--------|------|
| GET /api/external/ar/payments | ✅ CUSTOMER | 查询我的收款单 |
| GET /api/external/ar/invoices | ✅ CUSTOMER | 查询我的发票 |

---

## 🎯 总结

**核心原则**:
1. ✅ 内部/外部API完全分离（不同路径前缀）
2. ✅ 外部客户强制执行CustomerScope（只能访问自己的数据）
3. ✅ 审计日志等内部工具不对外开放
4. ✅ 外部API默认只读（未来可扩展写操作）
5. ✅ 100%测试覆盖（10个测试用例）

**安全保障**:
- ❌ 客户端无法伪造customerId
- ❌ 客户端无法越权访问其他客户的数据
- ❌ 客户端无法访问内部工具（审计日志等）
- ✅ 所有数据访问都有明确的权限控制
