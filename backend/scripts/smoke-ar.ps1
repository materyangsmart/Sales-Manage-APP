# AR模块冒烟测试脚本 (PowerShell版本)
# 用途：快速验证AR模块的核心功能是否正常
# 使用：powershell -ExecutionPolicy Bypass -File scripts/smoke-ar.ps1
# 兼容性：PowerShell 5.1 和 7+

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "AR模块冒烟测试 (Windows)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 配置
$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "password" }
$DB_NAME = if ($env:DB_DATABASE) { $env:DB_DATABASE } else { "qianzhang_sales_test" }

# 测试计数器
$PASSED = 0
$FAILED = 0
$TOTAL = 0

# 测试函数
function Test-Case {
    param(
        [string]$Name,
        [scriptblock]$Command,
        [string]$Expected
    )
    
    $script:TOTAL++
    Write-Host -NoNewline "[$script:TOTAL] 测试: $Name ... "
    
    try {
        $result = & $Command
        if ($result -match $Expected) {
            Write-Host "✓ 通过" -ForegroundColor Green
            $script:PASSED++
            return $true
        } else {
            Write-Host "✗ 失败" -ForegroundColor Red
            Write-Host "  期望: $Expected" -ForegroundColor Gray
            Write-Host "  实际: $result" -ForegroundColor Gray
            $script:FAILED++
            return $false
        }
    } catch {
        Write-Host "✗ 失败 (异常: $_)" -ForegroundColor Red
        $script:FAILED++
        return $false
    }
}

# 1. 检查应用是否启动
Write-Host "1. 检查应用状态" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Case "应用健康检查" {
    (Invoke-WebRequest -Uri "$BASE_URL/" -UseBasicParsing).Content
} "Hello World"

Test-Case "Swagger文档可访问" {
    (Invoke-WebRequest -Uri "$BASE_URL/api-docs" -UseBasicParsing).Content.Substring(0, 100)
} "<!DOCTYPE html>"

Write-Host ""

# 2. 检查数据库连接 (需要MySQL客户端)
Write-Host "2. 检查数据库连接" -ForegroundColor Yellow
Write-Host "-----------------------------------"

if (Get-Command mysql -ErrorAction SilentlyContinue) {
    Test-Case "数据库连接正常" {
        # 使用安全的参数拼接方式，避免&运算符问题
        $mysqlArgs = @(
            "-h", $DB_HOST,
            "-P", $DB_PORT,
            "-u", $DB_USER,
            "-p$DB_PASSWORD",
            "-e", "SELECT 1"
        )
        $output = & mysql $mysqlArgs 2>&1 | Out-String
        $output
    } "1"
    
    Test-Case "数据库存在" {
        $mysqlArgs = @(
            "-h", $DB_HOST,
            "-P", $DB_PORT,
            "-u", $DB_USER,
            "-p$DB_PASSWORD",
            "-e", "SHOW DATABASES LIKE '$DB_NAME'"
        )
        $output = & mysql $mysqlArgs 2>&1 | Out-String
        $output
    } "$DB_NAME"
} else {
    Write-Host "⚠ MySQL客户端未安装，跳过数据库测试" -ForegroundColor Yellow
}

Write-Host ""

# 3. 检查AR表是否存在 (需要MySQL客户端)
Write-Host "3. 检查AR表结构" -ForegroundColor Yellow
Write-Host "-----------------------------------"

if (Get-Command mysql -ErrorAction SilentlyContinue) {
    Test-Case "ar_payments表存在" {
        $mysqlArgs = @(
            "-h", $DB_HOST,
            "-P", $DB_PORT,
            "-u", $DB_USER,
            "-p$DB_PASSWORD",
            $DB_NAME,
            "-e", "SHOW TABLES LIKE 'ar_payments'"
        )
        $output = & mysql $mysqlArgs 2>&1 | Out-String
        $output
    } "ar_payments"
    
    Test-Case "ar_invoices表存在" {
        $mysqlArgs = @(
            "-h", $DB_HOST,
            "-P", $DB_PORT,
            "-u", $DB_USER,
            "-p$DB_PASSWORD",
            $DB_NAME,
            "-e", "SHOW TABLES LIKE 'ar_invoices'"
        )
        $output = & mysql $mysqlArgs 2>&1 | Out-String
        $output
    } "ar_invoices"
    
    Test-Case "audit_logs表存在" {
        $mysqlArgs = @(
            "-h", $DB_HOST,
            "-P", $DB_PORT,
            "-u", $DB_USER,
            "-p$DB_PASSWORD",
            $DB_NAME,
            "-e", "SHOW TABLES LIKE 'audit_logs'"
        )
        $output = & mysql $mysqlArgs 2>&1 | Out-String
        $output
    } "audit_logs"
} else {
    Write-Host "⚠ MySQL客户端未安装，跳过表结构测试" -ForegroundColor Yellow
}

Write-Host ""

# 4. 检查AR API端点
Write-Host "4. 检查AR API端点" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Case "GET /ar/payments (无参数)" {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/ar/payments" -UseBasicParsing -ErrorAction Stop
        "200"
    } catch {
        $_.Exception.Response.StatusCode.value__.ToString()
    }
} "400"

Test-Case "GET /ar/payments?orgId=2" {
    $url = "$BASE_URL/ar/payments?orgId=2"
    (Invoke-WebRequest -Uri $url -UseBasicParsing).StatusCode.ToString()
} "200"

Test-Case "GET /ar/invoices?orgId=2" {
    $url = "$BASE_URL/ar/invoices?orgId=2"
    (Invoke-WebRequest -Uri $url -UseBasicParsing).StatusCode.ToString()
} "200"

Test-Case "GET /ar/summary?orgId=2" {
    $url = "$BASE_URL/ar/summary?orgId=2"
    (Invoke-WebRequest -Uri $url -UseBasicParsing).StatusCode.ToString()
} "200"

Write-Host ""

# 5. 检查审计日志API
Write-Host "5. 检查审计日志API" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Case "GET /audit-logs (无参数)" {
    (Invoke-WebRequest -Uri "$BASE_URL/audit-logs" -UseBasicParsing).StatusCode.ToString()
} "200"

Test-Case "GET /audit-logs?page=1&pageSize=10" {
    $url = "$BASE_URL/audit-logs?page=1&pageSize=10"
    (Invoke-WebRequest -Uri $url -UseBasicParsing).StatusCode.ToString()
} "200"

Write-Host ""

# 6. 检查订单API
Write-Host "6. 检查订单API" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Case "GET /api/internal/orders (无token)" {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/api/internal/orders" -UseBasicParsing -ErrorAction Stop
        "200"
    } catch {
        $_.Exception.Response.StatusCode.value__.ToString()
    }
} "403"

Test-Case "GET /api/internal/orders?orgId=2 (无token)" {
    try {
        $url = "$BASE_URL/api/internal/orders?orgId=2"
        Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        "200"
    } catch {
        $_.Exception.Response.StatusCode.value__.ToString()
    }
} "403"

Write-Host ""

# 7. 检查外部API隔离
Write-Host "7. 检查外部API隔离" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Case "GET /api/external/orders?orgId=2 (无token)" {
    try {
        $url = "$BASE_URL/api/external/orders?orgId=2"
        Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        "200"
    } catch {
        $_.Exception.Response.StatusCode.value__.ToString()
    }
} "403"

Test-Case "POST /api/external/orders (禁止写入)" {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/api/external/orders" -Method POST -UseBasicParsing -ErrorAction Stop
        "200"
    } catch {
        $_.Exception.Response.StatusCode.value__.ToString()
    }
} "404"

Write-Host ""

# 输出测试结果
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "测试结果汇总" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "总计: $TOTAL"
Write-Host "通过: $PASSED" -ForegroundColor Green
Write-Host "失败: $FAILED" -ForegroundColor Red
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "✓ 所有测试通过！AR模块运行正常。" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ 有 $FAILED 个测试失败，请检查日志。" -ForegroundColor Red
    exit 1
}
