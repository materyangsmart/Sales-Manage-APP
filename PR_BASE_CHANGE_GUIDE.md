# PR Base分支修改操作指南

## 背景

当前仓库有多个PR的base分支不是`main`，而是其他feature分支（堆叠PR）。为了简化合并流程和CI验证，需要将所有PR的base统一改为`main`。

## 需要修改的PR列表

| PR编号 | 标题 | 当前Base | 目标Base | 优先级 |
|--------|------|----------|----------|--------|
| #7 | feat(ops): AR运营端管理页面 | feat/ar-api-minimal | main | P0 |
| #12 | feat(ops-ar): default last-7-days & received_at DESC | feat/ops-ar-page | main | P0 |
| #13 | feat(ops-ar): empty/error states with retry | feat/ops-ar-page | main | P0 |
| #14 | chore(ops-ar): unify analytics fields | feat/ops-ar-page | main | P0 |
| #16 | (待确认) | (待确认) | main | P0 |

## 操作步骤

### 方法A: 使用GitHub Web UI（推荐）

#### 步骤1: 打开PR页面

1. 访问GitHub仓库：https://github.com/materyangsmart/Sales-Manage-APP/pulls
2. 点击要修改的PR（例如：PR #7）

#### 步骤2: 修改Base分支

1. 在PR页面顶部，找到类似这样的文字：
   ```
   [用户名] wants to merge X commits into [当前base] from [head分支]
   ```
   例如：`materyangsmart wants to merge 15 commits into feat/ar-api-minimal from feat/ops-ar-page`

2. 点击**当前base分支名称**旁边的**"Edit"**按钮（或直接点击base分支名称）

3. 在弹出的下拉菜单中，选择`main`

4. GitHub会显示一个确认对话框，说明修改base可能会影响PR的diff和冲突
   - 点击**"Change base"**确认修改

#### 步骤3: 检查修改结果

1. 修改后，PR页面顶部应该显示：
   ```
   materyangsmart wants to merge X commits into main from [head分支]
   ```

2. 检查"Files changed"标签页，确认diff是否正确
   - 如果出现大量意外的文件变更，可能是因为head分支包含了旧base分支的提交
   - 这种情况下需要rebase head分支到main（见方法B）

3. 检查"Checks"标签页，确认CI是否正常运行

#### 步骤4: 重复以上步骤

对以下PR重复步骤1-3：
- [ ] PR #7
- [ ] PR #12
- [ ] PR #13
- [ ] PR #14
- [ ] PR #16（如果存在）

---

### 方法B: 使用Git命令行（适用于出现冲突或diff异常的情况）

如果修改base后发现diff不正确，需要rebase head分支到main。

#### 前提条件

- 已安装Git
- 已克隆仓库到本地
- 有push权限

#### 以PR #7为例

```bash
# 1. 切换到本地仓库
cd /path/to/Sales-Manage-APP

# 2. 拉取最新的main分支
git checkout main
git pull origin main

# 3. 切换到PR #7的head分支（feat/ops-ar-page）
git checkout feat/ops-ar-page
git pull origin feat/ops-ar-page

# 4. Rebase到main
git rebase main

# 5. 解决冲突（如果有）
# Git会提示哪些文件有冲突，手动编辑这些文件
# 解决后执行：
git add <冲突文件>
git rebase --continue

# 6. Force push到远程仓库
git push origin feat/ops-ar-page --force-with-lease

# 7. 在GitHub Web UI上修改PR #7的base为main（参考方法A）
```

#### 对其他PR重复以上步骤

```bash
# PR #12
git checkout feat/ops-ar-list-defaults
git pull origin feat/ops-ar-list-defaults
git rebase main
git push origin feat/ops-ar-list-defaults --force-with-lease

# PR #13
git checkout feat/ops-ar-empty-and-error-states
git pull origin feat/ops-ar-empty-and-error-states
git rebase main
git push origin feat/ops-ar-empty-and-error-states --force-with-lease

# PR #14
git checkout chore/ops-ar-analytics-fields
git pull origin chore/ops-ar-analytics-fields
git rebase main
git push origin chore/ops-ar-analytics-fields --force-with-lease
```

---

## 常见问题

### Q1: 修改base后，PR的diff变得很大，包含了很多不相关的文件？

**原因**: head分支包含了旧base分支的所有提交。

**解决方案**: 使用方法B进行rebase，将head分支的提交重新应用到main上。

### Q2: Rebase时遇到冲突怎么办？

**步骤**:
1. Git会提示哪些文件有冲突
2. 打开冲突文件，查找`<<<<<<<`、`=======`、`>>>>>>>`标记
3. 手动编辑，保留正确的代码
4. 执行`git add <冲突文件>`
5. 执行`git rebase --continue`
6. 重复步骤1-5，直到所有冲突解决

### Q3: 如果rebase出错，想要撤销怎么办？

```bash
git rebase --abort
```

### Q4: Force push会不会丢失代码？

使用`--force-with-lease`比`--force`更安全，它会检查远程分支是否有其他人的提交。如果有，push会失败，避免覆盖他人的工作。

### Q5: 修改base后，CI失败了？

**可能原因**:
1. head分支依赖了旧base分支的某些代码
2. 存在未解决的冲突
3. 测试用例需要更新

**解决方案**:
1. 检查CI日志，找到具体错误
2. 在本地运行测试：`npm test`
3. 修复错误后提交新的commit

---

## 验证清单

完成所有修改后，请验证：

- [ ] 所有PR的base都是`main`
- [ ] 所有PR的diff只包含该PR应该包含的变更
- [ ] 所有PR的CI都通过（或至少在运行）
- [ ] 没有意外的merge commit

---

## 修改顺序建议

建议按以下顺序修改，从"最底层"的PR开始：

1. **PR #7** (feat/ops-ar-page) - 这是其他PR的base
2. **PR #12** (feat/ops-ar-list-defaults)
3. **PR #13** (feat/ops-ar-empty-and-error-states)
4. **PR #14** (chore/ops-ar-analytics-fields)
5. **PR #16** (如果存在)

这样可以最小化冲突和依赖问题。

---

## 完成后的下一步

1. 等待PR #17（.gitignore修复）合并到main
2. 将所有其他PR rebase到最新的main（包含.gitignore）
3. 按照合并顺序逐个review和合并PR

---

## 需要帮助？

如果在操作过程中遇到问题，可以：
1. 截图错误信息
2. 复制Git命令的输出
3. 说明当前在哪一步卡住了

我会提供具体的解决方案。

---

**文档版本**: v1.0  
**创建日期**: 2026-01-11  
**最后更新**: 2026-01-11
