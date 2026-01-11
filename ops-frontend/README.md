# 千张销售 - 运营管理后台

## 项目简介

这是千张销售系统的运营端管理后台，用于管理AR（应收账款）、订单、客户等业务数据。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件库**: Ant Design 5
- **样式**: TailwindCSS
- **路由**: React Router v6
- **HTTP客户端**: Axios
- **日期处理**: Day.js

## 项目结构

```
ops-frontend/
├── src/
│   ├── components/      # 公共组件
│   │   └── Amount.tsx   # 金额显示/输入组件
│   ├── pages/           # 页面组件
│   │   ├── ARPaymentList.tsx    # AR待处理列表
│   │   └── ARApplyDetail.tsx    # AR核销详情
│   ├── services/        # API服务
│   │   └── ar.ts        # AR相关API
│   ├── types/           # TypeScript类型定义
│   │   └── ar.ts        # AR类型定义
│   ├── utils/           # 工具函数
│   │   └── analytics.ts # 埋点工具
│   ├── App.tsx          # 应用主组件
│   ├── main.tsx         # 应用入口
│   └── index.css        # 全局样式
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
pnpm build
```

### 预览生产版本

```bash
pnpm preview
```

## 核心功能

### AR待处理列表 (`/ar/payments`)

- 展示所有待处理的收款单
- 支持按状态、客户、日期等条件筛选
- 支持分页查询
- 点击"核销"按钮进入核销详情页

### AR核销详情

- 显示收款单详细信息
- 列出该客户的所有未结清应收单
- 支持手动输入核销金额
- 支持"快速填充"功能
- 实时显示剩余可分配金额
- 409冲突错误自动提示用户刷新

### 金额组件

- **Amount**: 金额显示组件，自动将"分"转换为"元"
- **AmountInput**: 金额输入组件，用户输入"元"，自动转换为"分"
- 支持最大值限制，防止超额输入

### 错误处理

- 统一的HTTP拦截器处理错误
- 409冲突错误特殊提示："数据已被他人更新，请刷新后重试"
- 所有错误都有用户友好的提示信息

### 埋点

- `apply_submit`: 核销提交
- `apply_success`: 核销成功
- `apply_conflict`: 核销冲突（409错误）

## API对接

后端API地址配置在 `vite.config.ts` 中：

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
}
```

## 幂等性

所有POST请求自动添加 `Idempotency-Key` 请求头（UUID v4格式），确保重复请求不会产生副作用。

## 注意事项

1. 金额统一使用"分"为单位存储和传输
2. 时间格式统一使用ISO8601（UTC时区）
3. 所有操作都需要携带 `orgId`（组织ID）
4. 核销操作会自动校验跨客户防篡改和Org隔离

## License

MIT
