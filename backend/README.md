# 千张销售管理系统 - 后端服务

基于 [NestJS](https://github.com/nestjs/nest) 框架的 TypeScript 后端服务。

---

## 📋 目录

- [项目设置](#项目设置)
- [数据库设置](#数据库设置)
- [运行项目](#运行项目)
- [测试](#测试)
- [环境变量](#环境变量)
- [API文档](#api文档)

---

## 🚀 项目设置

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置数据库连接信息：

```env
# 服务端口
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_DATABASE=qianzhang_sales
DB_LOGGING=false
DB_SYNC=false

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 🗄️ 数据库设置

### 快速开始（推荐）

#### 步骤1: 创建数据库

```bash
mysql -u root -p -e "CREATE DATABASE qianzhang_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

#### 步骤2: 运行自动建表脚本

```bash
npm run db:sync
```

**期望输出**:

```
🚀 Starting database synchronization...
✅ Database connected successfully!
🔄 Synchronizing database schema...
✅ Database schema synchronized successfully!

📊 Created tables:
   ✓ ar_payments
   ✓ ar_invoices
   ✓ ar_apply
   ✓ audit_logs

🎉 Database synchronization completed successfully!
```

#### 步骤3: 验证表创建

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

### 详细文档

查看 [DATABASE_SETUP.md](./DATABASE_SETUP.md) 获取完整的数据库设置指南，包括：
- 多种建表方法
- 表结构说明
- 常见问题解决
- 安全建议

---

## 🏃 运行项目

### 开发模式（推荐）

```bash
npm run start:dev
```

服务将在 `http://localhost:3000` 启动，支持热重载。

### 生产模式

```bash
npm run build
npm run start:prod
```

### 调试模式

```bash
npm run start:debug
```

---

## 🧪 测试

### 单元测试

```bash
npm run test
```

### E2E测试

```bash
npm run test:e2e
```

### 测试覆盖率

```bash
npm run test:cov
```

### 冒烟测试

```bash
cd scripts
bash smoke-test-improved.sh
```

---

## 🔧 环境变量

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `PORT` | 服务端口 | 3000 | 否 |
| `DB_HOST` | 数据库主机 | localhost | 是 |
| `DB_PORT` | 数据库端口 | 3306 | 否 |
| `DB_USERNAME` | 数据库用户名 | root | 是 |
| `DB_PASSWORD` | 数据库密码 | - | 是 |
| `DB_DATABASE` | 数据库名称 | qianzhang_sales | 是 |
| `DB_LOGGING` | 启用SQL日志 | false | 否 |
| `DB_SYNC` | 自动同步表结构 | false | 否 |
| `REDIS_HOST` | Redis主机 | localhost | 否 |
| `REDIS_PORT` | Redis端口 | 6379 | 否 |
| `REDIS_PASSWORD` | Redis密码 | - | 否 |

### ⚠️ DB_SYNC 说明

- `DB_SYNC=true`: 应用启动时自动创建/更新表结构
- `DB_SYNC=false`: 不自动同步表结构（推荐）

**警告**: 
- ✅ 开发环境可以使用 `DB_SYNC=true`
- ❌ **生产环境禁止使用** `DB_SYNC=true`

---

## 📚 API文档

### Swagger文档

启动服务后访问：http://localhost:3000/api

### 主要API端点

#### AR管理

- `GET /ar/payments` - 获取收款单列表
- `POST /ar/payments` - 创建收款单
- `GET /ar/payments/:id` - 获取收款单详情
- `POST /ar/apply` - 执行核销
- `GET /ar/summary` - 获取汇总数据

---

## 📦 可用脚本

| 脚本 | 说明 |
|------|------|
| `npm run start` | 启动应用 |
| `npm run start:dev` | 开发模式（热重载） |
| `npm run start:debug` | 调试模式 |
| `npm run start:prod` | 生产模式 |
| `npm run build` | 构建应用 |
| `npm run lint` | 代码检查 |
| `npm run format` | 代码格式化 |
| `npm run test` | 运行单元测试 |
| `npm run test:e2e` | 运行E2E测试 |
| `npm run test:cov` | 测试覆盖率 |
| `npm run db:sync` | 自动创建数据库表 |

---

## 🔍 验证安装

### 1. 启动服务

```bash
npm run start:dev
```

### 2. 测试API

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

## 🐛 常见问题

### 1. `GET /ar/payments` 返回 500 错误

**原因**: 数据库表未创建

**解决方案**:
```bash
npm run db:sync
```

### 2. 无法连接到数据库

**原因**: MySQL未启动或配置错误

**解决方案**:
1. 检查MySQL是否运行
2. 验证 `.env` 中的数据库配置
3. 查看 [DATABASE_SETUP.md](./DATABASE_SETUP.md) 的"常见问题"部分

### 3. `SHOW TABLES` 为空

**原因**: 表未创建

**解决方案**:
```bash
npm run db:sync
```

---

## 📖 技术栈

- **框架**: NestJS 11.x
- **语言**: TypeScript 5.x
- **ORM**: TypeORM 0.3.x
- **数据库**: MySQL 8.x
- **缓存**: Redis 5.x
- **验证**: class-validator
- **文档**: Swagger/OpenAPI

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

[MIT licensed](LICENSE)

---

## 🆘 获取帮助

- 查看 [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- 查看 [Swagger API文档](http://localhost:3000/api)
- 提交 Issue 到项目仓库

---

**最后更新**: 2026-01-12
