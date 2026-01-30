# MySQL 备份与恢复方案

本文档详细说明千张销售管理系统的MySQL数据库备份策略、备份命令、保留策略和恢复演练步骤。

---

## 📋 备份策略概览

### 备份类型
- **全量备份**: 每天凌晨2点执行
- **增量备份**: 每6小时执行一次（可选，适用于高频变更场景）
- **手动备份**: 重大操作前手动执行

### 保留策略
- **每日备份**: 保留最近7天
- **每周备份**: 保留最近4周（每周日的备份）
- **每月备份**: 保留最近12个月（每月1号的备份）

### 备份存储位置
- **本地存储**: `/var/backups/mysql/`
- **远程存储**: 建议同步到云存储（如AWS S3、阿里云OSS）

---

## 🔧 准备工作

### 1. 创建备份目录

```bash
# 创建备份目录
sudo mkdir -p /var/backups/mysql

# 设置权限
sudo chown $USER:$USER /var/backups/mysql
chmod 700 /var/backups/mysql
```

### 2. 创建备份用户（可选但推荐）

```bash
# 连接到MySQL
mysql -h 127.0.0.1 -P 3306 -u root -p

# 创建备份专用用户
CREATE USER 'backup_user'@'localhost' IDENTIFIED BY 'strong_backup_password';

# 授予必要权限
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON *.* TO 'backup_user'@'localhost';

# 刷新权限
FLUSH PRIVILEGES;

# 退出
EXIT;
```

### 3. 创建MySQL配置文件（避免密码明文）

```bash
# 创建配置文件
nano ~/.my.cnf
```

**内容**（根据实际情况修改）：

```ini
[client]
user=backup_user
password=strong_backup_password
host=127.0.0.1
port=3306
```

**设置权限**：

```bash
chmod 600 ~/.my.cnf
```

---

## 💾 备份命令

### 方法1：使用mysqldump（推荐）

#### 全量备份单个数据库

```bash
# 备份qianzhang_sales数据库
mysqldump --defaults-file=~/.my.cnf \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --databases qianzhang_sales \
  | gzip > /var/backups/mysql/qianzhang_sales_$(date +%Y%m%d_%H%M%S).sql.gz

# 说明：
# --single-transaction: 保证备份一致性（InnoDB表）
# --routines: 备份存储过程和函数
# --triggers: 备份触发器
# --events: 备份事件
# --databases: 指定数据库名称
# | gzip: 压缩备份文件
```

#### 全量备份所有数据库

```bash
# 备份所有数据库
mysqldump --defaults-file=~/.my.cnf \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --all-databases \
  | gzip > /var/backups/mysql/all_databases_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### 备份特定表

```bash
# 备份特定表（例如：customers和orders）
mysqldump --defaults-file=~/.my.cnf \
  --single-transaction \
  qianzhang_sales customers orders \
  | gzip > /var/backups/mysql/customers_orders_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 方法2：使用物理备份（适用于大型数据库）

```bash
# 安装Percona XtraBackup
sudo apt install percona-xtrabackup-80 -y

# 执行物理备份
xtrabackup --defaults-file=~/.my.cnf \
  --backup \
  --target-dir=/var/backups/mysql/xtrabackup_$(date +%Y%m%d_%H%M%S)
```

---

## 🤖 自动化备份脚本

### 创建备份脚本

```bash
# 创建脚本文件
nano /usr/local/bin/mysql_backup.sh
```

**脚本内容**：

```bash
#!/bin/bash

# MySQL备份脚本
# 作者: 千张销售管理系统团队
# 日期: 2026-01-29

# 配置变量
BACKUP_DIR="/var/backups/mysql"
DB_NAME="qianzhang_sales"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 开始备份
log "开始备份数据库: $DB_NAME"

# 执行备份
if mysqldump --defaults-file=~/.my.cnf \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --databases "$DB_NAME" \
    | gzip > "$BACKUP_FILE"; then
    
    log "备份成功: $BACKUP_FILE"
    
    # 获取备份文件大小
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "备份文件大小: $BACKUP_SIZE"
    
    # 标记特殊备份（周备份和月备份）
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        # 周日的备份，复制一份作为周备份
        WEEKLY_BACKUP="${BACKUP_DIR}/weekly_${DB_NAME}_${DATE}.sql.gz"
        cp "$BACKUP_FILE" "$WEEKLY_BACKUP"
        log "创建周备份: $WEEKLY_BACKUP"
    fi
    
    if [ "$DAY_OF_MONTH" -eq "01" ]; then
        # 每月1号的备份，复制一份作为月备份
        MONTHLY_BACKUP="${BACKUP_DIR}/monthly_${DB_NAME}_${DATE}.sql.gz"
        cp "$BACKUP_FILE" "$MONTHLY_BACKUP"
        log "创建月备份: $MONTHLY_BACKUP"
    fi
    
else
    log "备份失败！"
    exit 1
fi

# 清理旧备份（保留策略）
log "开始清理旧备份..."

# 删除7天前的每日备份
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +7 -delete
log "已删除7天前的每日备份"

# 删除4周前的周备份
find "$BACKUP_DIR" -name "weekly_${DB_NAME}_*.sql.gz" -type f -mtime +28 -delete
log "已删除4周前的周备份"

# 删除12个月前的月备份
find "$BACKUP_DIR" -name "monthly_${DB_NAME}_*.sql.gz" -type f -mtime +365 -delete
log "已删除12个月前的月备份"

log "备份完成！"
```

**设置权限**：

```bash
# 添加执行权限
sudo chmod +x /usr/local/bin/mysql_backup.sh

# 测试脚本
/usr/local/bin/mysql_backup.sh
```

### 配置定时任务（Cron）

```bash
# 编辑crontab
crontab -e
```

**添加以下行**：

```cron
# 每天凌晨2点执行全量备份
0 2 * * * /usr/local/bin/mysql_backup.sh >> /var/backups/mysql/cron.log 2>&1

# 每6小时执行一次备份（可选）
# 0 */6 * * * /usr/local/bin/mysql_backup.sh >> /var/backups/mysql/cron.log 2>&1
```

**验证cron任务**：

```bash
# 查看已配置的cron任务
crontab -l

# 查看cron日志
tail -f /var/backups/mysql/cron.log
```

---

## 🔄 恢复演练

### 场景1：恢复整个数据库

```bash
# 1. 列出可用的备份文件
ls -lh /var/backups/mysql/qianzhang_sales_*.sql.gz

# 2. 选择要恢复的备份文件（例如最新的备份）
BACKUP_FILE="/var/backups/mysql/qianzhang_sales_20260129_020000.sql.gz"

# 3. 停止应用（避免数据冲突）
pm2 stop qianzhang-backend
# 或者如果是开发模式，按Ctrl+C停止

# 4. 删除现有数据库（可选，谨慎操作！）
mysql -h 127.0.0.1 -P 3306 -u root -p -e "DROP DATABASE IF EXISTS qianzhang_sales;"

# 5. 恢复数据库
zcat "$BACKUP_FILE" | mysql -h 127.0.0.1 -P 3306 -u root -p

# 6. 验证恢复结果
mysql -h 127.0.0.1 -P 3306 -u root -p -e "USE qianzhang_sales; SHOW TABLES;"

# 7. 重启应用
pm2 start qianzhang-backend
```

### 场景2：恢复特定表

```bash
# 1. 解压备份文件到临时文件
BACKUP_FILE="/var/backups/mysql/qianzhang_sales_20260129_020000.sql.gz"
zcat "$BACKUP_FILE" > /tmp/qianzhang_sales_restore.sql

# 2. 提取特定表的SQL（例如：customers表）
sed -n '/CREATE TABLE `customers`/,/UNLOCK TABLES;/p' /tmp/qianzhang_sales_restore.sql > /tmp/customers_restore.sql

# 3. 恢复特定表
mysql -h 127.0.0.1 -P 3306 -u root -p qianzhang_sales < /tmp/customers_restore.sql

# 4. 清理临时文件
rm /tmp/qianzhang_sales_restore.sql /tmp/customers_restore.sql
```

### 场景3：恢复到新数据库（测试恢复）

```bash
# 1. 创建新数据库
mysql -h 127.0.0.1 -P 3306 -u root -p -e "CREATE DATABASE qianzhang_sales_restore;"

# 2. 恢复到新数据库
BACKUP_FILE="/var/backups/mysql/qianzhang_sales_20260129_020000.sql.gz"
zcat "$BACKUP_FILE" | sed 's/qianzhang_sales/qianzhang_sales_restore/g' | mysql -h 127.0.0.1 -P 3306 -u root -p

# 3. 验证恢复结果
mysql -h 127.0.0.1 -P 3306 -u root -p -e "USE qianzhang_sales_restore; SELECT COUNT(*) FROM customers;"

# 4. 测试完成后删除测试数据库
# mysql -h 127.0.0.1 -P 3306 -u root -p -e "DROP DATABASE qianzhang_sales_restore;"
```

---

## 📊 恢复演练记录表

建议每季度执行一次恢复演练，并记录结果：

| 日期 | 操作人 | 备份文件 | 恢复场景 | 恢复时间 | 结果 | 备注 |
|------|--------|----------|----------|----------|------|------|
| 2026-01-29 | 张三 | qianzhang_sales_20260129_020000.sql.gz | 完整恢复 | 5分钟 | 成功 | 首次演练 |
| 2026-04-15 | 李四 | qianzhang_sales_20260415_020000.sql.gz | 特定表恢复 | 2分钟 | 成功 | 恢复customers表 |
| 2026-07-20 | 王五 | qianzhang_sales_20260720_020000.sql.gz | 完整恢复 | 6分钟 | 成功 | 季度演练 |

**演练步骤**：

1. 选择最近的备份文件
2. 恢复到测试数据库
3. 验证数据完整性
4. 记录恢复时间和结果
5. 清理测试数据库

---

## 🚨 紧急恢复流程

当生产数据库出现严重问题时，按以下流程执行紧急恢复：

### 1. 评估情况
- 确认数据损坏程度
- 确定是否需要完全恢复
- 通知相关人员

### 2. 停止服务
```bash
# 停止应用
pm2 stop qianzhang-backend

# 停止MySQL（如果需要）
docker-compose stop mysql
```

### 3. 备份当前状态（即使已损坏）
```bash
# 备份当前数据库（用于事后分析）
mysqldump --defaults-file=~/.my.cnf \
  --single-transaction \
  --databases qianzhang_sales \
  | gzip > /var/backups/mysql/emergency_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 4. 执行恢复
```bash
# 使用最近的可用备份
BACKUP_FILE=$(ls -t /var/backups/mysql/qianzhang_sales_*.sql.gz | head -1)
echo "使用备份文件: $BACKUP_FILE"

# 恢复数据库
zcat "$BACKUP_FILE" | mysql -h 127.0.0.1 -P 3306 -u root -p
```

### 5. 验证恢复
```bash
# 检查表数量
mysql -h 127.0.0.1 -P 3306 -u root -p -e "USE qianzhang_sales; SHOW TABLES;"

# 检查关键表的记录数
mysql -h 127.0.0.1 -P 3306 -u root -p -e "
USE qianzhang_sales;
SELECT 'customers' AS table_name, COUNT(*) AS count FROM customers
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'ar_invoices', COUNT(*) FROM ar_invoices;
"
```

### 6. 重启服务
```bash
# 启动MySQL（如果已停止）
docker-compose start mysql

# 等待MySQL就绪
sleep 10

# 启动应用
pm2 start qianzhang-backend

# 验证健康检查
curl http://localhost:3000/health/ready
```

### 7. 通知用户
- 通知相关人员恢复完成
- 说明数据恢复到的时间点
- 记录事故和恢复过程

---

## 📦 远程备份（推荐）

### 使用rsync同步到远程服务器

```bash
# 安装rsync
sudo apt install rsync -y

# 同步到远程服务器
rsync -avz --delete \
  /var/backups/mysql/ \
  user@backup-server:/path/to/remote/backups/
```

### 使用云存储（AWS S3示例）

```bash
# 安装AWS CLI
sudo apt install awscli -y

# 配置AWS凭证
aws configure

# 上传备份到S3
aws s3 sync /var/backups/mysql/ s3://your-bucket-name/mysql-backups/
```

### 自动化远程备份

在备份脚本末尾添加：

```bash
# 同步到远程服务器
log "开始同步到远程服务器..."
rsync -avz --delete /var/backups/mysql/ user@backup-server:/path/to/remote/backups/
log "远程同步完成"
```

---

## ✅ 备份验证清单

定期检查以下项目：

- [ ] 备份脚本正常执行（检查cron日志）
- [ ] 备份文件正常生成（检查备份目录）
- [ ] 备份文件大小合理（不应为0或异常小）
- [ ] 保留策略正常工作（旧备份被正确删除）
- [ ] 远程备份正常同步（如果配置）
- [ ] 恢复演练成功（每季度一次）
- [ ] 备份用户权限正常
- [ ] 磁盘空间充足（至少保留20%空闲空间）

---

## 📞 支持

如遇到备份或恢复问题，请参考：
- [部署文档](./DEPLOY_STAGING.md)
- [日志策略文档](./LOGGING_STRATEGY.md)

或联系数据库管理员。

---

**记住：备份不是目的，能够成功恢复才是！** 🔐
