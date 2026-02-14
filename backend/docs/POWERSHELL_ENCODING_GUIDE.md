# PowerShell脚本编码规范

## 📋 概述

本文档说明了项目中PowerShell脚本的编码要求和最佳实践，确保脚本在不同环境下都能正常运行。

---

## ⚠️ 关键要求

### 1. 必须使用UTF-8 with BOM编码

**原因**:
- PowerShell 5.1（Windows默认版本）默认使用UTF-16 LE编码
- 如果脚本使用UTF-8 without BOM，PowerShell 5.1可能无法正确解析中文字符
- UTF-8 with BOM可以确保PowerShell 5.1和7+都能正确识别编码

**影响**:
- ❌ UTF-8 without BOM → 中文乱码、脚本解析失败
- ✅ UTF-8 with BOM → 所有PowerShell版本都能正确运行

### 2. URL参数必须使用变量存储

**原因**:
- PowerShell中`&`是后台运行运算符
- URL中的`&`符号（如`?page=1&limit=10`）会被误解析

**示例**:

```powershell
# ❌ 错误：& 会被误解析
Invoke-WebRequest -Uri "$BASE_URL/audit-logs?page=1&limit=10"

# ✅ 正确：使用变量存储完整URL
$url = "$BASE_URL/audit-logs?page=1&limit=10"
Invoke-WebRequest -Uri $url -UseBasicParsing
```

---

## 🔧 如何检查和修复编码

### 检查文件编码

**Linux/macOS**:
```bash
# 检查是否有UTF-8 BOM（应该显示: ef bb bf）
od -An -tx1 -N3 backend/scripts/smoke-ar.ps1

# 或使用file命令
file -bi backend/scripts/smoke-ar.ps1
```

**Windows PowerShell**:
```powershell
# 读取文件前3个字节
$bytes = [System.IO.File]::ReadAllBytes("backend\scripts\smoke-ar.ps1")
$bytes[0..2] | ForEach-Object { $_.ToString("X2") }
# 应该显示: EF BB BF
```

### 添加UTF-8 BOM

**使用Python**:
```bash
cd backend/scripts
python3 << 'EOF'
# 读取文件内容
with open('smoke-ar.ps1', 'r', encoding='utf-8') as f:
    content = f.read()

# 写回文件，添加UTF-8 BOM
with open('smoke-ar.ps1', 'w', encoding='utf-8-sig') as f:
    f.write(content)

print("✓ 已添加UTF-8 BOM")
EOF
```

**使用PowerShell**:
```powershell
# 读取文件内容
$content = Get-Content -Path "smoke-ar.ps1" -Raw -Encoding UTF8

# 写回文件，添加UTF-8 BOM
[System.IO.File]::WriteAllText(
    (Resolve-Path "smoke-ar.ps1").Path,
    $content,
    [System.Text.UTF8Encoding]::new($true)  # $true = 包含BOM
)

Write-Host "✓ 已添加UTF-8 BOM"
```

**使用VS Code**:
1. 打开文件
2. 点击右下角的编码显示（如"UTF-8"）
3. 选择"Save with Encoding"
4. 选择"UTF-8 with BOM"

---

## 📝 编码规范清单

在提交PowerShell脚本前，请确认：

- [ ] 文件使用UTF-8 with BOM编码
- [ ] URL参数使用变量存储（避免`&`运算符问题）
- [ ] 在PowerShell 5.1中测试过
- [ ] 在PowerShell 7+中测试过
- [ ] 中文字符显示正常
- [ ] 没有编码相关的错误或警告

---

## 🔍 CI检查

项目包含自动化检查，确保PowerShell脚本符合编码规范。

### 检查脚本

**文件**: `backend/scripts/check-ps1-encoding.sh`

```bash
#!/bin/bash
# 检查PowerShell脚本是否使用UTF-8 BOM编码

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED=0

echo "检查PowerShell脚本编码..."

for file in "$SCRIPT_DIR"/*.ps1; do
    if [ -f "$file" ]; then
        # 读取文件前3个字节
        BOM=$(od -An -tx1 -N3 "$file" | tr -d ' ')
        
        if [ "$BOM" = "efbbbf" ]; then
            echo "✓ $(basename "$file") - UTF-8 with BOM"
        else
            echo "✗ $(basename "$file") - 缺少UTF-8 BOM"
            FAILED=1
        fi
    fi
done

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "✓ 所有PowerShell脚本编码正确"
    exit 0
else
    echo ""
    echo "✗ 有脚本缺少UTF-8 BOM，请使用 'python3 add_bom.py' 修复"
    exit 1
fi
```

### 修复脚本

**文件**: `backend/scripts/add-bom.py`

```python
#!/usr/bin/env python3
"""为PowerShell脚本添加UTF-8 BOM"""

import os
import sys

def add_bom_to_file(filepath):
    """为文件添加UTF-8 BOM"""
    try:
        # 读取文件内容
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 写回文件，添加UTF-8 BOM
        with open(filepath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        
        print(f"✓ {os.path.basename(filepath)}")
        return True
    except Exception as e:
        print(f"✗ {os.path.basename(filepath)}: {e}")
        return False

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ps1_files = [f for f in os.listdir(script_dir) if f.endswith('.ps1')]
    
    if not ps1_files:
        print("未找到PowerShell脚本")
        return 0
    
    print("为PowerShell脚本添加UTF-8 BOM...")
    
    success = 0
    failed = 0
    
    for filename in ps1_files:
        filepath = os.path.join(script_dir, filename)
        if add_bom_to_file(filepath):
            success += 1
        else:
            failed += 1
    
    print(f"\n总计: {len(ps1_files)}, 成功: {success}, 失败: {failed}")
    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
```

### GitHub Actions CI配置

```yaml
name: Check PowerShell Encoding

on:
  pull_request:
    paths:
      - 'backend/scripts/*.ps1'
  push:
    branches:
      - main
    paths:
      - 'backend/scripts/*.ps1'

jobs:
  check-encoding:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check PowerShell script encoding
        run: |
          cd backend/scripts
          bash check-ps1-encoding.sh
```

---

## 🐛 常见问题

### Q1: 为什么我的脚本在Windows上显示乱码？

**A**: 脚本可能缺少UTF-8 BOM。使用上面的方法添加BOM。

### Q2: 为什么URL参数会导致脚本失败？

**A**: PowerShell中`&`是运算符。使用变量存储完整URL：
```powershell
$url = "$BASE_URL/api?param1=value1&param2=value2"
Invoke-WebRequest -Uri $url
```

### Q3: 如何在Git中保留UTF-8 BOM？

**A**: Git默认会保留BOM。确保`.gitattributes`中没有强制转换编码的规则。

### Q4: PowerShell 7+是否需要UTF-8 BOM？

**A**: PowerShell 7+默认使用UTF-8 without BOM，但为了兼容PowerShell 5.1，仍然建议使用UTF-8 with BOM。

---

## 📚 参考资料

- [PowerShell文档 - about_Character_Encoding](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding)
- [UTF-8 BOM说明](https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8)
- [PowerShell 5.1 vs 7+ 编码差异](https://devblogs.microsoft.com/powershell/powershell-7-1-general-availability/)

---

## ✅ 总结

**关键点**:
1. ✅ PowerShell脚本必须使用UTF-8 with BOM
2. ✅ URL参数必须使用变量存储
3. ✅ 提交前运行CI检查脚本
4. ✅ 在PowerShell 5.1和7+中都要测试

遵循这些规范，可以确保PowerShell脚本在所有环境下都能正常运行，避免"本地修好了，别人拉下来又坏"的问题。
