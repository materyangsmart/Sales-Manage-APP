# 外部客户端权限模型设计文档

**版本**: v1.0  
**日期**: 2026-01-12  
**状态**: 设计阶段（未上线）

---

## 📋 目标

为未来的外部客户端（客户侧APP/Web）预留清晰的权限模型和API边界，确保：
1. **数据隔离**: 客户只能看到自己的数据
2. **安全认证**: 基于JWT的token认证
3. **权限控制**: 细粒度的资源访问控制
4. **可扩展性**: 支持未来的多租户和角色扩展

---

## 🔐 认证架构

### 1. Token类型

#### 内部Token（Internal Token）
- **用途**: 运营端（ops-frontend）使用
- **权限**: 全局权限，可以访问所有组织的数据
- **payload示例**:
```json
{
  "userId": 1,
  "username": "admin",
  "role": "ADMIN",
  "orgId": 2,
  "type": "INTERNAL",
  "iat": 1704960000,
  "exp": 1704963600
}
```

#### 外部Token（External Token）
- **用途**: 客户端（customer-frontend）使用
- **权限**: 受限权限，只能访问自己的数据
- **payload示例**:
```json
{
  "userId": 100,
  "username": "customer001",
  "role": "CUSTOMER",
  "customerId": 1,
  "orgId": 2,
  "type": "EXTERNAL",
  "iat": 1704960000,
  "exp": 1704963600
}
```

---

### 2. 认证流程

#### 内部用户登录
```
1. POST /auth/internal/login
   Body: { username, password }
   ↓
2. 验证用户名密码
   ↓
3. 生成Internal Token
   ↓
4. 返回Token
```

#### 外部客户登录
```
1. POST /auth/external/login
   Body: { customerCode, password }
   ↓
2. 验证客户编码和密码
   ↓
3. 查询客户的customerId
   ↓
4. 生成External Token（包含customerId）
   ↓
5. 返回Token
```

---

## 🛡️ 权限模型

### 1. 角色定义

| 角色 | 类型 | 权限范围 | 描述 |
|------|------|---------|------|
| ADMIN | 内部 | 全局 | 系统管理员，可以访问所有数据 |
| OPERATOR | 内部 | 全局 | 运营人员，可以查看和操作所有订单 |
| AUDITOR | 内部 | 只读 | 审计人员，只能查看审计日志 |
| CUSTOMER | 外部 | 受限 | 客户，只能访问自己的数据 |

---

### 2. 资源权限矩阵

| 资源 | ADMIN | OPERATOR | AUDITOR | CUSTOMER |
|------|-------|----------|---------|----------|
| **订单** |
| 查询所有订单 | ✅ | ✅ | ❌ | ❌ |
| 查询自己的订单 | ✅ | ✅ | ❌ | ✅ |
| 创建订单 | ✅ | ✅ | ❌ | ✅ |
| 审核订单 | ✅ | ✅ | ❌ | ❌ |
| **收款单** |
| 查询所有收款单 | ✅ | ✅ | ❌ | ❌ |
| 查询自己的收款单 | ✅ | ✅ | ❌ | ✅ |
| 创建收款单 | ✅ | ✅ | ❌ | ❌ |
| **发票** |
| 查询所有发票 | ✅ | ✅ | ❌ | ❌ |
| 查询自己的发票 | ✅ | ✅ | ❌ | ✅ |
| 创建发票 | ✅ | ✅ | ❌ | ❌ |
| **审计日志** |
| 查询所有审计日志 | ✅ | ❌ | ✅ | ❌ |
| 查询自己的审计日志 | ✅ | ❌ | ✅ | ✅ |

---

## 🔧 API设计

### 1. 内部API（运营端）

#### 路由前缀: `/api/internal`

**特点**:
- 需要Internal Token
- 可以访问所有组织的数据
- 支持orgId参数

**示例**:
```bash
# 查询所有订单
GET /api/internal/orders?orgId=2&status=PENDING_REVIEW

# 审核订单
POST /api/internal/orders/review
Body: { orderId: 1, action: "APPROVED", reviewedBy: 1 }
```

---

### 2. 外部API（客户端）

#### 路由前缀: `/api/external`

**特点**:
- 需要External Token
- 只能访问自己的数据（通过token中的customerId自动过滤）
- 不需要customerId参数（从token中获取）

**示例**:
```bash
# 查询自己的订单（自动过滤customerId）
GET /api/external/orders?status=PENDING_REVIEW
Header: Authorization: Bearer <external_token>

# 创建订单（customerId从token中获取）
POST /api/external/orders
Header: Authorization: Bearer <external_token>
Body: {
  "orderDate": "2024-01-01",
  "items": [
    { "productId": 1, "quantity": 10 }
  ]
}
```

---

## 🎯 实现策略

### 1. 守卫（Guard）

#### AuthGuard
- 验证JWT token
- 解析token payload
- 将用户信息注入到request.user

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    
    const payload = this.jwtService.verify(token);
    request.user = payload;
    
    return true;
  }
}
```

---

#### RoleGuard
- 验证用户角色
- 检查是否有权限访问资源

```typescript
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    
    if (!requiredRoles) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    return requiredRoles.includes(user.role);
  }
}
```

---

#### CustomerScopeGuard
- 验证客户权限
- 确保客户只能访问自己的数据

```typescript
@Injectable()
export class CustomerScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // 如果是内部用户，跳过检查
    if (user.type === 'INTERNAL') {
      return true;
    }
    
    // 如果是外部客户，自动注入customerId过滤
    if (user.type === 'EXTERNAL') {
      request.query.customerId = user.customerId;
      request.body.customerId = user.customerId;
      return true;
    }
    
    return false;
  }
}
```

---

### 2. 装饰器（Decorator）

#### @Roles()
- 标记需要的角色

```typescript
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// 使用示例
@Get()
@Roles('ADMIN', 'OPERATOR')
async queryOrders() {
  // ...
}
```

---

#### @Public()
- 标记公开接口（不需要认证）

```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// 使用示例
@Post('login')
@Public()
async login() {
  // ...
}
```

---

#### @CurrentUser()
- 获取当前用户信息

```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// 使用示例
@Get()
async getProfile(@CurrentUser() user: any) {
  return user;
}
```

---

### 3. 控制器示例

#### 内部API控制器
```typescript
@Controller('api/internal/orders')
@UseGuards(AuthGuard, RoleGuard)
export class InternalOrderController {
  @Get()
  @Roles('ADMIN', 'OPERATOR')
  async queryOrders(@Query() dto: QueryOrdersDto) {
    // 可以访问所有组织的订单
    return this.orderService.queryOrders(dto);
  }
  
  @Post('review')
  @Roles('ADMIN', 'OPERATOR')
  async reviewOrder(@Body() dto: ReviewOrderDto) {
    return this.orderService.reviewOrder(dto);
  }
}
```

---

#### 外部API控制器
```typescript
@Controller('api/external/orders')
@UseGuards(AuthGuard, CustomerScopeGuard)
export class ExternalOrderController {
  @Get()
  async queryMyOrders(
    @Query() dto: QueryOrdersDto,
    @CurrentUser() user: any,
  ) {
    // customerId已经由CustomerScopeGuard自动注入
    // 只能查询自己的订单
    return this.orderService.queryOrders(dto);
  }
  
  @Post()
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    // customerId从token中获取
    dto.customerId = user.customerId;
    return this.orderService.createOrder(dto);
  }
}
```

---

## 📊 数据隔离策略

### 1. 查询自动过滤

**原则**: 外部客户的所有查询都自动添加customerId过滤

**实现**: 在CustomerScopeGuard中自动注入customerId

```typescript
// 客户端请求
GET /api/external/orders

// 自动转换为
GET /api/external/orders?customerId=1
```

---

### 2. 创建自动关联

**原则**: 外部客户创建的所有资源都自动关联到自己的customerId

**实现**: 在控制器中从token获取customerId并注入

```typescript
@Post()
async createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
  dto.customerId = user.customerId; // 自动关联
  return this.orderService.createOrder(dto);
}
```

---

### 3. 更新权限检查

**原则**: 外部客户只能更新自己的资源

**实现**: 在服务层检查资源的customerId是否匹配

```typescript
async updateOrder(id: number, dto: UpdateOrderDto, user: any) {
  const order = await this.orderRepository.findOne({ where: { id } });
  
  if (order.customerId !== user.customerId) {
    throw new ForbiddenException('Access denied');
  }
  
  // 更新订单
}
```

---

## 🔒 安全最佳实践

### 1. Token安全

- ✅ 使用HTTPS传输
- ✅ Token设置合理的过期时间（内部1小时，外部30分钟）
- ✅ 支持Token刷新机制
- ✅ 敏感操作需要重新验证

---

### 2. 密码安全

- ✅ 使用bcrypt加密密码
- ✅ 密码强度要求（最少8位，包含大小写字母和数字）
- ✅ 登录失败次数限制（5次后锁定账户）
- ✅ 支持密码重置功能

---

### 3. API安全

- ✅ 所有API都需要认证（除了登录和公开接口）
- ✅ 使用CORS限制跨域访问
- ✅ 使用Rate Limiting防止暴力破解
- ✅ 记录所有敏感操作到审计日志

---

## 📝 DTO设计

### 1. 内部API DTO

```typescript
export class InternalQueryOrdersDto {
  @IsInt()
  orgId: number; // 必需，可以查询任何组织

  @IsOptional()
  @IsInt()
  customerId?: number; // 可选，可以查询任何客户

  @IsOptional()
  @IsString()
  status?: string;
  
  // ... 其他字段
}
```

---

### 2. 外部API DTO

```typescript
export class ExternalQueryOrdersDto {
  // 不需要orgId和customerId参数
  // 这些值从token中自动获取

  @IsOptional()
  @IsString()
  status?: string;
  
  // ... 其他字段
}
```

---

## 🎯 未来扩展

### 1. 多租户支持

- 支持多个组织（orgId）
- 每个组织有独立的客户和订单
- 数据完全隔离

---

### 2. 细粒度权限

- 支持自定义角色
- 支持资源级权限（如只能查看自己创建的订单）
- 支持字段级权限（如客户不能看到成本价）

---

### 3. OAuth2集成

- 支持第三方登录（微信、支付宝）
- 支持API授权（OAuth2 Client Credentials）

---

## 📊 实施计划

### Phase 1: 基础认证（当前阶段）
- ✅ 设计权限模型文档
- ✅ 定义DTO和API边界
- ⏸️ 实现AuthGuard和RoleGuard（未来）
- ⏸️ 实现内部API（未来）

### Phase 2: 外部客户端（未来）
- ⏸️ 实现CustomerScopeGuard
- ⏸️ 实现外部API
- ⏸️ 实现客户端登录和注册
- ⏸️ 实现Token刷新机制

### Phase 3: 高级功能（未来）
- ⏸️ 多租户支持
- ⏸️ 细粒度权限
- ⏸️ OAuth2集成

---

## 🎉 总结

### 设计原则

1. **安全第一**: 所有API都需要认证，数据完全隔离
2. **简单易用**: 客户端不需要关心customerId，自动从token获取
3. **可扩展**: 支持未来的多租户和细粒度权限
4. **清晰边界**: 内部API和外部API完全分离

### 关键特性

- ✅ 基于JWT的token认证
- ✅ 内部/外部token分离
- ✅ 自动数据隔离（customerId过滤）
- ✅ 角色权限控制
- ✅ 审计日志记录

### 后续工作

1. 实现认证模块（AuthModule）
2. 实现守卫和装饰器
3. 实现外部API控制器
4. 添加集成测试

---

**文档版本**: v1.0  
**最后更新**: 2026-01-12  
**维护人**: Manus AI Agent
