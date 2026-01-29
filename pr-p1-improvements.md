# chore: add P1 engineering improvements

## 🎯 目标

完成P1工程化改进任务，包括：
1. CI仓库卫生检查
2. 改进后端冒烟测试脚本
3. 测试文档和模板

---

## 📋 新增功能

### 1. CI仓库卫生检查

**文件**: `.github/scripts/check-repo-hygiene.sh`

**功能**:
- ✅ 检查已追踪的文件（`git ls-files`）
- ✅ 检查暂存区（`git diff --cached --name-only`）
- ✅ 阻止以下文件/目录被提交：
  - `node_modules/`
  - `dist/`, `build/`, `coverage/`
  - `.next/`, `.nuxt/`, `out/`
  - `*.log`, `.DS_Store`, `Thumbs.db`

**CI集成**: `.github/workflows/ci.yml`
- 新增`repo-hygiene` job
- 在lint/test/build之前执行
- 使用`needs: repo-hygiene`确保卫生检查通过后才执行其他任务

**效果**:
- 🚫 自动拦截node_modules等文件的提交
- ✅ 在PR阶段就发现问题
- ✅ 减少Code Review负担
- ✅ 保持仓库干净

---

### 2. 改进后端冒烟测试脚本

**文件**: `backend/scripts/smoke-test-improved.sh`

**改进点**:

#### 改进1: GET请求不发送body
- **问题**: 原始脚本在GET请求中也发送body（不符合HTTP规范）
- **修复**: 根据method判断是否发送body

#### 改进2: 幂等性测试增加断言
- **问题**: 原始脚本只检查HTTP状态码，没有验证两次响应是否一致
- **修复**: 使用jq提取两次响应的payment_id，验证是否相同

#### 改进3: CUSTOMER_ID和INVOICE_ID参数化
- **问题**: 原始脚本硬编码测试数据ID
- **修复**: 使用环境变量，支持自定义

**使用方法**:
```bash
cd backend
export API_BASE=http://localhost:3001
export JWT=your_jwt_token_here
export CUSTOMER_ID=CUST001  # 可选，默认CUST001
export INVOICE_ID=INV001    # 可选，默认INV001
bash scripts/smoke-test-improved.sh
```

---

### 3. 测试文档和模板

#### 前端冒烟测试执行清单
**文件**: `ops-frontend/SMOKE_TEST_CHECKLIST.md`

- ✅ 11条测试用例的详细执行步骤
- ✅ 验收点清单
- ✅ 截图位置指引
- ✅ 测试结果汇总表
- ✅ PR #14决策依据

#### 测试报告模板
**文件**: `SMOKE_TEST_REPORT.md`

- ✅ 后端API测试结果表
- ✅ 前端11条用例详情
- ✅ PR #14决策记录
- ✅ 发现的问题汇总
- ✅ 测试结论和建议

#### PR #14决策分析
**文件**: `PR14_DECISION_ANALYSIS.md`

- ✅ 当前埋点实现分析
- ✅ 缺失字段对比
- ✅ 修复方案详解
- ✅ 验证方法

#### P1工程化改进总结
**文件**: `P1_ENGINEERING_IMPROVEMENTS.md`

- ✅ CI检查详细说明
- ✅ smoke-test改进对比
- ✅ PR #16（E2E测试）实施计划
- ✅ 效果预期

#### 截图目录
**目录**: `ops-frontend/screenshots/`

- ✅ 用于存放前端冒烟测试截图
- ✅ 包含`.gitkeep`以保留空目录

---

## 🧪 测试

### 本地验证

#### 1. 测试仓库卫生检查脚本
```bash
cd /path/to/Sales-Manage-APP
bash .github/scripts/check-repo-hygiene.sh
```

**期望输出**（干净仓库）:
```
========================================
仓库卫生检查
========================================

检查已追踪的文件...
检查暂存区...
========================================
✓ 仓库卫生检查通过！
```

#### 2. 测试改进后的smoke-test脚本
```bash
cd backend
# 需要实际运行的后端服务和数据库
export API_BASE=http://localhost:3001
export JWT=your_jwt_token_here
bash scripts/smoke-test-improved.sh
```

### CI验证

- [ ] repo-hygiene job在CI中正常执行
- [ ] 故意提交node_modules时，CI应该失败并提示

---

## 📊 改进效果

### CI检查

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| node_modules拦截 | ❌ 无 | ✅ 自动拦截 |
| 发现时机 | ❌ Code Review | ✅ CI阶段 |
| 仓库污染风险 | ❌ 高 | ✅ 低 |

### smoke-test改进

| 改进点 | 原始脚本 | 改进后脚本 |
|--------|---------|-----------|
| GET请求body | ❌ 发送body | ✅ 不发送body |
| 幂等性断言 | ❌ 缺失 | ✅ 验证响应一致性 |
| 参数化 | ❌ 硬编码 | ✅ 环境变量配置 |
| 测试准确性 | ⚠️ 一般 | ✅ 更高 |

---

## 📝 相关任务

### 已完成
- ✅ P0: node_modules清理（移除24,488个文件）
- ✅ P1: CI仓库卫生检查
- ✅ P1: smoke-test脚本改进
- ✅ P1: 测试文档和模板

### 待完成（需要实际环境）
- ⏸️ 执行后端冒烟测试
- ⏸️ 执行前端冒烟测试（11条用例 + 截图）
- ⏸️ 根据用例9结果决定是否需要PR #14
- ⏸️ PR #16（E2E测试）- 推迟到主干稳定后

---

## 🎯 下一步

### 立即需要做的

1. **Review并合并本PR**
   - 检查CI配置是否正确
   - 验证脚本语法

2. **在实际环境中执行冒烟测试**
   - 后端: `bash backend/scripts/smoke-test-improved.sh`
   - 前端: 按照`ops-frontend/SMOKE_TEST_CHECKLIST.md`执行

3. **根据测试结果决定PR #14**
   - 如果用例9通过：不需要新PR
   - 如果用例9失败：创建PR `fix(ops-ar): unify analytics fields`

### 后续工作

4. **PR #16（E2E测试）**
   - 等待主干稳定
   - 使用Playwright
   - 优先覆盖 list→detail→409 链路

---

## 📚 文档清单

- ✅ `.github/scripts/check-repo-hygiene.sh` - CI检查脚本
- ✅ `.github/workflows/ci.yml` - CI工作流（已更新）
- ✅ `backend/scripts/smoke-test-improved.sh` - 改进后的冒烟测试脚本
- ✅ `ops-frontend/SMOKE_TEST_CHECKLIST.md` - 前端冒烟测试执行清单
- ✅ `SMOKE_TEST_REPORT.md` - 测试报告模板
- ✅ `PR14_DECISION_ANALYSIS.md` - PR #14决策分析
- ✅ `P1_ENGINEERING_IMPROVEMENTS.md` - P1工程化改进总结
- ✅ `ops-frontend/screenshots/` - 截图目录

---

**PR类型**: chore  
**优先级**: P1  
**Blocking**: No（但建议尽快合并以启用CI检查）

---

**相关PR**:
- #18: AR API (backend) - 已合并
- #19: CI配置 - 已合并
- #20: AR基础页面 - 已合并
- #25: 默认筛选和排序 - 已合并
- #29: 空状态/错误边界 - 已合并
