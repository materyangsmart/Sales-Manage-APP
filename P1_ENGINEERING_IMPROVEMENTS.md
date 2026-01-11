# P1工程化改进总结

**完成日期**: 2026-01-12  
**负责人**: Manus AI

---

## 一、改进概述

本次P1工程化改进包含3个主要任务：

1. ✅ **新增CI检查**：阻止node_modules/dist/build/coverage被提交
2. ✅ **修复smoke-test.sh**：修复3个已知问题
3. ⏸️ **PR #16（E2E测试）**：推迟到主干稳定后再补

---

## 二、CI检查：仓库卫生

### 2.1 问题背景

在P0任务中，我们发现7个PR包含24,488个node_modules文件，严重污染仓库。

**根本原因**:
- `.gitignore`配置不完善
- 缺少CI检查，无法在PR阶段拦截

### 2.2 解决方案

#### 新增文件

1. **检查脚本**: `.github/scripts/check-repo-hygiene.sh`
   - 检查已追踪的文件（`git ls-files`）
   - 检查暂存区（`git diff --cached --name-only`）
   - 禁止提交的模式：
     - `node_modules/`
     - `dist/`
     - `build/`
     - `coverage/`
     - `.next/`, `.nuxt/`, `out/`
     - `*.log`, `.DS_Store`, `Thumbs.db`

2. **CI工作流**: `.github/workflows/ci.yml`
   - 新增`repo-hygiene` job
   - 在lint/test/build之前执行
   - 使用`needs: repo-hygiene`确保卫生检查通过后才执行其他任务

#### 配置详情

**`.github/workflows/ci.yml`**:
```yaml
jobs:
  repo-hygiene:
    name: Repository Hygiene Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 获取完整历史
      - name: Check for forbidden files
        run: bash .github/scripts/check-repo-hygiene.sh
  
  lint:
    needs: repo-hygiene  # 依赖卫生检查
    # ...
  
  test:
    needs: repo-hygiene
    # ...
  
  build:
    needs: repo-hygiene
    # ...
```

### 2.3 验证方法

#### 本地验证

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

**期望输出**（有违规）:
```
========================================
仓库卫生检查
========================================

检查已追踪的文件...
✗ 发现禁止提交的文件/目录: node_modules/
  匹配的文件:
  backend/node_modules/.bin/acorn
  backend/node_modules/.bin/eslint
  ...

========================================
✗ 发现 1 个违规项

修复建议:
1. 检查.gitignore是否正确配置
2. 使用以下命令移除已追踪的文件:
   git rm -r --cached node_modules/
   ...
```

#### CI验证

在GitHub上创建一个测试PR，故意提交node_modules，验证CI是否拦截。

### 2.4 效果

- ✅ 自动拦截node_modules等文件的提交
- ✅ 在PR阶段就发现问题，避免污染main分支
- ✅ 减少Code Review负担
- ✅ 保持仓库干净

---

## 三、后端冒烟测试脚本改进

### 3.1 问题背景

原始脚本`backend/scripts/smoke-test.sh`存在3个问题：

1. **GET请求发送body**: GET请求不应该有body
2. **幂等性测试缺少断言**: 只检查HTTP状态码，没有验证两次响应是否一致
3. **CUSTOMER_ID和INVOICE_ID硬编码**: 不够灵活

### 3.2 解决方案

#### 新增文件

**`backend/scripts/smoke-test-improved.sh`**

#### 改进点详情

##### 改进1: GET请求不发送body

**问题**:
```bash
# 原始代码（错误）
response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$url" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "$data")  # GET请求也发送body
```

**修复**:
```bash
# 改进后（正确）
if [ "$method" = "GET" ]; then
  # GET请求不发送body
  response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$url" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json")
else
  # POST/PUT/PATCH等请求发送body
  response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$url" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "$data")
fi
```

---

##### 改进2: 幂等性测试增加断言

**问题**:
```bash
# 原始代码（不完整）
test_api \
  "幂等性测试（重复创建收款单）" \
  "POST" \
  "/ar/payments" \
  "$PAYMENT_DATA" \
  "11111111-1111-1111-1111-111111111111"

# 没有验证两次响应是否一致
```

**修复**:
```bash
# 改进后（完整）
FIRST_RESPONSE=$(test_api \
  "创建收款单" \
  "POST" \
  "/ar/payments" \
  "$PAYMENT_DATA" \
  "11111111-1111-1111-1111-111111111111")

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
fi
```

---

##### 改进3: CUSTOMER_ID和INVOICE_ID参数化

**问题**:
```bash
# 原始代码（硬编码）
CUSTOMER_ID="CUST001"
INVOICE_ID="INV001"
```

**修复**:
```bash
# 改进后（参数化）
CUSTOMER_ID=${CUSTOMER_ID:-"CUST001"}
INVOICE_ID=${INVOICE_ID:-"INV001"}
```

**使用方法**:
```bash
# 使用默认值
bash smoke-test-improved.sh

# 自定义值
export CUSTOMER_ID=CUST002
export INVOICE_ID=INV002
bash smoke-test-improved.sh
```

---

### 3.3 使用方法

#### 基本用法

```bash
cd backend
export API_BASE=http://localhost:3001
export JWT=your_jwt_token_here
bash scripts/smoke-test-improved.sh
```

#### 高级用法（自定义测试数据）

```bash
cd backend
export API_BASE=http://localhost:3001
export JWT=your_jwt_token_here
export CUSTOMER_ID=CUST002
export INVOICE_ID=INV002
bash scripts/smoke-test-improved.sh
```

### 3.4 对比总结

| 改进点 | 原始脚本 | 改进后脚本 |
|--------|---------|-----------|
| GET请求body | ❌ 发送body | ✅ 不发送body |
| 幂等性断言 | ❌ 缺失 | ✅ 验证响应一致性 |
| 参数化 | ❌ 硬编码 | ✅ 环境变量配置 |
| 测试计数 | ✅ 有 | ✅ 更准确（+1幂等性断言） |

---

## 四、PR #16（E2E测试）处理

### 4.1 决策

**推迟到P1阶段**，在主干稳定且冒烟通过后再补。

### 4.2 原因

1. **优先级**: E2E测试是Nice-to-have，不是Blocking
2. **依赖**: 需要所有功能PR合并后才能编写完整的E2E测试
3. **稳定性**: 主干不稳定时，E2E测试容易失败

### 4.3 建议方案

#### 技术选型

**推荐**: Playwright

**理由**:
- ✅ 官方支持，维护活跃
- ✅ 跨浏览器支持（Chrome, Firefox, Safari）
- ✅ 自动等待，减少flaky tests
- ✅ 内置截图和视频录制
- ✅ 支持并行执行

**备选**: Vitest + MSW

**理由**:
- ✅ 轻量级，集成简单
- ✅ MSW可以mock API，无需真实后端
- ❌ 无法测试真实浏览器交互

#### 测试覆盖

**优先级P0**（必须覆盖）:
1. list → detail → 409 flow（原PR #16的目标）
   - 列表页加载
   - 点击"核销"按钮
   - 详情页加载
   - 填写核销金额
   - 提交核销
   - 模拟409冲突
   - 验证错误提示

**优先级P1**（建议覆盖）:
2. 默认筛选和排序（PR #25）
3. 空态和异常态（PR #29）
4. 用户偏好记忆（PR #25）

#### 实施计划

1. **创建分支**: `test/ops-ar-e2e-playwright`
2. **安装依赖**:
   ```bash
   cd ops-frontend
   pnpm add -D @playwright/test
   npx playwright install
   ```
3. **创建测试文件**: `ops-frontend/e2e/ar-apply-flow.spec.ts`
4. **编写测试用例**:
   ```typescript
   import { test, expect } from '@playwright/test';
   
   test('AR apply flow: list → detail → submit → 409', async ({ page }) => {
     // 1. 访问列表页
     await page.goto('http://localhost:5173/ar/payments');
     await expect(page.locator('h1')).toContainText('AR待处理列表');
     
     // 2. 点击"核销"按钮
     await page.locator('button:has-text("核销")').first().click();
     await expect(page).toHaveURL(/\/ar\/apply\/.+/);
     
     // 3. 填写核销金额
     await page.locator('input[type="number"]').first().fill('20');
     
     // 4. 提交核销
     await page.locator('button:has-text("提交核销")').click();
     await page.locator('button:has-text("确定")').click();
     
     // 5. 验证成功提示
     await expect(page.locator('.ant-message-success')).toBeVisible();
     
     // 6. 模拟409冲突（需要mock API）
     // ...
   });
   ```
5. **配置CI**: 在`.github/workflows/ci.yml`中添加E2E测试job
6. **提交PR**: `test(ops-ar): add e2e tests with Playwright`

---

## 五、总结

### 5.1 已完成的改进

| 任务 | 状态 | 文件 |
|------|------|------|
| CI检查脚本 | ✅ 完成 | `.github/scripts/check-repo-hygiene.sh` |
| CI工作流更新 | ✅ 完成 | `.github/workflows/ci.yml` |
| smoke-test改进 | ✅ 完成 | `backend/scripts/smoke-test-improved.sh` |
| PR #16（E2E） | ⏸️ 推迟 | 等待主干稳定 |

### 5.2 效果预期

#### CI检查

- ✅ 自动拦截node_modules等文件
- ✅ 减少Code Review负担
- ✅ 保持仓库干净

#### smoke-test改进

- ✅ 修复GET请求body问题
- ✅ 增加幂等性断言
- ✅ 支持参数化配置
- ✅ 提高测试准确性

#### E2E测试

- ⏸️ 推迟到P1阶段
- ✅ 有明确的实施计划
- ✅ 技术选型已确定（Playwright）

### 5.3 下一步行动

1. ✅ 提交P1改进到Git
2. ✅ 创建PR：`chore: add repo hygiene check and improve smoke-test`
3. ⏸️ 等待冒烟测试完成
4. ⏸️ 根据测试结果决定是否需要PR #14
5. ⏸️ 主干稳定后补充E2E测试（PR #16）

---

**文档版本**: v1.0  
**最后更新**: 2026-01-12
