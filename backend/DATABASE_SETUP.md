# 数据库设置指南

本文档说明如何在本地环境中设置和初始化数据库。

---

## 📋 前置要求

### 1. 安装MySQL

#### Windows
- 下载并安装 [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
- 或使用 [XAMPP](https://www.apachefriends.org/)

#### macOS
```bash
brew install mysql
brew services start mysql
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
```

---

## 🚀 快速开始

### 方法1: 使用 db:sync 脚本（推荐）

这是最简单的方法，适用于开发环境。

#### 步骤1: 创建数据库

```bash
# 登录MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE qianzhang_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 退出
EXIT;
```

#### 步骤2: 配置环境变量

复制 `.env.example` 为 `.env` 并修改数据库配置：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_DATABASE=qianzhang_sales
DB_LOGGING=false
DB_SYNC=false  # 默认关闭，避免意外修改表结构
```

#### 步骤3: 安装依赖

```bash
npm install
# 或
pnpm install
```

#### 步骤4: 运行 db:sync 脚本

```bash
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

#### 步骤6: 启动后端服务

```bash
npm run start:dev
```

#### 步骤7: 测试API

```bash
curl "http://localhost:3000/ar/payments?orgId=2&status=UNAPPLIED&page=1&pageSize=20"
```

**期望响应**:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

**状态码**: `200 OK`

---

### 方法2: 使用 DB_SYNC 环境变量

这种方法会在应用启动时自动同步表结构。

#### 步骤1-3: 同方法1

#### 步骤4: 启用 DB_SYNC

编辑 `.env` 文件：

```env
DB_SYNC=true  # 启用自动同步
```

#### 步骤5: 启动后端服务

```bash
npm run start:dev
```

应用启动时会自动创建表。

#### 步骤6: 关闭 DB_SYNC（重要！）

表创建完成后，**立即关闭** `DB_SYNC`：

```env
DB_SYNC=false  # 关闭自动同步
```

重启应用：

```bash
# Ctrl+C 停止应用
npm run start:dev
```

⚠️ **警告**: 不要在生产环境中启用 `DB_SYNC=true`！

---

### 方法3: 使用 Migration（生产环境推荐）

TODO: 待实现 TypeORM migration 脚本

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
| status | ENUM | 状态：UNAPPLIED/PARTIAL/APPLIED |
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
| status | ENUM | 状态：OPEN/PARTIAL/CLOSED |
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

## 🔧 常见问题

### 1. `ECONNREFUSED` 错误

**问题**: 无法连接到MySQL

**解决方案**:
1. 检查MySQL是否运行：
   ```bash
   # Windows
   net start MySQL80
   
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status mysql
   ```

2. 检查 `.env` 中的 `DB_HOST` 和 `DB_PORT`

### 2. `Access denied` 错误

**问题**: 用户名或密码错误

**解决方案**:
1. 检查 `.env` 中的 `DB_USERNAME` 和 `DB_PASSWORD`
2. 确认MySQL用户权限：
   ```sql
   GRANT ALL PRIVILEGES ON qianzhang_sales.* TO 'root'@'localhost';
   FLUSH PRIVILEGES;
   ```

### 3. `Unknown database` 错误

**问题**: 数据库不存在

**解决方案**:
```bash
mysql -u root -p -e "CREATE DATABASE qianzhang_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 4. `GET /ar/payments` 返回 500 错误

**问题**: 表未创建

**解决方案**:
1. 运行 `npm run db:sync`
2. 或启用 `DB_SYNC=true` 并重启应用
3. 验证表是否创建：`SHOW TABLES;`

### 5. Windows 上 `ts-node` 报错

**问题**: `ts-node` 命令未找到

**解决方案**:
```bash
npm install -g ts-node
# 或使用 npx
npx ts-node scripts/db-sync.ts
```

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

## 📚 相关文档

- [TypeORM Documentation](https://typeorm.io/)
- [NestJS TypeORM Integration](https://docs.nestjs.com/techniques/database)
- [MySQL Documentation](https://dev.mysql.com/doc/)

---

## 🆘 获取帮助

如果遇到问题：

1. 检查 MySQL 日志
2. 检查应用日志（启用 `DB_LOGGING=true`）
3. 查看本文档的"常见问题"部分
4. 提交 Issue 到项目仓库

---

**最后更新**: 2026-01-12
