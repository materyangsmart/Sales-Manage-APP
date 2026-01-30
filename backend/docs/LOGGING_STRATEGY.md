# 日志策略文档

本文档定义千张销售管理系统的日志记录策略，包括日志分类、结构、存储和查询方法。

---

## 📋 日志分类

系统日志分为三大类：

### 1. 应用日志（Application Logs）
记录应用程序的运行状态、错误和调试信息。

**用途**:
- 调试应用问题
- 监控应用健康状态
- 性能分析

**日志级别**:
- `ERROR`: 错误信息（数据库连接失败、API调用失败等）
- `WARN`: 警告信息（性能下降、配置问题等）
- `INFO`: 一般信息（服务启动、配置加载等）
- `DEBUG`: 调试信息（仅开发环境）

### 2. 业务日志（Business Logs）
记录业务操作和流程，用于业务分析和问题追踪。

**用途**:
- 业务流程追踪
- 数据分析
- 合规审计

**示例**:
- 订单创建、审核、履行
- 发票生成
- 收款记录
- 核销操作

### 3. 审计日志（Audit Logs）
记录所有数据变更操作，用于安全审计和合规要求。

**用途**:
- 安全审计
- 合规要求
- 数据追溯

**内容**:
- 操作人（userId）
- 操作时间（timestamp）
- 操作类型（action）
- 资源类型（resourceType）
- 资源ID（resourceId）
- 变更内容（changes）

---

## 🔍 日志结构

### 应用日志结构

```json
{
  "timestamp": "2026-01-29T12:00:00.000Z",
  "level": "ERROR",
  "context": "OrderService",
  "message": "Failed to create order",
  "error": {
    "name": "DatabaseError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at ..."
  },
  "metadata": {
    "userId": 123,
    "orderId": 456,
    "customerId": 789
  }
}
```

### 业务日志结构

```json
{
  "timestamp": "2026-01-29T12:00:00.000Z",
  "type": "ORDER_CREATED",
  "userId": 123,
  "userName": "张三",
  "data": {
    "orderId": 456,
    "customerId": 789,
    "totalAmount": 1000.00,
    "status": "PENDING_REVIEW"
  }
}
```

### 审计日志结构（已在数据库中）

```sql
CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_name VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INT NOT NULL,
  changes JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📝 日志记录规范

### 应用日志记录

#### NestJS内置Logger

```typescript
import { Logger } from '@nestjs/common';

export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async createOrder(dto: CreateOrderDto) {
    try {
      this.logger.log(`Creating order for customer ${dto.customerId}`);
      
      // 业务逻辑...
      
      this.logger.log(`Order created successfully: ${order.id}`);
      return order;
    } catch (error) {
      this.logger.error(
        `Failed to create order for customer ${dto.customerId}`,
        error.stack,
      );
      throw error;
    }
  }
}
```

#### 关键错误日志

```typescript
// 数据库错误
this.logger.error('Database connection failed', error.stack);

// API调用失败
this.logger.error(`External API call failed: ${apiUrl}`, error.stack);

// 业务逻辑错误
this.logger.warn(`Order ${orderId} is already fulfilled`);
```

### 业务日志记录

业务日志通过审计日志表记录，无需单独记录。

### 审计日志记录

```typescript
// 在Service中记录审计日志
await this.auditLogRepository.save({
  userId: user.id,
  userName: user.name,
  action: 'CREATE',
  resourceType: 'ORDER',
  resourceId: order.id,
  changes: {
    status: 'PENDING_REVIEW',
    totalAmount: order.totalAmount,
  },
});
```

---

## 📂 日志存储

### 开发环境

**输出位置**: 控制台（stdout/stderr）

**配置**: 无需特殊配置，NestJS默认输出到控制台

### 生产环境（使用PM2）

**输出位置**: 
- 标准输出: `~/.pm2/logs/qianzhang-backend-out.log`
- 错误输出: `~/.pm2/logs/qianzhang-backend-error.log`

**日志轮转配置**:

```bash
# 安装PM2日志轮转模块
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 50M        # 单个日志文件最大50MB
pm2 set pm2-logrotate:retain 30           # 保留30个日志文件
pm2 set pm2-logrotate:compress true       # 压缩旧日志
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss  # 日期格式
pm2 set pm2-logrotate:rotateModule true   # 轮转PM2模块日志
```

**查看日志**:

```bash
# 实时查看日志
pm2 logs qianzhang-backend

# 查看最近100行日志
pm2 logs qianzhang-backend --lines 100

# 只查看错误日志
pm2 logs qianzhang-backend --err

# 清空日志
pm2 flush qianzhang-backend
```

### 审计日志存储

**存储位置**: MySQL数据库 `audit_logs` 表

**保留策略**: 
- 保留所有审计日志（不删除）
- 定期归档到冷存储（如S3）
- 建议每年归档一次

**归档脚本**:

```bash
#!/bin/bash
# 归档去年的审计日志

YEAR=$(date -d "last year" +%Y)
BACKUP_FILE="/var/backups/mysql/audit_logs_${YEAR}.sql.gz"

# 导出去年的审计日志
mysqldump --defaults-file=~/.my.cnf \
  --single-transaction \
  --where="YEAR(created_at) = $YEAR" \
  qianzhang_sales audit_logs \
  | gzip > "$BACKUP_FILE"

echo "审计日志已归档到: $BACKUP_FILE"

# 可选：删除已归档的数据（谨慎操作！）
# mysql -h 127.0.0.1 -P 3306 -u root -p -e \
#   "DELETE FROM qianzhang_sales.audit_logs WHERE YEAR(created_at) = $YEAR;"
```

---

## 🔎 日志查询

### 应用日志查询

#### 使用PM2查询

```bash
# 查看实时日志
pm2 logs qianzhang-backend

# 查看最近的错误日志
pm2 logs qianzhang-backend --err --lines 50

# 搜索特定关键词
pm2 logs qianzhang-backend | grep "ERROR"
pm2 logs qianzhang-backend | grep "OrderService"
```

#### 使用grep查询历史日志

```bash
# 查找包含"ERROR"的日志
grep "ERROR" ~/.pm2/logs/qianzhang-backend-out.log

# 查找特定时间段的日志
grep "2026-01-29" ~/.pm2/logs/qianzhang-backend-out.log

# 统计错误数量
grep -c "ERROR" ~/.pm2/logs/qianzhang-backend-out.log

# 查找并显示上下文（前后5行）
grep -A 5 -B 5 "Failed to create order" ~/.pm2/logs/qianzhang-backend-out.log
```

### 审计日志查询

#### 通过API查询

```bash
# 查询所有审计日志
curl -H "x-internal-token: your-token" \
  "http://localhost:3000/audit-logs"

# 按资源类型过滤
curl -H "x-internal-token: your-token" \
  "http://localhost:3000/audit-logs?resourceType=ORDER"

# 按操作类型过滤
curl -H "x-internal-token: your-token" \
  "http://localhost:3000/audit-logs?action=CREATE"

# 追踪特定资源
curl -H "x-internal-token: your-token" \
  "http://localhost:3000/audit-logs/trace/ORDER/123"
```

#### 通过SQL查询

```sql
-- 查询最近100条审计日志
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 100;

-- 查询特定用户的操作
SELECT * FROM audit_logs 
WHERE user_id = 123 
ORDER BY created_at DESC;

-- 查询特定资源的所有操作
SELECT * FROM audit_logs 
WHERE resource_type = 'ORDER' AND resource_id = 456 
ORDER BY created_at ASC;

-- 统计每个用户的操作次数
SELECT user_id, user_name, COUNT(*) as operation_count 
FROM audit_logs 
GROUP BY user_id, user_name 
ORDER BY operation_count DESC;

-- 查询最近24小时的操作
SELECT * FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL 24 HOUR 
ORDER BY created_at DESC;
```

---

## 🚨 关键错误日志监控

### 需要立即关注的错误

1. **数据库连接失败**
   ```
   ERROR [TypeOrmModule] Unable to connect to the database
   ```

2. **API调用失败**
   ```
   ERROR [OrderService] External API call failed
   ```

3. **内存不足**
   ```
   ERROR [NestApplication] JavaScript heap out of memory
   ```

4. **未捕获的异常**
   ```
   ERROR [ExceptionsHandler] Unhandled exception
   ```

### 监控脚本

```bash
#!/bin/bash
# 监控关键错误日志

LOG_FILE="$HOME/.pm2/logs/qianzhang-backend-error.log"
ALERT_EMAIL="admin@example.com"

# 检查是否有新的错误
if tail -n 100 "$LOG_FILE" | grep -q "Unable to connect to the database"; then
    echo "数据库连接失败！" | mail -s "【紧急】数据库连接失败" "$ALERT_EMAIL"
fi

if tail -n 100 "$LOG_FILE" | grep -q "JavaScript heap out of memory"; then
    echo "内存不足！" | mail -s "【紧急】内存不足" "$ALERT_EMAIL"
fi
```

**配置定时检查**:

```bash
# 编辑crontab
crontab -e

# 每5分钟检查一次
*/5 * * * * /usr/local/bin/monitor_errors.sh
```

---

## 📊 日志分析建议

### 1. 性能分析

查找慢操作：

```bash
# 查找耗时超过1秒的操作
grep "took [0-9]\{4,\}ms" ~/.pm2/logs/qianzhang-backend-out.log
```

### 2. 错误趋势分析

统计每小时的错误数量：

```bash
# 按小时统计错误数量
grep "ERROR" ~/.pm2/logs/qianzhang-backend-error.log | \
  awk '{print $1" "$2}' | \
  cut -d: -f1 | \
  sort | \
  uniq -c
```

### 3. 用户行为分析

通过审计日志分析用户行为：

```sql
-- 查询最活跃的用户
SELECT user_id, user_name, COUNT(*) as action_count 
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL 7 DAY 
GROUP BY user_id, user_name 
ORDER BY action_count DESC 
LIMIT 10;

-- 查询最常见的操作
SELECT action, COUNT(*) as count 
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL 7 DAY 
GROUP BY action 
ORDER BY count DESC;
```

---

## 🔧 日志配置优化

### 生产环境配置

在 `.env` 文件中配置：

```env
# 日志级别（production环境建议使用info）
LOG_LEVEL=info

# 是否启用详细日志（仅开发环境）
DB_LOGGING=false

# 是否启用SQL查询日志（性能调试时开启）
DB_QUERY_LOGGING=false
```

### NestJS日志配置

在 `main.ts` 中配置：

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']  // 生产环境：只记录错误、警告和一般信息
      : ['error', 'warn', 'log', 'debug', 'verbose'],  // 开发环境：记录所有级别
  });

  await app.listen(3000);
  Logger.log(`Application is running on: http://localhost:3000`, 'Bootstrap');
}
bootstrap();
```

---

## 📦 日志聚合（高级）

对于大规模部署，建议使用日志聚合工具：

### 选项1：ELK Stack（Elasticsearch + Logstash + Kibana）

**优点**:
- 强大的搜索和分析能力
- 可视化仪表板
- 实时监控

**缺点**:
- 资源消耗较大
- 配置复杂

### 选项2：Grafana Loki

**优点**:
- 轻量级
- 与Grafana无缝集成
- 成本较低

**缺点**:
- 功能相对简单

### 选项3：云服务（AWS CloudWatch、阿里云日志服务）

**优点**:
- 托管服务，无需维护
- 与云平台集成

**缺点**:
- 需要额外费用

---

## ✅ 日志管理清单

定期检查以下项目：

- [ ] 应用日志正常输出
- [ ] 错误日志及时查看和处理
- [ ] PM2日志轮转正常工作
- [ ] 审计日志正常记录
- [ ] 日志文件大小合理（不超过配置的最大值）
- [ ] 磁盘空间充足（日志目录）
- [ ] 关键错误监控脚本正常运行
- [ ] 日志归档按计划执行

---

## 📞 支持

如遇到日志相关问题，请参考：
- [部署文档](./DEPLOY_STAGING.md)
- [MySQL备份方案文档](./MYSQL_BACKUP_STRATEGY.md)

或联系系统管理员。

---

**良好的日志是问题排查的第一步！** 📝
