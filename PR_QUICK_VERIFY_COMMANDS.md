# PR快速验证命令

本文档为每个PR提供3行快速验证命令，节省reviewer时间。

---

## P4: CI门禁

### How to verify quickly

```bash
# 1. 检查CI配置文件是否正确
cat .github/workflows/ci.yml | grep -A 5 "audit-test\|smoke-test\|all-checks"

# 2. 查看CI作业依赖关系
cat .github/workflows/ci.yml | grep "needs:"

# 3. 验证MySQL service配置
cat .github/workflows/ci.yml | grep -A 10 "services:"
```

**期望结果**:
- ✅ 看到 `audit-test`, `smoke-test`, `all-checks` 三个作业
- ✅ `all-checks` 依赖所有其他作业
- ✅ `smoke-test` 包含 MySQL service container

---

## P5: 幂等拦截器测试

### How to verify quickly

```bash
# 1. 运行幂等拦截器e2e测试（11个用例）
cd backend && npm test -- idempotency.e2e-spec.ts

# 2. 检查测试覆盖的接口
grep -n "POST.*ar" test/idempotency.e2e-spec.ts

# 3. 验证并发幂等性测试
grep -n "Promise.all" test/idempotency.e2e-spec.ts
```

**期望结果**:
- ✅ 11个测试用例全部通过
- ✅ 覆盖 `/ar/payments` 和 `/ar/apply` 接口
- ✅ 包含并发测试场景

---

## P7: 审计查询能力

### How to verify quickly

```bash
# 1. 运行审计日志服务单元测试（10个用例）
cd backend && npm test -- audit-log.service.spec.ts

# 2. 检查审计查询API端点
grep -n "@Get" src/modules/ar/controllers/audit-log.controller.ts

# 3. 验证查询性能优化（索引）
grep -n "createQueryBuilder\|andWhere" src/modules/ar/services/audit-log.service.ts
```

**期望结果**:
- ✅ 10个单元测试全部通过
- ✅ 看到4个GET端点（/audit-logs, /trace, /recent, /stats）
- ✅ 使用QueryBuilder优化查询性能

---

## P8: 统一API前缀+身份注入规范

### How to verify quickly

```bash
# 1. 验证API前缀统一到/api/internal/*
grep -n "@Controller" backend/src/modules/order/controllers/order.controller.ts

# 2. 确认DTO中不再有createdBy/reviewedBy字段
grep -n "createdBy\|reviewedBy" backend/src/modules/order/dto/order.dto.ts

# 3. 验证身份从JWT token注入
grep -n "req.user.id" backend/src/modules/order/controllers/order.controller.ts
```

**期望结果**:
- ✅ Controller使用 `@Controller('api/internal/orders')`
- ✅ DTO中没有 `createdBy` 和 `reviewedBy` 字段
- ✅ Controller中使用 `req.user.id` 获取身份

---

## P9: 外部权限模型安全落地

### How to verify quickly

```bash
# 1. 运行越权测试（10个用例）
cd backend && npm test -- external-permission.e2e-spec.ts

# 2. 检查CustomerScope守卫实现
cat backend/src/common/guards/customer-scope.guard.ts

# 3. 验证外部订单控制器使用CustomerScope
grep -n "@CustomerScope\|@UseGuards(CustomerScopeGuard)" backend/src/modules/order/controllers/external-order.controller.ts
```

**期望结果**:
- ✅ 10个越权测试用例全部通过
- ✅ CustomerScope守卫强制执行customerId过滤
- ✅ 外部控制器所有端点都使用CustomerScope

---

## P10: 订单与AR挂接

### How to verify quickly

```bash
# 1. 验证fulfill接口生成发票
cd backend && grep -A 20 "async fulfillOrder" src/modules/order/services/order.service.ts | grep "arInvoiceRepository\|invoiceNo"

# 2. 确认新增GET /ar/invoices接口
grep -n "GET.*invoices" src/modules/ar/controllers/ar.controller.ts

# 3. 验证fulfilledBy类型一致性（number）
grep -n "fulfilledBy.*number" src/modules/order/entities/order.entity.ts
```

**期望结果**:
- ✅ fulfillOrder方法中生成应收发票（ar_invoices）
- ✅ AR控制器包含 `GET /ar/invoices` 端点
- ✅ fulfilledBy字段类型为 `number`

---

## 完整业务闭环验证（P10）

### 端到端验证命令

```bash
# 步骤1: 创建订单
curl -X POST http://localhost:3000/api/internal/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <internal_token>" \
  -d '{
    "orgId": 2,
    "customerId": 1,
    "items": [{"productId": 1, "quantity": 2, "unitPrice": 5000}]
  }'

# 步骤2: 审核订单（假设订单ID为1）
curl -X POST http://localhost:3000/api/internal/orders/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <internal_token>" \
  -d '{"orderId": 1, "action": "APPROVED", "comment": "审核通过"}'

# 步骤3: 履行订单（生成发票）
curl -X POST http://localhost:3000/api/internal/orders/1/fulfill \
  -H "Authorization: Bearer <internal_token>"

# 步骤4: 查询应收发票
curl "http://localhost:3000/ar/invoices?orgId=2&orderId=1"

# 步骤5: 查询审计日志
curl "http://localhost:3000/audit-logs?resourceType=Order&resourceId=1"
```

**期望结果**:
- ✅ 订单创建成功（PENDING_REVIEW）
- ✅ 订单审核通过（APPROVED）
- ✅ 订单履行成功（FULFILLED）+ 生成发票
- ✅ 可以查询到发票记录
- ✅ 可以查询到FULFILL审计记录

---

## 注意事项

1. **Token获取**: 所有internal API需要JWT token，可以通过登录接口获取
2. **数据库准备**: 确保运行 `npm run db:sync` 初始化数据库
3. **测试环境**: 建议在测试环境运行，避免影响生产数据
4. **并发测试**: P5的并发测试可能需要多次运行以验证稳定性

---

## 快速验证脚本

如果您想一次性验证所有PR，可以使用以下脚本：

```bash
#!/bin/bash

echo "=== P4: CI门禁 ==="
cat .github/workflows/ci.yml | grep -A 5 "audit-test\|smoke-test\|all-checks"

echo -e "\n=== P5: 幂等拦截器测试 ==="
cd backend && npm test -- idempotency.e2e-spec.ts

echo -e "\n=== P7: 审计查询能力 ==="
npm test -- audit-log.service.spec.ts

echo -e "\n=== P8: 统一API前缀 ==="
grep -n "@Controller" src/modules/order/controllers/order.controller.ts

echo -e "\n=== P9: 外部权限模型 ==="
npm test -- external-permission.e2e-spec.ts

echo -e "\n=== P10: 订单与AR挂接 ==="
grep -A 20 "async fulfillOrder" src/modules/order/services/order.service.ts | grep "arInvoiceRepository\|invoiceNo"

echo -e "\n✅ 所有验证完成！"
```

保存为 `quick_verify_all.sh`，然后运行：

```bash
chmod +x quick_verify_all.sh
./quick_verify_all.sh
```

---

**文档维护**: 本文档应随PR更新而更新，确保验证命令始终有效。
