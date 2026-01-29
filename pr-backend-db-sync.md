# fix(backend): add TypeORM entities registration and DB_SYNC switch

## 🎯 目标

解决 Windows 环境下数据库表未创建导致 API 返回 500 错误的问题，提供便捷的一键建表方案。

---

## 🐛 问题描述

### 现象

1. Windows MySQL 已安装并创建数据库 `qianzhang_sales`
2. `SHOW TABLES` 返回空结果
3. `GET /ar/payments` 返回 500 错误

### 根本原因

- TypeORM 配置中 `synchronize` 固定为 `false`
- 没有提供便捷的建表方式
- 开发者需要手动编写 SQL 或使用 migration（复杂）

---

## ✅ 解决方案

### 1. 添加 DB_SYNC 环境变量开关

**修改文件**: `backend/src/app.module.ts`

**修改前**:
```typescript
synchronize: false,
```

**修改后**:
```typescript
synchronize: configService.get('DB_SYNC', 'false') === 'true',
```

**说明**:
- 默认值：`false`（安全，避免意外修改表结构）
- 开发环境可临时启用：`DB_SYNC=true`
- 生产环境禁止启用

---

### 2. 创建 db:sync 脚本（跨平台）

**新增文件**: `backend/scripts/db-sync.ts`

**功能**:
- ✅ 一键自动创建数据库表
- ✅ 显示详细的执行过程和结果
- ✅ 支持 Windows/Linux/macOS
- ✅ 包含错误处理和解决方案提示
- ✅ 验证表是否创建成功

**使用方法**:
```bash
cd backend
npm run db:sync
```

**期望输出**:
```
🚀 Starting database synchronization...

📋 Configuration:
   Host: localhost:3306
   Database: qianzhang_sales
   Username: root
   Entities: 4 entities

🔌 Connecting to database...
✅ Database connected successfully!

🔄 Synchronizing database schema...
✅ Database schema synchronized successfully!

🔍 Verifying tables...

📊 Created tables:
   ✓ ar_payments
   ✓ ar_invoices
   ✓ ar_apply
   ✓ audit_logs

🎉 Database synchronization completed successfully!

💡 Next steps:
   1. Start the backend server: npm run start:dev
   2. Test the API: GET /ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20
   3. Expected result: 200 OK with empty array
```

---

### 3. 更新配置和文档

#### 3.1 更新 .env.example

**新增配置**:
```env
DB_SYNC=false
```

**说明**:
- `DB_SYNC=true`: 应用启动时自动创建/更新表结构
- `DB_SYNC=false`: 不自动同步表结构（推荐）

#### 3.2 更新 package.json

**新增脚本**:
```json
{
  "scripts": {
    "db:sync": "ts-node -r tsconfig-paths/register scripts/db-sync.ts"
  }
}
```

**新增依赖**:
```json
{
  "dependencies": {
    "dotenv": "^16.3.1"
  }
}
```

#### 3.3 新增 DATABASE_SETUP.md

**内容**:
- 完整的数据库设置指南
- 多种建表方法（db:sync、DB_SYNC、migration）
- 表结构说明
- 常见问题解决
- 安全建议

#### 3.4 更新 README.md

**新增内容**:
- 数据库设置章节
- db:sync 脚本使用说明
- 验证安装步骤
- 常见问题解答

---

## 📋 使用方法

### 方法1: 使用 db:sync 脚本（推荐）

#### 步骤1: 创建数据库

```bash
mysql -u root -p -e "CREATE DATABASE qianzhang_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

#### 步骤2: 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_DATABASE=qianzhang_sales
DB_SYNC=false
```

#### 步骤3: 安装依赖

```bash
npm install
```

#### 步骤4: 运行 db:sync

```bash
npm run db:sync
```

#### 步骤5: 验证表创建

```bash
mysql -u root -p qianzhang_sales -e "SHOW TABLES;"
```

**期望输出**:
```
+----------------------------+
| Tables_in_qianzhang_sales  |
+----------------------------+
| ar_apply                   |
| ar_invoices                |
| ar_payments                |
| audit_logs                 |
+----------------------------+
```

#### 步骤6: 启动服务

```bash
npm run start:dev
```

#### 步骤7: 测试API

```bash
curl "http://localhost:3000/ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20"
```

**期望响应** (200 OK):
```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

---

### 方法2: 使用 DB_SYNC 环境变量

#### 步骤1-3: 同方法1

#### 步骤4: 启用 DB_SYNC

编辑 `.env` 文件：
```env
DB_SYNC=true
```

#### 步骤5: 启动服务

```bash
npm run start:dev
```

应用启动时会自动创建表。

#### 步骤6: 关闭 DB_SYNC（重要！）

表创建完成后，**立即关闭** `DB_SYNC`：

```env
DB_SYNC=false
```

重启应用。

⚠️ **警告**: 不要在生产环境中启用 `DB_SYNC=true`！

---

## 🧪 验收标准

### ✅ 必须满足

1. **表创建成功**

```bash
mysql -u root -p qianzhang_sales -e "SHOW TABLES;"
```

**期望输出**:
```
+----------------------------+
| Tables_in_qianzhang_sales  |
+----------------------------+
| ar_apply                   |
| ar_invoices                |
| ar_payments                |
| audit_logs                 |
+----------------------------+
```

2. **API返回200**

```bash
curl "http://localhost:3000/ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20"
```

**期望响应**:
- 状态码: `200 OK`
- 响应体:
```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

3. **db:sync 脚本正常运行**

```bash
npm run db:sync
```

**期望输出**:
- ✅ 数据库连接成功
- ✅ 表结构同步成功
- ✅ 显示4个表名
- ✅ 无错误信息

---

## 📊 数据库表结构

### 1. ar_payments (收款单表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| org_id | INT | 组织ID |
| customer_id | BIGINT | 客户ID |
| payment_no | VARCHAR(50) | 收款单号（唯一） |
| bank_ref | VARCHAR(100) | 银行流水号（唯一） |
| amount | BIGINT | 收款金额（分） |
| unapplied_amount | BIGINT | 未核销金额（分） |
| payment_date | DATE | 收款日期 |
| payment_method | VARCHAR(50) | 收款方式 |
| status | ENUM | 状态 |
| receipt_url | VARCHAR(500) | 回单URL |
| remark | TEXT | 备注 |
| created_by | BIGINT | 创建人ID |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| version | INT | 乐观锁版本号 |

### 2. ar_invoices (应收单表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| org_id | INT | 组织ID |
| customer_id | BIGINT | 客户ID |
| invoice_no | VARCHAR(50) | 应收单号（唯一） |
| amount | BIGINT | 应收金额（分） |
| balance | BIGINT | 余额（分） |
| due_date | DATE | 到期日 |
| status | ENUM | 状态 |
| created_by | BIGINT | 创建人ID |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| version | INT | 乐观锁版本号 |

### 3. ar_apply (核销记录表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| org_id | INT | 组织ID |
| payment_id | BIGINT | 收款单ID |
| invoice_id | BIGINT | 应收单ID |
| applied_amount | BIGINT | 核销金额（分） |
| applied_by | BIGINT | 核销人ID |
| applied_at | TIMESTAMP | 核销时间 |

### 4. audit_logs (审计日志表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| org_id | INT | 组织ID |
| entity_type | VARCHAR(50) | 实体类型 |
| entity_id | BIGINT | 实体ID |
| action | VARCHAR(50) | 操作类型 |
| user_id | BIGINT | 操作人ID |
| changes | JSON | 变更内容 |
| created_at | TIMESTAMP | 创建时间 |

---

## 📂 文件修改清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `backend/src/app.module.ts` | 修改 | 添加 DB_SYNC 开关 |
| `backend/.env.example` | 修改 | 添加 DB_SYNC 配置 |
| `backend/package.json` | 修改 | 添加 db:sync 脚本和 dotenv 依赖 |
| `backend/scripts/db-sync.ts` | 新增 | 自动建表脚本 |
| `backend/DATABASE_SETUP.md` | 新增 | 数据库设置指南 |
| `backend/README.md` | 修改 | 更新项目文档 |

---

## 🔒 安全建议

### 开发环境
- ✅ 可以使用 `DB_SYNC=true`
- ✅ 可以使用 `npm run db:sync`
- ✅ 可以使用 root 用户

### 生产环境
- ❌ **禁止** 使用 `DB_SYNC=true`
- ❌ **禁止** 使用 `npm run db:sync`
- ✅ 使用 TypeORM migration
- ✅ 使用专用数据库用户（非root）
- ✅ 限制用户权限（仅SELECT/INSERT/UPDATE/DELETE）

---

## 🐛 常见问题

### 1. `ECONNREFUSED` 错误

**问题**: 无法连接到MySQL

**解决方案**:
1. 检查MySQL是否运行
2. 验证 `.env` 中的 `DB_HOST` 和 `DB_PORT`

### 2. `Access denied` 错误

**问题**: 用户名或密码错误

**解决方案**:
1. 检查 `.env` 中的 `DB_USERNAME` 和 `DB_PASSWORD`
2. 确认MySQL用户权限

### 3. `Unknown database` 错误

**问题**: 数据库不存在

**解决方案**:
```bash
mysql -u root -p -e "CREATE DATABASE qianzhang_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 4. Windows 上 `ts-node` 报错

**问题**: `ts-node` 命令未找到

**解决方案**:
```bash
npm install -g ts-node
# 或使用 npx
npx ts-node scripts/db-sync.ts
```

---

## 📈 影响范围

### 影响的功能
- ✅ 数据库表创建
- ✅ TypeORM 同步行为
- ✅ 开发环境设置流程

### 不影响的功能
- ✅ 业务逻辑（无变化）
- ✅ API接口（无变化）
- ✅ 现有数据（不会删除）

### 向后兼容性
- ✅ **完全兼容**: 默认 `DB_SYNC=false`，行为与之前一致
- ✅ **可选功能**: db:sync 脚本是新增功能，不影响现有流程

---

## 🚀 部署建议

### 开发环境
1. 使用 `npm run db:sync` 创建表
2. 或临时启用 `DB_SYNC=true`

### 测试环境
1. 使用 `npm run db:sync` 创建表
2. 或使用 migration（推荐）

### 生产环境
1. **必须** 使用 TypeORM migration
2. **禁止** 使用 `DB_SYNC=true`
3. **禁止** 使用 `npm run db:sync`

---

## 📝 后续工作

### 立即需要做的
1. ✅ Review并合并本PR
2. ✅ 在本地运行 `npm run db:sync`
3. ✅ 验证表创建和API返回200

### 后续改进
1. 创建 TypeORM migration 脚本
2. 添加种子数据（seed data）
3. 添加数据库备份脚本

---

**PR类型**: fix  
**优先级**: P0  
**Blocking**: Yes（后端API依赖数据库表）

---

**相关文档**:
- [DATABASE_SETUP.md](backend/DATABASE_SETUP.md)
- [README.md](backend/README.md)

---

**测试清单**:
- [ ] `npm run db:sync` 正常运行
- [ ] `SHOW TABLES` 显示4个表
- [ ] `GET /ar/payments` 返回200
- [ ] Windows环境测试通过
- [ ] Linux/macOS环境测试通过（可选）
