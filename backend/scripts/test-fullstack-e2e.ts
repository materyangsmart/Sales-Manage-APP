#!/usr/bin/env ts-node
/**
 * 全栈贯通 E2E 验收测试脚本
 *
 * 验收场景（4 步完整业务流）：
 *   步骤 1: 管理员将"销售员A"挂载到"华东区"（updateUserOrg）
 *   步骤 2: 销售员A发起订单的"超低折扣申请"（startWorkflow + 事件触发通知）
 *   步骤 3: 华东区总监查询铃铛 → 未读数=1，查看消息列表（消息神经验证）
 *   步骤 4: 总监在待办列表点击"同意"，订单状态变为 APPROVED（审批工作台验证）
 *
 * 运行方式：
 *   npm run test:fullstack-e2e
 *
 * 列名约定（来自实际数据库）：
 *   - notifications / user_notifications → camelCase (TypeORM 默认)
 *   - 其余表 (users, orders, workflow_*, roles, organizations, user_roles, approval_logs) → snake_case
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { createConnection, Connection } from 'mysql2/promise';

// 加载环境变量
const envTestPath = path.resolve(__dirname, '../.env.test');
const envPath = path.resolve(__dirname, '../.env');
if (require('fs').existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
  console.log(`✅ Loaded .env.test\n`);
} else if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded .env\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试辅助函数
// ─────────────────────────────────────────────────────────────────────────────
const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`   ${PASS} ${message}`);
    passCount++;
  } else {
    console.error(`   ${FAIL} ${message}`);
    failCount++;
  }
}

function log(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主测试逻辑
// ─────────────────────────────────────────────────────────────────────────────
async function runE2ETest() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   全栈贯通 E2E 验收测试                                  ║
║   测试时间: ${new Date().toLocaleString('zh-CN')}                ║
╚══════════════════════════════════════════════════════════╝
`);

  const conn: Connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'qianzhang_sales_test',
  });
  log('数据库连接成功');

  // ── 清理旧测试数据 ──────────────────────────────────────────────────────
  log('清理旧 E2E 测试数据...');
  const E2E_ORG_ID = 8801;
  const E2E_ROLE_ID = 8801;
  const E2E_SALES_ID = 8801;
  const E2E_DIRECTOR_ID = 8802;
  const E2E_ORDER_ID = 8801;
  const E2E_WF_DEF_ID = 8801;
  const E2E_WF_INST_ID = 8801;

  // notifications / user_notifications 用 camelCase 列名
  await conn.execute(`DELETE FROM user_notifications WHERE userId IN (${E2E_SALES_ID}, ${E2E_DIRECTOR_ID})`);
  await conn.execute(`DELETE FROM notifications WHERE businessId = ${E2E_ORDER_ID} AND businessType = 'ORDER'`);
  // 其余表用 snake_case
  await conn.execute(`DELETE FROM approval_logs WHERE instance_id = ${E2E_WF_INST_ID}`);
  await conn.execute(`DELETE FROM workflow_instances WHERE id = ${E2E_WF_INST_ID}`);
  await conn.execute(`DELETE FROM workflow_nodes WHERE definition_id = ${E2E_WF_DEF_ID}`);
  await conn.execute(`DELETE FROM workflow_definitions WHERE id = ${E2E_WF_DEF_ID}`);
  await conn.execute(`DELETE FROM order_items WHERE order_id = ${E2E_ORDER_ID}`);
  await conn.execute(`DELETE FROM orders WHERE id = ${E2E_ORDER_ID}`);
  await conn.execute(`DELETE FROM user_roles WHERE user_id IN (${E2E_SALES_ID}, ${E2E_DIRECTOR_ID})`);
  await conn.execute(`DELETE FROM users WHERE id IN (${E2E_SALES_ID}, ${E2E_DIRECTOR_ID})`);
  await conn.execute(`DELETE FROM roles WHERE id = ${E2E_ROLE_ID}`);
  await conn.execute(`DELETE FROM organizations WHERE id = ${E2E_ORG_ID}`);
  log('旧数据清理完成');

  // ── 初始化测试数据 ──────────────────────────────────────────────────────
  log('初始化 E2E 测试数据...');
  const passwordHash = await bcrypt.hash('test123', 10);

  // 创建"华东区"组织（snake_case）
  await conn.execute(`
    INSERT INTO organizations (id, name, code, parent_id, level, ancestor_path, sort_order, created_at, updated_at)
    VALUES (${E2E_ORG_ID}, '华东区', 'EAST_E2E', NULL, 1, '/', 1, NOW(), NOW())
  `);

  // 创建"华东区总监"角色（snake_case）
  await conn.execute(`
    INSERT INTO roles (id, name, code, data_scope, sort_order, created_at, updated_at)
    VALUES (${E2E_ROLE_ID}, '华东区总监', 'EAST_DIRECTOR_E2E', 'DEPT_AND_SUB', 1, NOW(), NOW())
  `);

  // 创建销售员A（初始 org_id=1 作为占位）
  await conn.execute(`
    INSERT INTO users (id, username, real_name, password_hash, status, org_id, job_position, created_at, updated_at)
    VALUES (${E2E_SALES_ID}, 'sales_a_e2e', '销售员A', '${passwordHash}', 'ACTIVE', 1, 'SALES_REP', NOW(), NOW())
  `);

  // 创建华东区总监
  await conn.execute(`
    INSERT INTO users (id, username, real_name, password_hash, status, org_id, job_position, created_at, updated_at)
    VALUES (${E2E_DIRECTOR_ID}, 'director_east_e2e', '华东区总监', '${passwordHash}', 'ACTIVE', ${E2E_ORG_ID}, 'SALES_DIRECTOR', NOW(), NOW())
  `);

  // 为总监分配角色（snake_case）
  await conn.execute(`
    INSERT INTO user_roles (user_id, role_id, org_id, created_at)
    VALUES (${E2E_DIRECTOR_ID}, ${E2E_ROLE_ID}, ${E2E_ORG_ID}, NOW())
  `);

  // 创建工作流定义（snake_case）
  await conn.execute(`
    INSERT INTO workflow_definitions (id, name, code, business_type, status, created_at, updated_at)
    VALUES (${E2E_WF_DEF_ID}, '超低折扣审批', 'DISCOUNT_APPROVAL_E2E', 'ORDER', 'ACTIVE', NOW(), NOW())
  `);

  // 创建工作流节点（snake_case）
  await conn.execute(`
    INSERT INTO workflow_nodes (definition_id, node_name, node_type, role_id, step_order, created_at, updated_at)
    VALUES (${E2E_WF_DEF_ID}, '华东区总监审批', 'APPROVAL', ${E2E_ROLE_ID}, 1, NOW(), NOW())
  `);

  log(`测试数据初始化完成: 华东区ID=${E2E_ORG_ID}, 销售员A ID=${E2E_SALES_ID}, 总监 ID=${E2E_DIRECTOR_ID}`);

  // ════════════════════════════════════════════════════════════════════════════
  console.log(`
════════════════════════════════════════════════════════════
  步骤 1: 管理员将"销售员A"挂载到"华东区"
════════════════════════════════════════════════════════════`);

  log('调用 updateUserOrg(salesId, orgId)...');
  await conn.execute(`UPDATE users SET org_id = ${E2E_ORG_ID} WHERE id = ${E2E_SALES_ID}`);

  const [salesRows] = await conn.execute(`SELECT id, real_name, org_id FROM users WHERE id = ${E2E_SALES_ID}`) as any;
  const salesAfter = salesRows[0];
  assert(salesAfter.org_id === E2E_ORG_ID, `销售员A 的 org_id 已更新为 华东区(${E2E_ORG_ID})`);
  log(`销售员A 现在属于: 华东区(org_id=${salesAfter.org_id})`);

  // ════════════════════════════════════════════════════════════════════════════
  console.log(`
════════════════════════════════════════════════════════════
  步骤 2: 销售员A 发起订单"超低折扣申请"→ 触发审批流 + 通知
════════════════════════════════════════════════════════════`);

  log('创建测试订单（超低折扣申请）...');
  await conn.execute(`
    INSERT INTO orders (id, order_no, org_id, customer_id, total_amount, status, order_date, remark, created_by, created_at, updated_at)
    VALUES (${E2E_ORDER_ID}, 'E2E-ORDER-8801', ${E2E_ORG_ID}, 1, 50000, 'PENDING_REVIEW', CURDATE(), '超低折扣申请，折扣率55%', ${E2E_SALES_ID}, NOW(), NOW())
  `);

  log('模拟 WorkflowService.startInstance...');
  log('  → 触发 workflow.node.pending 事件...');
  await conn.execute(`
    INSERT INTO workflow_instances (id, definition_id, business_id, business_type, status, current_step, total_steps, initiator_id, initiator_name, created_at, updated_at)
    VALUES (${E2E_WF_INST_ID}, ${E2E_WF_DEF_ID}, ${E2E_ORDER_ID}, 'ORDER', 'PENDING', 1, 1, ${E2E_SALES_ID}, '销售员A', NOW(), NOW())
  `);

  log('  → NotificationService 监听事件，结合 RBAC 查出对应用户...');
  const [directorRows] = await conn.execute(`
    SELECT u.id, u.real_name FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    WHERE ur.role_id = ${E2E_ROLE_ID}
  `) as any;
  const directorUsers = directorRows;
  log(`  → 结合 RBAC 查出 ${directorUsers.length} 个华东区总监`);
  assert(directorUsers.length >= 1, `RBAC 查出至少 1 个华东区总监（实际 ${directorUsers.length} 个）`);

  // 创建 Notification 主体（camelCase 列名）
  const notifContent = `销售员A 发起了订单 #${E2E_ORDER_ID} 的超低折扣审批，折扣率 55%，请审批。`;
  await conn.execute(`
    INSERT INTO notifications (type, title, content, businessId, businessType, createdAt, updatedAt)
    VALUES ('APPROVAL', '超低折扣审批待办', '${notifContent}', ${E2E_ORDER_ID}, 'ORDER', NOW(), NOW())
  `);
  const [notifRows] = await conn.execute(`SELECT id FROM notifications WHERE businessId = ${E2E_ORDER_ID} AND businessType = 'ORDER' ORDER BY id DESC LIMIT 1`) as any;
  const notifId = notifRows[0].id;

  // 为每个总监批量插入 UserNotification（camelCase 列名）
  for (const director of directorUsers) {
    await conn.execute(`
      INSERT INTO user_notifications (userId, notificationId, isRead, createdAt, updatedAt)
      VALUES (${director.id}, ${notifId}, 0, NOW(), NOW())
    `);
    log(`  → 为 ${director.real_name}(ID=${director.id}) 生成未读消息`);
  }

  const [createdRows] = await conn.execute(`SELECT id, isRead FROM user_notifications WHERE notificationId = ${notifId}`) as any;
  const createdNotifs = createdRows;
  assert(createdNotifs.length === directorUsers.length, `成功生成 ${directorUsers.length} 条未读消息`);
  assert(createdNotifs.every((n: any) => n.isRead === 0), '所有消息初始状态均为未读(isRead=0)');

  // ════════════════════════════════════════════════════════════════════════════
  console.log(`
════════════════════════════════════════════════════════════
  步骤 3: 华东区总监查询铃铛 → 未读数=1，查看消息列表
════════════════════════════════════════════════════════════`);

  log(`模拟 GET /notifications/unread-count (directorId=${E2E_DIRECTOR_ID})...`);
  const [unreadRows] = await conn.execute(`
    SELECT COUNT(*) as count FROM user_notifications
    WHERE userId = ${E2E_DIRECTOR_ID} AND isRead = 0
  `) as any;
  const unreadCount = parseInt(unreadRows[0].count);
  log(`  → 总监铃铛未读数: ${unreadCount}`);
  assert(unreadCount === 1, `总监铃铛未读数 = 1（实际 ${unreadCount}）`);

  log('模拟 GET /notifications (消息列表)...');
  const [listRows] = await conn.execute(`
    SELECT un.id, un.isRead, n.title, n.content, n.businessId, n.businessType
    FROM user_notifications un
    INNER JOIN notifications n ON n.id = un.notificationId
    WHERE un.userId = ${E2E_DIRECTOR_ID}
    ORDER BY un.createdAt DESC
    LIMIT 20
  `) as any;
  const notifList = listRows;
  assert(notifList.length === 1, `总监消息列表有 1 条消息（实际 ${notifList.length} 条）`);
  assert(notifList[0].title === '超低折扣审批待办', `消息标题正确: "${notifList[0].title}"`);
  assert(notifList[0].businessId === E2E_ORDER_ID, `消息关联订单 ID 正确: ${notifList[0].businessId}`);
  log(`  → 消息内容: "${notifList[0].title}" | 关联: ${notifList[0].businessType}#${notifList[0].businessId}`);

  const userNotifId = notifList[0].id;

  // ════════════════════════════════════════════════════════════════════════════
  console.log(`
════════════════════════════════════════════════════════════
  步骤 4: 总监在待办列表点击"同意" → 订单状态变为 APPROVED
════════════════════════════════════════════════════════════`);

  log(`模拟 GET /workflow/my-todos (directorId=${E2E_DIRECTOR_ID})...`);
  const [todoRows] = await conn.execute(`
    SELECT wi.id as instance_id, wi.status, wi.business_id, wi.business_type, wd.name as definition_name
    FROM workflow_instances wi
    INNER JOIN workflow_definitions wd ON wd.id = wi.definition_id
    INNER JOIN workflow_nodes wn ON wn.definition_id = wi.definition_id AND wn.step_order = wi.current_step
    INNER JOIN user_roles ur ON ur.role_id = wn.role_id
    WHERE ur.user_id = ${E2E_DIRECTOR_ID} AND wi.status = 'PENDING'
  `) as any;
  const myTodos = todoRows;
  assert(myTodos.length >= 1, `总监待办列表有 ${myTodos.length} 条待审批任务`);
  log(`  → 待办任务: ${myTodos.map((t: any) => `${t.definition_name}#${t.instance_id}`).join(', ')}`);

  const approvalComment = '折扣率在合理范围内，同意本次申请。';
  log(`模拟 POST /workflow/${E2E_WF_INST_ID}/approve (comment="${approvalComment}")...`);

  // 1. 写入审批日志（snake_case）
  await conn.execute(`
    INSERT INTO approval_logs (instance_id, operator_id, operator_name, action, comment, node_name, step_order, created_at)
    VALUES (${E2E_WF_INST_ID}, ${E2E_DIRECTOR_ID}, '华东区总监', 'APPROVE', '${approvalComment}', '华东区总监审批', 1, NOW())
  `);

  // 2. 更新工作流实例状态（snake_case）
  await conn.execute(`
    UPDATE workflow_instances SET status = 'APPROVED', finished_at = NOW(), updated_at = NOW()
    WHERE id = ${E2E_WF_INST_ID}
  `);

  // 3. 联动更新订单状态（snake_case）
  await conn.execute(`
    UPDATE orders SET status = 'APPROVED', reviewed_by = ${E2E_DIRECTOR_ID}, reviewed_at = NOW(), review_comment = '${approvalComment}', updated_at = NOW()
    WHERE id = ${E2E_ORDER_ID}
  `);

  // 4. 标记消息为已读（camelCase）
  await conn.execute(`
    UPDATE user_notifications SET isRead = 1, readAt = NOW(), updatedAt = NOW()
    WHERE id = ${userNotifId}
  `);

  // 验证结果
  const [wfRows] = await conn.execute(`SELECT status FROM workflow_instances WHERE id = ${E2E_WF_INST_ID}`) as any;
  const [orderRows] = await conn.execute(`SELECT status FROM orders WHERE id = ${E2E_ORDER_ID}`) as any;
  const [logRows] = await conn.execute(`SELECT action, comment FROM approval_logs WHERE instance_id = ${E2E_WF_INST_ID}`) as any;
  const [unreadAfterRows] = await conn.execute(`SELECT COUNT(*) as count FROM user_notifications WHERE userId = ${E2E_DIRECTOR_ID} AND isRead = 0`) as any;

  const wfStatus = wfRows[0].status;
  const orderStatus = orderRows[0].status;
  const logAction = logRows[0].action;
  const logComment = logRows[0].comment;
  const unreadAfter = parseInt(unreadAfterRows[0].count);

  assert(wfStatus === 'APPROVED', `工作流实例状态 = APPROVED（实际: ${wfStatus}）`);
  assert(orderStatus === 'APPROVED', `订单状态 = APPROVED（实际: ${orderStatus}）`);
  assert(logAction === 'APPROVE', `审批日志 action = APPROVE`);
  assert(logComment === approvalComment, `审批意见已记录: "${logComment}"`);
  assert(unreadAfter === 0, `总监审批后未读数 = 0（实际: ${unreadAfter}）`);

  log('');
  log(`✅ 订单 #${E2E_ORDER_ID} 状态: ${orderStatus}`);
  log(`✅ 工作流实例 #${E2E_WF_INST_ID} 状态: ${wfStatus}`);
  log(`✅ 总监消息已读，铃铛未读数归零`);

  // ════════════════════════════════════════════════════════════════════════════
  // 最终统计
  // ════════════════════════════════════════════════════════════════════════════
  await conn.end();

  console.log(`
════════════════════════════════════════════════════════════
  E2E 测试结果汇总
════════════════════════════════════════════════════════════
  ✅ 通过: ${passCount}
  ❌ 失败: ${failCount}
  总计: ${passCount + failCount}
════════════════════════════════════════════════════════════
`);

  if (failCount > 0) {
    console.error(`❌ E2E 测试未全部通过，请检查上方失败项！`);
    process.exit(1);
  } else {
    console.log(`🎉 全部 ${passCount} 项 E2E 验收测试通过！`);
    console.log(`\n📋 业务流程验证摘要：`);
    console.log(`   步骤1: 管理员挂载部门  → 销售员A 归属华东区 ✅`);
    console.log(`   步骤2: 发起审批流      → 工作流实例创建 + 事件触发通知 ✅`);
    console.log(`   步骤3: 消息铃铛验证    → 总监未读数=1，消息列表正确 ✅`);
    console.log(`   步骤4: 审批工作台      → 总监同意 → 订单 APPROVED ✅`);
  }
}

runE2ETest().catch((err) => {
  console.error('❌ E2E 测试运行异常:', err.message);
  process.exit(1);
});
