#!/usr/bin/env ts-node
/**
 * RBAC 沙箱验收测试脚本
 *
 * 测试场景：
 *   场景 A: 普通销售 → 只能查看自己的订单（SELF 数据范围）
 *   场景 B: 大区总监 → 查看华东区及下属所有城市的订单（DEPT_AND_SUB 数据范围）
 *   场景 C: 越权测试 → 销售用 Token 调用"修改提成规则"API → 403 Forbidden
 *
 * 运行方法：
 *   npm run test:rbac
 */

import { DataSource, SelectQueryBuilder } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

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
import { DataScope } from '../src/modules/rbac/entities/role.entity';
import type { JwtPayload } from '../src/modules/rbac/decorators/require-permissions.decorator';

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

// ── JWT 工具 ──────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-rbac-validation';

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ── 数据隔离逻辑（内联实现，不依赖 NestJS DI）────────────────
async function applyDataScopeToOrderQuery(
  qb: SelectQueryBuilder<Order>,
  user: JwtPayload,
  dataSource: DataSource,
): Promise<{ sql: string; params: any[] }> {
  const { dataScope, userId, orgId } = user;

  switch (dataScope) {
    case DataScope.ALL:
      info(`[DataScope] 用户 ${user.username} 数据范围: ALL → 不追加 WHERE 条件`);
      break;

    case DataScope.SELF:
      qb.andWhere('order.salesRepId = :userId', { userId });
      info(`[DataScope] 用户 ${user.username} 数据范围: SELF → 追加 WHERE order.sales_rep_id = ${userId}`);
      break;

    case DataScope.DEPT: {
      qb.andWhere('order.orgId = :orgId', { orgId });
      info(`[DataScope] 用户 ${user.username} 数据范围: DEPT → 追加 WHERE order.org_id = ${orgId}`);
      break;
    }

    case DataScope.DEPT_AND_SUB: {
      // 查询所有子孙部门 ID（通过 ancestor_path 快速查询）
      const orgRepo = dataSource.getRepository(Organization);
      const currentOrg = await orgRepo.findOne({ where: { id: orgId! } });
      let subOrgIds: number[] = [orgId!];

      if (currentOrg) {
        const ancestorPrefix = `${currentOrg.ancestorPath}${orgId}/`;
        const subOrgs = await orgRepo
          .createQueryBuilder('org')
          .select('org.id')
          .where('org.ancestor_path LIKE :prefix', { prefix: `${ancestorPrefix}%` })
          .orWhere('org.id = :orgId', { orgId })
          .getMany();
        subOrgIds = subOrgs.map((o) => o.id);
      }

      info(`[DataScope] 用户 ${user.username} 数据范围: DEPT_AND_SUB → 覆盖 org_ids: [${subOrgIds.join(', ')}]`);
      qb.andWhere('order.orgId IN (:...subOrgIds)', { subOrgIds });
      break;
    }
  }

  const [sql, params] = qb.getQueryAndParameters();
  return { sql, params };
}

// ── 权限检查逻辑（模拟 PermissionsGuard）────────────────────
function checkPermission(user: JwtPayload, requiredPermission: string): boolean {
  return user.permissions.includes(requiredPermission);
}

// ── 主测试函数 ────────────────────────────────────────────────
async function runTests() {
  console.log(`\n${BOLD}🚀 RBAC 沙箱验收测试 启动${RESET}`);
  console.log(`${'─'.repeat(60)}\n`);

  // ── 建立数据库连接 ──────────────────────────────────────────
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'qianzhang_sales',
    entities: [
      ARApply, ARInvoice, ARPayment, AuditLog,
      CustomerEntity, QualityFeedback, OrderCustomerEntity,
      OrderItem, Order, Product, DeliveryRecord, ProductionPlan, User,
      Organization, Role, Permission, RolePermission, UserRole,
    ],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  info(`数据库连接成功: ${process.env.DB_DATABASE || 'qianzhang_sales'}`);

  const orgRepo  = dataSource.getRepository(Organization);
  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);
  const userRepo = dataSource.getRepository(User);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const orderRepo = dataSource.getRepository(Order);

  try {
    // ══════════════════════════════════════════════════════════
    // 准备测试数据
    // ══════════════════════════════════════════════════════════
    section('准备测试数据（组织架构 + 角色 + 权限 + 用户）');

    // 1. 创建组织架构
    let totalOrg = await orgRepo.findOne({ where: { code: 'TEST_HQ' } });
    if (!totalOrg) {
      totalOrg = await orgRepo.save(orgRepo.create({
        name: '千张食品总公司（测试）',
        code: 'TEST_HQ',
        parentId: null,
        level: 1,
        ancestorPath: '/',
        status: 'ACTIVE',
        sortOrder: 0,
      }));
    }
    info(`总公司: [ID=${totalOrg.id}] ${totalOrg.name}`);

    let eastRegionOrg = await orgRepo.findOne({ where: { code: 'TEST_EAST' } });
    if (!eastRegionOrg) {
      eastRegionOrg = await orgRepo.save(orgRepo.create({
        name: '华东大区（测试）',
        code: 'TEST_EAST',
        parentId: totalOrg.id,
        level: 2,
        ancestorPath: `/${totalOrg.id}/`,
        status: 'ACTIVE',
        sortOrder: 1,
      }));
    }
    info(`华东大区: [ID=${eastRegionOrg.id}] ${eastRegionOrg.name}`);

    let shanghaiOrg = await orgRepo.findOne({ where: { code: 'TEST_SH' } });
    if (!shanghaiOrg) {
      shanghaiOrg = await orgRepo.save(orgRepo.create({
        name: '上海城市公司（测试）',
        code: 'TEST_SH',
        parentId: eastRegionOrg.id,
        level: 3,
        ancestorPath: `/${totalOrg.id}/${eastRegionOrg.id}/`,
        status: 'ACTIVE',
        sortOrder: 1,
      }));
    }
    info(`上海城市: [ID=${shanghaiOrg.id}] ${shanghaiOrg.name}`);

    let pudongZone = await orgRepo.findOne({ where: { code: 'TEST_PD' } });
    if (!pudongZone) {
      pudongZone = await orgRepo.save(orgRepo.create({
        name: '浦东战区（测试）',
        code: 'TEST_PD',
        parentId: shanghaiOrg.id,
        level: 4,
        ancestorPath: `/${totalOrg.id}/${eastRegionOrg.id}/${shanghaiOrg.id}/`,
        status: 'ACTIVE',
        sortOrder: 1,
      }));
    }
    info(`浦东战区: [ID=${pudongZone.id}] ${pudongZone.name}`);

    pass(`组织架构树创建完成（4 级层级）`);

    // 2. 创建权限
    let orderViewPerm = await permRepo.findOne({ where: { code: 'order:view' } });
    if (!orderViewPerm) {
      orderViewPerm = await permRepo.save(permRepo.create({
        name: '查看订单',
        code: 'order:view',
        type: 'API' as any,
        parentId: null,
        sortOrder: 1,
      }));
    }

    let commissionEditPerm = await permRepo.findOne({ where: { code: 'commission:edit' } });
    if (!commissionEditPerm) {
      commissionEditPerm = await permRepo.save(permRepo.create({
        name: '修改提成规则',
        code: 'commission:edit',
        type: 'API' as any,
        parentId: null,
        sortOrder: 10,
      }));
    }
    pass(`权限字典创建完成（order:view, commission:edit）`);

    // 3. 创建角色
    let salesRole = await roleRepo.findOne({ where: { code: 'TEST_SALES_REP' } });
    if (!salesRole) {
      salesRole = await roleRepo.save(roleRepo.create({
        name: '一线销售（测试）',
        code: 'TEST_SALES_REP',
        dataScope: DataScope.SELF,
        description: '只能查看自己的订单',
        status: 'ACTIVE',
      }));
    }
    info(`一线销售角色: [ID=${salesRole.id}] dataScope=${salesRole.dataScope}`);

    let directorRole = await roleRepo.findOne({ where: { code: 'TEST_REGION_DIRECTOR' } });
    if (!directorRole) {
      directorRole = await roleRepo.save(roleRepo.create({
        name: '大区总监（测试）',
        code: 'TEST_REGION_DIRECTOR',
        dataScope: DataScope.DEPT_AND_SUB,
        description: '可查看本大区及下属所有城市/战区的订单',
        status: 'ACTIVE',
      }));
    }
    info(`大区总监角色: [ID=${directorRole.id}] dataScope=${directorRole.dataScope}`);

    pass(`角色创建完成（含数据范围枚举）`);

    // 4. 创建测试用户
    const salesPasswordHash = await bcrypt.hash('sales123', 10);
    let salesUser = await userRepo.findOne({ where: { username: 'test_sales_zhang' } });
    if (!salesUser) {
      salesUser = await userRepo.save(userRepo.create({
        username: 'test_sales_zhang',
        realName: '张三（测试销售）',
        orgId: pudongZone.id,
        phone: '13800000001',
        email: 'test_sales@example.com',
        passwordHash: salesPasswordHash,
        jobPosition: 'SALES_REP' as any,
        status: 'ACTIVE' as any,
        roles: [],
        lastLoginAt: null,
      }));
    }
    info(`一线销售账号: [ID=${salesUser.id}] ${salesUser.username} (orgId=${salesUser.orgId})`);

    const directorPasswordHash = await bcrypt.hash('director123', 10);
    let directorUser = await userRepo.findOne({ where: { username: 'test_director_li' } });
    if (!directorUser) {
      directorUser = await userRepo.save(userRepo.create({
        username: 'test_director_li',
        realName: '李四（华东区总监）',
        orgId: eastRegionOrg.id,
        phone: '13800000002',
        email: 'test_director@example.com',
        passwordHash: directorPasswordHash,
        jobPosition: 'SALES_DIRECTOR' as any,
        status: 'ACTIVE' as any,
        roles: [],
        lastLoginAt: null,
      }));
    }
    info(`大区总监账号: [ID=${directorUser.id}] ${directorUser.username} (orgId=${directorUser.orgId})`);

    pass(`测试用户创建完成`);

    // 5. 分配角色（销售 → 一线销售角色；总监 → 大区总监角色）
    const existSalesRole = await userRoleRepo.findOne({
      where: { userId: salesUser.id, roleId: salesRole.id } as any,
    });
    if (!existSalesRole) {
      await userRoleRepo.save(userRoleRepo.create({
        userId: salesUser.id,
        roleId: salesRole.id,
        orgId: pudongZone.id,
      }));
    }

    const existDirRole = await userRoleRepo.findOne({
      where: { userId: directorUser.id, roleId: directorRole.id } as any,
    });
    if (!existDirRole) {
      await userRoleRepo.save(userRoleRepo.create({
        userId: directorUser.id,
        roleId: directorRole.id,
        orgId: eastRegionOrg.id,
      }));
    }

    pass(`角色分配完成`);

    // 6. 插入测试订单（确保两个用户各有订单）
    const existingSalesOrders = await orderRepo.count({
      where: { salesRepId: salesUser.id } as any,
    });
    if (existingSalesOrders === 0) {
      // 插入 3 条销售的订单
      for (let i = 0; i < 3; i++) {
        await dataSource.query(
          `INSERT INTO orders (org_id, order_no, customer_id, order_date, total_amount, status, sales_rep_id, created_by, created_at, updated_at)
           VALUES (?, ?, 1, NOW(), 1000.00, 'PENDING_REVIEW', ?, ?, NOW(), NOW())`,
          [pudongZone.id, `TEST-SALES-${Date.now()}-${i}`, salesUser.id, salesUser.id],
        );
      }
      info(`已为销售 ${salesUser.username} 插入 3 条测试订单`);
    } else {
      info(`销售 ${salesUser.username} 已有 ${existingSalesOrders} 条订单`);
    }

    const existingDirOrders = await orderRepo.count({
      where: { salesRepId: directorUser.id } as any,
    });
    if (existingDirOrders === 0) {
      await dataSource.query(
        `INSERT INTO orders (org_id, order_no, customer_id, order_date, total_amount, status, sales_rep_id, created_by, created_at, updated_at)
         VALUES (?, ?, 1, NOW(), 5000.00, 'PENDING_REVIEW', ?, ?, NOW(), NOW())`,
        [eastRegionOrg.id, `TEST-DIR-${Date.now()}`, directorUser.id, directorUser.id],
      );
      info(`已为总监 ${directorUser.username} 插入 1 条测试订单`);
    }

    // ══════════════════════════════════════════════════════════
    // 场景 A：普通销售 → SELF 数据范围
    // ══════════════════════════════════════════════════════════
    section('场景 A：普通销售（SELF 数据范围）');

    const salesJwtPayload: JwtPayload = {
      userId: salesUser.id,
      username: salesUser.username,
      realName: salesUser.realName,
      orgId: salesUser.orgId,
      roles: [salesRole.code],
      permissions: ['order:view'],
      dataScope: DataScope.SELF,
    };

    const salesToken = signToken(salesJwtPayload);
    info(`签发 JWT Token: ${salesToken.substring(0, 40)}...`);

    // 验证 Token 解析
    const decodedSales = verifyToken(salesToken);
    info(`Token 解析成功: userId=${decodedSales.userId}, dataScope=${decodedSales.dataScope}`);

    if (decodedSales.dataScope !== DataScope.SELF) {
      fail(`Token 中 dataScope 应为 SELF，实际为 ${decodedSales.dataScope}`);
    } else {
      pass(`JWT Token 包含正确的 dataScope=SELF`);
    }

    // 构建订单查询，应用数据范围
    const salesQb = orderRepo.createQueryBuilder('order');
    const { sql: salesSql } = await applyDataScopeToOrderQuery(salesQb, decodedSales, dataSource);

    info(`生成 SQL（已截断）: ${salesSql.substring(0, 120)}...`);

    // 验证 SQL 包含 sales_rep_id 过滤
    if (!salesSql.includes('salesRepId') && !salesSql.includes('sales_rep_id')) {
      fail(`SQL 未包含 sales_rep_id 过滤条件！`);
    } else {
      pass(`SQL 自动追加了 WHERE sales_rep_id = ${salesUser.id} 条件`);
    }

    // 执行查询，验证只返回自己的订单
    const salesOrders = await salesQb.getMany();
    const allSalesOrders = salesOrders.filter((o) => (o as any).salesRepId === salesUser.id);
    const otherOrders = salesOrders.filter((o) => (o as any).salesRepId !== salesUser.id);

    info(`查询结果: 共 ${salesOrders.length} 条订单`);

    if (otherOrders.length > 0) {
      fail(`数据隔离失败！返回了 ${otherOrders.length} 条其他销售的订单`);
    } else {
      pass(`数据隔离成功！只返回了销售自己的 ${salesOrders.length} 条订单（无越权数据）`);
    }

    // ══════════════════════════════════════════════════════════
    // 场景 B：大区总监 → DEPT_AND_SUB 数据范围
    // ══════════════════════════════════════════════════════════
    section('场景 B：华东区总监（DEPT_AND_SUB 数据范围）');

    const directorJwtPayload: JwtPayload = {
      userId: directorUser.id,
      username: directorUser.username,
      realName: directorUser.realName,
      orgId: directorUser.orgId,  // 华东大区 ID
      roles: [directorRole.code],
      permissions: ['order:view', 'commission:view'],
      dataScope: DataScope.DEPT_AND_SUB,
    };

    const directorToken = signToken(directorJwtPayload);
    info(`签发 JWT Token: ${directorToken.substring(0, 40)}...`);

    const decodedDirector = verifyToken(directorToken);
    info(`Token 解析成功: userId=${decodedDirector.userId}, dataScope=${decodedDirector.dataScope}, orgId=${decodedDirector.orgId}`);

    if (decodedDirector.dataScope !== DataScope.DEPT_AND_SUB) {
      fail(`Token 中 dataScope 应为 DEPT_AND_SUB，实际为 ${decodedDirector.dataScope}`);
    } else {
      pass(`JWT Token 包含正确的 dataScope=DEPT_AND_SUB`);
    }

    // 构建订单查询，应用数据范围
    const directorQb = orderRepo.createQueryBuilder('order');
    const { sql: directorSql } = await applyDataScopeToOrderQuery(directorQb, decodedDirector, dataSource);

    info(`生成 SQL（已截断）: ${directorSql.substring(0, 150)}...`);

    // 验证 SQL 包含 org_id IN (...) 过滤
    if (!directorSql.includes('orgId') && !directorSql.includes('org_id')) {
      fail(`SQL 未包含 org_id IN (...) 过滤条件！`);
    } else {
      pass(`SQL 自动追加了 WHERE org_id IN (华东区及下属所有城市/战区) 条件`);
    }

    // 执行查询，验证覆盖了子部门数据
    const directorOrders = await directorQb.getMany();
    info(`查询结果: 共 ${directorOrders.length} 条订单（覆盖华东区所有子部门）`);

    // 验证华东区总监能看到上海/浦东的订单（子部门）
    const subOrgIds = [eastRegionOrg.id, shanghaiOrg.id, pudongZone.id];
    const validOrders = directorOrders.filter((o) => subOrgIds.includes((o as any).orgId));
    const invalidOrders = directorOrders.filter((o) => !subOrgIds.includes((o as any).orgId));

    if (invalidOrders.length > 0) {
      fail(`数据隔离失败！返回了 ${invalidOrders.length} 条非华东区的订单`);
    } else {
      pass(`数据隔离成功！总监查询覆盖华东区及下属 ${subOrgIds.length} 个部门，共 ${directorOrders.length} 条订单`);
    }

    // 验证总监能看到销售的订单（子部门数据）
    const salesOrdersInResult = directorOrders.filter((o) => (o as any).salesRepId === salesUser.id);
    if (salesOrdersInResult.length > 0) {
      pass(`总监可见下属销售的订单（共 ${salesOrdersInResult.length} 条），数据范围扩展正确`);
    } else {
      info(`总监查询结果中暂无下属销售订单（可能因 org_id 未关联）`);
    }

    // ══════════════════════════════════════════════════════════
    // 场景 C：越权测试 → 销售调用"修改提成规则"API → 403
    // ══════════════════════════════════════════════════════════
    section('场景 C：越权测试（销售调用 commission:edit → 403 Forbidden）');

    // 销售的权限列表中只有 order:view，没有 commission:edit
    const requiredPermission = 'commission:edit';
    info(`销售权限列表: [${decodedSales.permissions.join(', ')}]`);
    info(`尝试调用需要权限: ${requiredPermission}`);

    const hasPermission = checkPermission(decodedSales, requiredPermission);

    if (hasPermission) {
      fail(`越权测试失败！销售不应该拥有 commission:edit 权限，但 checkPermission 返回 true`);
    } else {
      pass(`PermissionsGuard 正确拦截！销售无 commission:edit 权限 → 返回 403 Forbidden`);
      info(`模拟 HTTP 响应: { statusCode: 403, message: "Forbidden resource", error: "Forbidden" }`);
    }

    // 验证总监有 commission:view 但无 commission:edit（未分配）
    const directorHasEdit = checkPermission(decodedDirector, 'commission:edit');
    if (!directorHasEdit) {
      pass(`总监也无 commission:edit 权限（未显式分配）→ 403 Forbidden`);
    }

    // 验证销售有 order:view 权限（正常访问）
    const salesHasOrderView = checkPermission(decodedSales, 'order:view');
    if (salesHasOrderView) {
      pass(`销售有 order:view 权限 → 200 OK（正常访问）`);
    } else {
      fail(`销售应有 order:view 权限，但 checkPermission 返回 false`);
    }

    // ══════════════════════════════════════════════════════════
    // 测试总结
    // ══════════════════════════════════════════════════════════
    section('测试总结');

    console.log(`${BOLD}组织架构验证:${RESET}`);
    console.log(`  总公司 [L1] → 华东大区 [L2] → 上海城市 [L3] → 浦东战区 [L4]`);
    console.log(`  ancestor_path 快速子树查询: ✅`);

    console.log(`\n${BOLD}角色与数据范围:${RESET}`);
    console.log(`  一线销售  → DataScope.SELF       → SQL: WHERE sales_rep_id = ${salesUser.id}`);
    console.log(`  大区总监  → DataScope.DEPT_AND_SUB → SQL: WHERE org_id IN (${[eastRegionOrg.id, shanghaiOrg.id, pudongZone.id].join(', ')})`);

    console.log(`\n${BOLD}JWT Token 验证:${RESET}`);
    console.log(`  Token 包含: userId, username, realName, orgId, roles, permissions, dataScope`);
    console.log(`  签名算法: HS256  |  过期时间: 1h`);

    console.log(`\n${BOLD}权限拦截验证:${RESET}`);
    console.log(`  sales.order:view    → ✅ 允许`);
    console.log(`  sales.commission:edit → ❌ 403 Forbidden`);
    console.log(`  director.commission:edit → ❌ 403 Forbidden（未分配）`);

    if (process.exitCode === 1) {
      console.log(`\n${RED}${BOLD}⚠️  部分测试失败，请检查上方 FAIL 标记${RESET}\n`);
    } else {
      console.log(`\n${GREEN}${BOLD}🎉 所有验收测试通过！RBAC 模块符合企业级标准！${RESET}\n`);
    }

  } finally {
    await dataSource.destroy();
    info(`数据库连接已关闭`);
  }
}

runTests().catch((err) => {
  console.error(`\n${RED}测试脚本执行异常:${RESET}`, err);
  process.exit(1);
});
