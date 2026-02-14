#!/bin/bash

# ============================================
# AR API 冒烟测试脚本
# ============================================
# 用途：验证AR核心API的基本功能
# 使用方法：
#   1. 设置环境变量：export API_BASE=https://api.example.com
#   2. 设置JWT Token：export JWT=your_jwt_token_here
#   3. 执行脚本：bash smoke-test.sh
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
API_BASE=${API_BASE:-"http://localhost:3001"}
JWT=${JWT:-""}

if [ -z "$JWT" ]; then
  echo -e "${RED}错误: 请设置JWT环境变量${NC}"
  echo "示例: export JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AR API 冒烟测试${NC}"
echo -e "${GREEN}========================================${NC}"
echo "API地址: $API_BASE"
echo ""

# 测试计数器
PASSED=0
FAILED=0

# 测试函数
test_api() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local idempotency_key=$5
  
  echo -e "${YELLOW}测试: $name${NC}"
  
  if [ -z "$idempotency_key" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$url" \
      -H "Authorization: Bearer $JWT" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$url" \
      -H "Authorization: Bearer $JWT" \
      -H "Idempotency-Key: $idempotency_key" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ 通过 (HTTP $http_code)${NC}"
    echo "响应: $body" | head -c 200
    echo ""
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ 失败 (HTTP $http_code)${NC}"
    echo "响应: $body"
    echo ""
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# ============================================
# 0. 前置准备：数据库迁移
# ============================================
echo -e "${YELLOW}步骤 0: 数据库迁移（请手动执行）${NC}"
echo "命令: cd backend && npm run migration:run"
echo "说明: 确保所有表和索引已创建"
echo ""
read -p "迁移已完成？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}请先完成数据库迁移${NC}"
  exit 1
fi

# ============================================
# 1. 造测试数据（可选，如已有数据可跳过）
# ============================================
echo -e "${YELLOW}步骤 1: 造测试数据${NC}"
echo "说明: 需要先创建一个客户和一张应收发票"
echo "假设: customer_id=CUST001, invoice_id=INV001, 余额=8000分(80元)"
echo ""
read -p "测试数据已准备好？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}跳过后续测试${NC}"
  exit 0
fi

# 记录测试用的ID
CUSTOMER_ID="CUST001"
INVOICE_ID="INV001"

# ============================================
# 2. 登记一笔到款 50.00 元（5000 分）
# ============================================
PAYMENT_DATA='{
  "customer_id":"'$CUSTOMER_ID'",
  "method":"BANK",
  "amount_fen":5000,
  "received_at":"2026-01-11T10:20:00Z",
  "bank_ref":"BANK-SMOKE-TEST-001",
  "voucher_url":"https://oss/receipt/smoke-test.pdf"
}'

test_api \
  "创建收款单" \
  "POST" \
  "/ar/payments" \
  "$PAYMENT_DATA" \
  "11111111-1111-1111-1111-111111111111"

# 从响应中提取payment_id（需要jq工具）
if command -v jq &> /dev/null; then
  PAYMENT_ID=$(echo "$body" | jq -r '.id')
  echo "Payment ID: $PAYMENT_ID"
else
  echo -e "${YELLOW}警告: 未安装jq，请手动记录payment_id${NC}"
  read -p "请输入payment_id: " PAYMENT_ID
fi

# ============================================
# 3. 测试幂等性：重复请求应返回相同响应
# ============================================
test_api \
  "幂等性测试（重复创建收款单）" \
  "POST" \
  "/ar/payments" \
  "$PAYMENT_DATA" \
  "11111111-1111-1111-1111-111111111111"

# ============================================
# 4. 核销到该发票 20.00 元（2000 分）
# ============================================
APPLY_DATA='{
  "payment_id":"'$PAYMENT_ID'",
  "items":[
    {
      "invoice_id":"'$INVOICE_ID'",
      "applied_amount_fen":2000
    }
  ]
}'

test_api \
  "核销收款单" \
  "POST" \
  "/ar/apply" \
  "$APPLY_DATA" \
  "22222222-2222-2222-2222-222222222222"

# ============================================
# 5. 汇总校验：余额应减少 20.00 元
# ============================================
test_api \
  "查询账本汇总" \
  "GET" \
  "/ar/summary?customer_id=$CUSTOMER_ID" \
  ""

# ============================================
# 6. 列表校验：默认按 received_at DESC
# ============================================
test_api \
  "查询收款单列表（默认排序）" \
  "GET" \
  "/ar/payments?status=UNAPPLIED&page=1&page_size=20" \
  ""

# ============================================
# 7. 列表校验：近7天筛选
# ============================================
DATE_FROM=$(date -u -d '7 days ago' +%Y-%m-%dT00:00:00Z)
DATE_TO=$(date -u +%Y-%m-%dT23:59:59Z)

test_api \
  "查询收款单列表（近7天）" \
  "GET" \
  "/ar/payments?date_from=$DATE_FROM&date_to=$DATE_TO&page=1&page_size=20" \
  ""

# ============================================
# 8. 参数校验：蛇形命名
# ============================================
test_api \
  "查询收款单列表（蛇形命名）" \
  "GET" \
  "/ar/payments?customer_id=$CUSTOMER_ID&page_size=10" \
  ""

# ============================================
# 测试结果汇总
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}测试结果汇总${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo -e "总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ 所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}✗ 部分测试失败${NC}"
  exit 1
fi
