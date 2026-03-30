# MS16 分析结果

## Bug 1: 客户管理数据隔离
- **后端问题**: `customerMgmt.list` 路由（routers.ts:2665）直接调用 `listCustomers(input)` 没有传入 `createdBy` 过滤
- **修复方案**: 在路由中加入角色判断，sales 只看自己创建的客户
- **前端问题**: 统计摘要使用 `total` 和 `items.filter()` 计算，后端修复后前端自动正确

## Bug 2: 报销审批按钮丢失
- **分析**: ExpenseClaim.tsx 第 470 行有审批按钮，条件是 `user?.role === "admin" && item.status === "PENDING"`
- **问题**: 审批按钮只在 ExpenseClaim.tsx（销售报销页面）中显示，但 FinanceExpenses.tsx（财务审核台）没有审批按钮（只有打款按钮）
- **FinanceExpenses.tsx 第 301 行**: 只有 `claim.status === "APPROVED" && !claim.isPaid` 时显示"确认打款"按钮
- **关键**: 财务审核台 `financeExpenses.listWithTrip` 可能没有返回 PENDING 状态的报销单
- **修复方案**: 在 FinanceExpenses.tsx 中为 PENDING 状态添加"审批通过/退回"按钮

## Bug 3: 代客下单缺少 SKU 数据
- **分析**: SalesCreateOrder.tsx 第 157 行使用 `trpc.portal.getProducts.useQuery({})` 获取商品
- **portal.getProducts** 从 `productCatalog` 本地表查询，条件是 `isActive === true`
- **问题**: Admin 在库存管理中新建的 SKU 写入的是 `inventory_items` 表，而不是 `productCatalog` 表
- **修复方案**: 让代客下单页面也能从 inventory_items 表获取商品数据，或者在新建 SKU 时同步写入 productCatalog

## Bug 4: 提成规则权限控制
- **后端**: commissionRules 的 create/update/delete 都使用 `protectedProcedure`（任何登录用户都能调用）
- **前端**: CommissionRules.tsx 没有角色判断，所有用户都能看到新建/编辑/删除按钮
- **修复方案**: 后端改为 `roleProcedure(['admin'])`，前端按角色隐藏操作按钮
