#!/usr/bin/env ts-node
/**
 * Database Synchronization Script
 *
 * 用途：一键自动创建数据库表（基于TypeORM entities）
 *
 * 使用方法：
 *   npm run db:sync
 *
 * 重要：此脚本必须与 app.module.ts 中的 entities 列表保持 100% 一致
 *       任何新增的 Entity 都必须在此处显式导入
 *
 * 当前实体数：26（原有 13 + RBAC 5 + Workflow 4 + Export 1 + Notification 3）
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ========================================
// 显式导入所有实体（与 app.module.ts 保持 100% 一致）
// ========================================

// 原有业务实体（13 个）
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

// RBAC 实体（5 个）
import { Organization } from '../src/modules/rbac/entities/organization.entity';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../src/modules/rbac/entities/role-permission.entity';
import { UserRole } from '../src/modules/rbac/entities/user-role.entity';

// Workflow 实体（4 个）
import { WorkflowDefinition } from '../src/modules/workflow/entities/workflow-definition.entity';
import { WorkflowNode } from '../src/modules/workflow/entities/workflow-node.entity';
import { WorkflowInstance } from '../src/modules/workflow/entities/workflow-instance.entity';
import { ApprovalLog } from '../src/modules/workflow/entities/approval-log.entity';

// Export 实体（1 个）
import { ExportTask } from '../src/modules/export/entities/export-task.entity';

// Notification 实体（3 个新增）
import { MessageTemplate } from '../src/modules/notification/entities/message-template.entity';
import { Notification } from '../src/modules/notification/entities/notification.entity';
import { UserNotification } from '../src/modules/notification/entities/user-notification.entity';

// 加载 .env 文件
// 优先尝试 .env.test（测试环境），其次尝试 .env（生产环境）
const envTestPath = path.resolve(__dirname, '../.env.test');
const envPath = path.resolve(__dirname, '../.env');

if (require('fs').existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
  console.log(`✅ Loaded .env.test from: ${envTestPath}\n`);
} else if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded .env from: ${envPath}\n`);
} else {
  console.warn(`⚠️  No .env file found, using default values\n`);
}

// 数据库配置
const ALL_ENTITIES = [
  // 原有业务实体（13 个）
  ARApply,
  ARInvoice,
  ARPayment,
  AuditLog,
  CustomerEntity,
  QualityFeedback,
  OrderCustomerEntity,
  OrderItem,
  Order,
  Product,
  DeliveryRecord,
  ProductionPlan,
  User,
  // RBAC 实体（5 个）
  Organization,
  Role,
  Permission,
  RolePermission,
  UserRole,
  // Workflow 实体（4 个）
  WorkflowDefinition,
  WorkflowNode,
  WorkflowInstance,
  ApprovalLog,
  // Export 实体（1 个）
  ExportTask,
  // Notification 实体（3 个新增）
  MessageTemplate,
  Notification,
  UserNotification,
];

const config = {
  type: 'mysql' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'qianzhang_sales',
  entities: ALL_ENTITIES,
  synchronize: true, // 强制开启同步
  logging: true,     // 显示 SQL 日志
};

async function syncDatabase() {
  console.log('🚀 Starting database synchronization...\n');
  console.log('📋 Configuration:');
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   Username: ${config.username}`);
  console.log(`   Entities: ${config.entities.length} entities (原有13 + RBAC 5 + Workflow 4 + Export 1 + Notification 3)`);
  console.log('\n📦 Entity List:');
  config.entities.forEach((entity, index) => {
    console.log(`   ${index + 1}. ${entity.name}`);
  });
  console.log('');

  let dataSource: DataSource | null = null;

  try {
    dataSource = new DataSource(config);

    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected successfully!\n');

    console.log('🔄 Synchronizing database schema...');
    await dataSource.synchronize();
    console.log('✅ Database schema synchronized successfully!\n');

    // 验证表是否创建
    console.log('🔍 Verifying tables...');
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.query('SHOW TABLES');

    console.log('\n📊 Created tables:');
    tables.forEach((table: any) => {
      const tableName = Object.values(table)[0];
      console.log(`   ✓ ${tableName}`);
    });

    await queryRunner.release();

    console.log('\n🎉 Database synchronization completed successfully!');
    console.log('\n📝 Core business tables:');
    console.log('   ✓ orders, customers, users, products');
    console.log('   ✓ production_plans, delivery_records, quality_feedback');
    console.log('   ✓ ar_invoices, ar_payments, ar_apply, audit_logs, order_items');
    console.log('\n📝 RBAC tables:');
    console.log('   ✓ organizations (组织架构树)');
    console.log('   ✓ roles (角色表，含数据范围)');
    console.log('   ✓ permissions (权限字典)');
    console.log('   ✓ role_permissions (角色-权限关联)');
    console.log('   ✓ user_roles (用户-角色关联)');
    console.log('\n📝 Workflow tables:');
    console.log('   ✓ workflow_definitions (流程定义)');
    console.log('   ✓ workflow_nodes (流程节点)');
    console.log('   ✓ workflow_instances (流程实例)');
    console.log('   ✓ approval_logs (审批日志)');
    console.log('\n📝 Notification tables (新增):');
    console.log('   ✓ message_templates (消息模板)');
    console.log('   ✓ notifications (通知主体)');
    console.log('   ✓ user_notifications (用户触达记录)');

  } catch (error) {
    console.error('\n❌ Database synchronization failed!');
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      if (error.message.includes('ECONNREFUSED')) {
        console.error('\n💡 Solution: Check if MySQL is running and DB_HOST/DB_PORT are correct');
      } else if (error.message.includes('Access denied')) {
        console.error('\n💡 Solution: Check DB_USERNAME and DB_PASSWORD in .env file');
      } else if (error.message.includes('Unknown database')) {
        console.error(`\n💡 Solution: CREATE DATABASE ${config.database};`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

syncDatabase();
