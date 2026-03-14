# ops-frontend 快速启动指南

**目标读者**: 接手项目的新开发者（Gemini）  
**预计阅读时间**: 10分钟  
**最后更新**: 2026-01-31

---

## 一、5分钟快速启动

### 1.1 启动ops-frontend

```bash
# 1. 进入项目目录
cd /home/ubuntu/ops-frontend

# 2. 安装依赖（如果还没安装）
pnpm install

# 3. 启动开发服务器
npm run dev
```

**期望输出**：
```
============================================================
✓ ops-frontend Server running on http://localhost:3000/
============================================================
Architecture: Vite middleware mode (integrated with Express)
tRPC endpoint: http://localhost:3000/api/trpc
OAuth callback: http://localhost:3000/api/oauth/callback
Frontend: Vite HMR enabled
============================================================

[Server] Runtime Configuration
============================================================
SERVER_ENTRY: server/_core/index.ts
GIT_COMMIT: a0602376
BACKEND_URL: http://localhost:3100
TOKEN_PRESENT: true
============================================================
```

### 1.2 验证服务运行

```bash
# 测试ping端点
curl "http://localhost:3000/api/trpc/ping"

# 期望返回：
# {"result":{"data":{"json":{"success":true,"message":"pong",...}}}}
```

### 1.3 访问Web界面

打开浏览器访问：
```
http://localhost:3000
```

或使用Manus提供的公网URL：
```
https://3000-i96c9pg6s6pwm8hgpfyuo-1619b2ec.sg1.manus.computer
```

---

## 二、Backend连接配置

### 2.1 当前问题

ops-frontend运行在Manus sandbox，backend运行在用户Windows本机。两者无法通过localhost直接通信。

### 2.2 解决方案：使用ngrok暴露backend

**步骤1**：在用户Windows本机安装ngrok

```powershell
# 下载ngrok
# https://ngrok.com/download

# 解压并运行
ngrok http 3100
```

**步骤2**：获取公网URL

ngrok会输出类似：
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3100
```

**步骤3**：更新ops-frontend的BACKEND_URL

```bash
# 在ops-frontend项目中执行
cd /home/ubuntu/ops-frontend

# 使用webdev工具更新环境变量
# （需要在Manus AI中执行）
webdev_request_secrets({
  secrets: [{
    key: 'BACKEND_URL',
    value: 'https://abc123.ngrok.io',  # 替换为实际的ngrok URL
    description: 'Backend REST API base URL'
  }]
})
```

**步骤4**：重启ops-frontend

```bash
npm run dev
```

**步骤5**：验证连接

```bash
# 测试backend health endpoint
curl "https://abc123.ngrok.io/health"

# 期望返回：
# {"status":"ok","timestamp":"..."}
```

---

## 三、常用开发命令

### 3.1 启动和停止

```bash
# 启动开发服务器
npm run dev

# 停止服务器
Ctrl+C
```

### 3.2 测试

```bash
# 运行所有单元测试
pnpm test

# 运行特定测试文件
pnpm test server/backend-api.test.ts

# Watch模式（自动重跑）
pnpm test --watch

# 运行E2E测试
pnpm test:e2e

# E2E测试UI模式
pnpm test:e2e:ui
```

### 3.3 代码检查

```bash
# TypeScript类型检查
pnpm tsc --noEmit

# 查看TypeScript错误数量
pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

### 3.4 构建

```bash
# 构建生产版本
pnpm build

# 输出目录：
# - dist/public/: 前端静态资源
# - dist/server/: 服务端代码
```

---

## 四、验证完整业务流程

### 4.1 前提条件

- ✅ ops-frontend已启动（http://localhost:3000）
- ✅ backend已启动并可访问（通过ngrok或其他方式）
- ✅ BACKEND_URL已配置为backend的公网URL
- ✅ INTERNAL_SERVICE_TOKEN已配置

### 4.2 测试流程

#### 步骤1：登录系统

访问：http://localhost:3000

如果未登录，会自动跳转到Manus OAuth登录页面。

#### 步骤2：订单审核

1. 点击侧边栏"订单审核"
2. 查看待审核订单列表（PENDING_REVIEW状态）
3. 点击某个订单的"批准"按钮
4. 输入备注（可选）
5. 确认批准
6. 验证订单状态变为APPROVED

#### 步骤3：订单履行

1. 点击侧边栏"订单履行"
2. 查看已批准订单列表（APPROVED状态）
3. 点击某个订单的"履行"按钮
4. 确认履行
5. 验证订单状态变为FULFILLED
6. 验证自动生成AR发票

#### 步骤4：查看发票

1. 点击侧边栏"发票管理"
2. 查看发票列表
3. 验证刚才履行订单生成的发票（OPEN状态）
4. 记录发票ID和未付余额

#### 步骤5：查看收款

1. 点击侧边栏"收款管理"
2. 查看收款列表
3. 找到未核销的收款记录（UNAPPLIED状态）
4. 记录收款ID和未核销金额

#### 步骤6：执行核销

1. 点击侧边栏"核销操作"
2. 选择收款（步骤5记录的收款ID）
3. 选择发票（步骤4记录的发票ID）
4. 输入核销金额（不超过收款未核销金额和发票未付余额）
5. 点击"核销"按钮
6. 验证核销成功
7. 返回发票管理页面，验证发票余额减少
8. 返回收款管理页面，验证收款未核销金额减少

#### 步骤7：查看审计日志

1. 点击侧边栏"审计日志"
2. 查看所有操作记录
3. 按资源类型过滤（ORDER/INVOICE/PAYMENT）
4. 点击某条日志的"追踪"按钮
5. 验证显示完整的事件链路

### 4.3 验证成功标准

- ✅ 所有页面可以正常加载
- ✅ 所有tRPC请求返回200或明确的错误JSON（不是500 text/plain）
- ✅ 订单审核→履行→发票生成流程正常
- ✅ 收款→核销→发票余额更新流程正常
- ✅ 审计日志记录所有操作

---

## 五、常见问题快速解决

### 问题1：npm run dev启动失败

**症状**：
```
Error: Cannot find module 'express'
```

**解决**：
```bash
pnpm install
```

### 问题2：/api/trpc返回500错误

**症状**：
```bash
curl "http://localhost:3000/api/trpc/ping"
# 返回：500 Internal Server Error
```

**排查**：
```bash
# 查看server日志
# 查找[tRPC Error]或[Express Error Handler]日志
```

**常见原因**：
- TypeScript编译错误
- tRPC procedure抛出未捕获异常
- 环境变量配置错误

### 问题3：Backend API调用返回ECONNREFUSED

**症状**：
```
[Backend API] Request failed: fetch failed
[cause]: AggregateError [ECONNREFUSED]
```

**解决**：
```bash
# 1. 检查BACKEND_URL
node -e "console.log('BACKEND_URL:', process.env.BACKEND_URL)"

# 2. 测试backend连接
curl "$(node -e "console.log(process.env.BACKEND_URL)")/health"

# 3. 如果失败，确认backend是否运行
# 在Windows本机执行：
curl http://localhost:3100/health

# 4. 如果backend运行正常，使用ngrok暴露
ngrok http 3100

# 5. 更新BACKEND_URL为ngrok URL
```

### 问题4：前端页面一直loading

**症状**：
- 页面显示loading状态
- 不显示数据也不显示错误

**排查**：
```bash
# 1. 打开浏览器DevTools → Network
# 查看/api/trpc请求的状态码和响应

# 2. 打开浏览器DevTools → Console
# 查看是否有JavaScript错误

# 3. 查看server日志
# 查找tRPC请求和backend API调用日志
```

**常见原因**：
- tRPC请求超时（backend不可达）
- 前端未处理error状态
- useQuery的enabled选项为false

### 问题5：TypeScript类型错误

**症状**：
```
error TS7006: Parameter 'order' implicitly has an 'any' type.
```

**解决**：
```typescript
// ❌ 错误
data.map((order) => ...)

// ✅ 正确
data.map((order: Order) => ...)

// 或定义类型
interface Order {
  id: number;
  // ... 其他字段
}
```

---

## 六、下一步

### 6.1 必做任务

1. **解决Backend网络可达性**
   - 使用ngrok暴露backend
   - 更新BACKEND_URL
   - 验证backend连接

2. **执行完整业务流程验证**
   - 按照"四、验证完整业务流程"执行
   - 确保所有功能正常工作

3. **阅读项目文档**
   - `docs/PROJECT_HANDOVER.md`：完整的项目交接文档
   - `docs/TODO_AND_ISSUES.md`：待办事项和已知问题
   - `todo.md`：功能清单

### 6.2 可选任务

1. **完善错误处理**
   - 在其他5个页面应用useErrorHandler
   - 参考：`docs/ERROR_HANDLING_GUIDE.md`

2. **修复TypeScript类型警告**
   - 修复27个implicit any警告
   - 提升代码质量

3. **运行E2E测试**
   - 执行Playwright测试
   - 验证自动化测试通过

---

## 七、有用的资源

### 7.1 项目文档

| 文档 | 说明 |
|------|------|
| `docs/PROJECT_HANDOVER.md` | 完整的项目交接文档（必读） |
| `docs/QUICK_START.md` | 本快速启动指南 |
| `docs/TODO_AND_ISSUES.md` | 待办事项和已知问题 |
| `docs/ERROR_HANDLING_GUIDE.md` | 错误处理实施指南 |
| `docs/TOKEN_SECURITY_VERIFICATION.md` | Token安全验证指南 |
| `todo.md` | 功能清单和待办事项 |

### 7.2 验收命令

```bash
# 1. 验证ping端点
curl "http://localhost:3000/api/trpc/ping"

# 2. 验证401错误格式
curl "http://localhost:3000/api/trpc/orders.list?input=%7B%22orgId%22%3A2%7D"

# 3. 验证环境变量
node -e "console.log('BACKEND_URL:', process.env.BACKEND_URL)"
node -e "console.log('TOKEN_PRESENT:', !!process.env.INTERNAL_SERVICE_TOKEN)"

# 4. 运行测试
pnpm test server/backend-api.test.ts
```

### 7.3 技术栈文档

- **React**: https://react.dev/
- **tRPC**: https://trpc.io/
- **Tailwind CSS**: https://tailwindcss.com/
- **shadcn/ui**: https://ui.shadcn.com/
- **Vite**: https://vitejs.dev/
- **Vitest**: https://vitest.dev/
- **Playwright**: https://playwright.dev/

---

**祝开发顺利！遇到问题请参考`docs/PROJECT_HANDOVER.md`或相关技术文档。**
