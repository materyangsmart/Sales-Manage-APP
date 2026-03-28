# 千张销售管理系统 — 全栈技术交底文档

**作者：** Manus AI
**日期：** 2026-03-28
**版本：** v3.0（Dockerfile 架构修复后）

---

## 一、项目总体架构

千张销售管理系统采用**前后端一体化**的 Monorepo 架构，前端和后端共享同一个 `package.json`，通过不同的构建工具分别打包。整个项目在 GitHub 仓库 `materyangsmart/Sales-Manage-APP` 中维护，包含两套部署上下文：**Manus 平台托管**（根目录）和**阿里云 Docker 自部署**（`ops-frontend/` 子目录）。

### 1.1 技术栈总览

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **前端框架** | React 19 + TypeScript | SPA 单页应用 |
| **UI 组件库** | shadcn/ui + Tailwind CSS 4 | 组件化 + 原子化样式 |
| **前端构建** | Vite 6 | 开发热更新 + 生产打包 |
| **后端框架** | Express 4 + tRPC 11 | 类型安全的 RPC 通信 |
| **后端构建** | esbuild | 高速打包，单文件输出 |
| **数据库** | MySQL 8.0 (TiDB 兼容) | 通过 Drizzle ORM 操作 |
| **ORM** | Drizzle ORM | Schema-first，类型安全 |
| **认证** | JWT + bcrypt | 本地登录 + OAuth 双模式 |
| **缓存** | Redis 7 | 可选，用于会话和限流 |
| **容器化** | Docker + docker-compose | 多阶段构建 |

### 1.2 目录结构

```
ops-frontend/                    ← Git 仓库根目录
├── client/                      ← 前端源码
│   ├── index.html               ← Vite 入口 HTML（注意：不在根目录！）
│   ├── src/
│   │   ├── pages/               ← 页面组件
│   │   ├── components/          ← 可复用组件
│   │   ├── lib/trpc.ts          ← tRPC 客户端
│   │   └── App.tsx              ← 路由注册
│   └── public/                  ← 静态资源
├── server/                      ← 后端源码
│   ├── _core/                   ← 框架核心（不要修改）
│   │   ├── index.ts             ← 服务入口
│   │   ├── sdk.ts               ← JWT/认证 SDK
│   │   └── env.ts               ← 环境变量定义
│   ├── services/                ← 业务服务层
│   ├── routers.ts               ← tRPC 路由定义
│   └── db.ts                    ← 数据库查询助手
├── drizzle/                     ← 数据库 Schema + 迁移
│   └── schema.ts                ← 表定义
├── shared/                      ← 前后端共享类型
├── patches/                     ← pnpm patch 补丁
│   └── wouter@3.7.1.patch       ← 路由库补丁
├── scripts/                     ← 运维脚本
├── Dockerfile                   ← 后端 Docker（根目录版）
├── Dockerfile.nginx             ← 前端 Docker（根目录版）
├── ops-frontend/                ← 阿里云部署专用副本
│   ├── Dockerfile               ← 后端 Docker（子目录版）
│   ├── Dockerfile.nginx         ← 前端 Docker（子目录版）
│   ├── docker-compose.prod.yml  ← 生产编排
│   ├── docker-entrypoint.sh     ← 启动入口脚本
│   └── tsconfig.build.json      ← 后端构建专用 tsconfig
├── vite.config.ts               ← Vite 配置
├── tsconfig.json                ← TypeScript 配置（开发用）
├── drizzle.config.ts            ← Drizzle Kit 配置
└── package.json                 ← 统一依赖管理
```

---

## 二、构建链路详解

### 2.1 核心问题：为什么不能用 `tsc` 编译后端？

根目录的 `tsconfig.json` 启用了 `allowImportingTsExtensions: true`，这是 Vite/esbuild 生态的标准配置，允许在 import 语句中使用 `.ts` 扩展名。但根据 TypeScript 官方规范 [1]，该选项**必须**配合 `noEmit: true` 使用——也就是说，一旦开启此选项，`tsc` 就不能产出任何编译文件（`--outDir` 会报 TS5096 错误）。

> **TS5096 错误原文：** Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set.

这意味着**后端绝对不能使用 `tsc --outDir dist` 来编译**，必须使用 esbuild 作为打包工具。

### 2.2 正确的构建流程

| 步骤 | 命令 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| 前端打包 | `pnpm exec vite build` | `client/` 全部源码 | `dist/public/` | Vite 读取 `client/index.html` 作为入口 |
| 后端打包 | `pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist` | `server/_core/index.ts` | `dist/index.js` | esbuild 将所有后端代码打包为单文件 |
| 生产启动 | `node dist/index.js` | `dist/index.js` + `dist/public/` | — | Express 同时服务 API 和静态文件 |

### 2.3 关键配置文件说明

**`tsconfig.json`（根目录）** 仅用于开发时的类型检查（`tsc --noEmit`），不用于编译产出。其中 `allowImportingTsExtensions: true` + `noEmit: true` 是固定搭配，不可修改。

**`tsconfig.build.json`（ops-frontend/ 子目录）** 是后端构建的备用配置，去掉了 `allowImportingTsExtensions`，但实际上 Dockerfile 中已改用 esbuild，此文件仅作为安全网保留。

**`vite.config.ts`** 中的关键配置：`root` 指向 `client/`，`build.outDir` 指向 `dist/public`。这意味着 Vite 的入口 HTML 是 `client/index.html`（不是根目录的 `index.html`），产物在 `dist/public/` 下。

---

## 三、Dockerfile 架构详解

### 3.1 本次修复的三个致命问题

| 问题编号 | 原始错误 | 根因 | 修复方案 |
|----------|----------|------|----------|
| **BUG-1** | `tsc --outDir dist` 报 TS5096 | `allowImportingTsExtensions` 与 `--outDir` 互斥 | 改用 `esbuild` 打包后端 |
| **BUG-2** | `pnpm install` 报 exit 254 | Dockerfile 未 COPY `patches/` 目录 | 在 `pnpm install` 前添加 `COPY patches/ ./patches/` |
| **BUG-3** | 生产镜像缺少 `seed.ts` | Stage 2 未复制 `scripts/`、`server/`、`shared/` | 补齐所有运维必需文件的 COPY 指令 |

### 3.2 后端 Dockerfile 构建流程

```
Stage 1 (builder):
  ① COPY package.json + pnpm-lock.yaml + patches/
  ② pnpm install --frozen-lockfile
  ③ COPY server/ + shared/ + drizzle/ + client/ + scripts/ + 配置文件
  ④ vite build → dist/public/（前端产物）
  ⑤ esbuild → dist/index.js（后端产物）

Stage 2 (production):
  ① COPY package.json + pnpm-lock.yaml + patches/
  ② pnpm install --frozen-lockfile（含 devDeps，因为需要 drizzle-kit）
  ③ COPY --from=builder dist/（编译产物）
  ④ COPY drizzle/ + scripts/ + server/ + shared/ + 配置文件（运维用）
  ⑤ COPY docker-entrypoint.sh
  ⑥ ENTRYPOINT → docker-entrypoint.sh
```

### 3.3 前端 Dockerfile.nginx 构建流程

```
Stage 1 (builder):
  ① COPY package.json + pnpm-lock.yaml + patches/
  ② pnpm install --frozen-lockfile
  ③ COPY client/ + shared/ + vite.config.ts + tsconfig.json
  ④ vite build → dist/public/

Stage 2 (nginx):
  ① COPY nginx.conf
  ② COPY --from=builder /app/dist/public → /usr/share/nginx/html
```

**特别注意：** Vite 的产物路径是 `dist/public`（不是 `dist`），因为 `vite.config.ts` 中 `build.outDir` 配置为 `dist/public`。Nginx 的 COPY 指令必须使用 `/app/dist/public` 而非 `/app/dist`。

---

## 四、生产环境启动流程

### 4.1 docker-entrypoint.sh 入口脚本

生产容器启动时，入口脚本按以下顺序执行：

| 步骤 | 环境变量 | 默认值 | 说明 |
|------|----------|--------|------|
| 数据库迁移 | `RUN_DB_PUSH=true` | `false` | 执行 `drizzle-kit push --force` |
| 种子数据 | `RUN_SEED=true` | `false` | 导入 `seed-600m-revenue.sql` |
| 启动服务 | — | — | `node dist/index.js` |

### 4.2 首次部署操作步骤

在阿里云服务器上，按以下步骤操作：

**第一步：** 从 GitHub 拉取代码

```bash
cd /opt
git clone https://github.com/materyangsmart/Sales-Manage-APP.git
cd Sales-Manage-APP/ops-frontend
```

**第二步：** 创建 `.env` 文件

```bash
cp .env.example .env
# 编辑 .env，填写数据库密码、JWT 密钥等
```

**第三步：** 首次启动（含数据库迁移）

```bash
RUN_DB_PUSH=true docker-compose -f docker-compose.prod.yml up -d
```

**第四步：** 后续启动（跳过迁移）

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 4.3 环境变量清单

| 变量名 | 必填 | 说明 | 示例值 |
|--------|------|------|--------|
| `MYSQL_ROOT_PASSWORD` | 是 | MySQL root 密码 | `qianzhang_root_2026` |
| `MYSQL_DATABASE` | 是 | 数据库名 | `qianzhang_sales` |
| `MYSQL_USER` | 是 | 数据库用户名 | `qianzhang` |
| `MYSQL_PASSWORD` | 是 | 数据库用户密码 | `qianzhang_pwd_2026` |
| `JWT_SECRET` | 是 | JWT 签名密钥 | 随机 32 位字符串 |
| `ENABLE_LOCAL_AUTH` | 否 | 启用本地登录 | `true` |
| `VITE_ENABLE_OAUTH` | 否 | 启用 OAuth | `false` |
| `RUN_DB_PUSH` | 否 | 启动时执行数据库迁移 | `true`（首次）/ `false`（后续） |
| `RUN_SEED` | 否 | 启动时导入种子数据 | `false` |

### 4.4 默认管理员账号

| 项目 | 值 |
|------|------|
| 用户名 | `admin` |
| 密码 | `Admin@2026` |
| 角色 | `admin`（超级管理员） |

服务启动后，后端会自动检测是否存在管理员账号，如果不存在则自动创建。首次登录后请立即修改默认密码。

---

## 五、认证系统双模式

系统支持两种认证模式，通过环境变量切换：

| 模式 | 环境变量 | 适用场景 |
|------|----------|----------|
| **本地登录** | `VITE_ENABLE_OAUTH=false` + `ENABLE_LOCAL_AUTH=true` | 阿里云自部署，无需外部 OAuth |
| **Manus OAuth** | `VITE_ENABLE_OAUTH=true` | Manus 平台托管 |

本地登录模式下，用户通过 `/login` 页面输入用户名和密码登录。密码使用 bcrypt 哈希存储，登录成功后签发 JWT 写入 HttpOnly Cookie。

---

## 六、数据库管理

### 6.1 Schema 变更流程

所有数据库表定义在 `drizzle/schema.ts` 中。修改表结构后，执行以下命令同步到数据库：

```bash
pnpm db:push
```

该命令等价于 `drizzle-kit generate && drizzle-kit migrate`，会自动生成迁移文件并执行。

### 6.2 当前表清单（截至 MS11）

系统共有约 40 张业务表，涵盖订单管理、库存管理、财务核算、客户管理、增长引擎、反作弊等模块。核心表包括：`users`、`orders`、`order_items`、`products`、`customers`、`customer_profiles`、`sales_commissions`、`referral_records`、`churn_alerts`、`fraud_alerts`、`winback_coupons` 等。

---

## 七、已知限制与注意事项

**patches 目录不可删除。** `patches/wouter@3.7.1.patch` 是 pnpm 的补丁文件，`pnpm install` 时会自动应用。如果 Dockerfile 中未 COPY 此目录，安装会以 exit code 254 失败。

**生产镜像包含 devDependencies。** 因为生产环境需要 `drizzle-kit`（数据库迁移）和 `tsx`（运行 TypeScript 脚本），所以 Stage 2 使用 `pnpm install --frozen-lockfile`（不加 `--prod`）。这会增加约 200MB 镜像体积，但确保运维能力完整。

**Vite 产物路径是 `dist/public` 而非 `dist`。** 这是因为 `vite.config.ts` 中 `build.outDir` 配置为 `dist/public`，而 esbuild 的后端产物在 `dist/index.js`。两者共存于 `dist/` 目录下，互不冲突。

---

## References

[1]: [TypeScript 5.0 Release Notes - allowImportingTsExtensions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)
