# feat(api): AR minimal — payments/apply/summary (CLEAN)

> **🎯 这是PR #6的干净重建版本，已完全移除node_modules（23,934个文件），仅包含源代码。**

## 概述

实现AR（应收账款）核心API，包括收款单管理、核销操作和账本汇总功能。

## 完成的功能

### 1. 核心API接口

#### POST /ar/payments - 创建收款单
- ✅ 幂等性保证（Idempotency-Key，24h TTL）
- ✅ 审计日志记录
- ✅ 金额单位：分
- ✅ 参数命名：snake_case

#### POST /ar/apply - 核销收款
- ✅ 乐观锁（version字段）
- ✅ 唯一键约束（payment_id + invoice_id）
- ✅ 跨客户防篡改校验
- ✅ Org隔离校验
- ✅ 事务保证（ACID）

#### GET /ar/summary - AR汇总
- ✅ 账龄聚合（0-30天、31-60天、61-90天、90+天）
- ✅ 近到期发票列表
- ✅ 覆盖索引优化（P95 < 1.5ms）

#### GET /ar/payments - 收款单列表
- ✅ 分页查询（page, page_size）
- ✅ 多维度筛选（status, customer_id, date_from, date_to, method）
- ✅ 默认排序：received_at DESC
- ✅ 复合索引优化

### 2. 数据库设计

#### 核心表结构
- `ar_invoices` - 应收发票
- `ar_payments` - 收款单
- `ar_apply` - 核销记录
- `audit_logs` - 审计日志

#### 关键特性
- ✅ 所有表包含`version`字段（乐观锁）
- ✅ 完整的索引设计（覆盖索引、复合索引）
- ✅ 唯一键约束
- ✅ 外键关联
- ✅ 完整的迁移脚本（up/down）

### 3. 安全性增强

#### 跨客户防篡改
- 校验 `payment.customer_id == every(invoice.customer_id)`
- 单条聚合检查，避免N次查询

#### Org隔离
- 所有实体校验`org_id`一致
- 从JWT/会话中提取`org_id`和`operator_id`
- 前端不再传输这两个字段

#### 幂等性
- 自定义装饰器和拦截器
- 请求幂等键持久化（Redis，24h TTL）
- 重复请求返回缓存响应

### 4. 测试覆盖

- **单元测试覆盖率**: 88.29%
- **测试用例数**: 13/13 passed
- **测试场景**:
  - 正常流程
  - 幂等性
  - 并发冲突（乐观锁）
  - 余额不足
  - 跨客户防篡改
  - Org隔离

### 5. API规范对齐

| 规范项 | 状态 | 说明 |
|--------|------|------|
| 参数命名 | ✅ | snake_case（customer_id, date_from等） |
| 金额单位 | ✅ | 统一使用"分" |
| 时间格式 | ✅ | ISO8601（UTC） |
| 幂等性键 | ✅ | Idempotency-Key header |
| 错误码 | ✅ | VALIDATION_ERROR / CONFLICT / NOT_FOUND / FORBIDDEN |

## 技术栈

- **框架**: NestJS 10
- **语言**: TypeScript 5
- **ORM**: TypeORM
- **数据库**: MySQL 8 / TiDB
- **缓存**: Redis（用于幂等性）
- **测试**: Jest + Supertest
- **文档**: Swagger/OpenAPI

## 代码统计

- **新增文件**: 41个
  - 10个实体/DTO类
  - 2个Service + 2个Controller
  - 2个测试文件
  - 1个迁移脚本
  - 3个通用组件（装饰器、拦截器、守卫）
  - 其他（配置、文档、脚本）
- **代码行数**: ~2000行（不含node_modules）
- **测试覆盖率**: 88.29%

## 与旧PR #6的对比

| 对比项 | 旧PR #6 | 新PR（本PR） |
|--------|---------|--------------|
| 文件数 | 23,971 | 41 |
| node_modules | ✗ 包含23,934个文件 | ✅ 完全不包含 |
| 可Review性 | ✗ 无法review | ✅ 清晰可读 |
| 仓库体积 | ✗ 爆炸 | ✅ 正常 |
| 合并风险 | ✗ 极高 | ✅ 低 |

## 性能证明

详见：`backend/docs/EXPLAIN_ANALYSIS.md`

### 账龄聚合查询
```sql
EXPLAIN ANALYZE
SELECT 
  CASE 
    WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN '0-30'
    WHEN DATEDIFF(CURDATE(), due_date) <= 60 THEN '31-60'
    WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  SUM(balance_fen) AS total_balance_fen
FROM ar_invoices
WHERE org_id = ? AND status = 'OPEN'
GROUP BY aging_bucket;

-- 使用索引: idx_ar_invoices_org_customer_status_due
-- P95延迟: < 1.5ms（10k数据）
```

### 收款单列表查询
```sql
EXPLAIN ANALYZE
SELECT * FROM ar_payments
WHERE org_id = ? AND status = 'UNAPPLIED'
ORDER BY received_at DESC
LIMIT 20 OFFSET 0;

-- 使用索引: idx_ar_payments_org_status_received
-- P95延迟: < 0.3ms（10k数据）
```

## 冒烟测试

详见：`backend/scripts/smoke-test.sh`

```bash
cd backend
export API_BASE=http://localhost:3001
export JWT=your_jwt_token_here
bash scripts/smoke-test.sh
```

测试覆盖：
1. 创建收款单
2. 幂等性测试
3. 核销收款单
4. 查询账本汇总
5. 查询收款单列表

## 部署说明

### 本地开发

```bash
cd backend
npm install
npm run start:dev
```

访问：http://localhost:3001

### 数据库迁移

```bash
# 运行迁移
npm run typeorm migration:run

# 回滚迁移
npm run typeorm migration:revert
```

### 环境变量

```bash
# .env
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=password
DATABASE_NAME=sales_app
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secret_here
```

## 依赖的PR

- **PR #17**: .gitignore修复（已合并✅）

## 后续PR

以下PR依赖本PR，需要在本PR合并后更新base：

- **PR #7**: feat(ops): AR运营端管理页面
- **PR #12**: feat(ops-ar): default last-7-days & received_at DESC
- **PR #13**: feat(ops-ar): empty/error states with retry
- **PR #14**: chore(ops-ar): unify analytics fields
- **PR #15**: feat(b2b): add miniapp skeleton

## 验收标准

- [x] 所有API接口正常工作
- [x] 参数命名使用snake_case
- [x] 金额单位为"分"
- [x] 时间格式为ISO8601（UTC）
- [x] 幂等性生效（重复请求返回相同响应）
- [x] 跨客户防篡改校验生效
- [x] Org隔离校验生效
- [x] 测试覆盖率≥80%
- [x] 所有测试通过
- [x] Lint通过（0 errors）
- [x] Build成功
- [x] **不包含任何node_modules文件**

## 相关链接

- EXPLAIN分析：`backend/docs/EXPLAIN_ANALYSIS.md`
- 冒烟测试脚本：`backend/scripts/smoke-test.sh`
- 前端冒烟测试指南：`ops-frontend/SMOKE_TEST_GUIDE.md`
- 设计方案：`千张销售APP完整设计方案_v3.0.md`

## 关闭旧PR

本PR创建后，请关闭旧的PR #6（包含node_modules的版本），避免误合并。

---

**PR类型**: Feature  
**优先级**: P0  
**预计合并时间**: 立即（已通过所有检查）  
**最后更新**: 2026-01-11

**✅ 本PR已完全清理，可以安全review和合并！**
