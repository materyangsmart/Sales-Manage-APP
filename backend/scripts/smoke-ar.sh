#!/bin/bash

# AR模块冒烟测试脚本
# 用途：快速验证AR模块的核心功能是否正常
# 使用：npm run smoke:ar

set -e  # 遇到错误立即退出

echo "========================================="
echo "AR模块冒烟测试"
echo "========================================="
echo ""

# 配置
BASE_URL="${BASE_URL:-http://localhost:3000}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_NAME="${DB_DATABASE:-qianzhang_sales_test}"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
PASSED=0
FAILED=0
TOTAL=0

# 测试函数
test_case() {
  local name="$1"
  local command="$2"
  local expected="$3"
  
  TOTAL=$((TOTAL + 1))
  echo -n "[$TOTAL] 测试: $name ... "
  
  if eval "$command" | grep -q "$expected"; then
    echo -e "${GREEN}✓ 通过${NC}"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ 失败${NC}"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# 1. 检查应用是否启动
echo "1. 检查应用状态"
echo "-----------------------------------"

test_case "应用健康检查" \
  "curl -s $BASE_URL/" \
  "Hello World"

test_case "Swagger文档可访问" \
  "curl -s $BASE_URL/api-docs | head -1" \
  "<!DOCTYPE html>"

echo ""

# 2. 检查数据库连接
echo "2. 检查数据库连接"
echo "-----------------------------------"

test_case "数据库连接正常" \
  "mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD -e 'SELECT 1' 2>&1" \
  "1"

test_case "数据库存在" \
  "mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD -e 'SHOW DATABASES LIKE \"$DB_NAME\"' 2>&1" \
  "$DB_NAME"

echo ""

# 3. 检查AR表是否存在
echo "3. 检查AR表结构"
echo "-----------------------------------"

test_case "ar_payments表存在" \
  "mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD $DB_NAME -e 'SHOW TABLES LIKE \"ar_payments\"' 2>&1" \
  "ar_payments"

test_case "ar_invoices表存在" \
  "mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD $DB_NAME -e 'SHOW TABLES LIKE \"ar_invoices\"' 2>&1" \
  "ar_invoices"

test_case "audit_logs表存在" \
  "mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD $DB_NAME -e 'SHOW TABLES LIKE \"audit_logs\"' 2>&1" \
  "audit_logs"

echo ""

# 4. 检查AR API端点
echo "4. 检查AR API端点"
echo "-----------------------------------"

test_case "GET /ar/payments (无参数)" \
  "curl -s -o /dev/null -w '%{http_code}' $BASE_URL/ar/payments" \
  "400"

test_case "GET /ar/payments?orgId=2" \
  "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/ar/payments?orgId=2'" \
  "200"

test_case "GET /ar/invoices?orgId=2" \
  "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/ar/invoices?orgId=2'" \
  "200"

test_case "GET /ar/summary?orgId=2" \
  "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/ar/summary?orgId=2'" \
  "200"

echo ""

# 5. 检查审计日志API
echo "5. 检查审计日志API"
echo "-----------------------------------"

test_case "GET /audit-logs (无参数)" \
  "curl -s -o /dev/null -w '%{http_code}' $BASE_URL/audit-logs" \
  "200"

test_case "GET /audit-logs?page=1&pageSize=10" \
  "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/audit-logs?page=1&pageSize=10'" \
  "200"

echo ""

# 6. 检查订单API
echo "6. 检查订单API"
echo "-----------------------------------"

test_case "GET /api/internal/orders (无token)" \
  "curl -s -o /dev/null -w '%{http_code}' $BASE_URL/api/internal/orders" \
  "403"

test_case "GET /api/internal/orders?orgId=2 (无token)" \
  "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/api/internal/orders?orgId=2'" \
  "403"

echo ""

# 7. 检查外部API隔离
echo "7. 检查外部API隔离"
echo "-----------------------------------"

test_case "GET /api/external/orders?orgId=2 (无token)" \
  "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/api/external/orders?orgId=2'" \
  "403"

test_case "POST /api/external/orders (禁止写入)" \
  "curl -s -o /dev/null -w '%{http_code}' -X POST $BASE_URL/api/external/orders" \
  "404"

echo ""

# 输出测试结果
echo "========================================="
echo "测试结果汇总"
echo "========================================="
echo -e "总计: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ 所有测试通过！AR模块运行正常。${NC}"
  exit 0
else
  echo -e "${RED}✗ 有 $FAILED 个测试失败，请检查日志。${NC}"
  exit 1
fi
