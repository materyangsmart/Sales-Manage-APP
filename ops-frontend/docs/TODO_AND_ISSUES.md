# ops-frontend 待办事项和已知问题

**最后更新**: 2026-01-31  
**项目版本**: a0602376  
**状态**: 功能完备，待端到端验证

---

## 一、优先级说明

| 优先级 | 标记 | 说明 | 处理时间 |
|-------|------|------|---------|
| **P0 - 阻塞** | 🔴 | 阻塞核心功能，必须立即解决 | 立即 |
| **P1 - 紧急** | 🟠 | 影响用户体验，需要尽快解决 | 1-2天 |
| **P2 - 重要** | 🟡 | 重要但不紧急，应该解决 | 1周内 |
| **P3 - 一般** | 🟢 | 质量改进，可以延后 | 2周内 |
| **P4 - 可选** | 🔵 | 锦上添花，有时间再做 | 未来 |

---

## 二、待办事项（按优先级）

### 2.1 P0 - 阻塞问题

#### 🔴 P0-1: Backend网络可达性

**问题描述**：

Backend服务运行在用户Windows本机（E:\work\Sales-Manage-APP-git\backend，端口3100），ops-frontend运行在Manus sandbox。两者无法通过localhost直接通信，导致所有backend API调用失败（ECONNREFUSED）。

**影响范围**：
- 所有tRPC procedures无法正常工作
- 所有页面无法加载数据
- 完整业务流程无法验证

**解决方案**：

**方案A：使用ngrok（推荐）**

```powershell
# 在用户Windows本机执行
ngrok http 3100

# 获取公网URL：https://xxx.ngrok.io

# 在ops-frontend中更新BACKEND_URL
webdev_request_secrets({
  secrets: [{
    key: 'BACKEND_URL',
    value: 'https://xxx.ngrok.io'
  }]
})

# 重启ops-frontend
npm run dev
```

**方案B：使用Manus端口转发**

如果backend也部署在Manus平台，可以使用类似`https://3100-xxx.manus.computer`的URL。

**方案C：部署backend到公网服务器**

部署到云服务器（AWS/阿里云等），使用固定的公网IP或域名。

**验收标准**：
- [ ] ops-frontend可以访问backend的/health endpoint
- [ ] ops-frontend启动时的health check显示"✓ Backend connection OK"
- [ ] 订单审核页面可以加载订单列表

**预计工作量**：30分钟（使用ngrok）

---

### 2.2 P1 - 紧急任务

#### 🟠 P1-1: 完整业务流程端到端验证

**问题描述**：

虽然所有功能模块已实现，但由于backend不可达，尚未进行完整的端到端验证。需要验证订单审核→履行→发票生成→核销→审计查询的完整流程。

**前置条件**：
- 依赖P0-1（Backend网络可达性）解决

**验证步骤**：

1. **订单审核**
   - [ ] 登录ops-frontend
   - [ ] 访问订单审核页面
   - [ ] 查看待审核订单列表（PENDING_REVIEW）
   - [ ] 批准一个订单
   - [ ] 验证订单状态变为APPROVED
   - [ ] 拒绝一个订单
   - [ ] 验证订单状态变为REJECTED

2. **订单履行**
   - [ ] 访问订单履行页面
   - [ ] 查看已批准订单列表（APPROVED）
   - [ ] 履行一个订单
   - [ ] 验证订单状态变为FULFILLED
   - [ ] 验证自动生成AR发票

3. **AR发票管理**
   - [ ] 访问发票管理页面
   - [ ] 查看发票列表
   - [ ] 验证刚才履行订单生成的发票（OPEN状态）
   - [ ] 按状态过滤（OPEN/CLOSED）

4. **AR收款管理**
   - [ ] 访问收款管理页面
   - [ ] 查看收款列表
   - [ ] 找到未核销的收款记录（UNAPPLIED）
   - [ ] 按核销状态过滤（UNAPPLIED/PARTIAL/APPLIED）

5. **核销操作**
   - [ ] 访问核销操作页面
   - [ ] 选择收款和发票
   - [ ] 输入核销金额
   - [ ] 执行核销
   - [ ] 验证核销成功
   - [ ] 返回发票管理，验证发票余额减少
   - [ ] 返回收款管理，验证收款未核销金额减少

6. **审计日志**
   - [ ] 访问审计日志页面
   - [ ] 查看所有操作记录
   - [ ] 按资源类型过滤（ORDER/INVOICE/PAYMENT）
   - [ ] 按操作类型过滤（APPROVE/REJECT/FULFILL/APPLY）
   - [ ] 按时间过滤
   - [ ] 点击"追踪"按钮，验证显示完整事件链路

**验收标准**：
- [ ] 所有页面可以正常加载
- [ ] 所有操作可以正常执行
- [ ] 数据更新正确反映在UI上
- [ ] 审计日志记录所有操作

**预计工作量**：1-2小时

---

#### 🟠 P1-2: Token安全验证

**问题描述**：

虽然已实现server-side tRPC架构，确保INTERNAL_SERVICE_TOKEN只在server端使用，但尚未进行浏览器端的手动验证。需要确保token不会泄露到前端bundle、LocalStorage或Network请求中。

**验证步骤**：

1. **前端bundle验证**
   ```bash
   cd /home/ubuntu/ops-frontend
   pnpm build
   grep -r "INTERNAL_SERVICE_TOKEN" dist/public/assets/*.js
   # 期望：无结果
   
   grep -r "Bearer" dist/public/assets/*.js
   # 期望：无结果
   ```

2. **浏览器DevTools验证**
   - [ ] 打开浏览器DevTools
   - [ ] Application → Local Storage → 搜索"INTERNAL_SERVICE_TOKEN"
   - [ ] 期望：无结果
   - [ ] Application → Session Storage → 搜索"INTERNAL_SERVICE_TOKEN"
   - [ ] 期望：无结果
   - [ ] Application → Cookies → 查看所有cookies
   - [ ] 期望：只有session cookie，无token相关cookie

3. **Network请求验证**
   - [ ] 打开浏览器DevTools → Network
   - [ ] 访问订单审核页面（触发tRPC请求）
   - [ ] 点击/api/trpc请求
   - [ ] 查看Request Headers
   - [ ] 期望：无Authorization header（因为是浏览器到ops-frontend server的请求）
   - [ ] 查看Response
   - [ ] 期望：无token相关信息

**验收标准**：
- [ ] 前端bundle不包含INTERNAL_SERVICE_TOKEN
- [ ] LocalStorage/SessionStorage不包含token
- [ ] Network请求不包含Authorization header（浏览器→ops-frontend）
- [ ] 创建验证截图并保存到docs/screenshots/

**预计工作量**：30分钟

**参考文档**：`docs/TOKEN_SECURITY_VERIFICATION.md`

---

### 2.3 P2 - 重要任务

#### 🟡 P2-1: 错误处理完善

**问题描述**：

当前只有OrderReview页面使用了useErrorHandler hook，其他5个页面的错误处理不统一。当backend不可达或返回错误时，这些页面可能出现无限loading或空白页。

**待办**：

在以下页面应用useErrorHandler：
- [ ] OrderFulfill.tsx
- [ ] ARInvoices.tsx
- [ ] ARPayments.tsx
- [ ] ARApply.tsx
- [ ] AuditLogs.tsx

**实施方法**：

```typescript
// 示例：ARInvoices.tsx
import { useErrorHandler } from '@/hooks/useErrorHandler';

function ARInvoices() {
  const { data, isLoading, error } = trpc.invoices.list.useQuery({ orgId: 2 });
  
  // 添加错误处理
  useErrorHandler(error);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  // ... 正常渲染
}
```

**验收标准**：
- [ ] 所有页面都使用useErrorHandler
- [ ] 模拟backend不可达，验证页面显示友好错误提示（不是无限loading）
- [ ] 模拟401/403错误，验证页面显示"请登录"或"权限不足"提示

**预计工作量**：1-2小时

**参考文档**：`docs/ERROR_HANDLING_GUIDE.md`

---

#### 🟡 P2-2: TypeScript类型警告修复

**问题描述**：

当前有27个TypeScript类型警告（Parameter implicitly has 'any' type），影响代码可维护性和IDE智能提示。

**待修复文件**：
- [ ] client/src/pages/AuditLogs.tsx (4个警告)
- [ ] client/src/pages/OrderFulfill.tsx (1个警告)
- [ ] client/src/pages/OrderReview.tsx (1个警告)
- [ ] 其他文件 (21个警告)

**修复方法**：

```typescript
// ❌ 错误
data.map((log, index) => ...)

// ✅ 正确
data.map((log: AuditLog, index: number) => ...)

// 或定义类型
interface AuditLog {
  id: number;
  resourceType: string;
  resourceId: number;
  action: string;
  timestamp: string;
  // ... 其他字段
}
```

**验收标准**：
- [ ] TypeScript编译无警告（pnpm tsc --noEmit）
- [ ] IDE智能提示正常工作
- [ ] 所有类型定义清晰明确

**预计工作量**：2-3小时

---

#### 🟡 P2-3: E2E测试执行

**问题描述**：

已创建Playwright E2E测试脚本（tests/e2e/order-flow.spec.ts, tests/e2e/apply-flow.spec.ts），但尚未实际运行验证。

**前置条件**：
- 依赖P0-1（Backend网络可达性）解决
- 依赖P1-1（完整业务流程验证）完成

**待办**：

1. **准备测试环境**
   - [ ] 确认backend有测试数据（seed数据）
   - [ ] 确认ops-frontend可以访问backend

2. **运行E2E测试**
   ```bash
   cd /home/ubuntu/ops-frontend
   BASE_URL=https://3000-xxx.manus.computer pnpm test:e2e
   ```

3. **验证测试结果**
   - [ ] 订单审核→履行→发票生成流程测试通过
   - [ ] 收款核销流程测试通过
   - [ ] 生成测试报告（pnpm test:e2e:report）

4. **修复失败的测试**
   - [ ] 分析失败原因
   - [ ] 修复代码或测试脚本
   - [ ] 重新运行测试

**验收标准**：
- [ ] 所有E2E测试通过
- [ ] 测试报告显示绿色（无失败）
- [ ] 测试覆盖核心业务流程

**预计工作量**：2-3小时

**参考文档**：`docs/E2E_TEST_EXECUTION_GUIDE.md`

---

### 2.4 P3 - 一般任务

#### 🟢 P3-1: 单元测试覆盖率提升

**问题描述**：

当前只有backend-api.test.ts一个单元测试文件，测试覆盖率很低。需要为关键业务逻辑添加单元测试。

**待办**：

1. **tRPC procedures测试**
   - [ ] 创建server/routers.test.ts
   - [ ] 测试orders.list procedure
   - [ ] 测试orders.approve procedure
   - [ ] 测试orders.reject procedure
   - [ ] 测试orders.fulfill procedure
   - [ ] 测试invoices.list procedure
   - [ ] 测试payments.list procedure
   - [ ] 测试arApply.create procedure
   - [ ] 测试auditLogs.list procedure
   - [ ] 测试auditLogs.trace procedure

2. **前端hooks测试**
   - [ ] 创建client/src/hooks/useErrorHandler.test.ts
   - [ ] 测试401错误处理
   - [ ] 测试403错误处理
   - [ ] 测试网络错误处理

3. **前端组件测试**
   - [ ] 创建client/src/components/DashboardLayout.test.tsx
   - [ ] 测试导航菜单渲染
   - [ ] 测试用户信息显示
   - [ ] 测试登出功能

**验收标准**：
- [ ] 测试覆盖率 > 60%
- [ ] 所有关键业务逻辑有测试
- [ ] 所有测试通过

**预计工作量**：1-2天

---

#### 🟢 P3-2: 性能优化

**问题描述**：

当前未进行性能优化，可能存在不必要的重渲染和网络请求。

**待办**：

1. **实现乐观更新（Optimistic Updates）**
   - [ ] 订单审核操作（Approve/Reject）
   - [ ] 订单履行操作（Fulfill）
   - [ ] 核销操作（Apply）

2. **添加React.memo优化**
   - [ ] 识别频繁重渲染的组件
   - [ ] 使用React.memo包裹纯组件
   - [ ] 使用useMemo/useCallback优化计算和回调

3. **实现分页和虚拟滚动**
   - [ ] 订单列表分页（如果数据量大）
   - [ ] 发票列表分页
   - [ ] 收款列表分页
   - [ ] 审计日志列表分页
   - [ ] 考虑使用tRPC的infinite query

**验收标准**：
- [ ] 页面加载时间 < 2秒
- [ ] 操作响应时间 < 500ms
- [ ] 无明显的UI卡顿

**预计工作量**：2-3天

---

#### 🟢 P3-3: 用户体验优化

**问题描述**：

当前UI功能完备，但用户体验可以进一步提升。

**待办**：

1. **添加骨架屏（Skeleton）**
   - [ ] 订单列表loading状态
   - [ ] 发票列表loading状态
   - [ ] 收款列表loading状态
   - [ ] 审计日志列表loading状态

2. **添加操作确认对话框**
   - [ ] 订单拒绝确认
   - [ ] 订单履行确认
   - [ ] 核销操作确认

3. **添加Toast提示**
   - [ ] 操作成功提示
   - [ ] 操作失败提示
   - [ ] 网络错误提示

4. **优化移动端响应式**
   - [ ] 测试移动端布局
   - [ ] 优化侧边栏在移动端的显示
   - [ ] 优化表格在移动端的显示

**验收标准**：
- [ ] 所有loading状态有骨架屏
- [ ] 所有敏感操作有确认对话框
- [ ] 所有操作有Toast提示
- [ ] 移动端布局正常

**预计工作量**：2-3天

---

### 2.5 P4 - 可选任务

#### 🔵 P4-1: 代码重构

**待办**：

1. **拆分大型组件**
   - [ ] 将500+行的组件拆分为多个子组件
   - [ ] 提取可复用的UI组件到components/

2. **提取共享逻辑到hooks**
   - [ ] 创建useOrders hook
   - [ ] 创建useInvoices hook
   - [ ] 创建usePayments hook
   - [ ] 创建useAuditLogs hook

3. **统一代码风格**
   - [ ] 配置ESLint
   - [ ] 配置Prettier
   - [ ] 运行lint fix

**预计工作量**：2-3天

---

#### 🔵 P4-2: 文档完善

**待办**：

1. **API文档**
   - [ ] 生成tRPC API文档
   - [ ] 添加每个procedure的说明和示例

2. **组件文档**
   - [ ] 添加Storybook
   - [ ] 为每个组件编写story

3. **开发指南**
   - [ ] 编写代码规范文档
   - [ ] 编写Git workflow文档
   - [ ] 编写部署文档

**预计工作量**：3-5天

---

## 三、已知问题

### 3.1 功能问题

#### Issue #1: Backend网络可达性（P0）

**状态**: 🔴 未解决  
**优先级**: P0 - 阻塞  
**详见**: 2.1 P0-1

---

#### Issue #2: ARApply页面未完全迁移到tRPC

**状态**: 🟡 部分解决  
**优先级**: P2  
**描述**: ARApply.tsx已迁移到tRPC，但可能存在未测试的边界情况。  
**影响**: 核销操作可能在某些情况下失败。  
**解决方案**: 进行完整的端到端测试（依赖P1-1）。

---

### 3.2 技术债务

#### Issue #3: TypeScript类型警告（27个）

**状态**: 🟡 未解决  
**优先级**: P2  
**详见**: 2.3 P2-2

---

#### Issue #4: 错误处理不统一

**状态**: 🟡 部分解决  
**优先级**: P2  
**详见**: 2.3 P2-1

---

#### Issue #5: 缺少单元测试

**状态**: 🟢 未解决  
**优先级**: P3  
**详见**: 2.4 P3-1

---

### 3.3 性能问题

#### Issue #6: 列表数据未分页

**状态**: 🟢 未解决  
**优先级**: P3  
**描述**: 订单、发票、收款、审计日志列表未实现分页，数据量大时可能影响性能。  
**影响**: 当数据量 > 100条时，页面加载变慢。  
**解决方案**: 实现分页或虚拟滚动（详见2.4 P3-2）。

---

#### Issue #7: 未实现乐观更新

**状态**: 🟢 未解决  
**优先级**: P3  
**描述**: 订单审核、履行、核销等操作未实现乐观更新，用户需要等待服务器响应才能看到UI更新。  
**影响**: 用户体验不够流畅。  
**解决方案**: 实现乐观更新（详见2.4 P3-2）。

---

### 3.4 用户体验问题

#### Issue #8: Loading状态无骨架屏

**状态**: 🟢 未解决  
**优先级**: P3  
**描述**: 所有列表的loading状态只显示"Loading..."文本，没有骨架屏。  
**影响**: 用户体验不够友好。  
**解决方案**: 添加骨架屏（详见2.4 P3-3）。

---

#### Issue #9: 敏感操作无确认对话框

**状态**: 🟢 未解决  
**优先级**: P3  
**描述**: 订单拒绝、订单履行、核销操作等敏感操作无确认对话框，用户可能误操作。  
**影响**: 用户可能误操作，导致数据错误。  
**解决方案**: 添加确认对话框（详见2.4 P3-3）。

---

#### Issue #10: 移动端响应式待优化

**状态**: 🔵 未解决  
**优先级**: P4  
**描述**: 虽然使用了Tailwind CSS的响应式工具类，但未在移动端实际测试。  
**影响**: 移动端可能显示异常。  
**解决方案**: 测试并优化移动端布局（详见2.4 P3-3）。

---

## 四、工作量估算

### 4.1 按优先级

| 优先级 | 任务数 | 预计工作量 | 建议完成时间 |
|-------|-------|-----------|------------|
| P0 - 阻塞 | 1 | 0.5小时 | 立即 |
| P1 - 紧急 | 2 | 2-3小时 | 1-2天 |
| P2 - 重要 | 3 | 1-2天 | 1周内 |
| P3 - 一般 | 3 | 4-6天 | 2周内 |
| P4 - 可选 | 2 | 5-8天 | 未来 |

### 4.2 建议的开发顺序

#### 第1天：解决阻塞问题
1. ✅ P0-1: Backend网络可达性（0.5小时）
2. ✅ P1-1: 完整业务流程验证（1-2小时）
3. ✅ P1-2: Token安全验证（0.5小时）

**目标**：完成核心功能验证，确保系统可用。

#### 第2-3天：重要任务
1. ✅ P2-1: 错误处理完善（1-2小时）
2. ✅ P2-2: TypeScript类型警告修复（2-3小时）
3. ✅ P2-3: E2E测试执行（2-3小时）

**目标**：提升代码质量和可维护性。

#### 第4-7天：一般任务
1. ✅ P3-1: 单元测试覆盖率提升（1-2天）
2. ✅ P3-2: 性能优化（2-3天）
3. ✅ P3-3: 用户体验优化（2-3天）

**目标**：提升系统质量和用户体验。

#### 第8天及以后：可选任务
1. ⏳ P4-1: 代码重构（2-3天）
2. ⏳ P4-2: 文档完善（3-5天）

**目标**：长期维护和改进。

---

## 五、风险和依赖

### 5.1 关键依赖

| 任务 | 依赖 | 风险 |
|------|------|------|
| P1-1 | P0-1 | 高：如果backend无法暴露公网，整个验证流程无法进行 |
| P2-3 | P0-1, P1-1 | 中：E2E测试依赖backend可达和功能正常 |
| P3-2 | P1-1 | 低：性能优化需要先验证功能正常 |

### 5.2 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| ngrok连接不稳定 | 中 | 高 | 考虑使用付费ngrok或部署backend到公网服务器 |
| Backend API变更 | 低 | 高 | 与backend开发者保持沟通，及时同步API变更 |
| TypeScript类型错误难以修复 | 低 | 中 | 参考现有类型定义，逐步修复 |
| E2E测试不稳定 | 中 | 中 | 添加重试机制，优化测试脚本 |

---

## 六、总结

### 6.1 当前状态

- ✅ 核心功能已实现（6个功能模块）
- ✅ tRPC集成已完成
- ✅ Token安全机制已验证（代码层面）
- ✅ 错误处理基础设施已搭建
- ⏳ 端到端验证待完成（阻塞于Backend网络可达性）

### 6.2 下一步

**立即执行**：
1. 解决P0-1（Backend网络可达性）
2. 完成P1-1（完整业务流程验证）
3. 完成P1-2（Token安全验证）

**1周内完成**：
1. P2-1（错误处理完善）
2. P2-2（TypeScript类型警告修复）
3. P2-3（E2E测试执行）

**2周内完成**：
1. P3-1（单元测试覆盖率提升）
2. P3-2（性能优化）
3. P3-3（用户体验优化）

### 6.3 质量目标

| 指标 | 当前 | 目标 | 优先级 |
|------|------|------|--------|
| 功能完整性 | 100% | 100% | P0 |
| 端到端验证 | 0% | 100% | P1 |
| Token安全验证 | 50% | 100% | P1 |
| 错误处理覆盖 | 17% (1/6页面) | 100% | P2 |
| TypeScript类型安全 | 73% (27个警告) | 100% | P2 |
| E2E测试通过率 | 0% (未运行) | 100% | P2 |
| 单元测试覆盖率 | <10% | >60% | P3 |
| 性能（页面加载） | 未测试 | <2秒 | P3 |
| 用户体验评分 | 未评估 | >8/10 | P3 |

---

**最后更新**: 2026-01-31  
**下次更新**: 完成P0-1和P1-1后
