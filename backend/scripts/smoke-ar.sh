#!/bin/bash

# AR模块冒烟测试脚本（Linux/macOS）
# 用途：5分钟快速验证AR模块核心功能
# 使用：bash scripts/smoke-ar.sh

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果统计
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS_COUNT++))
    ((TOTAL_COUNT++))
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL_COUNT++))
    ((TOTAL_COUNT++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 打印分隔线
print_separator() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# 打印标题
print_title() {
    print_separator
    echo -e "${BLUE}$1${NC}"
    print_separator
}

# 加载环境变量
load_env() {
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        log_success "环境变量加载成功"
    else
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
}

# 检查MySQL连接
check_mysql_connection() {
    log_info "检查MySQL连接..."
    
    if command -v mysql &> /dev/null; then
        if mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" -e "SELECT 1;" &> /dev/null; then
            log_success "MySQL连接成功"
            return 0
        else
            log_error "MySQL连接失败，请检查数据库配置"
            return 1
        fi
    else
        log_warning "未找到mysql命令，跳过MySQL连接检查"
        return 0
    fi
}

# 检查数据库表
check_tables() {
    log_info "检查数据库表..."
    
    if command -v mysql &> /dev/null; then
        TABLES=$(mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-qianzhang_sales}" -e "SHOW TABLES;" 2>/dev/null | tail -n +2)
        
        REQUIRED_TABLES=("ar_payments" "ar_invoices" "ar_apply" "audit_logs")
        ALL_EXISTS=true
        
        for table in "${REQUIRED_TABLES[@]}"; do
            if echo "$TABLES" | grep -q "^$table$"; then
                log_success "表 $table 存在"
            else
                log_error "表 $table 不存在"
                ALL_EXISTS=false
            fi
        done
        
        if [ "$ALL_EXISTS" = false ]; then
            log_warning "部分表不存在，请先运行: npm run db:sync"
            return 1
        fi
        
        return 0
    else
        log_warning "未找到mysql命令，跳过表检查"
        return 0
    fi
}

# 等待后端服务启动
wait_for_backend() {
    log_info "等待后端服务启动..."
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s "http://localhost:${PORT:-3000}/" > /dev/null 2>&1; then
            log_success "后端服务已就绪"
            return 0
        fi
        
        ((RETRY_COUNT++))
        sleep 1
    done
    
    log_error "后端服务启动超时（30秒）"
    return 1
}

# 测试API端点
test_api() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    
    log_info "测试: $description"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:${PORT:-3000}$endpoint")
    STATUS_CODE=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$STATUS_CODE" = "$expected_status" ]; then
        log_success "$description - 返回 $STATUS_CODE"
        
        # 验证JSON格式
        if echo "$BODY" | python3 -m json.tool > /dev/null 2>&1; then
            log_success "$description - JSON格式正确"
        else
            log_warning "$description - 响应不是有效的JSON"
        fi
        
        return 0
    else
        log_error "$description - 期望 $expected_status，实际 $STATUS_CODE"
        echo "响应内容: $BODY"
        return 1
    fi
}

# 插入测试数据
insert_test_data() {
    log_info "插入测试数据..."
    
    if ! command -v mysql &> /dev/null; then
        log_warning "未找到mysql命令，跳过测试数据插入"
        return 0
    fi
    
    # 生成随机后缀避免唯一键冲突
    RANDOM_SUFFIX=$(date +%s)
    
    # 插入invoice
    mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-qianzhang_sales}" <<EOF
INSERT INTO ar_invoices (
    org_id, customer_id, invoice_no, invoice_date, 
    due_date, total_amount, balance, status, created_by
) VALUES (
    2, 1, 'INV-TEST-${RANDOM_SUFFIX}', CURDATE(), 
    DATE_ADD(CURDATE(), INTERVAL 30 DAY), 5000, 5000, 'OPEN', 1
);
EOF
    
    INVOICE_ID=$(mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-qianzhang_sales}" -N -e "SELECT LAST_INSERT_ID();")
    
    # 插入payment
    mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-qianzhang_sales}" <<EOF
INSERT INTO ar_payments (
    org_id, customer_id, payment_no, bank_ref, amount, 
    unapplied_amount, payment_date, payment_method, status, created_by
) VALUES (
    2, 1, 'PMT-TEST-${RANDOM_SUFFIX}', 'BANK-TEST-${RANDOM_SUFFIX}', 6000, 
    6000, CURDATE(), 'BANK_TRANSFER', 'UNAPPLIED', 1
);
EOF
    
    PAYMENT_ID=$(mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-qianzhang_sales}" -N -e "SELECT LAST_INSERT_ID();")
    
    log_success "测试数据插入成功 (Invoice ID: $INVOICE_ID, Payment ID: $PAYMENT_ID)"
    
    # 导出ID供后续使用
    export TEST_INVOICE_ID=$INVOICE_ID
    export TEST_PAYMENT_ID=$PAYMENT_ID
}

# 验证测试数据
verify_test_data() {
    log_info "验证测试数据..."
    
    # 查询UNAPPLIED状态的payment
    test_api "GET" "/ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20" "200" "查询UNAPPLIED状态的payments"
}

# 清理测试数据
cleanup_test_data() {
    log_info "清理测试数据..."
    
    if ! command -v mysql &> /dev/null; then
        log_warning "未找到mysql命令，跳过测试数据清理"
        return 0
    fi
    
    if [ -n "$TEST_PAYMENT_ID" ]; then
        mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-qianzhang_sales}" -e "DELETE FROM ar_payments WHERE id = $TEST_PAYMENT_ID;" 2>/dev/null || true
    fi
    
    if [ -n "$TEST_INVOICE_ID" ]; then
        mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-qianzhang_sales}" -e "DELETE FROM ar_invoices WHERE id = $TEST_INVOICE_ID;" 2>/dev/null || true
    fi
    
    log_success "测试数据清理完成"
}

# 主函数
main() {
    print_title "🚀 AR模块冒烟测试"
    
    log_info "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "测试环境: $(uname -s)"
    
    print_separator
    
    # 阶段1: 环境检查
    print_title "📋 阶段1: 环境检查"
    
    load_env
    check_mysql_connection || exit 1
    check_tables || exit 1
    
    # 阶段2: 后端服务检查
    print_title "📋 阶段2: 后端服务检查"
    
    wait_for_backend || {
        log_error "后端服务未运行，请先启动: npm run start:dev"
        exit 1
    }
    
    # 阶段3: API测试
    print_title "📋 阶段3: API基础测试"
    
    test_api "GET" "/" "200" "根路径"
    test_api "GET" "/ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20" "200" "查询UNAPPLIED payments"
    test_api "GET" "/ar/summary?orgId=2" "200" "查询AR汇总"
    
    # 阶段4: 数据写入测试（可选）
    if [ "${SKIP_DATA_TEST:-false}" != "true" ]; then
        print_title "📋 阶段4: 数据写入测试"
        
        insert_test_data
        verify_test_data
        cleanup_test_data
    else
        log_warning "跳过数据写入测试（设置了SKIP_DATA_TEST=true）"
    fi
    
    # 测试结果汇总
    print_title "📊 测试结果汇总"
    
    echo "总测试数: $TOTAL_COUNT"
    echo -e "通过: ${GREEN}$PASS_COUNT${NC}"
    echo -e "失败: ${RED}$FAIL_COUNT${NC}"
    
    if [ $FAIL_COUNT -eq 0 ]; then
        echo ""
        log_success "所有测试通过！ 🎉"
        print_separator
        exit 0
    else
        echo ""
        log_error "部分测试失败，请检查日志"
        print_separator
        exit 1
    fi
}

# 捕获退出信号，清理测试数据
trap cleanup_test_data EXIT

# 执行主函数
main
