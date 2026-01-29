# feat(ops): AR运营端管理页面 (CLEAN)

> **🎯 这是PR #7的干净重建版本，已完全移除node_modules（92个文件），仅包含源代码。**

## 概述

实现AR（应收账款）运营端管理页面，包括收款单列表和核销详情页面，为运营人员提供完整的AR管理能力。

## 完成的功能

### 1. 收款单列表页面 (ARPaymentList)

#### 核心功能
- ✅ 收款单列表展示（表格）
- ✅ 多维度筛选
  - 收款状态（全部/未核销/部分核销/已核销）
  - 客户筛选
  - 收款方式（银行转账/支付宝/微信/现金/其他）
  - 日期范围筛选
- ✅ 分页加载
- ✅ 点击跳转到核销详情页

#### 数据展示
- 收款单号
- 客户名称
- 收款金额（分→元转换）
- 收款方式
- 收款时间
- 状态标签

### 2. 核销详情页面 (ARApplyDetail)

#### 核心功能
- ✅ 收款单基本信息展示
- ✅ 核销记录列表
- ✅ 发票详情展示
- ✅ 金额汇总统计

#### 数据展示
- 收款单信息（金额、方式、时间、备注）
- 核销记录（核销金额、发票号、核销时间、操作人）
- 发票详情（发票号、原始金额、已核销金额、余额）
- 汇总统计（总收款、已核销、未核销）

### 3. 金额显示组件 (Amount)

#### 核心功能
- ✅ 分→元自动转换
- ✅ 千分位格式化
- ✅ 货币符号显示
- ✅ 颜色定制（正数/负数）
- ✅ 单元测试覆盖

#### 使用示例
```tsx
<Amount value={10000} /> // 显示: ¥100.00
<Amount value={-5000} /> // 显示: -¥50.00
```

### 4. API服务封装 (ar.ts)

#### 核心功能
- ✅ 获取收款单列表
- ✅ 获取收款单详情
- ✅ 获取核销记录列表
- ✅ 统一错误处理
- ✅ TypeScript类型安全

#### API规范对齐
| 规范项 | 状态 | 说明 |
|--------|------|------|
| 参数命名 | ✅ | snake_case（customer_id, date_from等） |
| 金额单位 | ✅ | 统一使用"分" |
| 时间格式 | ✅ | ISO8601（UTC） |
| orgId/operatorId | ✅ | 从JWT提取，前端不传 |

### 5. 埋点工具函数 (analytics.ts)

#### 核心功能
- ✅ 页面浏览埋点
- ✅ 按钮点击埋点
- ✅ 统一的埋点字段格式
- ✅ 支持自定义属性

#### 使用示例
```tsx
trackPageView('ar_payment_list');
trackButtonClick('filter_submit', { status: 'UNAPPLIED' });
```

### 6. TypeScript类型定义 (ar.ts)

#### 核心类型
- `ARPayment` - 收款单
- `ARApply` - 核销记录
- `ARInvoice` - 应收发票
- `PaymentStatus` - 收款状态枚举
- `PaymentMethod` - 收款方式枚举

## 技术栈

- **框架**: React 18 + TypeScript 5
- **UI库**: Ant Design 5
- **构建工具**: Vite 6
- **样式**: TailwindCSS 4
- **HTTP客户端**: Axios
- **测试**: Vitest + React Testing Library

## 项目结构

```
ops-frontend/
├── src/
│   ├── components/
│   │   ├── Amount.tsx          # 金额显示组件
│   │   └── Amount.test.tsx     # 单元测试
│   ├── pages/
│   │   ├── ARPaymentList.tsx   # 收款单列表页
│   │   ├── ARApplyDetail.tsx   # 核销详情页
│   │   └── ARApplyDetailWrapper.tsx  # 详情页路由包装
│   ├── services/
│   │   └── ar.ts               # AR API服务
│   ├── types/
│   │   └── ar.ts               # TypeScript类型定义
│   ├── utils/
│   │   └── analytics.ts        # 埋点工具函数
│   ├── App.tsx                 # 路由配置
│   ├── main.tsx                # 应用入口
│   └── index.css               # 全局样式
├── package.json                # 依赖配置
├── vite.config.ts              # Vite配置
├── tsconfig.json               # TypeScript配置
├── tailwind.config.js          # TailwindCSS配置
└── README.md                   # 项目文档
```

## 与旧PR #7的对比

| 对比项 | 旧PR #7 | 新PR（本PR） |
|--------|---------|--------------|
| 文件数 | 100 | 20 |
| node_modules | ✗ 包含92个文件 | ✅ 完全不包含 |
| 源代码文件 | 20 | 20 |
| 可Review性 | ✗ 无法review | ✅ 清晰可读 |
| 仓库体积 | ✗ 膨胀 | ✅ 正常 |

## 代码统计

- **新增文件**: 20个
  - 3个页面组件
  - 1个通用组件（Amount）
  - 1个API服务
  - 1个类型定义文件
  - 1个工具函数文件
  - 1个单元测试文件
  - 11个配置文件
- **代码行数**: ~1358行
- **测试覆盖率**: Amount组件100%

## 本地开发

### 安装依赖
```bash
cd ops-frontend
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问：http://localhost:5173

### 运行测试
```bash
npm run test
```

### 构建生产版本
```bash
npm run build
```

### 预览生产版本
```bash
npm run preview
```

## 环境变量

```bash
# .env
VITE_API_BASE_URL=http://localhost:3001
```

## 依赖的PR

- **PR #17**: .gitignore修复（已合并✅）
- **PR #18**: AR API实现（已合并✅）
- **PR #19**: CI配置（已合并✅）

## 后续PR

以下PR依赖本PR，需要在本PR合并后更新base：

- **PR #12**: feat(ops-ar): default last-7-days & received_at DESC
- **PR #13**: feat(ops-ar): empty/error states with retry
- **PR #14**: chore(ops-ar): unify analytics fields
- **PR #16**: test(ops-ar): e2e list→detail→409 flow

## 验收标准

- [x] 收款单列表页面正常显示
- [x] 筛选功能正常工作
- [x] 分页功能正常工作
- [x] 核销详情页面正常显示
- [x] 金额显示正确（分→元转换）
- [x] API调用使用snake_case参数
- [x] 不传orgId/operatorId
- [x] 埋点正常触发
- [x] TypeScript类型检查通过
- [x] 单元测试通过
- [x] **不包含任何node_modules文件**

## 冒烟测试

详见：`ops-frontend/SMOKE_TEST_GUIDE.md`

测试用例：
1. 访问收款单列表页
2. 筛选收款单（按状态）
3. 筛选收款单（按日期）
4. 点击收款单查看详情
5. 检查金额显示格式
6. 检查API请求参数格式

## 关闭旧PR

本PR创建后，请关闭旧的PR #7（包含node_modules的版本），避免误合并。

---

**PR类型**: Feature  
**优先级**: P0  
**预计合并时间**: 立即（已通过所有检查）  
**最后更新**: 2026-01-12

**✅ 本PR已完全清理，可以安全review和合并！**
