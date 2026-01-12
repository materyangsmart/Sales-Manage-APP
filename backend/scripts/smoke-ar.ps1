# AR模块冒烟测试脚本（Windows PowerShell）
# 用途：5分钟快速验证AR模块核心功能
# 使用：powershell -ExecutionPolicy Bypass -File scripts\smoke-ar.ps1

param(
    [switch]$SkipDataTest = $false
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 测试结果统计
$script:PassCount = 0
$script:FailCount = 0
$script:TotalCount = 0

# 测试数据ID
$script:TestInvoiceId = $null
$script:TestPaymentId = $null

# 日志函数
function Log-Info {
    param([string]$Message)
    Write-Host "ℹ " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Log-Success {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $Message
    $script:PassCount++
    $script:TotalCount++
}

function Log-Error {
    param([string]$Message)
    Write-Host "✗ " -ForegroundColor Red -NoNewline
    Write-Host $Message
    $script:FailCount++
    $script:TotalCount++
}

function Log-Warning {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

# 打印分隔线
function Print-Separator {
    Write-Host ""
    Write-Host ("━" * 80)
    Write-Host ""
}

# 打印标题
function Print-Title {
    param([string]$Title)
    Print-Separator
    Write-Host $Title -ForegroundColor Blue
    Print-Separator
}

# 加载环境变量
function Load-Env {
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match "^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$") {
                $name = $matches[1]
                $value = $matches[2]
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
        Log-Success "环境变量加载成功"
    } else {
        Log-Error "未找到.env文件，请先配置环境变量"
        exit 1
    }
}

# 检查MySQL连接
function Test-MySQLConnection {
    Log-Info "检查MySQL连接..."
    
    $mysqlCmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
    
    if ($mysqlCmd) {
        $dbHost = $env:DB_HOST ?? "localhost"
        $dbPort = $env:DB_PORT ?? "3306"
        $dbUser = $env:DB_USERNAME ?? "root"
        $dbPass = $env:DB_PASSWORD ?? ""
        
        try {
            $result = & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" -e "SELECT 1;" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Log-Success "MySQL连接成功"
                return $true
            } else {
                Log-Error "MySQL连接失败，请检查数据库配置"
                return $false
            }
        } catch {
            Log-Error "MySQL连接失败: $_"
            return $false
        }
    } else {
        Log-Warning "未找到mysql.exe命令，跳过MySQL连接检查"
        return $true
    }
}

# 检查数据库表
function Test-DatabaseTables {
    Log-Info "检查数据库表..."
    
    $mysqlCmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
    
    if ($mysqlCmd) {
        $dbHost = $env:DB_HOST ?? "localhost"
        $dbPort = $env:DB_PORT ?? "3306"
        $dbUser = $env:DB_USERNAME ?? "root"
        $dbPass = $env:DB_PASSWORD ?? ""
        $dbName = $env:DB_DATABASE ?? "qianzhang_sales"
        
        try {
            $tables = & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" $dbName -e "SHOW TABLES;" 2>&1 | Select-Object -Skip 1
            
            $requiredTables = @("ar_payments", "ar_invoices", "ar_apply", "audit_logs")
            $allExists = $true
            
            foreach ($table in $requiredTables) {
                if ($tables -contains $table) {
                    Log-Success "表 $table 存在"
                } else {
                    Log-Error "表 $table 不存在"
                    $allExists = $false
                }
            }
            
            if (-not $allExists) {
                Log-Warning "部分表不存在，请先运行: npm run db:sync"
                return $false
            }
            
            return $true
        } catch {
            Log-Error "检查表失败: $_"
            return $false
        }
    } else {
        Log-Warning "未找到mysql.exe命令，跳过表检查"
        return $true
    }
}

# 等待后端服务启动
function Wait-ForBackend {
    Log-Info "等待后端服务启动..."
    
    $port = $env:PORT ?? "3000"
    $maxRetries = 30
    $retryCount = 0
    
    while ($retryCount -lt $maxRetries) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$port/" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Log-Success "后端服务已就绪"
                return $true
            }
        } catch {
            # 忽略错误，继续重试
        }
        
        $retryCount++
        Start-Sleep -Seconds 1
    }
    
    Log-Error "后端服务启动超时（30秒）"
    return $false
}

# 测试API端点
function Test-API {
    param(
        [string]$Method,
        [string]$Endpoint,
        [int]$ExpectedStatus,
        [string]$Description
    )
    
    Log-Info "测试: $Description"
    
    $port = $env:PORT ?? "3000"
    $url = "http://localhost:$port$Endpoint"
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method $Method -ErrorAction Stop
        $statusCode = $response.StatusCode
        $body = $response.Content
        
        if ($statusCode -eq $ExpectedStatus) {
            Log-Success "$Description - 返回 $statusCode"
            
            # 验证JSON格式
            try {
                $json = $body | ConvertFrom-Json
                Log-Success "$Description - JSON格式正确"
            } catch {
                Log-Warning "$Description - 响应不是有效的JSON"
            }
            
            return $true
        } else {
            Log-Error "$Description - 期望 $ExpectedStatus，实际 $statusCode"
            Write-Host "响应内容: $body"
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedStatus) {
            Log-Success "$Description - 返回 $statusCode"
            return $true
        } else {
            Log-Error "$Description - 请求失败: $_"
            return $false
        }
    }
}

# 插入测试数据
function Insert-TestData {
    Log-Info "插入测试数据..."
    
    $mysqlCmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
    
    if (-not $mysqlCmd) {
        Log-Warning "未找到mysql.exe命令，跳过测试数据插入"
        return $true
    }
    
    $dbHost = $env:DB_HOST ?? "localhost"
    $dbPort = $env:DB_PORT ?? "3306"
    $dbUser = $env:DB_USERNAME ?? "root"
    $dbPass = $env:DB_PASSWORD ?? ""
    $dbName = $env:DB_DATABASE ?? "qianzhang_sales"
    
    # 生成随机后缀避免唯一键冲突
    $randomSuffix = [DateTimeOffset]::Now.ToUnixTimeSeconds()
    
    try {
        # 插入invoice
        $insertInvoiceSql = @"
INSERT INTO ar_invoices (
    org_id, customer_id, invoice_no, invoice_date, 
    due_date, total_amount, balance, status, created_by
) VALUES (
    2, 1, 'INV-TEST-$randomSuffix', CURDATE(), 
    DATE_ADD(CURDATE(), INTERVAL 30 DAY), 5000, 5000, 'OPEN', 1
);
"@
        
        & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" $dbName -e $insertInvoiceSql 2>&1 | Out-Null
        
        $invoiceId = & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" $dbName -N -e "SELECT LAST_INSERT_ID();" 2>&1
        $script:TestInvoiceId = $invoiceId.Trim()
        
        # 插入payment
        $insertPaymentSql = @"
INSERT INTO ar_payments (
    org_id, customer_id, payment_no, bank_ref, amount, 
    unapplied_amount, payment_date, payment_method, status, created_by
) VALUES (
    2, 1, 'PMT-TEST-$randomSuffix', 'BANK-TEST-$randomSuffix', 6000, 
    6000, CURDATE(), 'BANK_TRANSFER', 'UNAPPLIED', 1
);
"@
        
        & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" $dbName -e $insertPaymentSql 2>&1 | Out-Null
        
        $paymentId = & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" $dbName -N -e "SELECT LAST_INSERT_ID();" 2>&1
        $script:TestPaymentId = $paymentId.Trim()
        
        Log-Success "测试数据插入成功 (Invoice ID: $script:TestInvoiceId, Payment ID: $script:TestPaymentId)"
        return $true
    } catch {
        Log-Error "插入测试数据失败: $_"
        return $false
    }
}

# 验证测试数据
function Test-TestData {
    Log-Info "验证测试数据..."
    
    # 查询UNAPPLIED状态的payment
    return Test-API -Method "GET" -Endpoint "/ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20" -ExpectedStatus 200 -Description "查询UNAPPLIED状态的payments"
}

# 清理测试数据
function Remove-TestData {
    Log-Info "清理测试数据..."
    
    $mysqlCmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
    
    if (-not $mysqlCmd) {
        Log-Warning "未找到mysql.exe命令，跳过测试数据清理"
        return
    }
    
    $dbHost = $env:DB_HOST ?? "localhost"
    $dbPort = $env:DB_PORT ?? "3306"
    $dbUser = $env:DB_USERNAME ?? "root"
    $dbPass = $env:DB_PASSWORD ?? ""
    $dbName = $env:DB_DATABASE ?? "qianzhang_sales"
    
    try {
        if ($script:TestPaymentId) {
            & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" $dbName -e "DELETE FROM ar_payments WHERE id = $script:TestPaymentId;" 2>&1 | Out-Null
        }
        
        if ($script:TestInvoiceId) {
            & mysql.exe -h $dbHost -P $dbPort -u $dbUser -p"$dbPass" $dbName -e "DELETE FROM ar_invoices WHERE id = $script:TestInvoiceId;" 2>&1 | Out-Null
        }
        
        Log-Success "测试数据清理完成"
    } catch {
        Log-Warning "清理测试数据时出错: $_"
    }
}

# 主函数
function Main {
    Print-Title "🚀 AR模块冒烟测试"
    
    Log-Info "开始时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Log-Info "测试环境: Windows PowerShell"
    
    Print-Separator
    
    try {
        # 阶段1: 环境检查
        Print-Title "📋 阶段1: 环境检查"
        
        Load-Env
        if (-not (Test-MySQLConnection)) { exit 1 }
        if (-not (Test-DatabaseTables)) { exit 1 }
        
        # 阶段2: 后端服务检查
        Print-Title "📋 阶段2: 后端服务检查"
        
        if (-not (Wait-ForBackend)) {
            Log-Error "后端服务未运行，请先启动: npm run start:dev"
            exit 1
        }
        
        # 阶段3: API测试
        Print-Title "📋 阶段3: API基础测试"
        
        Test-API -Method "GET" -Endpoint "/" -ExpectedStatus 200 -Description "根路径"
        Test-API -Method "GET" -Endpoint "/ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20" -ExpectedStatus 200 -Description "查询UNAPPLIED payments"
        Test-API -Method "GET" -Endpoint "/ar/summary?orgId=2" -ExpectedStatus 200 -Description "查询AR汇总"
        
        # 阶段4: 数据写入测试（可选）
        if (-not $SkipDataTest) {
            Print-Title "📋 阶段4: 数据写入测试"
            
            Insert-TestData
            Test-TestData
        } else {
            Log-Warning "跳过数据写入测试（使用了-SkipDataTest参数）"
        }
        
        # 测试结果汇总
        Print-Title "📊 测试结果汇总"
        
        Write-Host "总测试数: $script:TotalCount"
        Write-Host "通过: " -NoNewline
        Write-Host $script:PassCount -ForegroundColor Green
        Write-Host "失败: " -NoNewline
        Write-Host $script:FailCount -ForegroundColor Red
        
        if ($script:FailCount -eq 0) {
            Write-Host ""
            Log-Success "所有测试通过！ 🎉"
            Print-Separator
            exit 0
        } else {
            Write-Host ""
            Log-Error "部分测试失败，请检查日志"
            Print-Separator
            exit 1
        }
    } finally {
        # 清理测试数据
        if (-not $SkipDataTest) {
            Remove-TestData
        }
    }
}

# 执行主函数
Main
