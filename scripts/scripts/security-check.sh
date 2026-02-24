#!/bin/bash
# ops-frontend 安全验收脚本
# 验证INTERNAL_SERVICE_TOKEN不会泄露到前端

set -e

echo "======================================"
echo "ops-frontend 安全验收检查"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数
PASS=0
FAIL=0

# 1. 检查环境变量配置
echo "1. 检查环境变量配置"
echo "--------------------------------------"

if grep -q "^INTERNAL_SERVICE_TOKEN=" .env 2>/dev/null; then
    echo -e "${GREEN}✓${NC} INTERNAL_SERVICE_TOKEN 在 .env 中配置（server-side only）"
    ((PASS++))
else
    echo -e "${RED}✗${NC} INTERNAL_SERVICE_TOKEN 未在 .env 中找到"
    ((FAIL++))
fi

if grep -q "^VITE_INTERNAL" .env 2>/dev/null; then
    echo -e "${RED}✗${NC} 发现 VITE_INTERNAL* 变量（会泄露到前端！）"
    ((FAIL++))
else
    echo -e "${GREEN}✓${NC} 没有 VITE_INTERNAL* 变量（正确）"
    ((PASS++))
fi

echo ""

# 2. 检查源代码中是否有直接使用token的情况
echo "2. 检查源代码中token使用情况"
echo "--------------------------------------"

if grep -r "VITE_INTERNAL_SERVICE_TOKEN" client/src/ 2>/dev/null; then
    echo -e "${RED}✗${NC} 前端代码中发现 VITE_INTERNAL_SERVICE_TOKEN"
    ((FAIL++))
else
    echo -e "${GREEN}✓${NC} 前端代码中未发现 VITE_INTERNAL_SERVICE_TOKEN"
    ((PASS++))
fi

if grep -r "import\.meta\.env\.INTERNAL_SERVICE_TOKEN" client/src/ 2>/dev/null; then
    echo -e "${RED}✗${NC} 前端代码中发现 import.meta.env.INTERNAL_SERVICE_TOKEN"
    ((FAIL++))
else
    echo -e "${GREEN}✓${NC} 前端代码中未发现 import.meta.env.INTERNAL_SERVICE_TOKEN"
    ((PASS++))
fi

# 检查server端是否正确使用token
if grep -r "process\.env\.INTERNAL_SERVICE_TOKEN" server/ 2>/dev/null | grep -v "node_modules" > /dev/null; then
    echo -e "${GREEN}✓${NC} Server端正确使用 process.env.INTERNAL_SERVICE_TOKEN"
    ((PASS++))
else
    echo -e "${YELLOW}⚠${NC} Server端未找到 process.env.INTERNAL_SERVICE_TOKEN 使用"
fi

echo ""

# 3. 检查是否有旧的api.ts文件（直接调用backend）
echo "3. 检查是否有直接调用backend的代码"
echo "--------------------------------------"

if [ -f "client/src/lib/api.ts" ]; then
    echo -e "${RED}✗${NC} 发现 client/src/lib/api.ts（会直接调用backend，导致token泄露）"
    ((FAIL++))
else
    echo -e "${GREEN}✓${NC} 没有 client/src/lib/api.ts（正确）"
    ((PASS++))
fi

# 检查是否所有页面都使用tRPC
PAGES_WITH_API=$(grep -r "from.*@/lib/api" client/src/pages/ 2>/dev/null | wc -l || echo "0")
if [ "$PAGES_WITH_API" -gt 0 ]; then
    echo -e "${RED}✗${NC} 发现 $PAGES_WITH_API 个页面仍在使用 @/lib/api"
    grep -r "from.*@/lib/api" client/src/pages/ 2>/dev/null || true
    ((FAIL++))
else
    echo -e "${GREEN}✓${NC} 所有页面都使用tRPC（正确）"
    ((PASS++))
fi

echo ""

# 4. 构建检查（如果需要）
echo "4. 生产构建检查（可选）"
echo "--------------------------------------"
echo -e "${YELLOW}ℹ${NC} 生产构建需要运行: pnpm build"
echo -e "${YELLOW}ℹ${NC} 然后检查 dist/assets/*.js 中是否包含token"
echo ""

# 5. 总结
echo "======================================"
echo "安全检查总结"
echo "======================================"
echo -e "通过: ${GREEN}${PASS}${NC}"
echo -e "失败: ${RED}${FAIL}${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ 所有安全检查通过！${NC}"
    echo ""
    echo "下一步验证（需要在浏览器中手动检查）："
    echo "1. 打开 DevTools → Application → Local Storage / Session Storage / Cookies"
    echo "   - 不应看到 INTERNAL_SERVICE_TOKEN"
    echo ""
    echo "2. 打开 DevTools → Network → 任意 JS bundle"
    echo "   - 搜索 'INTERNAL_SERVICE_TOKEN' 或 'Bearer'"
    echo "   - 应该搜不到"
    echo ""
    echo "3. 打开 DevTools → Network → 查看 /api/trpc/* 请求"
    echo "   - Request Headers 中不应看到 Authorization: Bearer ..."
    echo "   - 只有 server→backend 的请求会带 Authorization（在server日志中）"
    exit 0
else
    echo -e "${RED}✗ 发现 ${FAIL} 个安全问题，请修复！${NC}"
    exit 1
fi
