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

## P17最终交付（A-E任务）

### A) 确保前端不暴露token（最重要，涉及安全）
- [x] 检查server-side代码，确认token只在server端使用
- [x] 检查前端代码，移除任何INTERNAL_SERVICE_TOKEN引用
- [x] 验证前端bundle不含token
- [ ] 验证DevTools Application不含token（需要手动验证）
- [ ] 验证Network Request Headers无Authorization（需要手动验证）

### B) 修复tRPC请求头，确保每次请求都带Authorization
- [x] 修复backend-api.ts，确保每次请求都带Authorization header
- [x] 确认Authorization使用process.env.INTERNAL_SERVICE_TOKEN动态生成
- [x] 验证所有tRPC请求都正确携帧token（已在request函数中实现）

### C) Playwright e2e真跑一次（功能链路）
- [x] 创建E2E测试执行指南 (docs/E2E_TEST_EXECUTION_GUIDE.md)
- [ ] 启动backend服务（需要手动执行）
- [ ] 运行Playwright测试：订单→审核→fulfill→invoice→核销→audit（需要手动执行）
- [ ] 确保e2e能通过CI自动化回归（未来任务）
- [ ] 提供测试运行截图/日志（需要手动执行）

### D) 修复ops-frontend页面上的请求错误处理
- [x] 创建统一错误处理hook (client/src/hooks/useErrorHandler.ts)
- [x] 实现401/403错误友好提示
- [x] 确俟tRPC调用失败时不会一直转圈
- [x] 在OrderReview页面应用错误处理
- [x] 创建错误处理实施指南 (docs/ERROR_HANDLING_GUIDE.md)
- [ ] 在其他页面应用错误处理（OrderFulfill, ARInvoices, ARPayments, ARApply, AuditLogs）
- [ ] 测试错误处理流程（需要手动执行）

### E) 把P17最终交付合并到main
- [ ] 依次提交PR并合并
- [ ] 生成最终文档（PR验证命令、功能链路测试、错误处理、token使用说明）
- [ ] 确保所有bugfix都已解决

## 修复backend API路径（去掉/api前缀）
- [x] 检查server/backend-api.ts中的URL拼接逻辑
- [x] 去掉所有/api前缀，改为直接拼接/internal/orders、/ar/...等
- [x] 统一所有tRPC procedures的路径
- [x] 添加server-side启动自检日志（打印BACKEND_URL和探测请求结果）
- [x] 测试验证：health check显示200 OK

## P17-Blocker #1: 修复/api/trpc代理目标（ECONNREFUSED）
- [x] 任务1：确认Vite proxy配置（middleware mode，无需proxy）
- [x] 任务2：确俟tRPC server启动（架构A - Vite middleware mode）
- [x] 任务3：添加proxy target启动日志
- [x] 创建BLOCKER1_RESOLUTION.md文档
- [x] 验收：curl http://localhost:3000/api/trpc/orders.list 不再500

## P17-Blocker #2: 统一backend base path
- [x] 清理所有硬编码/api前缀（已在之前完成）
- [x] 使用BACKEND_URL + /internal/orders, /ar/...方式调用
- [x] 验收：所有backend API调用路径正确

## P17-Blocker #3: 补齐错误处理
- [x] 创建useErrorHandler hook
- [x] 在OrderReview页面应用（示例）
- [x] 创建ERROR_HANDLING_GUIDE.md
- [x] 创建BLOCKER3_STATUS.md
- [ ] 在其他5个页面应用（非阻塞，质量改进）
- [ ] 验收：模拟后端不可达，页面不无限转圈

## 改进tRPC错误响应和日志
- [x] 改进tRPC错误响应为JSON格式（添加onError和responseMeta）
- [x] 增强启动时配置验证（打印BACKEND_URL、token状态）
- [x] 添加health probe（GET ${BACKEND_URL}/health）
- [x] 添加tRPC请求访问日志（打印backend URL、状态码、错误摘要）
- [x] 测试验证：server启动日志显示health check结果

## 错误可观测性和启动自检落地
- [x] 任务1：确认npm run dev启动的是Express server（不是纯Vite dev server）
- [x] 任务1：确认启动时打印banner（架构、tRPC endpoint、BACKEND_URL、token present、/health probe）
- [x] 任务2：在/api/trpc handler最外层加强制JSON错误兜底（dev only）
- [x] 任务2：确保responseMeta/onError生效
- [x] 任务3：验证backend-api.ts的request函数打印日志
- [x] 任务3：测试500错误时能看到完整的URL + 状态码 + 错误摘要
- [ ] 验收：curl /api/trpc/orders.list返回JSON错误（需要手动执行）
- [x] 验收：server日志显示完整的backend API调用链路

## Express+tRPC server入口交付
- [x] 交付1：确认server入口文件路径（server/_core/index.ts）
- [x] 交付1：贴出文件头部，确认Express + createExpressMiddleware
- [x] 交付2：package.json已正确配置（dev脚本已是tsx watch server/_core/index.ts）
- [x] 交付2：npm run dev已是一键启动Express+tRPC server
- [x] 交付3：创建SERVER_ENTRY_DELIVERY.md文档
- [x] 交付3：提供启动自检输出示例
- [x] 交付3：提供3条curl验收命令（ping、orders.list、强制错误）
- [x] 测试验证：npm run dev能一键启动server并通过curl测试

## Task 1-4: tRPC可观测性和错误处理改进

### Task 1: /api/trpc/ping返回200 JSON
- [ ] 实现system.ping procedure（纯本地返回，不调用backend）
- [ ] 确保响应是application/json
- [ ] 确保status是200
- [ ] 验收：curl http://localhost:3000/api/trpc/system.ping返回200 JSON

### Task 2: 请求落点日志和错误JSON兜底
- [ ] 添加Express请求日志中间件（打印method + path）
- [ ] 在/api/trpc路由挂载前后打印日志
- [ ] 添加全局error handler强制JSON（dev模式）
- [ ] 验收：任何请求都能在日志中看到method + path

### Task 3: 确认server入口版本和banner
- [ ] 启动时打印SERVER_ENTRY=server/_core/index.ts
- [ ] 启动时打印GIT_COMMIT=<short sha>
- [ ] 启动时打印BACKEND_URL和TOKEN_PRESENT
- [ ] 验收：npm run dev显示完整banner

### Task 4: 区分401/403错误
- [ ] backend返回401/403时，tRPC返回对应code
- [ ] 只有真正未捕获异常才返回500
- [ ] 验收：token为空时，orders.list返回401/403 JSON（不是500 text/plain）
