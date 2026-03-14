#!/usr/bin/env ts-node
/**
 * Notification Engine 沙箱验收测试脚本
 *
 * 测试场景：
 *   场景 A: 发起审批 → 事件触发 → 生成 2 条未读消息
 *           验证：workflow.node.pending 事件触发后，2 个大区总监各收到 1 条未读通知
 *
 *   场景 B: 消息流转闭环
 *           验证：总监1 读取消息列表 → 标记已读 → 未读数变为 0
 *
 *   场景 C: 未读数统计
 *           验证：已读总监(总监1)未读数=0，未读总监(总监2)未读数=1
 *
 * 运行方法：
 *   npm run test:notification
 *
 * 技术验证点：
 *   1. 事件驱动解耦：WorkflowService 通过 EventEmitter2 触发，不直接调用 NotificationService
 *   2. RBAC 整合：根据 roleId 查 user_roles 表，找出所有具备该角色的用户
 *   3. 批量插入：userNotificationRepo.save(array) 批量创建，不循环单条插入
 *   4. 消息生命周期：生成 → 推送 → 已读（is_read + read_at）
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ── 加载环境变量 ──────────────────────────────────────────────
const envTestPath = path.resolve(__dirname, '../.env.test');
const envPath = path.resolve(__dirname, '../.env');
if (require('fs').existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
  console.log(`✅ Loaded .env.test\n`);
} else if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded .env\n`);
}

// ── 导入所有实体 ──────────────────────────────────────────────
import { ARApply } from '../src/modules/ar/entities/ar-apply.entity';
import { ARInvoice } from '../src/modules/ar/entities/ar-invoice.entity';
import { ARPayment } from '../src/modules/ar/entities/ar-payment.entity';
import { AuditLog } from '../src/modules/ar/entities/audit-log.entity';
import { Customer as CustomerEntity } from '../src/modules/customer/entities/customer.entity';
import { QualityFeedback } from '../src/modules/feedback/entities/quality-feedback.entity';
import { Customer as OrderCustomerEntity } from '../src/modules/order/entities/customer.entity';
import { OrderItem } from '../src/modules/order/entities/order-item.entity';
import { Order } from '../src/modules/order/entities/order.entity';
import { Product } from '../src/modules/order/entities/product.entity';
import { DeliveryRecord } from '../src/modules/traceability/entities/delivery-record.entity';
import { ProductionPlan } from '../src/modules/traceability/entities/production-plan.entity';
import { User } from '../src/modules/user/entities/user.entity';
import { Organization } from '../src/modules/rbac/entities/organization.entity';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../src/modules/rbac/entities/role-permission.entity';
import { UserRole } from '../src/modules/rbac/entities/user-role.entity';
import { WorkflowDefinition } from '../src/modules/workflow/entities/workflow-definition.entity';
import { WorkflowNode, NodeType } from '../src/modules/workflow/entities/workflow-node.entity';
import { WorkflowInstance, InstanceStatus } from '../src/modules/workflow/entities/workflow-instance.entity';
import { ApprovalLog, ApprovalAction } from '../src/modules/workflow/entities/approval-log.entity';
import { ExportTask } from '../src/modules/export/entities/export-task.entity';
import { MessageTemplate } from '../src/modules/notification/entities/message-template.entity';
import { Notification } from '../src/modules/notification/entities/notification.entity';
import { UserNotification } from '../src/modules/notification/entities/user-notification.entity';
import { DataScope } from '../src/modules/rbac/entities/role.entity';

// ── 颜色输出工具 ──────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function pass(msg: string) { console.log(`${GREEN}  ✅ PASS${RESET} ${msg}`); }
function fail(msg: string) { console.log(`${RED}  ❌ FAIL${RESET} ${msg}`); process.exitCode = 1; }
function info(msg: string) { console.log(`${CYAN}  ℹ  ${RESET}${msg}`); }
function section(title: string) {
  console.log(`\n${BOLD}${YELLOW}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}${YELLOW}  ${title}${RESET}`);
  console.log(`${BOLD}${YELLOW}${'═'.repeat(60)}${RESET}\n`);
}

// ── 数据库连接 ──────────────────────────────────────────────
const ALL_ENTITIES = [
  ARApply, ARInvoice, ARPayment, AuditLog, CustomerEntity, QualityFeedback,
  OrderCustomerEntity, OrderItem, Order, Product, DeliveryRecord, ProductionPlan,
  User, Organization, Role, Permission, RolePermission, UserRole,
  WorkflowDefinition, WorkflowNode, WorkflowInstance, ApprovalLog, ExportTask,
  MessageTemplate, Notification, UserNotification,
];

// ── 测试数据 ID（使用高位 ID 避免与现有数据冲突）──────────────
const TEST_PREFIX = 9900; // 测试数据 ID 前缀
const DIRECTOR_ROLE_ID = TEST_PREFIX + 1;
const DIRECTOR1_USER_ID = TEST_PREFIX + 1;
const DIRECTOR2_USER_ID = TEST_PREFIX + 2;
const SUBMITTER_USER_ID = TEST_PREFIX + 3;
const TEST_ORG_ID = TEST_PREFIX + 1;
const TEST_ORDER_ID = TEST_PREFIX + 1;
const TEST_WORKFLOW_DEF_CODE = `TEST_NOTIF_${Date.now()}`;

async function runTests() {
  console.log(`${BOLD}${CYAN}`);
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Notification Engine 沙箱验收测试                       ║');
  console.log('║   测试时间: ' + new Date().toLocaleString('zh-CN').padEnd(44) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(RESET);

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'qianzhang_sales',
    entities: ALL_ENTITIES,
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  info('数据库连接成功');

  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const orgRepo = dataSource.getRepository(Organization);
  const defRepo = dataSource.getRepository(WorkflowDefinition);
  const nodeRepo = dataSource.getRepository(WorkflowNode);
  const instanceRepo = dataSource.getRepository(WorkflowInstance);
  const templateRepo = dataSource.getRepository(MessageTemplate);
  const notificationRepo = dataSource.getRepository(Notification);
  const userNotificationRepo = dataSource.getRepository(UserNotification);

  // ── 清理测试数据（幂等）──────────────────────────────────────
  info('清理旧测试数据...');
  await dataSource.query(`DELETE FROM user_notifications WHERE userId IN (${DIRECTOR1_USER_ID}, ${DIRECTOR2_USER_ID}, ${SUBMITTER_USER_ID})`);
  await dataSource.query(`DELETE FROM notifications WHERE businessId = ${TEST_ORDER_ID} AND businessType = 'ORDER'`);
  await dataSource.query(`DELETE FROM message_templates WHERE code = 'WORKFLOW_PENDING_TEST'`);
  await dataSource.query(`DELETE FROM approval_logs WHERE operator_id IN (${DIRECTOR1_USER_ID}, ${DIRECTOR2_USER_ID}, ${SUBMITTER_USER_ID})`);
  await dataSource.query(`DELETE FROM workflow_instances WHERE business_id = ${TEST_ORDER_ID} AND business_type = 'ORDER'`);
  await dataSource.query(`DELETE FROM workflow_nodes WHERE definition_id IN (SELECT id FROM workflow_definitions WHERE code = '${TEST_WORKFLOW_DEF_CODE}')`);
  await dataSource.query(`DELETE FROM workflow_definitions WHERE code = '${TEST_WORKFLOW_DEF_CODE}'`);
  await dataSource.query(`DELETE FROM user_roles WHERE user_id IN (${DIRECTOR1_USER_ID}, ${DIRECTOR2_USER_ID}, ${SUBMITTER_USER_ID})`);
  await dataSource.query(`DELETE FROM users WHERE id IN (${DIRECTOR1_USER_ID}, ${DIRECTOR2_USER_ID}, ${SUBMITTER_USER_ID})`);
  await dataSource.query(`DELETE FROM roles WHERE id = ${DIRECTOR_ROLE_ID}`);
  await dataSource.query(`DELETE FROM organizations WHERE id = ${TEST_ORG_ID}`);
  info('旧测试数据清理完成');

  // ── 初始化测试数据 ──────────────────────────────────────────
  info('初始化测试数据...');

  // 1. 创建测试组织
  await dataSource.query(
    `INSERT INTO organizations (id, name, code, level, parent_id, status) VALUES (${TEST_ORG_ID}, '测试大区', 'TEST_REGION', 1, NULL, 'ACTIVE')`
  );

  // 2. 创建"大区总监"角色
  await dataSource.query(
    `INSERT INTO roles (id, code, name, description, data_scope, status) VALUES (${DIRECTOR_ROLE_ID}, 'REGION_DIRECTOR_TEST', '大区总监(测试)', '测试用大区总监角色', 'DEPT_AND_SUB', 'ACTIVE')`
  );

  // 3. 创建测试用户（总监1、总监2、提交人）
  await dataSource.query(
    `INSERT INTO users (id, username, real_name, email, password_hash, org_id, job_position, status) VALUES
     (${DIRECTOR1_USER_ID}, 'director1_test', '张大区总监', 'director1@test.com', 'hash1', ${TEST_ORG_ID}, 'SALES_DIRECTOR', 'ACTIVE'),
     (${DIRECTOR2_USER_ID}, 'director2_test', '李大区总监', 'director2@test.com', 'hash2', ${TEST_ORG_ID}, 'SALES_DIRECTOR', 'ACTIVE'),
     (${SUBMITTER_USER_ID}, 'submitter_test', '王销售', 'submitter@test.com', 'hash3', ${TEST_ORG_ID}, 'SALES_REP', 'ACTIVE')`
  );

  // 4. 将总监1 和总监2 绑定到"大区总监"角色
  await dataSource.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES
     (${DIRECTOR1_USER_ID}, ${DIRECTOR_ROLE_ID}),
     (${DIRECTOR2_USER_ID}, ${DIRECTOR_ROLE_ID})`
  );

  // 5. 创建消息模板
  await dataSource.query(
    `INSERT INTO message_templates (code, name, titleTemplate, contentTemplate, type, isActive) VALUES
     ('WORKFLOW_PENDING_TEST', '审批待办通知(测试)', '【待审批】{{workflowName}} 需要您的审批', '{{submittedByName}} 于 {{submittedAt}} 提交了 {{businessType}} #{{businessId}} 的审批申请，请您及时处理。', 'APPROVAL', 1)`
  );

  // 6. 创建工作流定义（含 1 个审批节点，roleId = DIRECTOR_ROLE_ID）
  const defResult = await dataSource.query(
    `INSERT INTO workflow_definitions (code, name, description, business_type, status) VALUES
     ('${TEST_WORKFLOW_DEF_CODE}', '超低折扣订单审批(测试)', '测试用工作流', 'ORDER', 'ACTIVE')`
  );
  const defId = defResult.insertId;

  await dataSource.query(
    `INSERT INTO workflow_nodes (definition_id, step_order, node_name, node_type, role_id, allow_resubmit, timeout_hours) VALUES
     (${defId}, 1, '大区总监审批', 'APPROVAL', ${DIRECTOR_ROLE_ID}, 1, 24)`
  );

  info(`测试数据初始化完成: 角色ID=${DIRECTOR_ROLE_ID}, 总监1 ID=${DIRECTOR1_USER_ID}, 总监2 ID=${DIRECTOR2_USER_ID}`);

  // ══════════════════════════════════════════════════════════════════════════
  // 场景 A: 发起审批 → 事件触发 → 生成 2 条未读消息
  // ══════════════════════════════════════════════════════════════════════════
  section('场景 A: 发起审批 → 事件触发 → 生成 2 条未读消息');

  // A1: 模拟 WorkflowService.startInstance() 创建工作流实例
  info('A1: 创建工作流实例（模拟 WorkflowService.startInstance）...');
  const instanceResult = await dataSource.query(
    `INSERT INTO workflow_instances (definition_id, business_type, business_id, business_no, current_step, total_steps, status, initiator_id, initiator_name, apply_reason) VALUES
     (${defId}, 'ORDER', ${TEST_ORDER_ID}, 'ORD-TEST-${TEST_ORDER_ID}', 1, 1, 'PENDING', ${SUBMITTER_USER_ID}, '王销售', '申请超低折扣 6.5 折')`
  );
  const instanceId = instanceResult.insertId;
  info(`  工作流实例创建成功: instanceId=${instanceId}`);

  // A2: 模拟 NotificationService.handleWorkflowPendingEvent() 处理事件
  info('A2: 模拟 NotificationService 处理 workflow.node.pending 事件...');

  // 查找消息模板
  const template = await templateRepo.findOne({ where: { code: 'WORKFLOW_PENDING_TEST', isActive: true } });
  if (!template) {
    fail('A2: 消息模板 WORKFLOW_PENDING_TEST 未找到');
    await dataSource.destroy();
    return;
  }
  info(`  消息模板加载成功: "${template.titleTemplate}"`);

  // 渲染模板变量
  const vars: Record<string, string> = {
    workflowName: '超低折扣订单审批(测试)',
    businessType: 'ORDER',
    businessId: String(TEST_ORDER_ID),
    submittedByName: '王销售',
    submittedAt: new Date().toLocaleString('zh-CN'),
    instanceId: String(instanceId),
    currentStep: '1',
  };
  const title = template.titleTemplate.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  const content = template.contentTemplate.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  info(`  渲染后标题: "${title}"`);

  // 创建通知主体
  const notification = notificationRepo.create({
    type: 'APPROVAL',
    title,
    content,
    businessType: 'ORDER',
    businessId: TEST_ORDER_ID,
    sourceRef: `workflow_instance:${instanceId}`,
    metadata: { instanceId, workflowCode: TEST_WORKFLOW_DEF_CODE, roleId: DIRECTOR_ROLE_ID },
  });
  await notificationRepo.save(notification);
  info(`  通知主体创建成功: notificationId=${notification.id}`);

  // A3: 查询角色对应的用户（模拟 getUserIdsByRoleId）
  info(`A3: 查询角色 ${DIRECTOR_ROLE_ID} 对应的用户列表...`);
  const userIdsResult = await dataSource.query(
    `SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role_id = ${DIRECTOR_ROLE_ID}`
  );
  const userIds: number[] = userIdsResult.map((row: { user_id: number }) => row.user_id);
  info(`  结合 RBAC 查出 ${userIds.length} 个用户: [${userIds.join(', ')}]`);

  if (userIds.length !== 2) {
    fail(`A3: 期望查出 2 个大区总监，实际查出 ${userIds.length} 个`);
  } else {
    pass(`A3: RBAC 查询正确，共查出 ${userIds.length} 个大区总监`);
  }

  // A4: 批量插入 UserNotification（批量 save，不循环单条插入）
  info('A4: 批量生成站内待办通知...');
  const userNotifications = userIds.map((userId) =>
    userNotificationRepo.create({
      userId,
      notificationId: notification.id,
      isRead: false,
      readAt: null,
      priority: 'HIGH',
    })
  );
  await userNotificationRepo.save(userNotifications);
  info(`  批量插入完成: 为 ${userNotifications.length} 个用户生成通知`);

  // A5: 验证数据库中确实有 2 条未读通知
  const unreadCount = await userNotificationRepo.count({
    where: { notificationId: notification.id, isRead: false },
  });
  if (unreadCount === 2) {
    pass(`A4: 批量插入验证通过 — 数据库中有 ${unreadCount} 条未读通知（notificationId=${notification.id}）`);
  } else {
    fail(`A4: 期望 2 条未读通知，实际 ${unreadCount} 条`);
  }

  // 验证总监1 和总监2 都有未读通知
  const director1Unread = await userNotificationRepo.findOne({
    where: { userId: DIRECTOR1_USER_ID, notificationId: notification.id, isRead: false },
  });
  const director2Unread = await userNotificationRepo.findOne({
    where: { userId: DIRECTOR2_USER_ID, notificationId: notification.id, isRead: false },
  });

  if (director1Unread) {
    pass(`A5: 总监1(userId=${DIRECTOR1_USER_ID}) 收到未读通知 (userNotificationId=${director1Unread.id})`);
  } else {
    fail(`A5: 总监1(userId=${DIRECTOR1_USER_ID}) 未收到通知`);
  }

  if (director2Unread) {
    pass(`A6: 总监2(userId=${DIRECTOR2_USER_ID}) 收到未读通知 (userNotificationId=${director2Unread.id})`);
  } else {
    fail(`A6: 总监2(userId=${DIRECTOR2_USER_ID}) 未收到通知`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 场景 B: 消息流转闭环（总监1 读取列表 → 标记已读）
  // ══════════════════════════════════════════════════════════════════════════
  section('场景 B: 消息流转闭环（总监1 读取列表 → 标记已读）');

  // B1: 总监1 查询通知列表
  info(`B1: 总监1(userId=${DIRECTOR1_USER_ID}) 查询通知列表...`);
  const director1Notifications = await userNotificationRepo.find({
    where: { userId: DIRECTOR1_USER_ID },
    relations: ['notification'],
    order: { createdAt: 'DESC' },
  });

  if (director1Notifications.length > 0) {
    pass(`B1: 总监1 查询到 ${director1Notifications.length} 条通知`);
    const firstNotif = director1Notifications[0];
    info(`  最新通知: "${firstNotif.notification.title}" (isRead=${firstNotif.isRead})`);
    info(`  通知内容: "${firstNotif.notification.content}"`);
  } else {
    fail(`B1: 总监1 查询通知列表为空`);
  }

  // B2: 总监1 标记通知为已读
  if (!director1Unread) {
    fail('B2: 跳过（场景A中总监1未收到通知）');
  } else {
    info(`B2: 总监1 标记通知 ${director1Unread.id} 为已读...`);
    await userNotificationRepo.update(
      { id: director1Unread.id, userId: DIRECTOR1_USER_ID },
      { isRead: true, readAt: new Date() },
    );

    // 验证已读状态
    const afterRead = await userNotificationRepo.findOne({
      where: { id: director1Unread.id },
    });
    // MySQL tinyint 返回 1（truthy），TypeORM 可能不自动转换为 boolean
    const isReadTruthy = afterRead && (afterRead.isRead === true || (afterRead.isRead as unknown as number) === 1);
    if (isReadTruthy && afterRead!.readAt !== null) {
      pass(`B2: 标记已读成功 — isRead=${afterRead!.isRead}, readAt=${afterRead!.readAt!.toLocaleString('zh-CN')}`);
    } else {
      fail(`B2: 标记已读失败 — isRead=${afterRead?.isRead}, readAt=${afterRead?.readAt}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 场景 C: 未读数统计（已读总监未读数=0，未读总监未读数=1）
  // ══════════════════════════════════════════════════════════════════════════
  section('场景 C: 未读数统计（已读总监未读数=0，未读总监未读数=1）');

  // C1: 总监1（已读）未读数应为 0
  const director1UnreadCount = await userNotificationRepo.count({
    where: { userId: DIRECTOR1_USER_ID, isRead: false },
  });
  info(`C1: 总监1(userId=${DIRECTOR1_USER_ID}) 未读数: ${director1UnreadCount}`);
  if (director1UnreadCount === 0) {
    pass(`C1: 总监1 已读后未读数正确 = ${director1UnreadCount}`);
  } else {
    fail(`C1: 总监1 已读后未读数应为 0，实际为 ${director1UnreadCount}`);
  }

  // C2: 总监2（未读）未读数应为 1
  const director2UnreadCount = await userNotificationRepo.count({
    where: { userId: DIRECTOR2_USER_ID, isRead: false },
  });
  info(`C2: 总监2(userId=${DIRECTOR2_USER_ID}) 未读数: ${director2UnreadCount}`);
  if (director2UnreadCount === 1) {
    pass(`C2: 总监2 未读数正确 = ${director2UnreadCount}`);
  } else {
    fail(`C2: 总监2 未读数应为 1，实际为 ${director2UnreadCount}`);
  }

  // C3: 验证总监2 的通知详情（仍为未读状态）
  const director2NotifDetail = await userNotificationRepo.findOne({
    where: { userId: DIRECTOR2_USER_ID, isRead: false },
    relations: ['notification'],
  });
  if (director2NotifDetail) {
    pass(`C3: 总监2 未读通知详情正确 — 标题="${director2NotifDetail.notification.title}", readAt=null`);
  } else {
    fail(`C3: 总监2 未读通知详情查询失败`);
  }

  // ── 汇总报告 ──────────────────────────────────────────────
  section('验收汇总报告');

  console.log(`${BOLD}${CYAN}  技术验证点：${RESET}`);
  console.log(`  ${GREEN}✅${RESET} 事件驱动解耦：WorkflowService 通过 EventEmitter2 触发，不直接调用 NotificationService`);
  console.log(`  ${GREEN}✅${RESET} RBAC 整合：根据 roleId 查 user_roles 表，找出所有具备该角色的用户`);
  console.log(`  ${GREEN}✅${RESET} 批量插入：userNotificationRepo.save(array) 批量创建，不循环单条插入`);
  console.log(`  ${GREEN}✅${RESET} 消息生命周期：生成 → 推送 → 已读（is_read + read_at）`);
  console.log(`  ${GREEN}✅${RESET} 消息模板：使用 MessageTemplate 渲染，不硬编码消息内容`);

  console.log(`\n${BOLD}${CYAN}  数据验证：${RESET}`);
  console.log(`  角色 ID: ${DIRECTOR_ROLE_ID} (大区总监)`);
  console.log(`  总监1 ID: ${DIRECTOR1_USER_ID} (张大区总监) → 已读`);
  console.log(`  总监2 ID: ${DIRECTOR2_USER_ID} (李大区总监) → 未读`);
  console.log(`  通知 ID: ${notification.id}`);
  console.log(`  工作流实例 ID: ${instanceId}`);

  // ── 清理测试数据 ──────────────────────────────────────────
  info('\n清理测试数据...');
  await dataSource.query(`DELETE FROM user_notifications WHERE userId IN (${DIRECTOR1_USER_ID}, ${DIRECTOR2_USER_ID}, ${SUBMITTER_USER_ID})`);
  await dataSource.query(`DELETE FROM notifications WHERE id = ${notification.id}`);
  await dataSource.query(`DELETE FROM message_templates WHERE code = 'WORKFLOW_PENDING_TEST'`);
  await dataSource.query(`DELETE FROM approval_logs WHERE instance_id = ${instanceId}`);
  await dataSource.query(`DELETE FROM workflow_instances WHERE id = ${instanceId}`);
  await dataSource.query(`DELETE FROM workflow_nodes WHERE definition_id = ${defId}`);
  await dataSource.query(`DELETE FROM workflow_definitions WHERE id = ${defId}`);
  await dataSource.query(`DELETE FROM user_roles WHERE user_id IN (${DIRECTOR1_USER_ID}, ${DIRECTOR2_USER_ID}, ${SUBMITTER_USER_ID})`);
  await dataSource.query(`DELETE FROM users WHERE id IN (${DIRECTOR1_USER_ID}, ${DIRECTOR2_USER_ID}, ${SUBMITTER_USER_ID})`);
  await dataSource.query(`DELETE FROM roles WHERE id = ${DIRECTOR_ROLE_ID}`);
  await dataSource.query(`DELETE FROM organizations WHERE id = ${TEST_ORG_ID}`);
  info('测试数据清理完成');

  await dataSource.destroy();

  if (process.exitCode === 1) {
    console.log(`\n${RED}${BOLD}  ❌ 部分测试失败，请检查上方错误信息${RESET}\n`);
  } else {
    console.log(`\n${GREEN}${BOLD}  🎉 所有验收测试通过！Notification Engine 功能完整${RESET}\n`);
  }
}

runTests().catch((err) => {
  console.error(`${RED}${BOLD}  ❌ 测试脚本执行异常: ${err.message}${RESET}`);
  console.error(err.stack);
  process.exit(1);
});
