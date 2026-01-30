# ops-frontend 安全验收报告

**日期**: 2026-01-30  
**验收人**: Manus AI  
**项目**: ops-frontend (千张销售管理系统 - 内部中台工作台)  
**Checkpoint**: 2cdc06b5

---

## 验收目标

确保`INTERNAL_SERVICE_TOKEN`不会泄露到前端，验证以下三个方面：
1. 前端bundle不含token
2. 浏览器存储不含token
3. 后端请求头不在浏览器出现

---

## A) 前端Bundle检查 ✅

### 1. 源代码检查

**检查前端代码中是否使用VITE_INTERNAL***：
```bash
$ grep -r "VITE_INTERNAL" client/src/ 2>/dev/null | wc -l
0
```
**结果**: ✅ 前端代码中没有使用`VITE_INTERNAL*`变量

**检查server端是否正确使用token**：
```bash
$ grep -r "INTERNAL_SERVICE_TOKEN" server/ 2>/dev/null | grep -v node_modules
server/routers.ts:  // INTERNAL_SERVICE_TOKEN只在server端使用，不会暴露到前端
server/backend-api.ts: * INTERNAL_SERVICE_TOKEN只在server端使用，不会暴露到前端
server/backend-api.ts:const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
server/backend-api.ts:if (!INTERNAL_SERVICE_TOKEN) {
server/backend-api.ts:  console.warn('[Backend API] INTERNAL_SERVICE_TOKEN not configured');
```
**结果**: ✅ Token只在server端使用（`process.env.INTERNAL_SERVICE_TOKEN`）

### 2. 旧代码清理检查

**检查是否存在旧的client/src/lib/api.ts**：
```bash
$ ls -la client/src/lib/api.ts
ls: cannot access 'client/src/lib/api.ts': No such file or directory
```
**结果**: ✅ 旧的api.ts已删除（该文件会直接调用backend，导致token泄露）

**检查页面是否使用@/lib/api**：
```bash
$ grep -r "from.*@/lib/api" client/src/pages/ 2>/dev/null | wc -l
0
```
**结果**: ✅ 所有页面都已迁移到tRPC，不再直接调用backend API

### 3. 生产构建检查

**构建命令**：
```bash
$ pnpm build
```

**构建产物**：
- `dist/public/assets/index-Bg96xsbu.js` (862.55 kB)
- `dist/public/assets/index-Cs70XDOw.css` (119.41 kB)

**检查JS bundle中是否包含INTERNAL_SERVICE_TOKEN**：
```bash
$ grep -r "INTERNAL_SERVICE_TOKEN" dist/public/assets/*.js | wc -l
0
```
**结果**: ✅ JS bundle中不包含`INTERNAL_SERVICE_TOKEN`

**检查JS bundle中是否包含Bearer**：
```bash
$ grep -r "Bearer" dist/public/assets/*.js | wc -l
0
```
**结果**: ✅ JS bundle中不包含`Bearer`关键字

---

## B) 浏览器存储检查 ⏳

**需要在浏览器中手动验证**：

### 验证步骤

1. **打开ops-frontend页面**：https://3000-i96c9pg6s6pwm8hgpfyuo-1619b2ec.sg1.manus.computer

2. **打开DevTools → Application标签**：
   - **Local Storage**: 检查是否有`INTERNAL_SERVICE_TOKEN`或类似的token
   - **Session Storage**: 检查是否有`INTERNAL_SERVICE_TOKEN`或类似的token
   - **Cookies**: 检查是否有包含`internal`或`token`的cookie

3. **预期结果**：
   - ✅ Local Storage中不应看到`INTERNAL_SERVICE_TOKEN`
   - ✅ Session Storage中不应看到`INTERNAL_SERVICE_TOKEN`
   - ✅ Cookies中可能有session cookie（用于OAuth），但不应包含`INTERNAL_SERVICE_TOKEN`

### 截图证据

**请提供以下截图**：
- [ ] DevTools → Application → Local Storage截图
- [ ] DevTools → Application → Session Storage截图
- [ ] DevTools → Application → Cookies截图

---

## C) 网络请求检查 ⏳

**需要在浏览器中手动验证**：

### 验证步骤

1. **打开ops-frontend页面并打开DevTools → Network标签**

2. **刷新页面，观察所有请求**：
   - 查看所有`/api/trpc/*`请求的Request Headers
   - 查看所有JS bundle请求（`*.js`）

3. **预期结果**：
   - ✅ `/api/trpc/*`请求的Request Headers中**不应**看到`Authorization: Bearer ...`
   - ✅ 只有ops-frontend server → backend的请求会带`Authorization`（这部分只能在server日志中看到）
   - ✅ 前端→server的请求只会带session cookie（用于OAuth认证）

### 截图证据

**请提供以下截图**：
- [ ] DevTools → Network → 任意`/api/trpc/*`请求的Request Headers截图
- [ ] DevTools → Network → 任意JS bundle请求的Response内容搜索`INTERNAL_SERVICE_TOKEN`截图（应搜不到）

---

## D) 架构验证 ✅

### 当前架构

```
Frontend (Browser)
    ↓ (tRPC, 无token)
ops-frontend Server (Node.js)
    ↓ (REST API, 带INTERNAL_SERVICE_TOKEN)
Backend (Sales-Manage-APP)
```

### 关键实现

1. **Backend API Client** (`server/backend-api.ts`):
   ```typescript
   const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
   
   headers: {
     'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}`,
     'Content-Type': 'application/json',
   }
   ```

2. **tRPC Procedures** (`server/routers.ts`):
   ```typescript
   orders: {
     list: publicProcedure
       .input(z.object({ orgId: z.number(), ... }))
       .query(async ({ input }) => {
         return backendApi.orders.list(input); // server-side调用
       }),
   }
   ```

3. **Frontend调用** (例如`client/src/pages/OrderReview.tsx`):
   ```typescript
   const { data, isLoading } = trpc.orders.list.useQuery({
     orgId: 2,
     status: "PENDING_REVIEW",
   });
   // 不需要token，tRPC会自动路由到server端
   ```

**结果**: ✅ 架构正确，token只在server端使用

---

## 总结

### 自动化检查结果

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 前端代码无VITE_INTERNAL* | ✅ | 0个引用 |
| Server代码正确使用token | ✅ | 使用process.env.INTERNAL_SERVICE_TOKEN |
| 旧api.ts已删除 | ✅ | 不存在 |
| 页面都使用tRPC | ✅ | 0个页面使用@/lib/api |
| JS bundle无token | ✅ | 0个匹配 |
| JS bundle无Bearer | ✅ | 0个匹配 |

### 手动验证待完成

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 浏览器Local Storage | ⏳ | 需要截图证据 |
| 浏览器Session Storage | ⏳ | 需要截图证据 |
| 浏览器Cookies | ⏳ | 需要截图证据 |
| Network请求Headers | ⏳ | 需要截图证据 |
| JS bundle搜索验证 | ⏳ | 需要截图证据 |

---

## 建议

1. **完成手动验证**：按照上述步骤在浏览器中验证，并提供截图证据
2. **Server日志脱敏**：如果需要展示server→backend的请求日志，确保token已脱敏（例如：`Bearer dev-internal-***`）
3. **定期审计**：每次添加新功能时，重新运行安全检查脚本

---

## 验收命令

```bash
# 1. 源代码检查
cd /home/ubuntu/ops-frontend
grep -r "VITE_INTERNAL" client/src/ | wc -l  # 应该是0
grep -r "INTERNAL_SERVICE_TOKEN" server/ | grep -v node_modules

# 2. 构建检查
pnpm build
grep -r "INTERNAL_SERVICE_TOKEN" dist/public/assets/*.js | wc -l  # 应该是0
grep -r "Bearer" dist/public/assets/*.js | wc -l  # 应该是0

# 3. 手动浏览器验证（见上文）
```

---

**验收状态**: 🟡 自动化检查全部通过，等待手动浏览器验证
