# P13: 补齐smoke:ar脚本

**创建日期**: 2024-01-29  
**目的**: 为AR模块创建快速冒烟测试脚本  
**状态**: ✅ 已完成

---

## 📋 背景

在主干回归验收报告中，`smoke:ar` 命令被标记为"未配置"状态，导致无法快速验证AR模块的核心功能。

**问题**:
- ❌ `package.json` 中没有 `smoke:ar` 命令
- ❌ 没有AR模块的快速验证脚本
- ❌ 回归测试需要手动执行多个步骤

---

## ✅ 解决方案

### 1. 创建Bash版本脚本

**文件**: `backend/scripts/smoke-ar.sh`

**功能**:
- 检查应用状态（健康检查、Swagger文档）
- 检查数据库连接和表结构
- 检查AR API端点（payments、invoices、summary）
- 检查审计日志API
- 检查订单API
- 检查外部API隔离

**测试项**: 共17个测试用例

**平台**: Linux / macOS / WSL

### 2. 创建PowerShell版本脚本

**文件**: `backend/scripts/smoke-ar.ps1`

**功能**: 与Bash版本相同

**平台**: Windows (PowerShell)

**特点**:
- 使用 `Invoke-WebRequest` 进行HTTP请求
- 自动检测MySQL客户端是否安装
- 彩色输出支持

### 3. 添加npm命令

**文件**: `backend/package.json`

**添加内容**:
```json
{
  "scripts": {
    "smoke:ar": "bash scripts/smoke-ar.sh"
  }
}
```

---

## 🧪 测试用例

### 1. 应用状态检查 (2个测试)

| 测试项 | 命令 | 期望结果 |
|--------|------|----------|
| 应用健康检查 | `GET /` | 包含 "Hello World" |
| Swagger文档可访问 | `GET /api-docs` | 包含 "<!DOCTYPE html>" |

### 2. 数据库连接检查 (2个测试)

| 测试项 | 命令 | 期望结果 |
|--------|------|----------|
| 数据库连接正常 | `mysql -e 'SELECT 1'` | 返回 "1" |
| 数据库存在 | `SHOW DATABASES LIKE 'xxx'` | 返回数据库名 |

### 3. AR表结构检查 (3个测试)

| 测试项 | 命令 | 期望结果 |
|--------|------|----------|
| ar_payments表存在 | `SHOW TABLES LIKE 'ar_payments'` | 返回表名 |
| ar_invoices表存在 | `SHOW TABLES LIKE 'ar_invoices'` | 返回表名 |
| audit_logs表存在 | `SHOW TABLES LIKE 'audit_logs'` | 返回表名 |

### 4. AR API端点检查 (4个测试)

| 测试项 | 端点 | 期望HTTP状态码 |
|--------|------|----------------|
| GET /ar/payments (无参数) | `/ar/payments` | 400 (缺少orgId) |
| GET /ar/payments?orgId=2 | `/ar/payments?orgId=2` | 200 |
| GET /ar/invoices?orgId=2 | `/ar/invoices?orgId=2` | 200 |
| GET /ar/summary?orgId=2 | `/ar/summary?orgId=2` | 200 |

### 5. 审计日志API检查 (2个测试)

| 测试项 | 端点 | 期望HTTP状态码 |
|--------|------|----------------|
| GET /audit-logs (无参数) | `/audit-logs` | 400 (缺少参数) |
| GET /audit-logs?page=1&limit=10 | `/audit-logs?page=1&limit=10` | 200 |

### 6. 订单API检查 (2个测试)

| 测试项 | 端点 | 期望HTTP状态码 |
|--------|------|----------------|
| GET /api/internal/orders (无参数) | `/api/internal/orders` | 400 (缺少orgId) |
| GET /api/internal/orders?orgId=2 | `/api/internal/orders?orgId=2` | 200 |

### 7. 外部API隔离检查 (2个测试)

| 测试项 | 端点 | 期望HTTP状态码 |
|--------|------|----------------|
| GET /api/external/orders?orgId=2 | `/api/external/orders?orgId=2` | 200 (只读允许) |
| POST /api/external/orders | `/api/external/orders` | 404 (写入禁止) |

---

## 📝 使用方法

### Linux / macOS / WSL

```bash
# 方法1: 使用npm命令
cd backend
npm run smoke:ar

# 方法2: 直接执行脚本
cd backend
bash scripts/smoke-ar.sh

# 方法3: 自定义配置
BASE_URL=http://localhost:4000 \
DB_HOST=192.168.1.100 \
DB_USER=admin \
DB_PASSWORD=secret \
npm run smoke:ar
```

### Windows (PowerShell)

```powershell
# 方法1: 直接执行脚本
cd backend
powershell -ExecutionPolicy Bypass -File scripts/smoke-ar.ps1

# 方法2: 自定义配置
$env:BASE_URL="http://localhost:4000"
$env:DB_HOST="192.168.1.100"
$env:DB_USER="admin"
$env:DB_PASSWORD="secret"
powershell -ExecutionPolicy Bypass -File scripts/smoke-ar.ps1
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BASE_URL` | `http://localhost:3000` | 应用基础URL |
| `DB_HOST` | `localhost` | 数据库主机 |
| `DB_PORT` | `3306` | 数据库端口 |
| `DB_USER` | `root` | 数据库用户名 |
| `DB_PASSWORD` | `password` | 数据库密码 |
| `DB_DATABASE` | `qianzhang_sales_test` | 数据库名称 |

---

## 📊 输出示例

### 成功输出

```
=========================================
AR模块冒烟测试
=========================================

1. 检查应用状态
-----------------------------------
[1] 测试: 应用健康检查 ... ✓ 通过
[2] 测试: Swagger文档可访问 ... ✓ 通过

2. 检查数据库连接
-----------------------------------
[3] 测试: 数据库连接正常 ... ✓ 通过
[4] 测试: 数据库存在 ... ✓ 通过

3. 检查AR表结构
-----------------------------------
[5] 测试: ar_payments表存在 ... ✓ 通过
[6] 测试: ar_invoices表存在 ... ✓ 通过
[7] 测试: audit_logs表存在 ... ✓ 通过

4. 检查AR API端点
-----------------------------------
[8] 测试: GET /ar/payments (无参数) ... ✓ 通过
[9] 测试: GET /ar/payments?orgId=2 ... ✓ 通过
[10] 测试: GET /ar/invoices?orgId=2 ... ✓ 通过
[11] 测试: GET /ar/summary?orgId=2 ... ✓ 通过

5. 检查审计日志API
-----------------------------------
[12] 测试: GET /audit-logs (无参数) ... ✓ 通过
[13] 测试: GET /audit-logs?page=1&limit=10 ... ✓ 通过

6. 检查订单API
-----------------------------------
[14] 测试: GET /api/internal/orders (无参数) ... ✓ 通过
[15] 测试: GET /api/internal/orders?orgId=2 ... ✓ 通过

7. 检查外部API隔离
-----------------------------------
[16] 测试: GET /api/external/orders?orgId=2 (只读) ... ✓ 通过
[17] 测试: POST /api/external/orders (禁止写入) ... ✓ 通过

=========================================
测试结果汇总
=========================================
总计: 17
通过: 17
失败: 0

✓ 所有测试通过！AR模块运行正常。
```

### 失败输出

```
=========================================
AR模块冒烟测试
=========================================

1. 检查应用状态
-----------------------------------
[1] 测试: 应用健康检查 ... ✗ 失败
[2] 测试: Swagger文档可访问 ... ✗ 失败

...

=========================================
测试结果汇总
=========================================
总计: 17
通过: 10
失败: 7

✗ 有 7 个测试失败，请检查日志。
```

---

## 🎯 集成到CI

### GitHub Actions示例

```yaml
name: Smoke Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: qianzhang_sales_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run database sync
        run: |
          cd backend
          npm run db:sync
        env:
          DB_HOST: localhost
          DB_PORT: 3306
          DB_USERNAME: root
          DB_PASSWORD: password
          DB_DATABASE: qianzhang_sales_test
      
      - name: Start application
        run: |
          cd backend
          npm run start:dev &
          sleep 10
      
      - name: Run smoke test
        run: |
          cd backend
          npm run smoke:ar
        env:
          BASE_URL: http://localhost:3000
          DB_HOST: localhost
          DB_PORT: 3306
          DB_USER: root
          DB_PASSWORD: password
          DB_DATABASE: qianzhang_sales_test
```

---

## 📋 验收标准

- [x] 创建Bash版本的smoke-ar.sh脚本
- [x] 创建PowerShell版本的smoke-ar.ps1脚本
- [x] 在package.json中添加smoke:ar命令
- [x] 脚本包含至少15个测试用例
- [x] 脚本支持环境变量配置
- [x] 脚本有清晰的输出和错误处理
- [x] 脚本返回正确的退出码（0=成功，1=失败）
- [x] 更新相关文档

---

## 🔗 相关文件

- `backend/scripts/smoke-ar.sh` - Linux/macOS版本
- `backend/scripts/smoke-ar.ps1` - Windows版本
- `backend/package.json` - npm scripts定义
- `MAIN_BRANCH_REGRESSION_REPORT_TEMPLATE.md` - 回归测试模板

---

## 📝 后续改进

### 短期改进

1. **添加更多测试用例**:
   - 测试数据创建和查询
   - 测试完整业务流程
   - 测试错误处理

2. **添加性能检查**:
   - API响应时间
   - 数据库查询性能
   - 并发请求测试

### 长期改进

3. **集成到CI/CD**:
   - 自动运行smoke测试
   - 失败时发送通知
   - 生成测试报告

4. **扩展到其他模块**:
   - `smoke:order` - 订单模块冒烟测试
   - `smoke:all` - 全模块冒烟测试

---

**创建完成时间**: 2024-01-29  
**创建人**: Manus AI Agent  
**Git Commit**: 待提交
