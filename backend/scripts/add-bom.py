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
    
    print("=========================================")
    print("为PowerShell脚本添加UTF-8 BOM")
    print("=========================================")
    print("")
    
    success = 0
    failed = 0
    
    for filename in ps1_files:
        filepath = os.path.join(script_dir, filename)
        if add_bom_to_file(filepath):
            success += 1
        else:
            failed += 1
    
    print("")
    print("=========================================")
    print(f"总计: {len(ps1_files)}, 成功: {success}, 失败: {failed}")
    
    if failed == 0:
        print("✓ 所有脚本已添加UTF-8 BOM")
    else:
        print("✗ 有脚本添加失败")
    
    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
