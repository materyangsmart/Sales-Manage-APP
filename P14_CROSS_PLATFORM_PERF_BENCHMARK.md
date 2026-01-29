# P14: 创建跨平台性能基准脚本

**创建日期**: 2024-01-29  
**目的**: 将"性能 <500ms"变成可重复的基准，支持Windows/Linux/macOS  
**状态**: ✅ 已完成

---

## 📋 背景

在P7中提到了"<500ms"的性能目标，但这是口头指标，无法复现和验证。需要创建可重复的性能基准测试脚本，确保：

1. **可复现**: 任何人按照文档都能重现测试结果
2. **跨平台**: 支持Windows、Linux、macOS
3. **可验证**: 输出包含P50/P95/P99等关键指标
4. **可对比**: 生成报告，便于版本间对比

---

## ✅ 解决方案

### 1. 创建Bash版本脚本

**文件**: `backend/scripts/perf-test-audit.sh`

**功能**:
- 自动检测可用的性能测试工具（wrk、autocannon、curl）
- 测试4个关键端点
- 生成详细的性能报告
- 支持环境变量配置

**平台**: Linux / macOS / WSL

**特点**:
- 优先使用wrk（高性能）
- 备选autocannon（跨平台）
- 最后使用curl循环（兼容性）

### 2. 创建PowerShell版本脚本

**文件**: `backend/scripts/perf-test-audit.ps1`

**功能**: 与Bash版本相同

**平台**: Windows (PowerShell)

**特点**:
- 使用 `Invoke-WebRequest` 进行HTTP请求
- 计算P50/P95/P99延迟
- 彩色输出支持
- 自动生成性能报告

### 3. 更新性能基准文档

**文件**: `backend/docs/perf/audit_query_benchmark.md`

**更新内容**:
- 添加跨平台测试说明
- 添加测试工具选择指南
- 添加完整的复现步骤
- 添加示例输出

### 4. 添加npm命令

**文件**: `backend/package.json`

**添加内容**:
```json
{
  "scripts": {
    "perf:audit": "bash scripts/perf-test-audit.sh",
    "generate:audit-logs": "ts-node -r tsconfig-paths/register scripts/generate-audit-logs.ts"
  }
}
```

---

## 🧪 测试场景

### 测试端点

| 端点 | 说明 | 期望P50 | 期望P95 |
|------|------|---------|---------|
| `/audit-logs?page=1&limit=10` | 查询第1页，每页10条 | <200ms | <500ms |
| `/audit-logs?page=1&limit=50` | 查询第1页，每页50条 | <200ms | <500ms |
| `/audit-logs?page=1&limit=100` | 查询第1页，每页100条 | <200ms | <500ms |
| `/audit-logs/recent?limit=20` | 查询最近20条记录 | <200ms | <500ms |

### 测试工具

#### 1. wrk (推荐 - Linux/macOS)

**优点**:
- 高性能，支持多线程和并发
- 输出详细的延迟分布
- 广泛使用的基准测试工具

**安装**:
```bash
# macOS
brew install wrk

# Ubuntu/Debian
sudo apt-get install wrk

# CentOS/RHEL
sudo yum install wrk
```

**示例输出**:
```
Running 30s test @ http://localhost:3000/audit-logs?page=1&limit=10
  2 threads and 10 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   185.23ms   68.45ms 520.12ms   75.23%
    Req/Sec    27.45      5.23    40.00     68.33%
  1642 requests in 30.02s, 4.93MB read
Requests/sec:     54.71
Transfer/sec:    168.15KB
```

#### 2. autocannon (推荐 - 跨平台)

**优点**:
- Node.js编写，跨平台支持
- 安装简单，无需编译
- 输出格式友好

**安装**:
```bash
npm install -g autocannon
```

**示例输出**:
```
Running 30s test @ http://localhost:3000/audit-logs?page=1&limit=10
10 connections

┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬───────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max   │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼───────┤
│ Latency │ 45ms │ 180ms│ 450ms │ 520ms│ 195ms   │ 85ms    │ 650ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴───────┘

1536 requests in 30.03s, 4.62MB read
```

#### 3. curl循环 (备选)

**优点**:
- 无需安装额外工具
- 适用于所有平台

**缺点**:
- 性能较低，无法模拟高并发
- 仅用于基本测试

**示例输出**:
```
使用简单curl循环测试（100次请求）...
..........
平均响应时间: 187ms
总请求数: 100
总耗时: 18700ms
```

---

## 📝 使用方法

### Linux / macOS / WSL

```bash
# 方法1: 使用npm命令
cd backend
npm run perf:audit

# 方法2: 直接执行脚本
bash scripts/perf-test-audit.sh

# 方法3: 自定义配置
BASE_URL=http://localhost:4000 \
TEST_DURATION=60 \
CONNECTIONS=20 \
THREADS=4 \
bash scripts/perf-test-audit.sh
```

**环境变量**:
- `BASE_URL`: 应用基础URL（默认: `http://localhost:3000`）
- `TEST_DURATION`: 测试持续时间（秒，默认: 30）
- `CONNECTIONS`: 并发连接数（默认: 10）
- `THREADS`: 线程数（默认: 2）

### Windows (PowerShell)

```powershell
# 方法1: 直接执行脚本
cd backend
powershell -ExecutionPolicy Bypass -File scripts/perf-test-audit.ps1

# 方法2: 自定义配置
$env:BASE_URL="http://localhost:4000"
$env:TEST_REQUESTS=200
powershell -ExecutionPolicy Bypass -File scripts/perf-test-audit.ps1
```

**环境变量**:
- `BASE_URL`: 应用基础URL（默认: `http://localhost:3000`）
- `TEST_REQUESTS`: 测试请求数（默认: 100）

---

## 📊 报告生成

### 报告格式

脚本会自动生成Markdown格式的性能基准报告：

**文件名**: `docs/perf/audit_query_benchmark_YYYYMMDD_HHMMSS.md`

**报告内容**:
1. **测试元数据**: 日期、环境、工具、配置
2. **测试结果**: 每个端点的P50/P95/P99延迟
3. **性能评估**: 与目标对比，标注通过/失败
4. **数据规模**: 测试数据量
5. **复现步骤**: 完整的测试步骤

### 报告示例

```markdown
# 审计日志查询性能基准报告

**测试日期**: 2024-01-29 14:30:52  
**测试环境**: Linux 5.15.0  
**测试工具**: wrk  
**应用URL**: http://localhost:3000

---

## 测试配置

- **测试持续时间**: 30秒
- **并发连接数**: 10
- **线程数**: 2

---

## 测试结果

### 端点1: /audit-logs?page=1&limit=10

- **说明**: 查询第1页，每页10条记录
- **P50延迟**: 178ms
- **P95延迟**: 398ms
- **平均延迟**: 187ms
- **吞吐量**: 54.7 req/s

### 性能评估

| 端点 | P50延迟 | 评估 |
|------|---------|------|
| /audit-logs?page=1&limit=10 | 178ms | ✅ 优秀 (<200ms) |
| /audit-logs?page=1&limit=50 | 195ms | ✅ 优秀 (<200ms) |
| /audit-logs?page=1&limit=100 | 245ms | ✅ 良好 (<500ms) |
| /audit-logs/recent?limit=20 | 165ms | ✅ 优秀 (<200ms) |

---

## 结论

所有端点的P50延迟均 < 500ms，满足性能目标。
```

---

## 🎯 完整复现步骤

### 1. 准备环境

```bash
# 克隆项目
git clone https://github.com/materyangsmart/Sales-Manage-APP.git
cd Sales-Manage-APP/backend

# 安装依赖
npm ci

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接
```

### 2. 初始化数据库

```bash
# 同步数据库结构
npm run db:sync

# 生成100,000条测试数据
npm run generate:audit-logs
```

**预期输出**:
```
开始生成100,000条审计日志...
已生成 10000 / 100000 条记录
已生成 20000 / 100000 条记录
...
已生成 100000 / 100000 条记录
✅ 数据生成完成！
```

### 3. 启动应用

```bash
npm run start:dev
```

**预期输出**:
```
[Nest] 12345  - 01/29/2024, 2:30:45 PM     LOG [NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
Swagger docs available at: http://localhost:3000/api-docs
```

### 4. 运行性能测试

#### Linux / macOS

```bash
# 安装性能测试工具（可选）
brew install wrk  # macOS
# 或
sudo apt-get install wrk  # Ubuntu

# 运行测试
npm run perf:audit
```

#### Windows

```powershell
# 运行测试
powershell -ExecutionPolicy Bypass -File scripts/perf-test-audit.ps1
```

### 5. 查看报告

```bash
# 列出所有报告
ls -la docs/perf/

# 查看最新报告
cat docs/perf/audit_query_benchmark_*.md | tail -100
```

---

## 📋 验收标准

- [x] 创建Bash版本的perf-test-audit.sh脚本
- [x] 创建PowerShell版本的perf-test-audit.ps1脚本
- [x] 在package.json中添加perf:audit命令
- [x] 脚本支持环境变量配置
- [x] 脚本自动检测可用的性能测试工具
- [x] 脚本测试至少4个关键端点
- [x] 脚本自动生成性能报告
- [x] 报告包含P50/P95/P99延迟数据
- [x] 报告包含性能评估（通过/失败）
- [x] 报告包含完整的复现步骤
- [x] 更新性能基准文档
- [x] 添加跨平台测试说明

---

## 🔗 相关文件

- `backend/scripts/perf-test-audit.sh` - Linux/macOS版本
- `backend/scripts/perf-test-audit.ps1` - Windows版本
- `backend/scripts/generate-audit-logs.ts` - 测试数据生成脚本
- `backend/docs/perf/audit_query_benchmark.md` - 性能基准文档
- `backend/package.json` - npm scripts定义

---

## 📈 改进效果

### 修改前

**问题**:
- ❌ 性能指标是口头的（"<500ms"）
- ❌ 无法验证性能是否满足要求
- ❌ 无法在不同环境下复现测试
- ❌ 无法对比不同版本的性能

### 修改后

**改进**:
- ✅ 性能指标可量化（P50/P95/P99）
- ✅ 自动化测试脚本，一键运行
- ✅ 跨平台支持（Windows/Linux/macOS）
- ✅ 自动生成报告，便于对比
- ✅ 完整的复现步骤，任何人都能重现

---

## 🎉 总结

**P14任务完成！**

现在我们有了：
1. ✅ 跨平台的性能测试脚本（Bash + PowerShell）
2. ✅ 自动化的报告生成
3. ✅ 完整的复现步骤
4. ✅ 详细的性能基准文档

**性能指标从"口头"变成"可复现、可验证、可对比"！**

---

**创建完成时间**: 2024-01-29  
**创建人**: Manus AI Agent  
**Git Commit**: 待提交
