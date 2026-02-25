# 权限集成指南

## 概述

本文档说明如何在ops-frontend的所有受保护页面中集成权限控制，确保未授权用户看到403错误提示。

## 权限系统架构

### 1. 角色定义（RoleCode）

```typescript
type RoleCode = 'SALES' | 'FINANCE' | 'SALES_DIRECTOR' | 'CEO';
```

### 2. 权限代码（PermissionCode）

```typescript
// 订单权限
'ORDER_CREATE' | 'ORDER_VIEW' | 'ORDER_EDIT' | 'ORDER_DELETE'

// 客户权限
'CUSTOMER_CREATE' | 'CUSTOMER_VIEW' | 'CUSTOMER_EDIT' | 'CUSTOMER_DELETE'

// 财务权限
'INVOICE_CREATE' | 'INVOICE_VIEW' | 'PAYMENT_CREATE' | 'PAYMENT_VIEW' | 'APPLY_CREATE' | 'APPLY_VIEW'

// 提成权限
'COMMISSION_VIEW_OWN' | 'COMMISSION_VIEW_ALL'

// 审批权限
'APPROVAL_L2' | 'APPROVAL_L3'
```

### 3. 角色权限映射

| 角色 | 权限 |
|------|------|
| SALES | 订单创建/查看/编辑、客户创建/查看/编辑、查看个人提成 |
| FINANCE | 订单查看、客户查看、发票/收款/核销全权限 |
| SALES_DIRECTOR | 订单全权限、客户全权限、查看所有提成、L2审批 |
| CEO | 所有权限 |

## 使用方法

### 方法1：使用PermissionGuard组件（推荐）

适用于整个页面或大块内容的权限控制。

```tsx
import { PermissionGuard } from '@/components/PermissionGuard';

export default function OrderReview() {
  return (
    <PermissionGuard permissions={['ORDER_VIEW']}>
      {/* 页面内容 */}
      <div>订单审核页面</div>
    </PermissionGuard>
  );
}
```

**参数说明：**

- `permissions`: 所需权限数组（满足任一即可）
- `requireAll`: 是否需要满足所有权限（默认false）
- `showAlert`: 是否显示无权限提示（默认true）
- `fallback`: 自定义无权限时的替代内容

### 方法2：使用usePermission Hook

适用于细粒度的权限控制（如按钮、表单字段）。

```tsx
import { usePermission } from '@/hooks/usePermission';

export default function OrderReview() {
  const { hasPermission } = usePermission();

  return (
    <div>
      {hasPermission('ORDER_EDIT') && (
        <Button>编辑订单</Button>
      )}
    </div>
  );
}
```

### 方法3：使用ProtectedButton组件

适用于按钮级别的权限控制。

```tsx
import { ProtectedButton } from '@/components/PermissionGuard';

<ProtectedButton 
  permissions={['ORDER_EDIT']}
  onClick={handleEdit}
>
  编辑订单
</ProtectedButton>
```

## 待集成页面清单

### 1. 订单管理

| 页面 | 路径 | 所需权限 | 状态 |
|------|------|----------|------|
| 订单审核 | /orders/review | ORDER_VIEW | ⏳ 待集成 |
| 订单履行 | /orders/fulfill | ORDER_VIEW | ⏳ 待集成 |

### 2. AR应收账款管理

| 页面 | 路径 | 所需权限 | 状态 |
|------|------|----------|------|
| 发票管理 | /ar/invoices | INVOICE_VIEW | ⏳ 待集成 |
| 收款管理 | /ar/payments | PAYMENT_VIEW | ⏳ 待集成 |
| 核销操作 | /ar/apply | APPLY_CREATE | ⏳ 待集成 |

### 3. 提成管理

| 页面 | 路径 | 所需权限 | 状态 |
|------|------|----------|------|
| 提成查询 | /commission/stats | COMMISSION_VIEW_OWN 或 COMMISSION_VIEW_ALL | ⏳ 待集成 |
| 提成规则 | /commission/rules | COMMISSION_VIEW_ALL | ⏳ 待集成 |

### 4. 审计查询

| 页面 | 路径 | 所需权限 | 状态 |
|------|------|----------|------|
| 审计日志 | /audit/logs | ORDER_VIEW（所有角色都有） | ⏳ 待集成 |

### 5. 员工管理

| 页面 | 路径 | 所需权限 | 状态 |
|------|------|----------|------|
| 员工管理 | /admin/employees | APPROVAL_L3（仅CEO） | ⏳ 待集成 |

### 6. 个人中心

| 页面 | 路径 | 所需权限 | 状态 |
|------|------|----------|------|
| 个人业绩 | /sales/my-performance | COMMISSION_VIEW_OWN | ⏳ 待集成 |

## 集成步骤

### Step 1: 导入PermissionGuard组件

```tsx
import { PermissionGuard } from '@/components/PermissionGuard';
```

### Step 2: 包裹页面内容

```tsx
export default function YourPage() {
  return (
    <PermissionGuard permissions={['YOUR_PERMISSION']}>
      {/* 原有页面内容 */}
    </PermissionGuard>
  );
}
```

### Step 3: 测试权限控制

1. 使用不同角色的用户登录
2. 访问受保护页面
3. 验证无权限用户看到403提示
4. 验证有权限用户正常访问

## 注意事项

1. **权限粒度**：页面级权限使用PermissionGuard，操作级权限使用usePermission Hook
2. **多权限组合**：使用`requireAll=true`要求用户同时拥有多个权限
3. **自定义提示**：使用`fallback`参数自定义无权限时的UI
4. **性能优化**：usePermission使用useMemo缓存权限列表，避免重复计算

## 示例代码

### 完整页面示例

```tsx
import { PermissionGuard } from '@/components/PermissionGuard';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';

export default function OrderReview() {
  const { hasPermission } = usePermission();

  return (
    <PermissionGuard permissions={['ORDER_VIEW']}>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-4">订单审核</h1>
        
        {/* 订单列表 */}
        <div className="space-y-4">
          {/* ... */}
        </div>

        {/* 仅有编辑权限的用户可见 */}
        {hasPermission('ORDER_EDIT') && (
          <Button>批量审核</Button>
        )}
      </div>
    </PermissionGuard>
  );
}
```

## 验收标准

- ✅ 所有受保护页面都包裹了PermissionGuard
- ✅ 无权限用户访问时显示403提示
- ✅ 有权限用户正常访问
- ✅ 按钮级权限控制正常工作
- ✅ 不同角色的权限隔离正确
