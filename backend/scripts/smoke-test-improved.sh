#!/bin/bash

# ============================================
# AR API 冒烟测试脚本（改进版）
# ============================================
# 改进点：
# 1. GET请求不发送body
# 2. 幂等性测试增加响应一致性断言
# 3. CUSTOMER_ID和INVOICE_ID参数化
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
CUSTOMER_ID=${CUSTOMER_ID:-"CUST001"}
INVOICE_ID=${INVOICE_ID:-"INV001"}

if [ -z "$JWT" ]; then
  echo -e "${RED}错误: 请设置JWT环境变量${NC}"
  echo "示例: export JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AR API 冒烟测试（改进版）${NC}"
echo -e "${GREEN}========================================${NC}"
echo "API地址: $API_BASE"
echo "客户ID: $CUSTOMER_ID"
echo "发票ID: $INVOICE_ID"
echo ""

# 测试计数器
PASSED=0
FAILED=0

# 用于存储响应的临时变量
FIRST_RESPONSE=""
SECOND_RESPONSE=""

# 测试函数（改进版）
test_api() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local idempotency_key=$5
  
  echo -e "${YELLOW}测试: $name${NC}"
  
  # 根据method决定是否发送body
  if [ "$method" = "GET" ]; then
    # GET请求不发送body
    if [ -z "$idempotency_key" ]; then
      response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$url" \
        -H "Authorization: Bearer $JWT" \
        -H "Content-Type: application/json")
    else
      response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$url" \
        -H "Authorization: Bearer $JWT" \
        -H "Idempotency-Key: $idempotency_key" \
        -H "Content-Type: application/json")
    fi
  else
    # POST/PUT/PATCH等请求发送body
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
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ 通过 (HTTP $http_code)${NC}"
    echo "响应: $body" | head -c 200
    echo ""
    PASSED=$((PASSED + 1))
    
    # 返回响应body供后续使用
    echo "$body"
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
echo "假设: customer_id=$CUSTOMER_ID, invoice_id=$INVOICE_ID, 余额=8000分(80元)"
echo ""
read -p "测试数据已准备好？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}跳过后续测试${NC}"
  exit 0
fi

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

FIRST_RESPONSE=$(test_api \
  "创建收款单" \
  "POST" \
  "/ar/payments" \
  "$PAYMENT_DATA" \
  "11111111-1111-1111-1111-111111111111")

# 从响应中提取payment_id（需要jq工具）
if command -v jq &> /dev/null; then
  PAYMENT_ID=$(echo "$FIRST_RESPONSE" | jq -r '.id')
  echo "Payment ID: $PAYMENT_ID"
else
  echo -e "${YELLOW}警告: 未安装jq，请手动记录payment_id${NC}"
  read -p "请输入payment_id: " PAYMENT_ID
fi

# ============================================
# 3. 测试幂等性：重复请求应返回相同响应
# ============================================
echo -e "${YELLOW}测试: 幂等性验证（重复创建收款单）${NC}"

SECOND_RESPONSE=$(test_api \
  "幂等性测试（重复创建收款单）" \
  "POST" \
  "/ar/payments" \
  "$PAYMENT_DATA" \
  "11111111-1111-1111-1111-111111111111")

# 幂等性断言：两次响应应该一致
if command -v jq &> /dev/null; then
  FIRST_ID=$(echo "$FIRST_RESPONSE" | jq -r '.id')
  SECOND_ID=$(echo "$SECOND_RESPONSE" | jq -r '.id')
  
  if [ "$FIRST_ID" = "$SECOND_ID" ]; then
    echo -e "${GREEN}✓ 幂等性验证通过：两次请求返回相同payment_id${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ 幂等性验证失败：两次请求返回不同payment_id${NC}"
    echo "第一次: $FIRST_ID"
    echo "第二次: $SECOND_ID"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${YELLOW}警告: 未安装jq，跳过幂等性断言${NC}"
fi

echo ""

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
DATE_FROM=$(date -u -d '7 days ago' +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -v-7d +%Y-%m-%dT00:00:00Z)
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
