# 审计日志查询性能基准测试脚本 (PowerShell版本)
# 用途：测试审计日志查询API的性能，生成P50/P95基准数据
# 使用：powershell -ExecutionPolicy Bypass -File scripts/perf-test-audit.ps1

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "审计日志查询性能基准测试 (Windows)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 配置
$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$TEST_REQUESTS = if ($env:TEST_REQUESTS) { [int]$env:TEST_REQUESTS } else { 100 }
$WARMUP_REQUESTS = 10

Write-Host "配置信息:" -ForegroundColor Cyan
Write-Host "  BASE_URL: $BASE_URL"
Write-Host "  测试请求数: $TEST_REQUESTS"
Write-Host "  预热请求数: $WARMUP_REQUESTS"
Write-Host ""

# 检查应用是否运行
Write-Host "检查应用状态..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ 应用正在运行" -ForegroundColor Green
} catch {
    Write-Host "错误: 应用未运行，请先启动应用" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 测试端点
$TEST_ENDPOINTS = @(
    @{Path="/audit-logs?page=1&limit=10"; Description="查询第1页，每页10条记录"},
    @{Path="/audit-logs?page=1&limit=50"; Description="查询第1页，每页50条记录"},
    @{Path="/audit-logs?page=1&limit=100"; Description="查询第1页，每页100条记录"},
    @{Path="/audit-logs/recent?limit=20"; Description="查询最近20条记录"}
)

# 性能测试函数
function Test-EndpointPerformance {
    param(
        [string]$Url,
        [int]$Requests,
        [int]$WarmupRequests
    )
    
    $latencies = @()
    
    # 预热
    Write-Host "  预热中..." -NoNewline
    for ($i = 0; $i -lt $WarmupRequests; $i++) {
        Invoke-WebRequest -Uri $Url -UseBasicParsing | Out-Null
    }
    Write-Host " 完成" -ForegroundColor Green
    
    # 正式测试
    Write-Host "  测试中..." -NoNewline
    for ($i = 0; $i -lt $Requests; $i++) {
        $start = Get-Date
        Invoke-WebRequest -Uri $Url -UseBasicParsing | Out-Null
        $end = Get-Date
        $elapsed = ($end - $start).TotalMilliseconds
        $latencies += $elapsed
        
        if (($i + 1) % 10 -eq 0) {
            Write-Host -NoNewline "."
        }
    }
    Write-Host " 完成" -ForegroundColor Green
    
    # 计算统计数据
    $sortedLatencies = $latencies | Sort-Object
    $count = $sortedLatencies.Count
    
    $min = $sortedLatencies[0]
    $max = $sortedLatencies[$count - 1]
    $avg = ($sortedLatencies | Measure-Object -Average).Average
    $p50 = $sortedLatencies[[Math]::Floor($count * 0.5)]
    $p95 = $sortedLatencies[[Math]::Floor($count * 0.95)]
    $p99 = $sortedLatencies[[Math]::Floor($count * 0.99)]
    
    return @{
        Min = [Math]::Round($min, 2)
        Max = [Math]::Round($max, 2)
        Avg = [Math]::Round($avg, 2)
        P50 = [Math]::Round($p50, 2)
        P95 = [Math]::Round($p95, 2)
        P99 = [Math]::Round($p99, 2)
        Count = $count
    }
}

# 执行性能测试
Write-Host "开始性能测试..." -ForegroundColor Cyan
Write-Host "========================================="
Write-Host ""

$results = @()

foreach ($endpoint in $TEST_ENDPOINTS) {
    Write-Host "测试端点: $($endpoint.Path)" -ForegroundColor Yellow
    Write-Host "说明: $($endpoint.Description)"
    Write-Host "-----------------------------------"
    
    $url = "$BASE_URL$($endpoint.Path)"
    $stats = Test-EndpointPerformance -Url $url -Requests $TEST_REQUESTS -WarmupRequests $WARMUP_REQUESTS
    
    Write-Host ""
    Write-Host "  最小延迟: $($stats.Min)ms"
    Write-Host "  最大延迟: $($stats.Max)ms"
    Write-Host "  平均延迟: $($stats.Avg)ms"
    Write-Host "  P50延迟: $($stats.P50)ms" -ForegroundColor Green
    Write-Host "  P95延迟: $($stats.P95)ms" -ForegroundColor Green
    Write-Host "  P99延迟: $($stats.P99)ms"
    Write-Host "  总请求数: $($stats.Count)"
    Write-Host ""
    
    $results += @{
        Endpoint = $endpoint.Path
        Description = $endpoint.Description
        Stats = $stats
    }
}

Write-Host "========================================="
Write-Host "✓ 性能测试完成" -ForegroundColor Green
Write-Host ""

# 生成报告
Write-Host "生成性能基准报告..." -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportFile = "docs/perf/audit_query_benchmark_$timestamp.md"

# 确保目录存在
New-Item -ItemType Directory -Force -Path "docs/perf" | Out-Null

$reportContent = @"
# 审计日志查询性能基准报告

**测试日期**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")  
**测试环境**: Windows $(([System.Environment]::OSVersion.Version).ToString())  
**测试工具**: PowerShell + Invoke-WebRequest  
**应用URL**: $BASE_URL

---

## 测试配置

- **测试请求数**: $TEST_REQUESTS
- **预热请求数**: $WARMUP_REQUESTS
- **并发连接数**: 1 (顺序执行)

---

## 测试结果

"@

foreach ($result in $results) {
    $reportContent += @"

### 端点: $($result.Endpoint)

- **说明**: $($result.Description)
- **最小延迟**: $($result.Stats.Min)ms
- **最大延迟**: $($result.Stats.Max)ms
- **平均延迟**: $($result.Stats.Avg)ms
- **P50延迟**: $($result.Stats.P50)ms
- **P95延迟**: $($result.Stats.P95)ms
- **P99延迟**: $($result.Stats.P99)ms
- **总请求数**: $($result.Stats.Count)

"@
}

$reportContent += @"

---

## 数据规模

- **audit_logs表记录数**: [请手动填写]
- **测试数据生成方式**: 使用 ``npm run generate:audit-logs`` 生成

---

## 性能评估

### P50延迟评估

| 端点 | P50延迟 | 评估 |
|------|---------|------|
"@

foreach ($result in $results) {
    $p50 = $result.Stats.P50
    $assessment = if ($p50 -lt 100) { "✅ 优秀 (<100ms)" } 
                  elseif ($p50 -lt 500) { "✅ 良好 (<500ms)" }
                  elseif ($p50 -lt 1000) { "⚠️ 一般 (<1000ms)" }
                  else { "❌ 需优化 (>1000ms)" }
    
    $reportContent += "| $($result.Endpoint) | $($p50)ms | $assessment |`n"
}

$reportContent += @"

### P95延迟评估

| 端点 | P95延迟 | 评估 |
|------|---------|------|
"@

foreach ($result in $results) {
    $p95 = $result.Stats.P95
    $assessment = if ($p95 -lt 200) { "✅ 优秀 (<200ms)" } 
                  elseif ($p95 -lt 1000) { "✅ 良好 (<1000ms)" }
                  elseif ($p95 -lt 2000) { "⚠️ 一般 (<2000ms)" }
                  else { "❌ 需优化 (>2000ms)" }
    
    $reportContent += "| $($result.Endpoint) | $($p95)ms | $assessment |`n"
}

$reportContent += @"

---

## 结论

根据测试结果：

1. **性能目标**: P50 < 500ms, P95 < 1000ms
2. **测试环境**: Windows本地环境，单线程顺序请求
3. **优化建议**: [根据实际结果填写]

---

## 复现步骤

### Windows (PowerShell)

``````powershell
# 1. 启动应用
cd backend
npm run start:dev

# 2. 生成测试数据（如果需要）
npm run generate:audit-logs

# 3. 运行性能测试
powershell -ExecutionPolicy Bypass -File scripts/perf-test-audit.ps1
``````

### Linux / macOS

``````bash
# 1. 启动应用
cd backend
npm run start:dev

# 2. 生成测试数据（如果需要）
npm run generate:audit-logs

# 3. 运行性能测试
bash scripts/perf-test-audit.sh
``````

---

**报告生成时间**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")  
**报告生成人**: 自动化脚本 (PowerShell)
"@

$reportContent | Out-File -FilePath $reportFile -Encoding UTF8

Write-Host "✓ 报告已生成: $reportFile" -ForegroundColor Green
Write-Host ""

# 提示下一步操作
Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "1. 查看报告文件: $reportFile"
Write-Host "2. 如果数据库中没有足够的测试数据，运行: npm run generate:audit-logs"
Write-Host "3. 使用更专业的工具（如wrk或autocannon）进行并发测试"
Write-Host ""

Write-Host "✓ 性能基准测试完成！" -ForegroundColor Green
