#!/bin/sh
# ============================================================
# 千张销售管理系统 - 生产环境启动入口脚本
# 功能：数据库迁移 → 种子数据（可选）→ 启动服务
# ============================================================

set -e

echo "========================================"
echo "  千张销售管理系统 - 启动中..."
echo "========================================"

# ---- Step 1: 数据库迁移（Drizzle Kit Push）----
# 仅在 RUN_DB_PUSH=true 时执行
if [ "$RUN_DB_PUSH" = "true" ]; then
  echo "[1/3] 执行数据库迁移 (drizzle-kit push)..."
  pnpm exec drizzle-kit push --force || {
    echo "[ERROR] 数据库迁移失败，但继续启动服务"
  }
  echo "[1/3] 数据库迁移完成"
else
  echo "[1/3] 跳过数据库迁移 (RUN_DB_PUSH != true)"
fi

# ---- Step 2: 种子数据（可选）----
# 仅在 RUN_SEED=true 时执行
if [ "$RUN_SEED" = "true" ]; then
  echo "[2/3] 执行种子数据初始化..."
  if [ -f "./scripts/seed-600m-revenue.sql" ]; then
    echo "  发现 seed-600m-revenue.sql，使用 mysql 客户端导入..."
    # 如果容器内有 mysql 客户端
    if command -v mysql > /dev/null 2>&1; then
      mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_NAME" < ./scripts/seed-600m-revenue.sql || {
        echo "[WARN] SQL 种子数据导入失败"
      }
    else
      echo "[WARN] 容器内无 mysql 客户端，跳过 SQL 种子导入"
      echo "  请手动执行: mysql -h <host> -u <user> -p <db> < scripts/seed-600m-revenue.sql"
    fi
  fi
  echo "[2/3] 种子数据处理完成"
else
  echo "[2/3] 跳过种子数据 (RUN_SEED != true)"
fi

# ---- Step 3: 启动 Node.js 服务 ----
echo "[3/3] 启动 Node.js 生产服务..."
echo "  PORT: ${PORT:-3000}"
echo "  NODE_ENV: ${NODE_ENV:-production}"
echo "========================================"

exec node dist/index.js
