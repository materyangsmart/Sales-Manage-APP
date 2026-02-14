# Sales-Manage-APP

千张销售管理系统 - 完整的B2B销售管理解决方案

## 项目结构

```
Sales-Manage-APP-git/
├── backend/          # NestJS后端API服务
│   ├── src/          # 源代码
│   ├── test/         # E2E测试
│   └── package.json
├── ops-frontend/     # Next.js内部运营中台
│   ├── client/       # React前端
│   ├── server/       # tRPC服务端
│   ├── drizzle/      # 数据库schema
│   └── package.json
└── README.md
```

## 快速启动

### Backend (NestJS)

```bash
cd backend
npm install
npm run start:dev
```

Backend默认运行在 http://localhost:3100

### ops-frontend (Next.js + tRPC)

```bash
cd ops-frontend
pnpm install
pnpm dev
```

ops-frontend默认运行在 http://localhost:3000

## 环境要求

- Node.js >= 18
- MySQL >= 8.0
- pnpm (用于ops-frontend)
- npm (用于backend)

## 文档

- [Backend API文档](./backend/README.md)
- [ops-frontend文档](./ops-frontend/README.md)
- [数据库设计](./backend/DATABASE_SETUP.md)

## 技术栈

### Backend
- NestJS
- TypeORM
- MySQL
- JWT认证

### ops-frontend
- Next.js 14
- tRPC 11
- Drizzle ORM
- Tailwind CSS 4
- React 19

## 许可证

MIT
