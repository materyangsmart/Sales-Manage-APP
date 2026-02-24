#!/bin/bash

# 性能回归测试脚本

set -e

echo "=== 审计查询性能回归测试 ==="

# 1. 启动应用
echo "1. 启动应用..."
npm run start:dev &
APP_PID=$!
sleep 10

# 2. 等待应用就绪
echo "2. 等待应用就绪..."
MAX_RETRIES=30
RETRY_COUNT=0

until curl -s http://localhost:3000/health > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ 应用启动超时"
    kill $APP_PID 2>/dev/null || true
    exit 1
  fi
  echo "等待应用启动... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo "✅ 应用已就绪"

# 3. 运行性能测试
echo "3. 运行性能测试..."

echo "场景1: 分页查询（无过滤）"
autocannon -c 10 -d 30 -m GET \
  "http://localhost:3000/audit-logs?page=1&pageSize=20" \
  > perf-results-1.txt

echo "场景2: 按用户过滤"
autocannon -c 10 -d 30 -m GET \
  "http://localhost:3000/audit-logs?userId=1&page=1&pageSize=20" \
  > perf-results-2.txt

echo "场景3: 按时间范围过滤"
autocannon -c 10 -d 30 -m GET \
  "http://localhost:3000/audit-logs?startDate=2024-01-01&endDate=2024-01-31&page=1&pageSize=20" \
  > perf-results-3.txt

echo "场景4: 关键事件追溯"
autocannon -c 10 -d 30 -m GET \
  "http://localhost:3000/audit-logs/trace?resourceType=Order&resourceId=1" \
  > perf-results-4.txt

# 4. 停止应用
echo "4. 停止应用..."
kill $APP_PID 2>/dev/null || true
sleep 2

# 5. 分析结果
echo "5. 分析结果..."
echo ""
echo "=== 场景1: 分页查询（无过滤） ==="
cat perf-results-1.txt | grep -A 5 "Latency"

echo ""
echo "=== 场景2: 按用户过滤 ==="
cat perf-results-2.txt | grep -A 5 "Latency"

echo ""
echo "=== 场景3: 按时间范围过滤 ==="
cat perf-results-3.txt | grep -A 5 "Latency"

echo ""
echo "=== 场景4: 关键事件追溯 ==="
cat perf-results-4.txt | grep -A 5 "Latency"

echo ""
echo "✅ 性能回归测试完成！"
echo ""
echo "详细结果已保存到:"
echo "  - perf-results-1.txt"
echo "  - perf-results-2.txt"
echo "  - perf-results-3.txt"
echo "  - perf-results-4.txt"
