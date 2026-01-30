# ops-frontend 功能清单

## 基础设施
- [x] 创建统一的API client连接backend的internal接口
- [x] 实现internal token身份验证机制
- [x] 配置DashboardLayout统一布局
- [x] 设置路由结构和导航菜单

## 订单管理
- [x] 订单审核页面
  - [x] 显示PENDING_REVIEW状态的订单列表
  - [x] 订单详情查看（订单项、金额）
  - [x] Approve操作（带备注）
  - [x] Reject操作（带备注）
- [x] 订单履行页面
  - [x] 显示APPROVED状态的订单列表
  - [x] Fulfill操作生成invoice
  - [x] 显示履行状态

## AR应收账款管理
- [x] AR发票管理页面
  - [x] 显示invoices列表
  - [x] 按OPEN/CLOSED状态过滤
  - [x] 显示发票详情（订单关联、金额、余额）
- [x] AR收款管理页面
  - [x] 显示payments列表
  - [x] 按UNAPPLIED/PARTIAL/APPLIED状态过滤
  - [x] 显示收款详情（客户、金额、未核销金额）

## 核销操作
- [x] 核销操作页面
  - [x] 选择payment（显示未核销金额）
  - [x] 选择invoice（显示未付余额）
  - [x] 输入applied_amount
  - [x] 执行核销操作
  - [x] 显示核销结果

## 审计查询
- [x] 审计日志页面
  - [x] 显示audit_logs列表
  - [x] 按resource过滤
  - [x] 按action过滤
  - [x] 按time过滤
  - [x] Trace功能（按resourceType+resourceId拉链路）
  - [x] 显示审计详情（用户、时间、变更内容）

## 测试与验证
- [ ] 使用seed数据测试完整业务闭环
- [ ] 验证订单审核→履行→发票生成流程
- [ ] 验证收款→核销→发票关闭流程
- [ ] 验证审计日志完整性
- [ ] 创建项目checkpoint

## P17-1: 接入后端（server-side tRPC）
- [x] 创建backend API client (server/backend-api.ts)
- [x] 配置环境变量（BACKEND_URL, INTERNAL_SERVICE_TOKEN）
- [x] 实现server-side tRPC procedures调用backend REST API
  - [x] Orders procedures（list, approve, reject, fulfill）
  - [x] Invoices procedures（list, get）
  - [x] Payments procedures（list, get）
  - [x] AR Apply procedures（create）
  - [x] AuditLogs procedures（list, trace）
- [x] 确保INTERNAL_SERVICE_TOKEN只在server端使用
- [x] 创建token安全验证文档 (docs/TOKEN_SECURITY_VERIFICATION.md)
- [ ] 验证浏览器bundle/Network/LocalStorage无token泄露
- [ ] 实现401/403错误友好提示

## P17-2: 页面闭环MVP
- [x] 删除旧的client/src/lib/api.ts（直接调用backend，token泄露）
- [x] 创建client/src/lib/types.ts（共享类型定义）
- [x] 订单审核页迁移到tRPC (OrderReview.tsx)
- [x] 订单履行页迁移到tRPC (OrderFulfill.tsx)
- [x] 发票页迁移到tRPC (ARInvoices.tsx)
- [x] 收款页迁移到tRPC (ARPayments.tsx)
- [ ] 核销页迁移到tRPC (ARApply.tsx)
- [x] 审计查询页迁移到tRPC (AuditLogs.tsx)
- [ ] Home页更新（如果需要）
- [ ] 修复TypeScript类型错误
- [ ] 验收闭环测试

## P17-3: 前端联调回归
- [x] 创建docs/OPS_FRONTEND_SMOKE.md文档
- [ ] 创建e2e测试脚本（Playwright/Cypress）（未来任务）
- [ ] 验收一遍跑通闭环（需要backend服务运行）
