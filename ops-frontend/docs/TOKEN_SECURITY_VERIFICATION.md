# Token安全验证指南

## 目标

确保`INTERNAL_SERVICE_TOKEN`不会暴露到前端，只在server端使用。

---

## 架构说明

```
Frontend (Browser)
    ↓ tRPC call (no token)
Server-side tRPC Procedures
    ↓ REST API call (with INTERNAL_SERVICE_TOKEN)
Backend REST API
```

**关键点**：
- Frontend只知道tRPC接口，不知道backend的URL和token
- INTERNAL_SERVICE_TOKEN只在server端的`backend-api.ts`中使用
- 环境变量不使用`VITE_`前缀，因此不会被打包到前端bundle

---

## 验证方法

### 1. 检查浏览器Network请求

**步骤**：
1. 打开浏览器DevTools（F12）
2. 切换到Network标签
3. 刷新页面或触发API调用
4. 查看所有请求的Headers

**预期结果**：
- ✅ 只能看到`/api/trpc/*`请求
- ✅ 请求headers中**没有**`Authorization: Bearer xxx`
- ❌ **不应该**看到任何对backend的直接请求（如`http://localhost:3000/api/internal/*`）

**示例**：
```
Request URL: https://your-domain.com/api/trpc/orders.list
Request Headers:
  Content-Type: application/json
  Cookie: session=xxx
  
✓ 没有 Authorization header
✓ 没有 INTERNAL_SERVICE_TOKEN
```

---

### 2. 检查浏览器Storage

**步骤**：
1. 打开浏览器DevTools（F12）
2. 切换到Application标签
3. 查看LocalStorage、SessionStorage、Cookies

**预期结果**：
- ❌ **不应该**在任何storage中看到`INTERNAL_SERVICE_TOKEN`
- ❌ **不应该**看到backend的URL
- ✅ 只能看到session cookie（用于tRPC认证）

---

### 3. 检查前端Bundle源码

**步骤**：
1. 构建生产版本：`pnpm build`
2. 查看`dist/assets/*.js`文件
3. 搜索敏感信息

**命令**：
```bash
# 构建
pnpm build

# 搜索token（应该找不到）
grep -r "INTERNAL_SERVICE_TOKEN" dist/
grep -r "your-actual-token-value" dist/

# 搜索backend URL（应该找不到internal endpoint）
grep -r "/api/internal" dist/
```

**预期结果**：
- ❌ **不应该**在bundle中找到`INTERNAL_SERVICE_TOKEN`
- ❌ **不应该**找到实际的token值
- ❌ **不应该**找到`/api/internal/*`路径

---

### 4. 检查环境变量配置

**步骤**：
1. 查看`.env`文件（或Manus平台的Secrets配置）
2. 确认变量命名

**正确配置**：
```bash
# ✓ Server-side only（不会打包到前端）
BACKEND_URL=http://localhost:3000
INTERNAL_SERVICE_TOKEN=your-token-here

# ✓ Frontend可见（会打包到前端，但不包含敏感信息）
VITE_APP_TITLE=千张销售管理系统
VITE_BACKEND_URL=http://localhost:3000  # 前端只知道有个backend，不知道token
```

**错误配置**：
```bash
# ✗ 错误！会暴露到前端
VITE_INTERNAL_SERVICE_TOKEN=your-token-here
```

---

### 5. 代码审查检查点

**Server-side代码（✓ 可以使用token）**：
- `server/backend-api.ts` - 调用backend REST API
- `server/routers.ts` - tRPC procedures

**Frontend代码（✗ 不应该出现token）**：
- `client/src/**/*.tsx` - React组件
- `client/src/lib/trpc.ts` - tRPC client

**检查命令**：
```bash
# 检查frontend代码中是否有token引用（应该找不到）
grep -r "INTERNAL_SERVICE_TOKEN" client/
grep -r "process.env.INTERNAL" client/

# 检查frontend代码中是否有直接的backend API调用（应该找不到）
grep -r "fetch.*api/internal" client/
grep -r "axios.*api/internal" client/
```

---

## 常见错误示例

### ❌ 错误1：在frontend直接调用backend

```tsx
// ❌ 错误！token暴露到前端
const token = process.env.VITE_INTERNAL_SERVICE_TOKEN;
fetch(`${backendUrl}/api/internal/orders`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### ✅ 正确做法：通过tRPC调用

```tsx
// ✓ 正确！通过tRPC，token在server端
const { data } = trpc.orders.list.useQuery({ orgId: 2 });
```

---

### ❌ 错误2：使用VITE_前缀的敏感变量

```bash
# ❌ 错误！会打包到前端
VITE_INTERNAL_SERVICE_TOKEN=secret-token
```

### ✅ 正确做法：不使用VITE_前缀

```bash
# ✓ 正确！只在server端可用
INTERNAL_SERVICE_TOKEN=secret-token
```

---

## 自动化验证脚本

创建`scripts/verify-token-security.sh`：

```bash
#!/bin/bash

echo "========================================="
echo "Token安全验证"
echo "========================================="
echo ""

# 1. 构建生产版本
echo "1. 构建生产版本..."
pnpm build

# 2. 检查bundle中是否有token
echo "2. 检查bundle中是否有敏感信息..."
if grep -r "INTERNAL_SERVICE_TOKEN" dist/; then
  echo "✗ 失败：在bundle中发现INTERNAL_SERVICE_TOKEN"
  exit 1
else
  echo "✓ 通过：bundle中没有INTERNAL_SERVICE_TOKEN"
fi

# 3. 检查frontend代码
echo "3. 检查frontend代码..."
if grep -r "INTERNAL_SERVICE_TOKEN" client/; then
  echo "✗ 失败：在frontend代码中发现INTERNAL_SERVICE_TOKEN"
  exit 1
else
  echo "✓ 通过：frontend代码中没有INTERNAL_SERVICE_TOKEN"
fi

# 4. 检查是否有直接的backend调用
echo "4. 检查是否有直接的backend API调用..."
if grep -r "api/internal" client/ | grep -v "\.test\."; then
  echo "✗ 失败：在frontend代码中发现直接的backend API调用"
  exit 1
else
  echo "✓ 通过：frontend代码中没有直接的backend API调用"
fi

echo ""
echo "========================================="
echo "✓ 所有安全检查通过"
echo "========================================="
```

**使用方法**：
```bash
chmod +x scripts/verify-token-security.sh
./scripts/verify-token-security.sh
```

---

## 总结

**安全原则**：
1. ✅ 敏感信息（tokens, secrets）不使用`VITE_`前缀
2. ✅ Frontend只通过tRPC调用backend，不直接调用REST API
3. ✅ INTERNAL_SERVICE_TOKEN只在`server/backend-api.ts`中使用
4. ✅ 定期运行安全验证脚本

**验证清单**：
- [ ] Network请求中没有Authorization header
- [ ] LocalStorage/SessionStorage中没有token
- [ ] 前端bundle中没有token
- [ ] Frontend代码中没有token引用
- [ ] Frontend代码中没有直接的backend API调用

---

**如果发现token泄露，立即**：
1. 停止使用泄露的token
2. 在backend生成新的token
3. 更新ops-frontend的INTERNAL_SERVICE_TOKEN配置
4. 重新部署ops-frontend
5. 审查代码，找出泄露原因并修复
