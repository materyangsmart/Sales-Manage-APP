# 千张销售管理系统 - 部署文档（Staging环境）

本文档详细说明如何在新机器上部署千张销售管理系统的Staging环境。

---

## 📋 前置要求

### 系统要求
- **操作系统**: Ubuntu 22.04 LTS 或更高版本
- **内存**: 最少 2GB RAM
- **磁盘空间**: 最少 10GB 可用空间
- **网络**: 可访问互联网

### 软件要求
- Docker 20.10+ 和 Docker Compose 2.0+
- Node.js 18+ 和 npm 8+
- Git

---

## 🚀 快速部署（30分钟内完成）

### 第一步：安装Docker和Docker Compose

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 将当前用户添加到docker组（避免每次使用sudo）
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version

# 重新登录以使docker组生效
# 或者运行: newgrp docker
```

### 第二步：安装Node.js和npm

```bash
# 安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

### 第三步：克隆代码仓库

```bash
# 克隆仓库
git clone https://github.com/materyangsmart/Sales-Manage-APP.git
cd Sales-Manage-APP

# 切换到main分支
git checkout main
git pull origin main
```

### 第四步：启动基础服务（MySQL + Redis）

```bash
# 启动Docker Compose服务
docker-compose up -d

# 等待服务启动（约30秒）
sleep 30

# 验证服务状态
docker-compose ps

# 预期输出：
# NAME                IMAGE               STATUS
# mysql               mysql:8.0           Up
# redis               redis:7-alpine      Up
```

### 第五步：配置Backend环境变量

```bash
# 进入backend目录
cd backend

# 复制环境变量模板
cp .env.example .env

# 编辑.env文件（使用你喜欢的编辑器）
nano .env
```

**重要配置项**（其他保持默认即可）：

```env
# 数据库配置（与docker-compose.yml保持一致）
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=qianzhang_password
DB_DATABASE=qianzhang_sales

# JWT密钥（生产环境请使用强密码）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 服务端口
PORT=3000

# 环境
NODE_ENV=staging
```

### 第六步：安装依赖并初始化数据库

```bash
# 安装npm依赖
npm install

# 同步数据库结构
npm run db:sync

# 预期输出：
# Database synchronized successfully
# Tables created: customers, products, orders, order_items, ar_invoices, ar_payments, ar_payment_applications, audit_logs

# 初始化种子数据
npm run seed

# 预期输出：
# Seed data inserted successfully
# - 3 customers
# - 20 products
# - Organization: 千张销售公司 (orgId=2)
```

### 第七步：启动Backend服务

```bash
# 启动应用（开发模式）
npm run start:dev

# 或者启动应用（生产模式）
# npm run build
# npm run start:prod
```

**等待启动完成**（约10-15秒），看到以下输出表示成功：

```
[Nest] 12345  - 01/29/2026, 12:00:00 PM     LOG [NestApplication] Nest application successfully started
[Nest] 12345  - 01/29/2026, 12:00:00 PM     LOG [NestApplication] Application is running on: http://localhost:3000
```

### 第八步：验证部署

打开新的终端窗口，运行以下命令：

```bash
cd /path/to/Sales-Manage-APP/backend

# 1. 检查进程存活
curl http://localhost:3000/health

# 预期输出：
# {"status":"ok","timestamp":"2026-01-29T12:00:00.000Z","uptime":123.45,"message":"Service is running"}

# 2. 检查服务就绪（数据库连接）
curl http://localhost:3000/health/ready

# 预期输出：
# {"status":"ready","timestamp":"2026-01-29T12:00:00.000Z","checks":{"database":true},"message":"Service is ready"}

# 3. 访问Swagger API文档
curl http://localhost:3000/api-docs

# 或在浏览器中打开：http://localhost:3000/api-docs

# 4. 运行冒烟测试
npm run smoke:ar

# 预期输出：17个测试全部通过
```

---

## 🔍 健康检查端点

系统提供两个健康检查端点用于监控：

### 1. 进程存活检查：`GET /health`

**用途**: 检查应用进程是否正常运行

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "uptime": 123.45,
  "message": "Service is running"
}
```

**使用场景**: 
- 负载均衡器的健康检查
- 进程监控工具（如Supervisor、PM2）

### 2. 服务就绪检查：`GET /health/ready`

**用途**: 检查应用是否已就绪（数据库连接正常）

**响应示例（就绪）**:
```json
{
  "status": "ready",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "checks": {
    "database": true
  },
  "message": "Service is ready"
}
```

**响应示例（未就绪）**:
```json
{
  "status": "not ready",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "checks": {
    "database": false
  },
  "message": "Service is not ready"
}
```
**HTTP状态码**: 503 Service Unavailable

**使用场景**:
- Kubernetes readiness probe
- 部署流程中的就绪检查
- 数据库维护期间的流量切换

---

## 🛠️ 常见问题排查

### 问题1：Docker服务无法启动

**症状**: `docker-compose up -d` 失败

**排查步骤**:
```bash
# 检查Docker服务状态
sudo systemctl status docker

# 如果未运行，启动Docker
sudo systemctl start docker

# 查看Docker日志
sudo journalctl -u docker -n 50
```

### 问题2：数据库连接失败

**症状**: `/health/ready` 返回 `database: false`

**排查步骤**:
```bash
# 检查MySQL容器状态
docker-compose ps mysql

# 查看MySQL日志
docker-compose logs mysql

# 测试数据库连接
mysql -h 127.0.0.1 -P 3306 -u root -p
# 输入密码：qianzhang_password

# 如果无法连接，重启MySQL容器
docker-compose restart mysql
```

### 问题3：端口已被占用

**症状**: 启动应用时报错 `Error: listen EADDRINUSE: address already in use :::3000`

**排查步骤**:
```bash
# 查找占用3000端口的进程
lsof -i :3000

# 或者使用netstat
netstat -tulnp | grep 3000

# 杀死占用端口的进程
kill -9 <PID>

# 或者修改.env中的PORT配置
```

### 问题4：npm install失败

**症状**: 依赖安装过程中报错

**排查步骤**:
```bash
# 清理npm缓存
npm cache clean --force

# 删除node_modules和package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 如果仍然失败，尝试使用国内镜像
npm config set registry https://registry.npmmirror.com
npm install
```

---

## 📊 监控建议

### 1. 进程监控

使用PM2管理Node.js进程（生产环境推荐）：

```bash
# 安装PM2
npm install -g pm2

# 使用PM2启动应用
pm2 start npm --name "qianzhang-backend" -- run start:prod

# 设置开机自启动
pm2 startup
pm2 save

# 查看进程状态
pm2 status

# 查看日志
pm2 logs qianzhang-backend
```

### 2. 数据库监控

定期检查数据库连接数和性能：

```bash
# 连接到MySQL
mysql -h 127.0.0.1 -P 3306 -u root -p

# 查看当前连接数
SHOW STATUS LIKE 'Threads_connected';

# 查看最大连接数
SHOW VARIABLES LIKE 'max_connections';

# 查看慢查询
SHOW VARIABLES LIKE 'slow_query_log';
```

### 3. 日志监控

应用日志位置：
- **开发模式**: 控制台输出
- **生产模式（PM2）**: `~/.pm2/logs/qianzhang-backend-out.log` 和 `~/.pm2/logs/qianzhang-backend-error.log`

建议使用日志聚合工具（如ELK Stack、Grafana Loki）进行集中管理。

---

## 🔄 更新部署

当代码有更新时，按以下步骤重新部署：

```bash
# 1. 停止应用
pm2 stop qianzhang-backend
# 或者如果是开发模式，按Ctrl+C停止

# 2. 拉取最新代码
cd /path/to/Sales-Manage-APP
git pull origin main

# 3. 更新依赖
cd backend
npm install

# 4. 同步数据库（如果有schema变更）
npm run db:sync

# 5. 重新启动应用
pm2 restart qianzhang-backend
# 或者开发模式：npm run start:dev
```

---

## 🔐 安全建议

1. **修改默认密码**: 
   - MySQL root密码（docker-compose.yml）
   - JWT_SECRET（.env）

2. **配置防火墙**:
   ```bash
   # 只允许必要的端口
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 3000/tcp  # Backend API
   sudo ufw enable
   ```

3. **使用HTTPS**: 
   - 在生产环境中使用Nginx作为反向代理
   - 配置SSL证书（Let's Encrypt）

4. **定期更新**:
   - 定期更新系统包：`sudo apt update && sudo apt upgrade`
   - 定期更新Docker镜像：`docker-compose pull && docker-compose up -d`

---

## 📞 支持

如遇到问题，请查看：
- [MySQL备份方案文档](./MYSQL_BACKUP_STRATEGY.md)
- [日志策略文档](./LOGGING_STRATEGY.md)
- [本地启动文档](./LOCAL_BOOTSTRAP.md)

或联系技术支持团队。

---

**部署完成！** 🎉

系统现在应该已经在 `http://localhost:3000` 上运行。
