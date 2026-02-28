# ============================================================
# 千张销售管理系统 - 后端 Dockerfile
# 多阶段构建：构建阶段 → 生产阶段
# ============================================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 先复制依赖文件，利用 Docker 缓存
COPY package.json pnpm-lock.yaml ./

# 安装全部依赖（包含 devDependencies 用于构建）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY server/ ./server/
COPY shared/ ./shared/
COPY drizzle/ ./drizzle/
COPY tsconfig.json ./

# TypeScript 编译
RUN pnpm exec tsc --outDir dist --skipLibCheck

# ---- Stage 2: Production ----
FROM node:22-alpine AS production

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 安全：创建非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 先复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 仅安装生产依赖
RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# 从构建阶段复制编译产物
COPY --from=builder /app/dist ./dist

# 复制 Drizzle 迁移文件（运行时可能需要）
COPY drizzle/ ./drizzle/

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 切换到非 root 用户
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

EXPOSE 3000

# 启动服务
CMD ["node", "dist/server/_core/index.js"]
