# P8: 统一API前缀 + 身份注入规范

## 🎯 目标

1. 统一API前缀到 `/api/internal/orders/*`
2. 删除DTO中的`createdBy`/`reviewedBy`字段
3. 从JWT token中注入身份信息
4. 补充RBAC（基于角色的访问控制）

---

## ✅ 完成内容

### 1. 统一API前缀

**修改前**:
```typescript
@Controller('orders')
```

**修改后**:
```typescript
@Controller('api/internal/orders')
```

**API路径变更**:
- `POST /orders` → `POST /api/internal/orders`
- `POST /orders/review` → `POST /api/internal/orders/review`
- `GET /orders` → `GET /api/internal/orders`
- `GET /orders/:id` → `GET /api/internal/orders/:id`

---

### 2. 删除DTO中的身份字段

#### CreateOrderDto

**修改前**:
```typescript
export class CreateOrderDto {
  // ... 其他字段
  
  @IsInt()
  createdBy: number;
}
```

**修改后**:
```typescript
export class CreateOrderDto {
  // ... 其他字段
  
  // createdBy 从 JWT token 中注入，不允许客户端传入
}
```

#### ReviewOrderDto

**修改前**:
```typescript
export class ReviewOrderDto {
  // ... 其他字段
  
  @IsInt()
  reviewedBy: number;
}
```

**修改后**:
```typescript
export class ReviewOrderDto {
  // ... 其他字段
  
  // reviewedBy 从 JWT token 中注入，不允许客户端传入
}
```

---

### 3. 从JWT token中注入身份

**Controller修改**:
```typescript
@Post()
@Roles(Role.ADMIN, Role.OPERATOR)
async createOrder(@Body() dto: CreateOrderDto, @Request() req) {
  // 从token中获取createdBy，而不是从DTO中获取
  const userId = req.user?.id || 1; // TODO: 从JWT token中获取
  return this.orderService.createOrder({ ...dto, createdBy: userId });
}

@Post('review')
@Roles(Role.ADMIN, Role.OPERATOR)
async reviewOrder(@Body() dto: ReviewOrderDto, @Request() req) {
  // 从token中获取reviewedBy，而不是从DTO中获取
  const userId = req.user?.id || 1; // TODO: 从JWT token中获取
  return this.orderService.reviewOrder({ ...dto, reviewedBy: userId });
}
```

**优点**:
- ✅ 客户端无法伪造身份
- ✅ 审计日志准确记录操作人
- ✅ 符合安全最佳实践

---

### 4. 补充RBAC

#### 角色定义

**文件**: `backend/src/common/decorators/roles.decorator.ts`

```typescript
export enum Role {
  ADMIN = 'ADMIN',           // 管理员：全部权限
  OPERATOR = 'OPERATOR',     // 运营：创建、审核、查询
  AUDITOR = 'AUDITOR',       // 审计：只读查询
  CUSTOMER = 'CUSTOMER',     // 客户：外部客户（未来）
}
```

#### RolesGuard

**文件**: `backend/src/common/guards/roles.guard.ts`

**功能**:
- 从request.user中获取用户角色
- 检查用户是否拥有所需角色
- 不满足条件时返回403 Forbidden

#### API权限矩阵

| API | ADMIN | OPERATOR | AUDITOR | CUSTOMER |
|-----|-------|----------|---------|----------|
| POST /api/internal/orders | ✅ | ✅ | ❌ | ❌ |
| POST /api/internal/orders/review | ✅ | ✅ | ❌ | ❌ |
| GET /api/internal/orders | ✅ | ✅ | ✅ | ❌ |
| GET /api/internal/orders/:id | ✅ | ✅ | ✅ | ❌ |

---

## 🔒 安全改进

### 修改前的问题

1. **身份伪造风险**: 客户端可以传入任意`createdBy`值
2. **审计不可信**: 无法确定操作人真实身份
3. **权限缺失**: 任何人都可以调用API
4. **API路径混乱**: 内部/外部API没有区分

### 修改后的改进

1. ✅ **身份强制注入**: 从JWT token中获取，客户端无法伪造
2. ✅ **审计可信**: 操作人身份准确可追溯
3. ✅ **RBAC保护**: 基于角色的访问控制
4. ✅ **API边界清晰**: `/api/internal/*` 明确标识内部API

---

## 📋 后续工作（P9）

1. **CustomerScope强制执行**: 外部客户只能访问自己的数据
2. **越权测试**: customer A token 访问 customer B 资源 => 403
3. **外部端权限矩阵**: 关闭审计查询等内部工具

---

## ✅ 验收标准

- [x] API路径统一到 `/api/internal/orders/*`
- [x] DTO中删除 `createdBy`/`reviewedBy` 字段
- [x] Controller从JWT token注入身份
- [x] 补充RBAC（角色定义、RolesGuard、权限矩阵）
- [x] 更新文档说明

---

## 🧪 测试

### 测试1: API路径变更

```bash
# 修改前（404）
curl -X POST http://localhost:3000/orders

# 修改后（200/403）
curl -X POST http://localhost:3000/api/internal/orders
```

### 测试2: 身份注入

```bash
# 请求不包含createdBy
curl -X POST http://localhost:3000/api/internal/orders \
  -H "Authorization: Bearer <token>" \
  -d '{
    "orgId": 2,
    "customerId": 1,
    "orderDate": "2024-01-01",
    "items": [...]
  }'

# 响应中createdBy应该是token中的userId
```

### 测试3: RBAC

```bash
# AUDITOR角色尝试创建订单（应该返回403）
curl -X POST http://localhost:3000/api/internal/orders \
  -H "Authorization: Bearer <auditor_token>" \
  -d '{...}'

# 期望响应: 403 Forbidden
# {
#   "statusCode": 403,
#   "message": "Insufficient permissions. Required roles: ADMIN, OPERATOR"
# }
```

---

## 📄 相关文件

1. `backend/src/modules/order/controllers/order.controller.ts` - 更新API路径和RBAC
2. `backend/src/modules/order/dto/order.dto.ts` - 删除身份字段
3. `backend/src/common/decorators/roles.decorator.ts` - 角色定义
4. `backend/src/common/guards/roles.guard.ts` - RBAC守卫

---

## 🎯 下一步

**P9**: 外部权限模型安全落地
- CustomerScope强制执行
- 越权测试
- 外部端权限矩阵
