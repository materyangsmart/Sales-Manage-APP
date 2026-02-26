#!/usr/bin/env ts-node
/**
 * Database Synchronization Script
 * 
 * 用途：一键自动创建数据库表（基于TypeORM entities）
 * 
 * 使用方法：
 *   npm run db:sync
 * 
 * 说明：
 * - 此脚本会读取 .env 文件中的数据库配置
 * - 使用 TypeORM 的 synchronize 功能自动创建表
 * - 适用于开发环境，生产环境请使用 migration
 * - Windows/Linux/macOS 通用
 * 
 * 注意：
 * - 确保数据库已创建（如 qianzhang_sales）
 * - 确保 .env 文件中的数据库配置正确
 * - synchronize 会自动创建/更新表结构，但不会删除表
 * 
 * 重要：
 * - 此脚本必须与 app.module.ts 中的 entities 列表保持 100% 一致
 * - 任何新增的 Entity 都必须在此处显式导入
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ========================================
// 显式导入所有实体（与 app.module.ts 保持一致）
// ========================================
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
const config = {
  type: 'mysql' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'qianzhang_sales',
  // 显式列出所有实体（与 app.module.ts 保持一致）
  entities: [
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
  ],
  synchronize: true, // 强制开启同步
  logging: true, // 显示SQL日志
};

async function syncDatabase() {
  console.log('🚀 Starting database synchronization...\n');
  console.log('📋 Configuration:');
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   Username: ${config.username}`);
  console.log(`   Entities: ${config.entities.length} entities`);
  console.log('\n📦 Entity List:');
  config.entities.forEach((entity, index) => {
    console.log(`   ${index + 1}. ${entity.name}`);
  });
  console.log('');

  let dataSource: DataSource | null = null;

  try {
    // 创建 DataSource
    dataSource = new DataSource(config);

    // 初始化连接
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected successfully!\n');

    // 同步表结构
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
    console.log('\n💡 Next steps:');
    console.log('   1. Import seed data: mysql -u root -p qianzhang_sales < scripts/scripts/seed-600m-revenue.sql');
    console.log('   2. Start the backend server: npm run start:dev');
    console.log('   3. Test the API endpoints');
    console.log('\n📝 Core tables created:');
    console.log('   ✓ orders (订单表)');
    console.log('   ✓ customers (客户表)');
    console.log('   ✓ users (用户表)');
    console.log('   ✓ products (产品表)');
    console.log('   ✓ production_plans (生产计划表)');
    console.log('   ✓ delivery_records (配送记录表)');
    console.log('   ✓ quality_feedback (质量反馈表)');
    console.log('   ✓ ar_invoices (应收发票表)');
    console.log('   ✓ ar_payments (应收回款表)');
    console.log('   ✓ ar_apply (应收核销表)');
    console.log('   ✓ audit_logs (审计日志表)');
    console.log('   ✓ order_items (订单明细表)\n');

  } catch (error) {
    console.error('\n❌ Database synchronization failed!');
    console.error('\n🔍 Error details:');
    
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      
      // 提供常见错误的解决方案
      if (error.message.includes('ECONNREFUSED')) {
        console.error('\n💡 Solution:');
        console.error('   1. Check if MySQL is running');
        console.error('   2. Verify DB_HOST and DB_PORT in .env file');
      } else if (error.message.includes('Access denied')) {
        console.error('\n💡 Solution:');
        console.error('   1. Check DB_USERNAME and DB_PASSWORD in .env file');
        console.error('   2. Verify MySQL user permissions');
      } else if (error.message.includes('Unknown database')) {
        console.error('\n💡 Solution:');
        console.error('   1. Create the database first:');
        console.error('      mysql -u root -p');
        console.error(`      CREATE DATABASE ${config.database};`);
      }
    } else {
      console.error(error);
    }
    
    process.exit(1);
  } finally {
    // 关闭连接
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('🔌 Database connection closed.');
    }
  }
}

// 执行同步
syncDatabase();
