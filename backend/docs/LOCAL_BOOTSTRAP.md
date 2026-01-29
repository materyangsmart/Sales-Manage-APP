# 本地环境启动指南

本文档提供从零到可用的完整步骤，帮助新机器在30分钟内跑起backend + MySQL + Redis + 基础数据。

---

## 📋 前置要求

### 必需软件

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | 22.x | 运行backend |
| Docker | 20.x+ | 运行MySQL和Redis |
| Docker Compose | 2.x+ | 编排容器 |
| Git | 2.x+ | 克隆代码 |

### 可选软件

| 软件 | 用途 |
|------|------|
| MySQL Client | 数据库管理 |
| Redis CLI | Redis管理 |

---

## 🚀 快速启动（30分钟）

### 步骤1: 克隆项目（2分钟）

```bash
# 克隆项目
git clone https://github.com/materyangsmart/Sales-Manage-APP.git
cd Sales-Manage-APP
```

### 步骤2: 启动Docker服务（5分钟）

```bash
# 启动MySQL和Redis
docker compose up -d

# 等待服务就绪（约30秒）
docker compose ps

# 验证服务状态
docker compose logs mysql | tail -20
docker compose logs redis | tail -20
```

**预期输出**:
```
NAME                  IMAGE          STATUS
qianzhang-mysql       mysql:8.0      Up (healthy)
qianzhang-redis       redis:7-alpine Up (healthy)
```

### 步骤3: 配置环境变量（2分钟）

```bash
cd backend

# 复制环境配置文件
cp .env.example .env

# 查看配置（可选）
cat .env
```

**重要配置项**:
- `DB_HOST=localhost` - 数据库主机
- `DB_PORT=3306` - 数据库端口
- `DB_USERNAME=qianzhang` - 数据库用户名
- `DB_PASSWORD=password` - 数据库密码
- `DB_DATABASE=qianzhang_sales_dev` - 数据库名称
- `REDIS_HOST=localhost` - Redis主机
- `REDIS_PORT=6379` - Redis端口
- `REDIS_PASSWORD=redis_password` - Redis密码

### 步骤4: 安装依赖（5分钟）

```bash
# 安装npm依赖
npm ci

# 验证安装
npm list --depth=0
```

### 步骤5: 同步数据库结构（2分钟）

```bash
# 创建数据库表
npm run db:sync
```

**预期输出**:
```
开始同步数据库...
✅ 数据库同步成功
创建的表：
- organizations
- users
- customers
- products
- orders
- order_items
- ar_invoices
- ar_payments
- audit_logs
```

### 步骤6: 初始化基础数据（2分钟）

```bash
# 执行seed脚本
npm run seed
```

**预期输出**:
```
========================================
开始执行Seed数据脚本
========================================

1. 连接数据库...
✅ 数据库连接成功

2. 创建组织数据...
✅ 组织数据创建完成（3个）

3. 创建用户数据...
✅ 用户数据创建完成（5个）

4. 创建客户数据...
✅ 客户数据创建完成（5个）

5. 创建产品数据...
✅ 产品数据创建完成（30个）

6. 验证数据...
  - 组织数量: 3
  - 用户数量: 5
  - 客户数量: 5
  - 产品数量: 30

========================================
✅ Seed数据脚本执行完成！
========================================
```

### 步骤7: 启动应用（2分钟）

```bash
# 启动开发服务器
npm run start:dev
```

**预期输出**:
```
[Nest] 12345  - 01/29/2024, 3:00:00 PM     LOG [NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
Swagger docs available at: http://localhost:3000/api-docs
```

### 步骤8: 验证服务（5分钟）

#### 8.1 访问Swagger文档

打开浏览器访问: http://localhost:3000/api-docs

**验证点**:
- ✅ 页面正常加载
- ✅ 显示所有API端点
- ✅ 可以展开查看API详情

#### 8.2 运行冒烟测试

```bash
# 在新终端窗口运行
cd backend
npm run smoke:ar
```

**预期输出**:
```
=========================================
AR模块冒烟测试
=========================================

1. 检查应用状态
-----------------------------------
[1] 测试: 应用健康检查 ... ✓ 通过
[2] 测试: Swagger文档可访问 ... ✓ 通过

2. 检查数据库连接
-----------------------------------
[3] 测试: 数据库连接正常 ... ✓ 通过
[4] 测试: 数据库存在 ... ✓ 通过

...

=========================================
测试结果汇总
=========================================
总计: 17
通过: 17
失败: 0

✓ 所有测试通过！AR模块运行正常。
```

---

## ✅ 验收标准

完成以上步骤后，应该满足以下标准：

- [x] Docker容器正常运行（MySQL + Redis）
- [x] 数据库表结构创建成功
- [x] 基础数据初始化完成（组织、用户、客户、产品）
- [x] 应用成功启动在3000端口
- [x] Swagger文档可访问
- [x] 冒烟测试全部通过

---

## 🔧 故障排查

### 问题1: Docker服务启动失败

**症状**: `docker compose up -d` 报错

**解决方案**:
```bash
# 检查Docker是否运行
docker ps

# 检查端口是否被占用
lsof -i:3306
lsof -i:6379

# 停止并删除旧容器
docker compose down -v

# 重新启动
docker compose up -d
```

### 问题2: 数据库连接失败

**症状**: `npm run db:sync` 报错 "ECONNREFUSED"

**解决方案**:
```bash
# 检查MySQL容器状态
docker compose ps mysql

# 查看MySQL日志
docker compose logs mysql

# 等待MySQL完全启动（约30秒）
sleep 30

# 重试
npm run db:sync
```

### 问题3: Seed数据重复插入

**症状**: `npm run seed` 报错 "Duplicate entry"

**解决方案**:
```bash
# Seed脚本使用 INSERT IGNORE，不应该报错
# 如果报错，检查数据库表是否有唯一索引

# 查看表结构
mysql -h localhost -u qianzhang -ppassword qianzhang_sales_dev -e "SHOW CREATE TABLE organizations"

# 如果需要重置数据，删除并重新创建
docker compose down -v
docker compose up -d
npm run db:sync
npm run seed
```

### 问题4: 应用启动失败

**症状**: `npm run start:dev` 报错

**解决方案**:
```bash
# 检查环境变量
cat .env

# 检查端口是否被占用
lsof -i:3000

# 检查依赖是否完整
npm ci

# 查看详细错误日志
npm run start:dev 2>&1 | tee app.log
```

### 问题5: 冒烟测试失败

**症状**: `npm run smoke:ar` 有失败项

**解决方案**:
```bash
# 检查应用是否运行
curl http://localhost:3000/

# 检查数据库连接
mysql -h localhost -u qianzhang -ppassword qianzhang_sales_dev -e "SELECT 1"

# 检查Redis连接
redis-cli -h localhost -p 6379 -a redis_password ping

# 查看应用日志
docker compose logs backend
```

---

## 📊 数据说明

### 组织数据

| ID | 名称 | 代码 | 说明 |
|----|------|------|------|
| 1 | 总部 | HQ | 总部组织 |
| 2 | 华东分公司 | EAST | **测试专用（orgId=2）** |
| 3 | 华南分公司 | SOUTH | 华南区域 |

### 用户数据

| ID | 用户名 | 邮箱 | 角色 | 组织 |
|----|--------|------|------|------|
| 1 | admin | admin@qianzhang.com | ADMIN | 总部 |
| 2 | sales_manager | sales.manager@qianzhang.com | MANAGER | 华东分公司 |
| 3 | sales_rep_1 | sales.rep1@qianzhang.com | SALES | 华东分公司 |
| 4 | sales_rep_2 | sales.rep2@qianzhang.com | SALES | 华东分公司 |
| 5 | finance_manager | finance.manager@qianzhang.com | FINANCE | 总部 |

### 客户数据

| ID | 名称 | 代码 | 联系人 | 组织 |
|----|------|------|--------|------|
| 1 | 阿里巴巴集团 | CUST001 | 张三 | 华东分公司 |
| 2 | 腾讯科技 | CUST002 | 李四 | 华南分公司 |
| 3 | 字节跳动 | CUST003 | 王五 | 华东分公司 |
| 4 | 美团 | CUST004 | 赵六 | 华东分公司 |
| 5 | 京东集团 | CUST005 | 孙七 | 华东分公司 |

### 产品数据

共30个产品，包括：
- 千张系列（标准型、精品型、有机型等）
- 豆腐干系列（原味、五香、麻辣等）
- 其他豆制品（豆腐皮、腐竹、豆浆粉、豆奶等）

价格范围: 45元 - 220元/箱

---

## 🔄 重置环境

如果需要完全重置环境：

```bash
# 1. 停止并删除所有容器和数据
docker compose down -v

# 2. 重新启动容器
docker compose up -d

# 3. 等待服务就绪
sleep 30

# 4. 重新初始化
cd backend
npm run db:sync
npm run seed

# 5. 启动应用
npm run start:dev
```

---

## 🎯 下一步

环境启动成功后，可以：

1. **开发新功能**: 在 `backend/src` 目录下开发
2. **运行测试**: `npm run test:e2e`
3. **查看API文档**: http://localhost:3000/api-docs
4. **管理数据库**: http://localhost:8080 (phpMyAdmin，需要启动tools profile)
5. **管理Redis**: http://localhost:8081 (Redis Commander，需要启动tools profile)

### 启动管理工具

```bash
# 启动phpMyAdmin和Redis Commander
docker compose --profile tools up -d

# 访问
# phpMyAdmin: http://localhost:8080
# Redis Commander: http://localhost:8081
```

---

## 📝 常用命令

```bash
# 查看所有容器状态
docker compose ps

# 查看容器日志
docker compose logs -f mysql
docker compose logs -f redis

# 重启容器
docker compose restart mysql
docker compose restart redis

# 进入MySQL容器
docker compose exec mysql mysql -u qianzhang -ppassword qianzhang_sales_dev

# 进入Redis容器
docker compose exec redis redis-cli -a redis_password

# 备份数据库
docker compose exec mysql mysqldump -u qianzhang -ppassword qianzhang_sales_dev > backup.sql

# 恢复数据库
docker compose exec -T mysql mysql -u qianzhang -ppassword qianzhang_sales_dev < backup.sql
```

---

## 🔗 相关文档

- [Docker Compose配置](../../docker-compose.yml)
- [环境变量配置](.env.example)
- [Seed数据脚本](../scripts/seed.ts)
- [冒烟测试脚本](../scripts/smoke-ar.sh)
- [主干回归验收报告模板](../../MAIN_BRANCH_REGRESSION_REPORT_TEMPLATE.md)

---

**文档更新时间**: 2024-01-29  
**维护人**: Manus AI Agent
