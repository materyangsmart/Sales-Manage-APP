# ============================================================
# 千张销售管理系统 - 后端 Dockerfile
# 构建策略：esbuild 打包（与开发环境一致，避免 tsc TS5096 死锁）
# ============================================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 1) 先复制依赖描述文件 + patches（pnpm install 需要 patches）
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# 2) 安装全部依赖（含 devDependencies，用于 esbuild / vite / drizzle-kit）
RUN pnpm install --frozen-lockfile

# 3) 复制所有源代码
COPY server/        ./server/
COPY shared/        ./shared/
COPY drizzle/       ./drizzle/
COPY client/        ./client/
COPY scripts/       ./scripts/
COPY vite.config.ts ./
COPY tsconfig.json  ./
COPY drizzle.config.ts ./

# 4) 使用 esbuild 打包后端（与 package.json "build" 脚本一致）
RUN pnpm exec vite build && \
    pnpm exec esbuild server/_core/index.ts \
      --platform=node \
      --packages=external \
      --bundle \
      --format=esm \
      --outdir=dist

# ---- Stage 2: Production ----
FROM node:22-alpine AS production
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 安全：创建非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 1) 复制依赖文件 + patches
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# 2) 安装全部依赖（生产阶段需要 drizzle-kit、tsx 等 devDeps 用于运维）
RUN pnpm install --frozen-lockfile && \
    pnpm store prune

# 3) 从构建阶段复制编译产物
COPY --from=builder /app/dist ./dist

# 4) 复制运维必需文件
COPY drizzle/          ./drizzle/
COPY drizzle.config.ts ./
COPY scripts/          ./scripts/
COPY shared/           ./shared/
COPY server/           ./server/
COPY tsconfig.json     ./

# 5) 复制启动入口脚本
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV RUN_DB_PUSH=false
ENV RUN_SEED=false

# 切换到非 root 用户
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

EXPOSE 3000

# 使用入口脚本启动（支持 db:push + seed + 启动服务）
ENTRYPOINT ["./docker-entrypoint.sh"]
