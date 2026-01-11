# 千张销售B2B客户小程序

## 项目简介

这是千张销售系统的B2B客户端小程序，主要用于B2B客户查看自己的账本、应收单、收款记录等信息。

## 技术栈

- **框架**: uni-app
- **语言**: Vue 3
- **平台**: 微信小程序、H5（可扩展到其他平台）

## 项目结构

```
b2b-miniapp/
├── pages/              # 页面目录
│   └── ledger/        # 账本页面
│       └── index.vue
├── components/        # 组件目录
├── api/              # API接口
│   └── ledger.js
├── utils/            # 工具函数
│   └── request.js    # 网络请求工具
├── static/           # 静态资源
├── App.vue           # 根组件
├── main.js           # 入口文件
├── manifest.json     # 应用配置
├── pages.json        # 页面配置
└── uni.scss          # 全局样式
```

## 功能模块

### 1. 账本页面（已实现骨架）

- **账本概览卡片**
  - 应收总额
  - 已收金额
  - 未收余额
  - 逾期金额

- **筛选器**
  - 状态筛选（全部/未结清/已结清/逾期）
  - 日期筛选

- **应收单列表**
  - 应收单号
  - 应收金额
  - 未收余额
  - 到期日期
  - 状态标签

### 2. 待实现功能

- [ ] 应收单详情页
- [ ] 收款记录页
- [ ] 登录/授权
- [ ] 消息通知
- [ ] 账单下载

## 开发指南

### 环境要求

- Node.js >= 14
- HBuilderX（推荐）或 Vue CLI

### 安装依赖

```bash
npm install
```

### 开发模式

#### 微信小程序

```bash
npm run dev:mp-weixin
```

然后使用微信开发者工具打开 `dist/dev/mp-weixin` 目录。

#### H5

```bash
npm run dev:h5
```

### 构建生产版本

#### 微信小程序

```bash
npm run build:mp-weixin
```

#### H5

```bash
npm run build:h5
```

## API接口

### 基础配置

在 `utils/request.js` 中配置API基础地址：

```javascript
const BASE_URL = 'https://api.example.com'
```

### 已定义接口

1. **获取账本概览**: `GET /api/b2b/ledger/summary`
2. **获取应收单列表**: `GET /api/b2b/ledger/invoices`
3. **获取应收单详情**: `GET /api/b2b/ledger/invoices/:id`
4. **获取收款记录**: `GET /api/b2b/ledger/invoices/:id/payments`

## 注意事项

1. **Token管理**: 目前使用 `uni.getStorageSync('token')` 获取token，需要在登录后保存
2. **API地址**: 需要替换 `utils/request.js` 中的 `BASE_URL` 为实际地址
3. **模拟数据**: 当前使用模拟数据，需要替换为实际API调用
4. **图标资源**: 需要添加 `static/ledger.png` 和 `static/ledger-active.png` 图标

## 后续开发计划

### Phase 1: 核心功能完善
- 实现登录/授权流程
- 对接真实API接口
- 完善错误处理

### Phase 2: 详情页开发
- 应收单详情页
- 收款记录详情
- 支付凭证查看

### Phase 3: 增强功能
- 消息推送
- 账单导出
- 数据统计图表

### Phase 4: 优化与测试
- 性能优化
- 用户体验优化
- 全面测试

## 联系方式

如有问题，请联系开发团队。
