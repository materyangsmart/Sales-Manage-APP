#!/bin/bash
# 检查PowerShell脚本是否使用UTF-8 BOM编码

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED=0

echo "========================================="
echo "检查PowerShell脚本编码"
echo "========================================="
echo ""

for file in "$SCRIPT_DIR"/*.ps1; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # 读取文件前3个字节
        BOM=$(od -An -tx1 -N3 "$file" | tr -d ' ')
        
        if [ "$BOM" = "efbbbf" ]; then
            echo "✓ $filename - UTF-8 with BOM"
        else
            echo "✗ $filename - 缺少UTF-8 BOM (当前: $BOM)"
            FAILED=1
        fi
    fi
done

echo ""
echo "========================================="

if [ $FAILED -eq 0 ]; then
    echo "✓ 所有PowerShell脚本编码正确"
    exit 0
else
    echo "✗ 有脚本缺少UTF-8 BOM"
    echo ""
    echo "修复方法："
    echo "  cd backend/scripts"
    echo "  python3 add-bom.py"
    exit 1
fi
