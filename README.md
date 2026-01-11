# 千张销售管理APP

## 项目概述

千张销售管理APP是一个面向B2B/B2C市场的企业级销售管理平台，专注于千张（豆制品）的销售、库存、财务和供应链管理。

## 技术栈

### 后端 (Backend)
- **框架**: NestJS (Node.js + TypeScript)
- **数据库**: MySQL 8.0 / TiDB
- **ORM**: TypeORM
- **缓存/队列**: Redis + Bull Queue
- **观测性**: OpenTelemetry + Jaeger + Prometheus + Grafana

### 前端 (待开发)
- **框架**: uni-app (支持微信小程序、H5、App)
- **UI库**: uni-ui

## 项目结构

```
Sales-Manage-APP/
├── backend/              # NestJS后端服务
│   ├── src/
│   │   ├── modules/      # 业务模块
│   │   ├── common/       # 公共模块
│   │   └── main.ts       # 入口文件
│   ├── test/             # 测试文件
│   └── package.json
├── .github/              # GitHub配置
│   ├── workflows/        # CI/CD工作流
│   └── PULL_REQUEST_TEMPLATE.md
└── package.json          # Monorepo根配置
```

## 快速开始

### 环境要求
- Node.js >= 20.0.0
- npm >= 10.0.0
- MySQL 8.0 或 TiDB
- Redis 7.0+

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run start:dev
```

### 运行测试
```bash
npm run test
```

### 构建生产版本
```bash
npm run build
```

## 开发流程

1. 从`main`分支创建功能分支 (`feature/*` 或 `bugfix/*`)
2. 编写代码并提交
3. 创建Pull Request
4. 等待CI检查通过和Code Review
5. 合并到`main`分支

## CI/CD

项目使用GitHub Actions进行持续集成，每次PR和push到main分支时会自动运行：
- ESLint代码检查
- 单元测试和覆盖率检查
- 构建验证

## 贡献指南

请参考 [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) 了解PR提交规范。

## 许可证

Private - 仅供内部使用
