# P6任务：最小业务骨架接口占位

**任务目标**: 为未来客户端交互留口，但不做客户端。只做中台侧的数据交互"接口边界预留"，避免后续大改。

**执行日期**: 2026-01-12

**状态**: ✅ 完成

---

## 📋 任务内容

### 1. 定义并落库最小字典

✅ **customers表** - 客户信息（10-30个客户）

✅ **products表** - 产品信息（10-30个SKU）

---

### 2. 定义最小订单域与状态机

✅ **orders表** - 订单主表

✅ **order_items表** - 订单明细表

✅ **状态机**:
- PENDING_REVIEW: 待审核
- APPROVED: 已批准
- REJECTED: 已拒绝
- FULFILLED: 已完成
- CANCELLED: 已取消

---

### 3. 只做ops端API

✅ **POST /orders** - 创建订单（内部用）

✅ **GET /orders** - 查询订单（内部用）

✅ **GET /orders/:id** - 获取订单详情

✅ **POST /orders/review** - 审核订单（approve/reject）

---

### 4. 明确未来外部侧的token/权限模型

✅ **文档**: `EXTERNAL_CLIENT_AUTH_MODEL.md`

✅ **内容**:
- 内部/外部token分离
- 客户只能看到自己的customerId
- 数据隔离策略
- API边界设计

---

## 🗄️ 数据模型

### 1. customers表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| org_id | INT | 组织ID |
| customer_code | VARCHAR(50) | 客户编码（唯一） |
| customer_name | VARCHAR(200) | 客户名称 |
| contact_person | VARCHAR(100) | 联系人 |
| contact_phone | VARCHAR(50) | 联系电话 |
| contact_email | VARCHAR(100) | 联系邮箱 |
| address | TEXT | 地址 |
| credit_limit | INT | 信用额度（分） |
| used_credit | INT | 已用信用额度（分） |
| status | ENUM | 状态（ACTIVE, INACTIVE, BLOCKED） |
| created_by | INT | 创建人ID |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引**:
- idx_customers_org: (org_id)
- idx_customers_code: (customer_code) UNIQUE

---

### 2. products表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| org_id | INT | 组织ID |
| sku | VARCHAR(50) | SKU编码（唯一） |
| product_name | VARCHAR(200) | 产品名称 |
| category | VARCHAR(100) | 产品类别 |
| unit | VARCHAR(20) | 单位 |
| unit_price | INT | 单价（分） |
| stock_quantity | INT | 库存数量 |
| status | ENUM | 状态（ACTIVE, INACTIVE, DISCONTINUED） |
| description | TEXT | 产品描述 |
| created_by | INT | 创建人ID |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引**:
- idx_products_org: (org_id)
- idx_products_sku: (sku) UNIQUE

---

### 3. orders表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| org_id | INT | 组织ID |
| order_no | VARCHAR(50) | 订单编号（唯一） |
| customer_id | INT | 客户ID |
| total_amount | INT | 订单总金额（分） |
| status | ENUM | 订单状态 |
| order_date | DATE | 订单日期 |
| delivery_address | TEXT | 交货地址 |
| delivery_date | DATE | 交货日期 |
| remark | TEXT | 备注 |
| created_by | INT | 创建人ID |
| reviewed_by | INT | 审核人ID |
| reviewed_at | DATETIME | 审核时间 |
| review_comment | TEXT | 审核意见 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引**:
- idx_orders_org: (org_id)
- idx_orders_customer: (customer_id)
- idx_orders_no: (order_no) UNIQUE
- idx_orders_status: (status)

---

### 4. order_items表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| order_id | INT | 订单ID |
| product_id | INT | 产品ID |
| product_name | VARCHAR(200) | 产品名称（冗余） |
| sku | VARCHAR(50) | SKU编码（冗余） |
| unit_price | INT | 单价（分） |
| quantity | INT | 数量 |
| subtotal | INT | 小计（分） |
| remark | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引**:
- idx_order_items_order: (order_id)
- idx_order_items_product: (product_id)

---

## 🔄 订单状态机

### 状态转换图

```
         创建订单
            ↓
    [PENDING_REVIEW]
         /     \
    审核通过   审核拒绝
      /           \
  [APPROVED]    [REJECTED]
      |
   完成交付
      |
  [FULFILLED]
  
  任何状态都可以取消 → [CANCELLED]
```

---

### 状态转换规则

| 当前状态 | 允许的操作 | 目标状态 |
|---------|-----------|---------|
| PENDING_REVIEW | 审核通过 | APPROVED |
| PENDING_REVIEW | 审核拒绝 | REJECTED |
| PENDING_REVIEW | 取消订单 | CANCELLED |
| APPROVED | 完成交付 | FULFILLED |
| APPROVED | 取消订单 | CANCELLED |
| REJECTED | 无 | - |
| FULFILLED | 无 | - |
| CANCELLED | 无 | - |

---

## 🔧 API详情

### 1. POST /orders - 创建订单

**描述**: 创建订单（内部用）

**请求体**:
```typescript
{
  orgId: number;
  customerId: number;
  orderDate: string; // ISO 8601
  items: [
    {
      productId: number;
      quantity: number;
      remark?: string;
    }
  ];
  deliveryAddress?: string;
  deliveryDate?: string; // ISO 8601
  remark?: string;
  createdBy: number;
}
```

**响应示例**:
```json
{
  "id": 1,
  "orgId": 2,
  "orderNo": "ORD-20260112-0001",
  "customerId": 1,
  "totalAmount": 50000,
  "status": "PENDING_REVIEW",
  "orderDate": "2024-01-01",
  "deliveryAddress": "北京市朝阳区xxx",
  "deliveryDate": "2024-01-10",
  "remark": "请尽快发货",
  "createdBy": 1,
  "createdAt": "2024-01-01T10:00:00Z",
  "items": [
    {
      "id": 1,
      "orderId": 1,
      "productId": 1,
      "productName": "产品A",
      "sku": "SKU-001",
      "unitPrice": 10000,
      "quantity": 5,
      "subtotal": 50000
    }
  ]
}
```

**业务逻辑**:
1. 验证客户存在且状态为ACTIVE
2. 验证产品存在且状态为ACTIVE
3. 计算订单总金额
4. 生成订单编号（ORD-YYYYMMDD-XXXX）
5. 使用事务创建订单和订单项

---

### 2. GET /orders - 查询订单

**描述**: 查询订单（分页、过滤）

**请求参数**:
```typescript
{
  orgId: number;
  customerId?: number;
  status?: string;
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  page?: number; // 默认1
  pageSize?: number; // 默认20
}
```

**响应示例**:
```json
{
  "items": [
    {
      "id": 1,
      "orderNo": "ORD-20260112-0001",
      "customerId": 1,
      "totalAmount": 50000,
      "status": "PENDING_REVIEW",
      "orderDate": "2024-01-01",
      "createdAt": "2024-01-01T10:00:00Z",
      "items": [...]
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

---

### 3. GET /orders/:id - 获取订单详情

**描述**: 获取订单详情（包含订单项）

**响应示例**:
```json
{
  "id": 1,
  "orgId": 2,
  "orderNo": "ORD-20260112-0001",
  "customerId": 1,
  "totalAmount": 50000,
  "status": "PENDING_REVIEW",
  "orderDate": "2024-01-01",
  "deliveryAddress": "北京市朝阳区xxx",
  "deliveryDate": "2024-01-10",
  "remark": "请尽快发货",
  "createdBy": 1,
  "reviewedBy": null,
  "reviewedAt": null,
  "reviewComment": null,
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z",
  "items": [
    {
      "id": 1,
      "orderId": 1,
      "productId": 1,
      "productName": "产品A",
      "sku": "SKU-001",
      "unitPrice": 10000,
      "quantity": 5,
      "subtotal": 50000,
      "remark": null,
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

---

### 4. POST /orders/review - 审核订单

**描述**: 审核订单（approve/reject）

**请求体**:
```typescript
{
  orderId: number;
  action: "APPROVED" | "REJECTED";
  comment?: string;
  reviewedBy: number;
}
```

**响应示例**:
```json
{
  "id": 1,
  "orderNo": "ORD-20260112-0001",
  "status": "APPROVED",
  "reviewedBy": 1,
  "reviewedAt": "2024-01-01T11:00:00Z",
  "reviewComment": "审核通过，可以发货"
}
```

**业务逻辑**:
1. 验证订单存在
2. 验证订单状态为PENDING_REVIEW
3. 更新订单状态
4. 记录审核人和审核时间
5. 如果批准，可以触发生成发票（未来扩展）

---

## ✅ 验收标准

### 1. 后端能以最小方式跑通

✅ **测试流程**:
```bash
# 1. 创建订单
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": 2,
    "customerId": 1,
    "orderDate": "2024-01-01",
    "items": [
      { "productId": 1, "quantity": 5 }
    ],
    "createdBy": 1
  }'

# 2. 审核订单
curl -X POST http://localhost:3000/orders/review \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 1,
    "action": "APPROVED",
    "comment": "审核通过",
    "reviewedBy": 1
  }'

# 3. 查询订单
curl "http://localhost:3000/orders?orgId=2&status=APPROVED"

# 4. 获取订单详情
curl "http://localhost:3000/orders/1"
```

**期望结果**:
- ✅ 创建订单成功，返回201
- ✅ 审核订单成功，状态变为APPROVED
- ✅ 查询订单成功，返回正确的订单列表
- ✅ 获取订单详情成功，包含订单项

---

### 2. （可选）触发生成invoice（与现有AR对接）

⏸️ **未来扩展**:
```typescript
async reviewOrder(dto: ReviewOrderDto) {
  // ... 审核逻辑

  if (dto.action === 'APPROVED') {
    // 触发生成发票
    await this.generateInvoiceFromOrder(order);
  }

  return order;
}

private async generateInvoiceFromOrder(order: Order) {
  // 1. 创建发票
  const invoice = await this.arService.createInvoice({
    orgId: order.orgId,
    customerId: order.customerId,
    invoiceNo: `INV-${order.orderNo}`,
    totalAmount: order.totalAmount,
    // ...
  });

  // 2. 创建发票明细
  for (const item of order.items) {
    await this.arService.createInvoiceItem({
      invoiceId: invoice.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    });
  }

  return invoice;
}
```

---

## 🔐 外部客户端权限模型

### 文档

✅ **文件**: `backend/EXTERNAL_CLIENT_AUTH_MODEL.md`

✅ **内容**:
1. 认证架构（内部/外部token）
2. 权限模型（角色定义、资源权限矩阵）
3. API设计（内部/外部API分离）
4. 实现策略（守卫、装饰器、控制器）
5. 数据隔离策略
6. 安全最佳实践
7. DTO设计
8. 未来扩展计划

---

### 关键设计

#### 1. Token分离

**内部Token**:
```json
{
  "userId": 1,
  "role": "ADMIN",
  "type": "INTERNAL",
  "orgId": 2
}
```

**外部Token**:
```json
{
  "userId": 100,
  "role": "CUSTOMER",
  "type": "EXTERNAL",
  "customerId": 1,
  "orgId": 2
}
```

---

#### 2. API边界

**内部API**: `/api/internal/*`
- 需要Internal Token
- 可以访问所有组织的数据
- 支持orgId参数

**外部API**: `/api/external/*`
- 需要External Token
- 只能访问自己的数据（通过token中的customerId自动过滤）
- 不需要customerId参数

---

#### 3. 数据隔离

**自动过滤**:
```typescript
// 客户端请求
GET /api/external/orders

// 自动转换为
GET /api/external/orders?customerId=1
```

**自动关联**:
```typescript
@Post()
async createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
  dto.customerId = user.customerId; // 自动关联
  return this.orderService.createOrder(dto);
}
```

---

## 🎯 技术实现

### 1. Entity定义

✅ **文件**:
- `backend/src/modules/order/entities/customer.entity.ts`
- `backend/src/modules/order/entities/product.entity.ts`
- `backend/src/modules/order/entities/order.entity.ts`
- `backend/src/modules/order/entities/order-item.entity.ts`

---

### 2. DTO定义

✅ **文件**: `backend/src/modules/order/dto/order.dto.ts`

✅ **DTO**:
- CreateOrderDto
- CreateOrderItemDto
- ReviewOrderDto
- QueryOrdersDto

---

### 3. Service实现

✅ **文件**: `backend/src/modules/order/services/order.service.ts`

✅ **方法**:
- createOrder(): 创建订单
- reviewOrder(): 审核订单
- queryOrders(): 查询订单
- getOrderById(): 获取订单详情
- generateOrderNo(): 生成订单编号

---

### 4. Controller实现

✅ **文件**: `backend/src/modules/order/controllers/order.controller.ts`

✅ **路由**:
- POST /orders
- POST /orders/review
- GET /orders
- GET /orders/:id

---

### 5. Module配置

✅ **文件**: `backend/src/modules/order/order.module.ts`

✅ **注册**:
- OrderController
- OrderService
- Customer, Product, Order, OrderItem entities

---

## 📊 数据示例

### 1. 客户数据（10-30个）

```sql
INSERT INTO customers (org_id, customer_code, customer_name, contact_person, contact_phone, credit_limit, status, created_by) VALUES
(2, 'CUST-001', '北京科技有限公司', '张三', '13800138001', 1000000, 'ACTIVE', 1),
(2, 'CUST-002', '上海贸易有限公司', '李四', '13800138002', 2000000, 'ACTIVE', 1),
(2, 'CUST-003', '广州实业有限公司', '王五', '13800138003', 1500000, 'ACTIVE', 1),
-- ... 更多客户
```

---

### 2. 产品数据（10-30个SKU）

```sql
INSERT INTO products (org_id, sku, product_name, category, unit, unit_price, stock_quantity, status, created_by) VALUES
(2, 'SKU-001', '产品A', '电子产品', '件', 10000, 100, 'ACTIVE', 1),
(2, 'SKU-002', '产品B', '电子产品', '件', 20000, 50, 'ACTIVE', 1),
(2, 'SKU-003', '产品C', '家居用品', '件', 5000, 200, 'ACTIVE', 1),
-- ... 更多产品
```

---

## 🎉 总结

### 完成情况

- ✅ 定义并落库最小字典（customers, products）
- ✅ 定义最小订单域与状态机（orders, order_items）
- ✅ 实现ops端API（创建、查询、审核）
- ✅ 明确未来外部侧的token/权限模型

### 效果

1. **接口边界清晰**: 内部/外部API完全分离
2. **数据隔离**: 客户只能看到自己的数据
3. **可扩展**: 支持未来的客户端接入
4. **最小化**: 只做骨架，不做客户端

### 后续工作

1. **Phase 1**: 实现认证模块（AuthModule）
2. **Phase 2**: 实现外部API控制器
3. **Phase 3**: 实现客户端（customer-frontend）
4. **Phase 4**: 订单与发票对接（生成invoice）

---

**任务完成时间**: 2026-01-12  
**执行人**: Manus AI Agent  
**状态**: ✅ 完成
