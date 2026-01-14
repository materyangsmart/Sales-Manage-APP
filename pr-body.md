## 变更类型
- [x] chore (构建/CI配置)
- [ ] feat (新功能)
- [ ] fix (Bug修复)
- [ ] refactor (重构)

## 变更说明

### 初始化项目并启用真实CI流程

本PR完成了以下工作：

1. **初始化NestJS后端项目**
   - 使用NestJS CLI创建标准项目结构
   - 配置TypeScript、ESLint、Prettier
   - 包含基础的单元测试和E2E测试框架

2. **配置Monorepo结构**
   - 创建根目录`package.json`，使用npm workspaces管理
   - 统一lint/test/build脚本

3. **启用真实CI检查**
   - 移除`.github/workflows/ci.yml`中所有`|| true`容错逻辑
   - CI现在会真正检查lint、test和build是否通过
   - 任何失败都会阻止PR合并

4. **添加项目文档**
   - 创建`README.md`，包含项目概述、技术栈、快速开始指南

## 测试情况

- [x] 本地运行`npm run lint`通过
- [x] 本地运行`npm run test`通过
- [x] 本地运行`npm run build`通过
- [x] CI流程将在PR创建后自动运行

## DoD检查清单

- [x] 代码符合项目编码规范
- [x] 所有测试通过
- [x] 构建成功
- [x] 文档已更新
- [x] 无安全漏洞

## 备注

这是项目的第一个PR（PR-0），为后续功能开发奠定基础。CI现在已经启用真实检查，后续所有PR都必须通过CI才能合并。
