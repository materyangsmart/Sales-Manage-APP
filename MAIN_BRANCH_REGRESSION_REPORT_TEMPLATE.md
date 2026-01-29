# 主干回归验收报告

**报告日期**: [填写日期，例如：2024-01-29]  
**合并PR**: P4, P5, P7, P8, P9, P10  
**测试人**: [填写测试人姓名]  
**测试环境**: [填写环境，例如：测试环境 / 本地环境]

---

## 📋 测试概述

本报告记录了P4-P10所有PR合并到main分支后的回归验证结果。目的是确保所有功能正常工作，没有引入回归问题。

**测试范围**:
1. 数据库同步（db:sync）
2. 冒烟测试（smoke:ar）
3. 幂等拦截器测试（11个用例）
4. 外部权限模型测试（10个用例）
5. 订单→AR完整业务流程

---

## 🗄️ 测试环境准备

### 环境信息

**操作系统**: [填写，例如：macOS 14.1 / Ubuntu 22.04]  
**Node.js版本**: [填写，例如：22.13.0]  
**MySQL版本**: [填写，例如：8.0.35]  
**数据库名称**: [填写，例如：qianzhang_sales_test]

### 环境变量配置

```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_USERNAME=root
export DB_PASSWORD=your_password
export DB_DATABASE=qianzhang_sales_test
export DB_SYNC=true
```

### 代码拉取

```bash
# 拉取最新main分支
git checkout main
git pull origin main

# 确认所有PR已合并
git log --oneline -10
```

**确认结果**: [填写最新commit hash和消息]

---

## ✅ 测试1: 数据库同步（db:sync）

### 测试目的

验证数据库schema同步功能正常，所有表、索引、约束都能正确创建。

### 测试步骤

```bash
# 1. 清空测试数据库（可选）
mysql -u root -p -e "DROP DATABASE IF EXISTS qianzhang_sales_test; CREATE DATABASE qianzhang_sales_test;"

# 2. 进入backend目录
cd backend

# 3. 安装依赖
npm ci

# 4. 运行数据库同步
npm run db:sync
```

### 测试结果

**执行时间**: [填写，例如：2024-01-29 10:00:00]

**输出日志**:
```
[填写实际输出日志]
```

**验证检查**:
- [ ] 所有表创建成功
- [ ] 所有索引创建成功
- [ ] 没有错误信息
- [ ] audit_logs表包含idempotencyKey唯一索引

**结果**: ✅ 通过 / ❌ 失败

**备注**: [如果失败，填写失败原因和错误信息]

---

## ✅ 测试2: 冒烟测试（smoke:ar）

### 测试目的

验证AR模块的基本功能（创建收款单、应用收款、查询）能正常工作。

### 测试步骤

```bash
cd backend
npm run smoke:ar
```

### 测试结果

**执行时间**: [填写，例如：2024-01-29 10:05:00]

**输出日志**:
```
[填写实际输出日志]
```

**验证检查**:
- [ ] 创建收款单成功
- [ ] 应用收款成功
- [ ] 查询收款单成功
- [ ] 审计日志写入成功

**结果**: ✅ 通过 / ❌ 失败

**备注**: [如果失败，填写失败原因和错误信息]

---

## ✅ 测试3: 幂等拦截器测试（11个用例）

### 测试目的

验证幂等拦截器能正确处理重复请求，防止数据多写。

### 测试步骤

```bash
cd backend
npm test -- idempotency.e2e-spec.ts
```

### 测试结果

**执行时间**: [填写，例如：2024-01-29 10:10:00]

**输出日志**:
```
[填写实际输出日志，包含测试用例列表和结果]
```

**测试用例清单**:
- [ ] 第一次请求正常写入
- [ ] 重复请求返回缓存响应
- [ ] 重复请求不重复写入业务表
- [ ] 并发请求只写入一条
- [ ] 不同Idempotency-Key独立处理
- [ ] 缺少Idempotency-Key返回400
- [ ] 无效Idempotency-Key返回400
- [ ] audit_logs.idempotencyKey唯一性生效
- [ ] response_data复用路径正确
- [ ] newValue复用路径正确
- [ ] 24小时后幂等键过期

**结果**: ✅ 11/11 通过 / ❌ [X]/11 通过

**备注**: [如果有失败用例，填写失败原因]

---

## ✅ 测试4: 外部权限模型测试（10个用例）

### 测试目的

验证外部权限模型能正确隔离客户数据，防止越权访问。

### 测试步骤

```bash
cd backend
npm test -- external-permission.e2e-spec.ts
```

### 测试结果

**执行时间**: [填写，例如：2024-01-29 10:15:00]

**输出日志**:
```
[填写实际输出日志，包含测试用例列表和结果]
```

**测试用例清单**:
- [ ] 客户A可以访问自己的订单
- [ ] 客户A不能访问客户B的订单（403）
- [ ] 客户A不能修改客户B的订单（403）
- [ ] 客户A不能删除客户B的订单（403）
- [ ] 无token访问返回401
- [ ] 无效token访问返回401
- [ ] CustomerScope自动过滤
- [ ] Service层强制执行customerId过滤
- [ ] Repository层强制执行customerId过滤
- [ ] 外部端不能访问审计日志（403）

**结果**: ✅ 10/10 通过 / ❌ [X]/10 通过

**备注**: [如果有失败用例，填写失败原因]

---

## ✅ 测试5: 订单→AR完整业务流程

### 测试目的

验证订单从创建到生成应收发票的完整业务流程。

### 测试步骤

#### 步骤1: 创建订单

```bash
curl -X POST http://localhost:3000/api/internal/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <internal_token>" \
  -d '{
    "orgId": 2,
    "customerId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "unitPrice": 5000
      }
    ]
  }'
```

**响应结果**:
```json
[填写实际响应]
```

**验证检查**:
- [ ] 订单创建成功
- [ ] 订单状态为 PENDING_REVIEW
- [ ] 返回订单ID

**订单ID**: [填写，例如：1]

---

#### 步骤2: 审核订单

```bash
curl -X POST http://localhost:3000/api/internal/orders/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <internal_token>" \
  -d '{
    "orderId": [填写步骤1的订单ID],
    "action": "APPROVED",
    "comment": "审核通过"
  }'
```

**响应结果**:
```json
[填写实际响应]
```

**验证检查**:
- [ ] 审核成功
- [ ] 订单状态变为 APPROVED

---

#### 步骤3: 履行订单（生成发票）

```bash
curl -X POST http://localhost:3000/api/internal/orders/[订单ID]/fulfill \
  -H "Authorization: Bearer <internal_token>"
```

**响应结果**:
```json
[填写实际响应]
```

**验证检查**:
- [ ] 履行成功
- [ ] 订单状态变为 FULFILLED
- [ ] 返回生成的发票信息
- [ ] fulfilledBy字段为number类型

**发票ID**: [填写，例如：1]

---

#### 步骤4: 查询应收发票

```bash
curl "http://localhost:3000/ar/invoices?orgId=2&orderId=[订单ID]"
```

**响应结果**:
```json
[填写实际响应]
```

**验证检查**:
- [ ] 查询成功
- [ ] 返回从订单生成的发票
- [ ] 发票金额正确
- [ ] 发票状态为 OPEN

---

#### 步骤5: 查询审计日志

```bash
curl "http://localhost:3000/audit-logs?resourceType=Order&resourceId=[订单ID]"
```

**响应结果**:
```json
[填写实际响应]
```

**验证检查**:
- [ ] 查询成功
- [ ] 可以看到 CREATE 操作
- [ ] 可以看到 REVIEW 操作
- [ ] 可以看到 FULFILL 操作
- [ ] 审计日志中userId为number类型

---

### 测试结果

**完整流程**: ✅ 通过 / ❌ 失败

**备注**: [如果失败，填写失败步骤和原因]

---

## ✅ 测试6: 无token访问fulfill接口（401验证）

### 测试目的

验证fulfill接口强制要求internal token，无token时返回401。

### 测试步骤

```bash
# 无token访问（应该返回401）
curl -X POST http://localhost:3000/api/internal/orders/1/fulfill
```

### 测试结果

**响应结果**:
```json
[填写实际响应]
```

**验证检查**:
- [ ] 返回401状态码
- [ ] 错误消息为 "Fulfill order requires internal authentication"

**结果**: ✅ 通过 / ❌ 失败

**备注**: [如果失败，填写失败原因]

---

## 📊 测试总结

### 测试结果汇总

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 数据库同步（db:sync） | ✅ / ❌ | [填写] |
| 冒烟测试（smoke:ar） | ✅ / ❌ | [填写] |
| 幂等拦截器测试（11个用例） | ✅ / ❌ | [填写] |
| 外部权限模型测试（10个用例） | ✅ / ❌ | [填写] |
| 订单→AR完整业务流程 | ✅ / ❌ | [填写] |
| 无token访问fulfill接口（401） | ✅ / ❌ | [填写] |

### 总体评估

**通过率**: [填写，例如：6/6 (100%)]

**总体结论**: ✅ 所有测试通过，可以发布 / ❌ 存在失败项，需要修复

---

## 🐛 问题记录

### 问题1: [填写问题标题]

**严重程度**: HIGH / MEDIUM / LOW

**问题描述**: [填写详细描述]

**复现步骤**:
1. [步骤1]
2. [步骤2]
3. [步骤3]

**期望结果**: [填写]

**实际结果**: [填写]

**错误日志**:
```
[填写错误日志]
```

**修复建议**: [填写]

---

### 问题2: [填写问题标题]

[如果有更多问题，继续添加]

---

## 📝 改进建议

### 测试流程改进

1. [填写改进建议1]
2. [填写改进建议2]
3. [填写改进建议3]

### 文档改进

1. [填写改进建议1]
2. [填写改进建议2]

### 自动化改进

1. [填写改进建议1]
2. [填写改进建议2]

---

## ✅ 验收签字

**测试人**: [签名] 日期: [填写]

**审核人**: [签名] 日期: [填写]

**批准人**: [签名] 日期: [填写]

---

## 📎 附件

### 测试截图

[如果有截图，在此添加]

### 测试日志

[如果有完整日志文件，在此说明文件路径]

### 相关链接

- PR列表: [填写GitHub PR链接]
- 测试环境: [填写测试环境URL]
- 文档: [填写相关文档链接]

---

**报告结束**

---

## 📋 使用说明

### 如何使用本模板

1. **复制模板**: 将本模板复制为新文件，命名为 `MAIN_BRANCH_REGRESSION_REPORT_[日期].md`
2. **填写信息**: 按照模板中的 `[填写]` 提示填写实际测试结果
3. **执行测试**: 按照测试步骤依次执行，记录结果
4. **保存日志**: 将测试输出日志保存到文件，并在报告中引用
5. **提交报告**: 测试完成后，将报告提交到Git仓库

### 报告存放位置

```
Sales-Manage-APP/
├── docs/
│   └── regression-reports/
│       ├── MAIN_BRANCH_REGRESSION_REPORT_2024-01-29.md
│       ├── MAIN_BRANCH_REGRESSION_REPORT_2024-02-15.md
│       └── ...
```

### 报告更新频率

- **主干合并后**: 每次合并重要PR到main分支后必须执行
- **发布前**: 每次发布到生产环境前必须执行
- **定期回归**: 每月至少执行一次

---

**模板版本**: v1.0  
**最后更新**: 2024-01-29  
**维护人**: QA Team
