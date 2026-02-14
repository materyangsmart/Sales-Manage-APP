# P17-Blocker #3 状态报告

## 已完成
- ✅ 创建useErrorHandler hook (client/src/hooks/useErrorHandler.ts)
- ✅ 在OrderReview页面应用
- ✅ 创建ERROR_HANDLING_GUIDE.md

## 待完成（非阻塞）
- ⏳ OrderFulfill, ARInvoices, ARPayments, ARApply, AuditLogs（5个页面）

## 验收方法
1. 模拟后端不可达 → 期望toast提示
2. 模拟401/403 → 期望dialog提示+重新登录按钮

详见 docs/ERROR_HANDLING_GUIDE.md
