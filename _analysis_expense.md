# 费用报销审批修复分析

## 问题总结

### 1. Date 渲染 Bug
- `item.expenseDate` 是 Date 对象，直接渲染到 JSX 导致 React 报错
- 需要 `.toLocaleDateString()` 或 `.toString()` 转换

### 2. 管理员审批按钮
- 代码中已有审批按钮（第 331 行），条件 `user?.role === "admin" && item.status === "PENDING"`
- 但"拒绝"按钮硬编码了 `approvalRemark: "不符合报销标准"`，没有输入框
- 需要改为弹窗输入退回原因

### 3. 退回原因可见性
- 销售员看不到退回原因（`approvalRemark` 字段）
- 需要在 REJECTED 状态的卡片中显示退回原因

### 4. 重新提交
- 数据库 status 枚举只有 PENDING/APPROVED/REJECTED
- 需要添加 RESUBMITTED 状态，或让 REJECTED 的单据可以重新编辑后变回 PENDING
- 方案：后端添加 resubmit mutation，将 REJECTED 状态改回 PENDING

### 5. 后端权限
- approve 路由权限是 `['admin', 'sales']`，应该限制为仅 admin
- 但考虑到销售也需要看到列表，只需要在 approve mutation 中加 admin 检查

## 修改文件清单
1. `client/src/pages/ExpenseClaim.tsx` - 大规模重写 ExpenseList 组件
2. `server/routers.ts` - 修改 approve 权限，添加 resubmit mutation
3. `server/expense-service.ts` - 添加 resubmitExpenseClaim 函数
