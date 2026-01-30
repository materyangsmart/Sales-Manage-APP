# Windows环境下的Smoke测试指南

本文档说明如何在Windows环境下运行AR模块的冒烟测试（smoke test）。

---

## 前置要求

### 1. PowerShell版本

支持以下PowerShell版本：
- **PowerShell 5.1**（Windows 10/11内置）
- **PowerShell 7+**（推荐，需要单独安装）

检查PowerShell版本：
```powershell
$PSVersionTable.PSVersion
```

### 2. MySQL客户端（可选）

如果需要运行数据库测试，请安装MySQL客户端：
- 下载地址：https://dev.mysql.com/downloads/mysql/
- 或使用Chocolatey安装：`choco install mysql`

检查MySQL客户端是否安装：
```powershell
mysql --version
```

### 3. 环境配置

确保backend目录下存在`.env`文件，并配置以下变量：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=qianzhang_sales_test

# 应用配置
PORT=3000
```

---

## 运行Smoke测试

### 方法1：使用npm命令（推荐）

```powershell
# 进入backend目录
cd backend

# 运行Windows版本的smoke测试
npm run smoke:ar:win
```

### 方法2：直接运行PowerShell脚本

```powershell
# 进入backend目录
cd backend

# 运行脚本
powershell -ExecutionPolicy Bypass -File scripts/smoke-ar.ps1
```

---

## 预期输出

### 成功输出示例

```
=========================================
AR模块冒烟测试 (Windows)
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

### 部分失败输出示例

```
=========================================
AR模块冒烟测试 (Windows)
=========================================

1. 检查应用状态
-----------------------------------
[1] 测试: 应用健康检查 ... ✗ 失败
  期望: Hello World
  实际: (空)

2. 检查数据库连接
-----------------------------------
⚠ MySQL客户端未安装，跳过数据库测试

...

=========================================
测试结果汇总
=========================================
总计: 10
通过: 9
失败: 1

✗ 有 1 个测试失败，请检查日志。
```

---

## 常见问题

### 1. "无法加载文件，因为在此系统上禁止运行脚本"

**原因**：PowerShell执行策略限制

**解决方案**：
```powershell
# 临时允许脚本执行（推荐）
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 或使用-ExecutionPolicy参数
powershell -ExecutionPolicy Bypass -File scripts/smoke-ar.ps1
```

### 2. "应用健康检查失败"

**原因**：backend服务未启动

**解决方案**：
```powershell
# 启动backend服务
npm run start:dev

# 等待几秒后再运行smoke测试
npm run smoke:ar:win
```

### 3. "数据库连接失败"

**原因**：.env文件未配置或数据库服务未启动

**解决方案**：
1. 检查`.env`文件是否存在并配置正确
2. 启动MySQL服务：
   ```powershell
   # 使用服务管理器
   net start MySQL80
   
   # 或使用Docker
   docker-compose up -d mysql
   ```

### 4. "MySQL客户端未安装"

**原因**：系统未安装MySQL命令行工具

**解决方案**：
- 安装MySQL客户端（可选，不影响API测试）
- 或跳过数据库测试（脚本会自动跳过）

### 5. "URL中的&符号导致解析错误"

**原因**：旧版本的脚本使用了不安全的URL拼接方式

**解决方案**：
- 确保使用最新版本的`smoke-ar.ps1`脚本
- 最新版本已修复此问题，使用变量存储URL

---

## 自定义配置

### 修改测试目标URL

```powershell
# 设置环境变量
$env:BASE_URL = "http://localhost:4000"

# 运行测试
npm run smoke:ar:win
```

### 修改数据库配置

```powershell
# 设置环境变量
$env:DB_HOST = "192.168.1.100"
$env:DB_PORT = "3306"
$env:DB_USER = "root"
$env:DB_PASSWORD = "password"
$env:DB_DATABASE = "qianzhang_sales_test"

# 运行测试
npm run smoke:ar:win
```

---

## CI/CD集成

### GitHub Actions示例

```yaml
name: Windows Smoke Test

on: [push, pull_request]

jobs:
  smoke-test:
    runs-on: windows-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        working-directory: backend
        run: npm ci
      
      - name: Setup MySQL
        uses: ankane/setup-mysql@v1
        with:
          mysql-version: '8.0'
      
      - name: Create .env file
        working-directory: backend
        run: |
          echo "DB_HOST=localhost" > .env
          echo "DB_PORT=3306" >> .env
          echo "DB_USERNAME=root" >> .env
          echo "DB_PASSWORD=root" >> .env
          echo "DB_DATABASE=qianzhang_sales_test" >> .env
          echo "PORT=3000" >> .env
      
      - name: Start backend
        working-directory: backend
        run: |
          Start-Process -NoNewWindow npm -ArgumentList "run", "start:dev"
          Start-Sleep -Seconds 10
      
      - name: Run smoke test
        working-directory: backend
        run: npm run smoke:ar:win
```

---

## 技术细节

### PowerShell兼容性修复

最新版本的`smoke-ar.ps1`脚本已修复以下问题：

1. **&运算符问题**：使用数组参数传递给mysql命令，避免&符号被解释为后台运行
2. **URL拼接问题**：使用变量存储完整URL，避免&符号在URL中被误解析
3. **编码问题**：脚本使用UTF-8 with BOM编码，确保中文字符正确显示
4. **错误信息增强**：失败时显示期望值和实际值，便于调试

### 脚本结构

```powershell
# 1. 配置加载（支持环境变量覆盖）
$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }

# 2. 测试函数（支持正则匹配）
function Test-Case {
    param([string]$Name, [scriptblock]$Command, [string]$Expected)
    # ...
}

# 3. 测试用例（7个测试组，17个测试用例）
# - 应用状态检查
# - 数据库连接检查
# - AR表结构检查
# - AR API端点检查
# - 审计日志API检查
# - 订单API检查
# - 外部API隔离检查

# 4. 结果汇总（返回正确的退出码）
exit 0  # 全部通过
exit 1  # 有失败
```

---

## 相关文档

- [本地启动文档](LOCAL_BOOTSTRAP.md)
- [部署文档](DEPLOY_STAGING.md)
- [冒烟测试脚本（Linux/macOS）](../scripts/smoke-ar.sh)
- [冒烟测试脚本（Windows）](../scripts/smoke-ar.ps1)

---

## 联系支持

如果遇到问题，请：
1. 检查本文档的"常见问题"部分
2. 查看backend启动日志：`npm run start:dev`
3. 提交Issue到GitHub仓库

---

**最后更新**：2026-01-30
