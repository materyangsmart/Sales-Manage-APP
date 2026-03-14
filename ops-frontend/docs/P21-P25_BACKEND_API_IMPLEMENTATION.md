# P21-P25 Backend API Implementation Guide

## 概述

P21-P25治理级架构需要backend提供以下API接口，ops-frontend通过server-side tRPC调用这些接口获取真实数据。

## P21: CEO雷达API

### GET /api/internal/ceo/radar

**功能**：返回CEO雷达的三大监控指标数据

**请求参数**：无

**响应格式**：
```json
{
  "badDebtRisks": [
    {
      "customerId": 1,
      "customerName": "李记菜市场",
      "unpaidAmount": 25000,
      "overdueDays": 18,
      "creditScore": 75,
      "estimatedLoss": 18750
    }
  ],
  "yieldAnomalies": [
    {
      "batchNo": "QZ20260224001",
      "soybeanInput": 1000,
      "productOutput": 2850,
      "actualYield": 285,
      "standardYield": 290,
      "deviation": -1.72,
      "productionDate": "2026-02-24T10:00:00Z"
    }
  ],
  "churnRisks": [
    {
      "customerId": 2,
      "customerName": "张家大排档",
      "customerCategory": "菜市场",
      "daysSinceLastOrder": 3,
      "lastOrderDate": "2026-02-21T10:00:00Z",
      "avgMonthlyOrders": 25,
      "salesRepName": "王五"
    }
  ],
  "lastUpdate": "2026-02-24T12:00:00Z"
}
```

**实现逻辑**：

#### 1. 坏账风险对冲（Bad Debt Risks）
```sql
SELECT 
  c.id AS customerId,
  c.name AS customerName,
  SUM(i.balance) AS unpaidAmount,
  DATEDIFF(NOW(), i.due_date) AS overdueDays,
  COALESCE(cs.credit_score, 60) AS creditScore,
  SUM(i.balance) * (COALESCE(cs.credit_score, 60) / 100) AS estimatedLoss
FROM ar_invoices i
JOIN customers c ON i.customer_id = c.id
LEFT JOIN customer_credit_scores cs ON c.id = cs.customer_id
WHERE i.balance > 0
  AND i.due_date < DATE_SUB(NOW(), INTERVAL 15 DAY)
GROUP BY c.id, c.name, cs.credit_score
ORDER BY estimatedLoss DESC
LIMIT 10;
```

#### 2. 得率异动审计（Yield Anomalies）
```sql
SELECT 
  pp.batch_no AS batchNo,
  pp.soybean_input AS soybeanInput,
  pp.product_output AS productOutput,
  (pp.product_output / pp.soybean_input * 100) AS actualYield,
  pp.standard_yield AS standardYield,
  ((pp.product_output / pp.soybean_input * 100) - pp.standard_yield) / pp.standard_yield * 100 AS deviation,
  pp.production_date AS productionDate
FROM production_plans pp
WHERE pp.production_date >= CURDATE()
  AND ABS(((pp.product_output / pp.soybean_input * 100) - pp.standard_yield) / pp.standard_yield * 100) > 2
ORDER BY ABS(deviation) DESC
LIMIT 10;
```

#### 3. 客户流失预警（Churn Risks）
```sql
SELECT 
  c.id AS customerId,
  c.name AS customerName,
  c.category AS customerCategory,
  DATEDIFF(NOW(), MAX(o.order_date)) AS daysSinceLastOrder,
  MAX(o.order_date) AS lastOrderDate,
  COUNT(o.id) / 12 AS avgMonthlyOrders,
  u.name AS salesRepName
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
LEFT JOIN users u ON c.sales_rep_id = u.id
WHERE c.is_core_customer = TRUE
GROUP BY c.id, c.name, c.category, u.name
HAVING daysSinceLastOrder >= 2
ORDER BY daysSinceLastOrder DESC
LIMIT 10;
```

---

## P22: 反舞弊API

### POST /api/internal/anti-fraud/check-price

**功能**：检查订单价格是否异常（在订单创建时调用）

**请求参数**：
```json
{
  "orderId": 123,
  "customerId": 456,
  "productId": 789,
  "unitPrice": 12.50,
  "quantity": 100,
  "salesRepId": 10
}
```

**响应格式**：
```json
{
  "isAnomaly": true,
  "regionAvgPrice": 15.00,
  "deviationPercent": -16.67,
  "requiresApproval": true,
  "anomalyId": 999
}
```

**实现逻辑**：
```sql
-- 1. 计算片区30天同品类平均价
SELECT AVG(oi.unit_price) AS regionAvgPrice
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN customers c ON o.customer_id = c.id
WHERE c.territory_id = (SELECT territory_id FROM customers WHERE id = :customerId)
  AND oi.product_id = :productId
  AND o.order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND o.status = 'FULFILLED';

-- 2. 判断是否异常
IF :unitPrice < (regionAvgPrice * 0.97) THEN
  -- 插入price_anomalies表
  INSERT INTO price_anomalies (
    order_id, customer_id, customer_name, product_id, product_name,
    unit_price, region_avg_price, deviation_percent,
    sales_rep_id, sales_rep_name, status
  ) VALUES (
    :orderId, :customerId, :customerName, :productId, :productName,
    :unitPrice, regionAvgPrice, (:unitPrice - regionAvgPrice) / regionAvgPrice * 100,
    :salesRepId, :salesRepName, 'PENDING'
  );
  
  -- 更新订单状态为PENDING_DIRECTOR_AUDIT
  UPDATE orders SET status = 'PENDING_DIRECTOR_AUDIT' WHERE id = :orderId;
END IF;
```

### POST /api/internal/anti-fraud/audit-settlement

**功能**：审计核销行为（在AR Apply时调用）

**请求参数**：
```json
{
  "paymentId": 123,
  "invoiceId": 456,
  "applyAmount": 10000,
  "salesRepId": 10,
  "commissionDeadline": "2026-02-28T23:59:59Z"
}
```

**响应格式**：
```json
{
  "isSuspicious": true,
  "timeToDeadline": 3600,
  "suspiciousReason": "核销时间距离提成统计截止仅剩1小时，疑似人为操控账期",
  "auditId": 888
}
```

**实现逻辑**：
```typescript
const applyTime = new Date();
const timeToDeadline = Math.floor((commissionDeadline.getTime() - applyTime.getTime()) / 1000);
const isSuspicious = timeToDeadline > 0 && timeToDeadline < 7200; // 2小时 = 7200秒

if (isSuspicious) {
  await db.insert(settlementAudit).values({
    paymentId,
    invoiceId,
    applyAmount,
    salesRepId,
    salesRepName,
    applyTime,
    commissionDeadline,
    timeToDeadline,
    isSuspicious: true,
    suspiciousReason: `核销时间距离提成统计截止仅剩${Math.floor(timeToDeadline / 3600)}小时，疑似人为操控账期`
  });
}
```

---

## P23: 数字信用API

### POST /api/internal/credit/calculate

**功能**：计算客户信用评分

**请求参数**：
```json
{
  "customerId": 123
}
```

**响应格式**：
```json
{
  "customerId": 123,
  "customerName": "李记菜市场",
  "creditScore": 85,
  "creditLevel": "A",
  "paymentRate": 98.5,
  "overdueCount": 2,
  "maxOverdueDays": 15,
  "totalOrders": 120,
  "autoApproveEnabled": true,
  "autoApproveLimit": 15000
}
```

**实现逻辑**：
```typescript
// 1. 查询客户历史数据
const customer = await db.query.customers.findFirst({
  where: eq(customers.id, customerId)
});

const orders = await db.query.orders.findMany({
  where: eq(orders.customerId, customerId)
});

const invoices = await db.query.arInvoices.findMany({
  where: eq(arInvoices.customerId, customerId)
});

// 2. 计算回款率
const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0);
const paidAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) - parseFloat(inv.balance)), 0);
const paymentRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

// 3. 计算逾期数据
const overdueInvoices = invoices.filter(inv => 
  parseFloat(inv.balance) > 0 && new Date(inv.dueDate) < new Date()
);
const overdueCount = overdueInvoices.length;
const maxOverdueDays = overdueInvoices.reduce((max, inv) => {
  const days = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(max, days);
}, 0);

// 4. 计算信用评分
let creditScore = 60; // 基础分

// 回款率加分（权重0.6）
if (paymentRate >= 98) creditScore += 20;
else if (paymentRate >= 95) creditScore += 10;
else if (paymentRate >= 90) creditScore += 5;

// 逾期扣分（权重0.4）
creditScore -= overdueCount * 5;
if (maxOverdueDays > 30) creditScore -= 10;

// 订单数加分
if (orders.length >= 100) creditScore += 10;
else if (orders.length >= 50) creditScore += 5;

creditScore = Math.max(0, Math.min(100, creditScore));

// 5. 确定信用等级
let creditLevel: 'S' | 'A' | 'B' | 'C' | 'D';
if (creditScore >= 90) creditLevel = 'S';
else if (creditScore >= 80) creditLevel = 'A';
else if (creditScore >= 70) creditLevel = 'B';
else if (creditScore >= 60) creditLevel = 'C';
else creditLevel = 'D';

// 6. 确定自动审批额度
let autoApproveEnabled = false;
let autoApproveLimit = 0;
if ((creditLevel === 'S' || creditLevel === 'A') && paymentRate >= 98) {
  autoApproveEnabled = true;
  const avgOrderAmount = totalAmount / orders.length;
  autoApproveLimit = avgOrderAmount * (creditLevel === 'S' ? 1.15 : 1.10);
}

// 7. 更新数据库
await db.insert(customerCreditScores).values({
  customerId,
  customerName: customer.name,
  creditScore,
  creditLevel,
  totalOrders: orders.length,
  totalAmount: totalAmount.toString(),
  paidAmount: paidAmount.toString(),
  paymentRate: paymentRate.toString(),
  overdueCount,
  maxOverdueDays,
  autoApproveEnabled,
  autoApproveLimit: autoApproveLimit.toString(),
  lastCalculatedAt: new Date()
}).onDuplicateKeyUpdate({
  creditScore,
  creditLevel,
  // ... 其他字段
});

return {
  customerId,
  customerName: customer.name,
  creditScore,
  creditLevel,
  paymentRate,
  overdueCount,
  maxOverdueDays,
  totalOrders: orders.length,
  autoApproveEnabled,
  autoApproveLimit
};
```

### POST /api/internal/credit/auto-approve

**功能**：自动审批订单

**请求参数**：
```json
{
  "orderId": 123,
  "customerId": 456,
  "orderAmount": 12000
}
```

**响应格式**：
```json
{
  "decision": "APPROVED",
  "reason": "信用等级A，回款率98.50%，订单金额12000元在自动审批额度内，自动批准",
  "processingTimeMs": 45,
  "creditScore": 85,
  "creditLevel": "A"
}
```

**实现逻辑**：
```typescript
const startTime = Date.now();

// 1. 获取客户信用评分
const credit = await db.query.customerCreditScores.findFirst({
  where: eq(customerCreditScores.customerId, customerId)
});

if (!credit) {
  // 无信用记录，转人工审批
  await logAutoApproval(orderId, customerId, 'MANUAL', '客户无信用记录，转人工审批');
  return { decision: 'MANUAL', reason: '客户无信用记录，转人工审批', processingTimeMs: Date.now() - startTime };
}

// 2. 判断是否自动批准
let decision: 'APPROVED' | 'MANUAL';
let reason: string;

if (
  (credit.creditLevel === 'S' || credit.creditLevel === 'A') &&
  parseFloat(credit.paymentRate) >= 98 &&
  orderAmount <= parseFloat(credit.autoApproveLimit) * 1.15
) {
  decision = 'APPROVED';
  reason = `信用等级${credit.creditLevel}，回款率${credit.paymentRate}%，订单金额${orderAmount}元在自动审批额度内，自动批准`;
  
  // 更新订单状态为APPROVED
  await db.update(orders).set({ status: 'APPROVED' }).where(eq(orders.id, orderId));
} else {
  decision = 'MANUAL';
  if (orderAmount > parseFloat(credit.autoApproveLimit) * 1.15) {
    reason = `订单金额${orderAmount}元超过自动审批额度${(parseFloat(credit.autoApproveLimit) * 1.15).toFixed(2)}元，转人工审批`;
  } else if (parseFloat(credit.paymentRate) < 98) {
    reason = `回款率${credit.paymentRate}%低于98%，转人工审批`;
  } else {
    reason = `信用等级${credit.creditLevel}不满足自动审批条件，转人工审批`;
  }
}

const processingTimeMs = Date.now() - startTime;

// 3. 记录审批日志
await db.insert(autoApprovalLogs).values({
  orderId,
  customerId,
  customerName: credit.customerName,
  orderAmount: orderAmount.toString(),
  creditScore: credit.creditScore,
  creditLevel: credit.creditLevel,
  paymentRate: credit.paymentRate,
  autoApproveLimit: credit.autoApproveLimit,
  decision,
  decisionReason: reason,
  processingTimeMs
});

return {
  decision,
  reason,
  processingTimeMs,
  creditScore: credit.creditScore,
  creditLevel: credit.creditLevel
};
```

---

## P24: 职能边界API

### POST /api/internal/employees

**功能**：创建员工并自动分配权限

**请求参数**：
```json
{
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "password": "hashed_password",
  "fullName": "张三",
  "phone": "13800138000",
  "department": "财务部",
  "jobPositionId": "FINANCE_SUPERVISOR"
}
```

**响应格式**：
```json
{
  "success": true,
  "employeeId": 123,
  "assignedRole": "FINANCE",
  "permissions": [
    "invoice.view",
    "invoice.create",
    "payment.view",
    "payment.apply"
  ]
}
```

**实现逻辑**：
```typescript
// 1. 创建员工
const employee = await db.insert(employees).values({
  username,
  email,
  password,
  fullName,
  phone,
  department,
  jobPositionId
});

// 2. 根据jobPositionId自动分配角色和权限
let roleName: string;
let permissions: string[];

switch (jobPositionId) {
  case 'FINANCE_SUPERVISOR':
    roleName = 'FINANCE';
    permissions = ['invoice.view', 'invoice.create', 'payment.view', 'payment.apply'];
    break;
  case 'SALES_REP':
    roleName = 'SALES';
    permissions = ['order.view', 'order.create', 'customer.view', 'commission.view'];
    break;
  case 'WAREHOUSE_MANAGER':
    roleName = 'WAREHOUSE';
    permissions = ['order.fulfill', 'inventory.view', 'inventory.update'];
    break;
  default:
    roleName = 'USER';
    permissions = [];
}

// 3. 分配角色
await db.insert(userRoles).values({
  userId: employee.id,
  roleName
});

// 4. 分配权限
for (const permission of permissions) {
  await db.insert(rolePermissions).values({
    roleName,
    permissionKey: permission,
    resourceType: permission.split('.')[0],
    action: permission.split('.')[1],
    isActive: true
  });
}

// 5. 记录权限变更日志
await db.insert(permissionChangeLogs).values({
  userId: employee.id,
  userName: fullName,
  oldRole: null,
  newRole: roleName,
  oldPermissions: null,
  newPermissions: JSON.stringify(permissions),
  changedBy: currentUser.id,
  changedByName: currentUser.name,
  changeReason: '新员工入职，自动分配权限'
});

return {
  success: true,
  employeeId: employee.id,
  assignedRole: roleName,
  permissions
};
```

### Middleware: 权限拦截

**功能**：在所有AR模块API前添加权限检查

```typescript
// 在ar.controller.ts中添加Guard
@Controller('ar')
@UseGuards(RoleGuard)
export class ArController {
  @Get('invoices')
  @Roles('FINANCE', 'ADMIN') // 只有财务和管理员可访问
  async getInvoices() {
    // ...
  }
  
  @Post('apply')
  @Roles('FINANCE', 'ADMIN')
  async applyPayment() {
    // ...
  }
}

// RoleGuard实现
@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    const hasRole = requiredRoles.some(role => user.roles?.includes(role));
    
    if (!hasRole) {
      throw new ForbiddenException('权限不足：该功能仅限财务人员访问');
    }
    
    return true;
  }
}
```

---

## P25: 质量反馈API

### POST /api/public/complaints

**功能**：提交质量投诉（公开接口，无需登录）

**请求参数**：
```json
{
  "orderId": 123,
  "batchNo": "QZ20260224001",
  "customerName": "李记菜市场",
  "customerPhone": "13800138000",
  "complaintType": "QUALITY",
  "complaintContent": "千张有异味",
  "complaintImages": [
    "https://cdn.example.com/complaint1.jpg",
    "https://cdn.example.com/complaint2.jpg"
  ]
}
```

**响应格式**：
```json
{
  "success": true,
  "complaintId": 999,
  "message": "投诉已提交，我们会尽快处理"
}
```

**实现逻辑**：
```typescript
// 1. 自动抓取批次号和配送司机ID
const order = await db.query.orders.findFirst({
  where: eq(orders.id, orderId),
  with: {
    orderItems: true,
    deliveries: true
  }
});

const batchNo = batchNo || order.orderItems[0]?.batchNo;
const driverId = order.deliveries[0]?.driverId;
const driverName = order.deliveries[0]?.driverName;

// 2. 插入投诉记录
const complaint = await db.insert(qualityComplaints).values({
  orderId,
  batchNo,
  customerId: order.customerId,
  customerName,
  customerPhone,
  complaintType,
  complaintContent,
  complaintImages: JSON.stringify(complaintImages),
  driverId,
  driverName,
  status: 'PENDING'
});

// 3. 触发CEO看板实时通知（通过WebSocket或轮询）
await notifyCEO({
  type: 'QUALITY_COMPLAINT',
  complaintId: complaint.id,
  orderId,
  batchNo,
  customerName,
  complaintContent
});

return {
  success: true,
  complaintId: complaint.id,
  message: '投诉已提交，我们会尽快处理'
};
```

### GET /api/internal/ceo/complaints

**功能**：获取质量投诉列表（CEO专用）

**请求参数**：
```
?status=PENDING&limit=50
```

**响应格式**：
```json
{
  "complaints": [
    {
      "id": 999,
      "orderId": 123,
      "batchNo": "QZ20260224001",
      "customerName": "李记菜市场",
      "customerPhone": "13800138000",
      "complaintType": "QUALITY",
      "complaintContent": "千张有异味",
      "complaintImages": ["https://..."],
      "driverId": 10,
      "driverName": "张师傅",
      "status": "PENDING",
      "createdAt": "2026-02-24T12:00:00Z"
    }
  ],
  "total": 5,
  "unreadCount": 3
}
```

---

## 总结

以上API接口是P21-P25治理级架构的**核心数据源**。ops-frontend将通过server-side tRPC调用这些backend API，实现真正的"算法拦截"与"自动治理"。

**下一步**：
1. 在backend中实现上述所有API接口
2. 在ops-frontend的server/backend-api.ts中添加对应的API调用方法
3. 在ops-frontend的server/routers.ts中调用backend API，废除所有Mock数据
4. 测试验证所有功能
