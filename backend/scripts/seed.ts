import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';

// 加载环境变量
config({ path: resolve(__dirname, '../.env') });

/**
 * Seed数据脚本
 * 
 * 功能：
 * - 初始化基础数据（customers、products、org、users）
 * - 幂等性：重复执行不会重复插入或报错
 * - 使用 INSERT IGNORE 或 ON DUPLICATE KEY UPDATE
 * 
 * 使用：
 * npm run seed
 */

async function seed() {
  console.log('========================================');
  console.log('开始执行Seed数据脚本');
  console.log('========================================');
  console.log('');

  // 创建数据源
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'qianzhang_sales_dev',
  });

  try {
    // 连接数据库
    console.log('1. 连接数据库...');
    await dataSource.initialize();
    console.log('✅ 数据库连接成功');
    console.log('');

    // 创建组织
    console.log('2. 创建组织数据...');
    await dataSource.query(`
      INSERT IGNORE INTO organizations (id, name, code, status, created_at, updated_at)
      VALUES 
        (1, '总部', 'HQ', 'ACTIVE', NOW(), NOW()),
        (2, '华东分公司', 'EAST', 'ACTIVE', NOW(), NOW()),
        (3, '华南分公司', 'SOUTH', 'ACTIVE', NOW(), NOW())
    `);
    console.log('✅ 组织数据创建完成（3个）');
    console.log('');

    // 创建用户
    console.log('3. 创建用户数据...');
    await dataSource.query(`
      INSERT IGNORE INTO users (id, username, email, role, org_id, status, created_at, updated_at)
      VALUES 
        (1, 'admin', 'admin@qianzhang.com', 'ADMIN', 1, 'ACTIVE', NOW(), NOW()),
        (2, 'sales_manager', 'sales.manager@qianzhang.com', 'MANAGER', 2, 'ACTIVE', NOW(), NOW()),
        (3, 'sales_rep_1', 'sales.rep1@qianzhang.com', 'SALES', 2, 'ACTIVE', NOW(), NOW()),
        (4, 'sales_rep_2', 'sales.rep2@qianzhang.com', 'SALES', 2, 'ACTIVE', NOW(), NOW()),
        (5, 'finance_manager', 'finance.manager@qianzhang.com', 'FINANCE', 1, 'ACTIVE', NOW(), NOW())
    `);
    console.log('✅ 用户数据创建完成（5个）');
    console.log('');

    // 创建客户
    console.log('4. 创建客户数据...');
    await dataSource.query(`
      INSERT IGNORE INTO customers (id, name, code, contact_person, contact_phone, contact_email, address, org_id, status, created_at, updated_at)
      VALUES 
        (1, '阿里巴巴集团', 'CUST001', '张三', '13800138001', 'zhangsan@alibaba.com', '杭州市余杭区文一西路969号', 2, 'ACTIVE', NOW(), NOW()),
        (2, '腾讯科技', 'CUST002', '李四', '13800138002', 'lisi@tencent.com', '深圳市南山区科技园', 3, 'ACTIVE', NOW(), NOW()),
        (3, '字节跳动', 'CUST003', '王五', '13800138003', 'wangwu@bytedance.com', '北京市海淀区知春路', 2, 'ACTIVE', NOW(), NOW()),
        (4, '美团', 'CUST004', '赵六', '13800138004', 'zhaoliu@meituan.com', '北京市朝阳区望京', 2, 'ACTIVE', NOW(), NOW()),
        (5, '京东集团', 'CUST005', '孙七', '13800138005', 'sunqi@jd.com', '北京市大兴区亦庄经济开发区', 2, 'ACTIVE', NOW(), NOW())
    `);
    console.log('✅ 客户数据创建完成（5个）');
    console.log('');

    // 创建产品
    console.log('5. 创建产品数据...');
    await dataSource.query(`
      INSERT IGNORE INTO products (id, name, code, category, unit, unit_price, stock, min_stock, description, status, created_at, updated_at)
      VALUES 
        (1, '千张（标准型）', 'PROD001', '豆制品', '箱', 50.00, 1000, 100, '标准千张，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (2, '千张（精品型）', 'PROD002', '豆制品', '箱', 80.00, 500, 50, '精品千张，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (3, '千张（有机型）', 'PROD003', '豆制品', '箱', 120.00, 200, 20, '有机千张，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (4, '豆腐干（原味）', 'PROD004', '豆制品', '箱', 60.00, 800, 80, '原味豆腐干，每箱20包', 'ACTIVE', NOW(), NOW()),
        (5, '豆腐干（五香）', 'PROD005', '豆制品', '箱', 65.00, 700, 70, '五香豆腐干，每箱20包', 'ACTIVE', NOW(), NOW()),
        (6, '豆腐干（麻辣）', 'PROD006', '豆制品', '箱', 70.00, 600, 60, '麻辣豆腐干，每箱20包', 'ACTIVE', NOW(), NOW()),
        (7, '豆腐皮', 'PROD007', '豆制品', '箱', 55.00, 900, 90, '豆腐皮，每箱15斤', 'ACTIVE', NOW(), NOW()),
        (8, '腐竹', 'PROD008', '豆制品', '箱', 90.00, 400, 40, '腐竹，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (9, '豆浆粉', 'PROD009', '豆制品', '箱', 100.00, 300, 30, '豆浆粉，每箱50包', 'ACTIVE', NOW(), NOW()),
        (10, '豆奶', 'PROD010', '豆制品', '箱', 45.00, 1200, 120, '豆奶，每箱24瓶', 'ACTIVE', NOW(), NOW()),
        (11, '千张（薄型）', 'PROD011', '豆制品', '箱', 55.00, 800, 80, '薄型千张，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (12, '千张（厚型）', 'PROD012', '豆制品', '箱', 75.00, 600, 60, '厚型千张，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (13, '豆腐干（烧烤味）', 'PROD013', '豆制品', '箱', 68.00, 500, 50, '烧烤味豆腐干，每箱20包', 'ACTIVE', NOW(), NOW()),
        (14, '豆腐干（孜然味）', 'PROD014', '豆制品', '箱', 68.00, 500, 50, '孜然味豆腐干，每箱20包', 'ACTIVE', NOW(), NOW()),
        (15, '豆腐干（海苔味）', 'PROD015', '豆制品', '箱', 70.00, 400, 40, '海苔味豆腐干，每箱20包', 'ACTIVE', NOW(), NOW()),
        (16, '腐竹（精品）', 'PROD016', '豆制品', '箱', 110.00, 300, 30, '精品腐竹，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (17, '豆浆粉（无糖）', 'PROD017', '豆制品', '箱', 105.00, 250, 25, '无糖豆浆粉，每箱50包', 'ACTIVE', NOW(), NOW()),
        (18, '豆浆粉（原味）', 'PROD018', '豆制品', '箱', 95.00, 350, 35, '原味豆浆粉，每箱50包', 'ACTIVE', NOW(), NOW()),
        (19, '豆奶（高钙）', 'PROD019', '豆制品', '箱', 50.00, 1000, 100, '高钙豆奶，每箱24瓶', 'ACTIVE', NOW(), NOW()),
        (20, '豆奶（无糖）', 'PROD020', '豆制品', '箱', 48.00, 1100, 110, '无糖豆奶，每箱24瓶', 'ACTIVE', NOW(), NOW()),
        (21, '千张（礼盒装）', 'PROD021', '豆制品', '盒', 150.00, 200, 20, '千张礼盒装，每盒5斤', 'ACTIVE', NOW(), NOW()),
        (22, '豆制品组合装A', 'PROD022', '豆制品', '箱', 200.00, 150, 15, '组合装A：千张+豆腐干+腐竹', 'ACTIVE', NOW(), NOW()),
        (23, '豆制品组合装B', 'PROD023', '豆制品', '箱', 180.00, 180, 18, '组合装B：千张+豆腐皮+豆浆粉', 'ACTIVE', NOW(), NOW()),
        (24, '豆制品组合装C', 'PROD024', '豆制品', '箱', 220.00, 120, 12, '组合装C：精品千张+精品腐竹+豆奶', 'ACTIVE', NOW(), NOW()),
        (25, '豆腐干（混合装）', 'PROD025', '豆制品', '箱', 75.00, 400, 40, '混合装豆腐干，每箱20包（多种口味）', 'ACTIVE', NOW(), NOW()),
        (26, '千张（特价装）', 'PROD026', '豆制品', '箱', 45.00, 1500, 150, '特价千张，每箱10斤（临期促销）', 'ACTIVE', NOW(), NOW()),
        (27, '豆腐皮（精品）', 'PROD027', '豆制品', '箱', 70.00, 600, 60, '精品豆腐皮，每箱15斤', 'ACTIVE', NOW(), NOW()),
        (28, '腐竹（有机）', 'PROD028', '豆制品', '箱', 150.00, 150, 15, '有机腐竹，每箱10斤', 'ACTIVE', NOW(), NOW()),
        (29, '豆浆粉（高钙）', 'PROD029', '豆制品', '箱', 110.00, 280, 28, '高钙豆浆粉，每箱50包', 'ACTIVE', NOW(), NOW()),
        (30, '豆奶（儿童装）', 'PROD030', '豆制品', '箱', 55.00, 900, 90, '儿童装豆奶，每箱24瓶', 'ACTIVE', NOW(), NOW())
    `);
    console.log('✅ 产品数据创建完成（30个）');
    console.log('');

    // 验证数据
    console.log('6. 验证数据...');
    const orgCount = await dataSource.query('SELECT COUNT(*) as count FROM organizations');
    const userCount = await dataSource.query('SELECT COUNT(*) as count FROM users');
    const customerCount = await dataSource.query('SELECT COUNT(*) as count FROM customers');
    const productCount = await dataSource.query('SELECT COUNT(*) as count FROM products');

    console.log(`  - 组织数量: ${orgCount[0].count}`);
    console.log(`  - 用户数量: ${userCount[0].count}`);
    console.log(`  - 客户数量: ${customerCount[0].count}`);
    console.log(`  - 产品数量: ${productCount[0].count}`);
    console.log('');

    console.log('========================================');
    console.log('✅ Seed数据脚本执行完成！');
    console.log('========================================');
    console.log('');
    console.log('提示：');
    console.log('- 所有数据已使用 INSERT IGNORE，重复执行不会报错');
    console.log('- orgId=2 (华东分公司) 用于测试');
    console.log('- 可以使用 npm run smoke:ar 验证数据');

  } catch (error) {
    console.error('❌ Seed数据脚本执行失败:', error);
    process.exit(1);
  } finally {
    // 关闭连接
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('');
      console.log('数据库连接已关闭');
    }
  }
}

// 执行seed
seed().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
