#!/bin/bash

# ============================================
# 仓库卫生检查脚本
# ============================================
# 用途：阻止node_modules、dist、build、coverage等目录被提交
# 使用场景：CI/CD pipeline、pre-commit hook
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}仓库卫生检查${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 禁止提交的目录和文件模式
FORBIDDEN_PATTERNS=(
  "node_modules/"
  "dist/"
  "build/"
  "coverage/"
  ".next/"
  ".nuxt/"
  "out/"
  "*.log"
  ".DS_Store"
  "Thumbs.db"
)

# 检查git ls-files
echo -e "${YELLOW}检查已追踪的文件...${NC}"

FOUND_VIOLATIONS=0

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  # 使用git ls-files检查已追踪的文件
  if git ls-files | grep -q "$pattern"; then
    echo -e "${RED}✗ 发现禁止提交的文件/目录: $pattern${NC}"
    echo "  匹配的文件:"
    git ls-files | grep "$pattern" | head -5
    if [ $(git ls-files | grep "$pattern" | wc -l) -gt 5 ]; then
      echo "  ... 还有 $(( $(git ls-files | grep "$pattern" | wc -l) - 5 )) 个文件"
    fi
    echo ""
    FOUND_VIOLATIONS=$((FOUND_VIOLATIONS + 1))
  fi
done

# 检查暂存区（staged files）
echo -e "${YELLOW}检查暂存区...${NC}"

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  if git diff --cached --name-only | grep -q "$pattern"; then
    echo -e "${RED}✗ 暂存区包含禁止提交的文件: $pattern${NC}"
    echo "  匹配的文件:"
    git diff --cached --name-only | grep "$pattern" | head -5
    echo ""
    FOUND_VIOLATIONS=$((FOUND_VIOLATIONS + 1))
  fi
done

# 结果汇总
echo -e "${GREEN}========================================${NC}"
if [ $FOUND_VIOLATIONS -eq 0 ]; then
  echo -e "${GREEN}✓ 仓库卫生检查通过！${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}✗ 发现 $FOUND_VIOLATIONS 个违规项${NC}"
  echo ""
  echo -e "${YELLOW}修复建议:${NC}"
  echo "1. 检查.gitignore是否正确配置"
  echo "2. 使用以下命令移除已追踪的文件:"
  echo "   git rm -r --cached node_modules/"
  echo "   git rm -r --cached dist/"
  echo "   git rm -r --cached build/"
  echo "   git rm -r --cached coverage/"
  echo "3. 提交.gitignore的修改"
  echo "4. 重新提交代码"
  echo ""
  exit 1
fi
