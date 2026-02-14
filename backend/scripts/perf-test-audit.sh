#!/bin/bash

# 审计日志查询性能基准测试脚本 (Bash版本)
# 用途：测试审计日志查询API的性能，生成P50/P95基准数据
# 使用：bash scripts/perf-test-audit.sh

set -e  # 遇到错误立即退出

echo "========================================="
echo "审计日志查询性能基准测试"
echo "========================================="
echo ""

# 配置
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_DURATION="${TEST_DURATION:-30}"  # 测试持续时间（秒）
CONNECTIONS="${CONNECTIONS:-10}"      # 并发连接数
THREADS="${THREADS:-2}"               # 线程数

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}配置信息:${NC}"
echo "  BASE_URL: $BASE_URL"
echo "  测试持续时间: ${TEST_DURATION}秒"
echo "  并发连接数: $CONNECTIONS"
echo "  线程数: $THREADS"
echo ""

# 检查依赖
echo -e "${CYAN}检查依赖...${NC}"

# 检查curl
if ! command -v curl &> /dev/null; then
    echo -e "${RED}错误: curl未安装${NC}"
    exit 1
fi

# 检查性能测试工具
PERF_TOOL=""
if command -v wrk &> /dev/null; then
    PERF_TOOL="wrk"
    echo -e "${GREEN}✓ 使用wrk进行性能测试${NC}"
elif command -v autocannon &> /dev/null; then
    PERF_TOOL="autocannon"
    echo -e "${GREEN}✓ 使用autocannon进行性能测试${NC}"
else
    echo -e "${YELLOW}⚠ 未找到wrk或autocannon，将使用简单的curl循环测试${NC}"
    PERF_TOOL="curl"
fi

echo ""

# 检查应用是否运行
echo -e "${CYAN}检查应用状态...${NC}"
if curl -s "$BASE_URL/" > /dev/null; then
    echo -e "${GREEN}✓ 应用正在运行${NC}"
else
    echo -e "${RED}错误: 应用未运行，请先启动应用${NC}"
    exit 1
fi

echo ""

# 测试端点
TEST_ENDPOINTS=(
    "/audit-logs?page=1&limit=10"
    "/audit-logs?page=1&limit=50"
    "/audit-logs?page=1&limit=100"
    "/audit-logs/recent?limit=20"
)

# 执行性能测试
echo -e "${CYAN}开始性能测试...${NC}"
echo "========================================="
echo ""

for endpoint in "${TEST_ENDPOINTS[@]}"; do
    echo -e "${YELLOW}测试端点: $endpoint${NC}"
    echo "-----------------------------------"
    
    case $PERF_TOOL in
        wrk)
            wrk -t$THREADS -c$CONNECTIONS -d${TEST_DURATION}s "$BASE_URL$endpoint"
            ;;
        autocannon)
            autocannon -c $CONNECTIONS -d $TEST_DURATION "$BASE_URL$endpoint"
            ;;
        curl)
            echo "使用简单curl循环测试（100次请求）..."
            total_time=0
            count=100
            
            for i in $(seq 1 $count); do
                start=$(date +%s%N)
                curl -s "$BASE_URL$endpoint" > /dev/null
                end=$(date +%s%N)
                elapsed=$((($end - $start) / 1000000))  # 转换为毫秒
                total_time=$(($total_time + $elapsed))
                
                if [ $(($i % 10)) -eq 0 ]; then
                    echo -n "."
                fi
            done
            
            echo ""
            avg_time=$(($total_time / $count))
            echo "平均响应时间: ${avg_time}ms"
            echo "总请求数: $count"
            echo "总耗时: ${total_time}ms"
            ;;
    esac
    
    echo ""
done

echo "========================================="
echo -e "${GREEN}✓ 性能测试完成${NC}"
echo ""

# 生成报告
echo -e "${CYAN}生成性能基准报告...${NC}"

REPORT_FILE="docs/perf/audit_query_benchmark_$(date +%Y%m%d_%H%M%S).md"
mkdir -p docs/perf

cat > "$REPORT_FILE" << EOF
# 审计日志查询性能基准报告

**测试日期**: $(date +"%Y-%m-%d %H:%M:%S")  
**测试环境**: $(uname -s) $(uname -r)  
**测试工具**: $PERF_TOOL  
**应用URL**: $BASE_URL

---

## 测试配置

- **测试持续时间**: ${TEST_DURATION}秒
- **并发连接数**: $CONNECTIONS
- **线程数**: $THREADS

---

## 测试结果

### 端点1: /audit-logs?page=1&limit=10

- **说明**: 查询第1页，每页10条记录
- **P50延迟**: [待填写]ms
- **P95延迟**: [待填写]ms
- **平均延迟**: [待填写]ms
- **吞吐量**: [待填写] req/s

### 端点2: /audit-logs?page=1&limit=50

- **说明**: 查询第1页，每页50条记录
- **P50延迟**: [待填写]ms
- **P95延迟**: [待填写]ms
- **平均延迟**: [待填写]ms
- **吞吐量**: [待填写] req/s

### 端点3: /audit-logs?page=1&limit=100

- **说明**: 查询第1页，每页100条记录
- **P50延迟**: [待填写]ms
- **P95延迟**: [待填写]ms
- **平均延迟**: [待填写]ms
- **吞吐量**: [待填写] req/s

### 端点4: /audit-logs/recent?limit=20

- **说明**: 查询最近20条记录
- **P50延迟**: [待填写]ms
- **P95延迟**: [待填写]ms
- **平均延迟**: [待填写]ms
- **吞吐量**: [待填写] req/s

---

## 数据规模

- **audit_logs表记录数**: [待填写]
- **测试数据生成方式**: 使用 \`npm run generate:audit-logs\` 生成

---

## 结论

[待填写]

---

**报告生成时间**: $(date +"%Y-%m-%d %H:%M:%S")  
**报告生成人**: 自动化脚本
EOF

echo -e "${GREEN}✓ 报告已生成: $REPORT_FILE${NC}"
echo ""

# 提示下一步操作
echo -e "${CYAN}下一步操作:${NC}"
echo "1. 查看完整测试输出"
echo "2. 编辑报告文件填写实际测试数据: $REPORT_FILE"
echo "3. 如果数据库中没有足够的测试数据，运行: npm run generate:audit-logs"
echo ""

echo -e "${GREEN}✓ 性能基准测试完成！${NC}"
