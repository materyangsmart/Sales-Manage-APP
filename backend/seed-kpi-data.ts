/**
 * P5 - 全场景业务仿真数据种子脚本
 * 
 * 业务场景：
 * - 场景A（地推型 WET_MARKET）：验证账期内回款 vs 超期回款的提成差异
 * - 场景B（商超型 SUPERMARKET）：验证毛利加权提成计算
 * - 场景C（电商型 ECOMMERCE）：验证新客户开发奖励（1.5倍）
 * 
 * 执行方式：
 * cd E:\work\Sales-Manage-APP-git\backend
 * npx ts-node seed-kpi-data.ts
 */

import { DataSource } from 'typeorm';
import { Customer } from './src/modules/order/entities/customer.entity';
import { Product } from './src/modules/order/entities/product.entity';
import { Order } from './src/modules/order/entities/order.entity';
import { OrderItem } from './src/modules/order/entities/order-item.entity';
import { ARInvoice } from './src/modules/ar/entities/ar-invoice.entity';
import { ARPayment } from './src/modules/ar/entities/ar-payment.entity';
import { ARApply } from './src/modules/ar/entities/ar-apply.entity';

// 数据库连接配置
const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'qianzhang_sales',
  entities: [Customer, Product, Order, OrderItem, ARInvoice, ARPayment, ARApply],
  synchronize: false,
  logging: true,
});

// 辅助函数：生成日期
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// 主函数
async function seedData() {
  console.log('🌱 开始注入P5业务仿真数据...\n');

  await AppDataSource.initialize();
  console.log('✅ 数据库连接成功\n');

  // ============================================================
  // Phase 1: 创建基础数据（Products）
  // ============================================================
  console.log('📦 Phase 1: 创建产品数据...');
  
  const productRepo = AppDataSource.getRepository(Product);
  
  const products = [
    {
      orgId: 2,
      sku: 'QZ-THIN-160G',
      productName: '千张（薄）- 160g',
      category: '千张',
      unit: '包',
      unitPrice: 800, // 8元
      stockQuantity: 1000,
      status: 'ACTIVE',
      description: '薄款千张，适合凉拌',
      createdBy: 1,
    },
    {
      orgId: 2,
      sku: 'QZ-MEDIUM-500G',
      productName: '千张（中）- 500g',
      category: '千张',
      unit: '包',
      unitPrice: 2500, // 25元
      stockQuantity: 800,
      status: 'ACTIVE',
      description: '中厚千张，适合炒菜',
      createdBy: 1,
    },
    {
      orgId: 2,
      sku: 'QZ-THICK-1KG',
      productName: '千张（厚）- 1kg',
      category: '千张',
      unit: '包',
      unitPrice: 4500, // 45元
      stockQuantity: 500,
      status: 'ACTIVE',
      description: '厚款千张，适合卤制',
      createdBy: 1,
    },
    {
      orgId: 2,
      sku: 'QZJ-KNOT-200G',
      productName: '千张结 - 200g',
      category: '千张结',
      unit: '包',
      unitPrice: 1200, // 12元
      stockQuantity: 600,
      status: 'ACTIVE',
      description: '千张结，适合火锅',
      createdBy: 1,
    },
  ];

  for (const p of products) {
    const existing = await productRepo.findOne({ where: { sku: p.sku } });
    if (!existing) {
      await productRepo.save(p);
      console.log(`  ✓ 创建产品: ${p.productName} (${p.sku})`);
    } else {
      console.log(`  ⊙ 产品已存在: ${p.productName} (${p.sku})`);
    }
  }

  // ============================================================
  // Phase 2: 场景A - 地推型（WET_MARKET）
  // ============================================================
  console.log('\n🏪 Phase 2: 场景A - 地推型（WET_MARKET）');
  console.log('   验证：账期内回款 vs 超期回款的提成差异\n');

  const customerRepo = AppDataSource.getRepository(Customer);
  const orderRepo = AppDataSource.getRepository(Order);
  const orderItemRepo = AppDataSource.getRepository(OrderItem);
  const invoiceRepo = AppDataSource.getRepository(ARInvoice);
  const paymentRepo = AppDataSource.getRepository(ARPayment);
  const applyRepo = AppDataSource.getRepository(ARApply);

  // 场景A-1: 优等生客户（按时回款）
  let customer = await customerRepo.findOne({ where: { customerCode: 'WM-001' } });
  if (!customer) {
    customer = await customerRepo.save({
      orgId: 2,
      customerCode: 'WM-001',
      customerName: '张记菜市场（优等生）',
      category: 'WET_MARKET',
      contactPerson: '张老板',
      contactPhone: '13800138001',
      address: '上海市浦东新区菜市场A区',
      creditLimit: 5000000, // 5万元
      usedCredit: 0,
      status: 'ACTIVE',
      createdBy: 1,
    });
    console.log('  ✓ 创建客户: 张记菜市场（优等生）');
  }

  // 订单1：30天前下单，7天后回款（账期内）
  let order1 = await orderRepo.findOne({ where: { orderNo: 'ORD-WM-001-001' } });
  if (!order1) {
    order1 = await orderRepo.save({
      orgId: 2,
      orderNo: 'ORD-WM-001-001',
      customerId: customer.id,
      totalAmount: 450000, // 4500元
      status: 'FULFILLED',
      orderDate: daysAgo(30),
      deliveryAddress: '上海市浦东新区菜市场A区',
      deliveryDate: daysAgo(29),
      createdBy: 1,
      reviewedBy: 1,
      reviewedAt: daysAgo(30),
      fulfilledBy: 1,
      fulfilledAt: daysAgo(29),
    });

    await orderItemRepo.save({
      orderId: order1.id,
      productId: 3, // 千张（厚）- 1kg
      productName: '千张（厚）- 1kg',
      sku: 'QZ-THICK-1KG',
      unitPrice: 4500,
      quantity: 100,
      subtotal: 450000,
      createdBy: 1,
    });

    // 生成发票（29天前）
    const invoice1 = await invoiceRepo.save({
      orgId: 2,
      customerId: customer.id,
      invoiceNo: 'INV-WM-001-001',
      orderId: order1.id,
      amount: 450000,
      taxAmount: 0,
      balance: 0, // 已全额核销
      dueDate: daysAgo(29 - 30), // 账期30天
      status: 'CLOSED',
      createdAt: daysAgo(29),
    });

    // 收款（22天前，发货后7天）
    const payment1 = await paymentRepo.save({
      orgId: 2,
      customerId: customer.id,
      paymentNo: 'PAY-WM-001-001',
      bankRef: 'BANK-WM-001-001',
      amount: 450000,
      unappliedAmount: 0,
      paymentDate: daysAgo(22),
      paymentMethod: '银行转账',
      status: 'APPLIED',
      createdBy: 1,
      createdAt: daysAgo(22),
    });

    // 核销
    await applyRepo.save({
      orgId: 2,
      paymentId: payment1.id,
      invoiceId: invoice1.id,
      appliedAmount: 450000,
      operatorId: 1,
      remark: '账期内回款，提成正常计算',
      createdAt: daysAgo(22),
    });

    console.log('  ✓ 创建订单: ORD-WM-001-001 (账期内回款)');
  }

  // 场景A-2: 风险生客户（超期回款）
  let customer2 = await customerRepo.findOne({ where: { customerCode: 'WM-002' } });
  if (!customer2) {
    customer2 = await customerRepo.save({
      orgId: 2,
      customerCode: 'WM-002',
      customerName: '李记菜市场（风险生）',
      category: 'WET_MARKET',
      contactPerson: '李老板',
      contactPhone: '13800138002',
      address: '上海市浦东新区菜市场B区',
      creditLimit: 3000000, // 3万元
      usedCredit: 0,
      status: 'ACTIVE',
      createdBy: 1,
    });
    console.log('  ✓ 创建客户: 李记菜市场（风险生）');
  }

  // 订单2：40天前下单，35天后才回款（超期5天）
  let order2 = await orderRepo.findOne({ where: { orderNo: 'ORD-WM-002-001' } });
  if (!order2) {
    order2 = await orderRepo.save({
      orgId: 2,
      orderNo: 'ORD-WM-002-001',
      customerId: customer2.id,
      totalAmount: 300000, // 3000元
      status: 'FULFILLED',
      orderDate: daysAgo(40),
      deliveryAddress: '上海市浦东新区菜市场B区',
      deliveryDate: daysAgo(39),
      createdBy: 1,
      reviewedBy: 1,
      reviewedAt: daysAgo(40),
      fulfilledBy: 1,
      fulfilledAt: daysAgo(39),
    });

    await orderItemRepo.save({
      orderId: order2.id,
      productId: 2, // 千张（中）- 500g
      productName: '千张（中）- 500g',
      sku: 'QZ-MEDIUM-500G',
      unitPrice: 2500,
      quantity: 120,
      subtotal: 300000,
      createdBy: 1,
    });

    // 生成发票（39天前）
    const invoice2 = await invoiceRepo.save({
      orgId: 2,
      customerId: customer2.id,
      invoiceNo: 'INV-WM-002-001',
      orderId: order2.id,
      amount: 300000,
      taxAmount: 0,
      balance: 0, // 已全额核销
      dueDate: daysAgo(39 - 30), // 账期30天
      status: 'CLOSED',
      createdAt: daysAgo(39),
    });

    // 收款（4天前，发货后35天，超期5天）
    const payment2 = await paymentRepo.save({
      orgId: 2,
      customerId: customer2.id,
      paymentNo: 'PAY-WM-002-001',
      bankRef: 'BANK-WM-002-001',
      amount: 300000,
      unappliedAmount: 0,
      paymentDate: daysAgo(4),
      paymentMethod: '银行转账',
      status: 'APPLIED',
      createdBy: 1,
      createdAt: daysAgo(4),
    });

    // 核销
    await applyRepo.save({
      orgId: 2,
      paymentId: payment2.id,
      invoiceId: invoice2.id,
      appliedAmount: 300000,
      operatorId: 1,
      remark: '超期5天回款，提成应扣除',
      createdAt: daysAgo(4),
    });

    console.log('  ✓ 创建订单: ORD-WM-002-001 (超期回款)');
  }

  // ============================================================
  // Phase 3: 场景B - 商超型（SUPERMARKET）
  // ============================================================
  console.log('\n🏬 Phase 3: 场景B - 商超型（SUPERMARKET）');
  console.log('   验证：毛利加权提成计算\n');

  // 场景B-1: 高毛利订单
  let customer3 = await customerRepo.findOne({ where: { customerCode: 'SM-001' } });
  if (!customer3) {
    customer3 = await customerRepo.save({
      orgId: 2,
      customerCode: 'SM-001',
      customerName: '华联超市（高毛利）',
      category: 'SUPERMARKET',
      contactPerson: '王经理',
      contactPhone: '13800138003',
      address: '上海市徐汇区淮海路123号',
      creditLimit: 10000000, // 10万元
      usedCredit: 0,
      status: 'ACTIVE',
      createdBy: 1,
    });
    console.log('  ✓ 创建客户: 华联超市（高毛利）');
  }

  // 订单3：20天前下单，高毛利产品
  let order3 = await orderRepo.findOne({ where: { orderNo: 'ORD-SM-001-001' } });
  if (!order3) {
    order3 = await orderRepo.save({
      orgId: 2,
      orderNo: 'ORD-SM-001-001',
      customerId: customer3.id,
      totalAmount: 600000, // 6000元
      status: 'FULFILLED',
      orderDate: daysAgo(20),
      deliveryAddress: '上海市徐汇区淮海路123号',
      deliveryDate: daysAgo(19),
      createdBy: 1,
      reviewedBy: 1,
      reviewedAt: daysAgo(20),
      fulfilledBy: 1,
      fulfilledAt: daysAgo(19),
    });

    await orderItemRepo.save({
      orderId: order3.id,
      productId: 4, // 千张结 - 200g（高毛利）
      productName: '千张结 - 200g',
      sku: 'QZJ-KNOT-200G',
      unitPrice: 1200,
      quantity: 500,
      subtotal: 600000,
      createdBy: 1,
    });

    // 生成发票（19天前）
    const invoice3 = await invoiceRepo.save({
      orgId: 2,
      customerId: customer3.id,
      invoiceNo: 'INV-SM-001-001',
      orderId: order3.id,
      amount: 600000,
      taxAmount: 0,
      balance: 0,
      dueDate: daysAgo(19 - 60), // 商超账期60天
      status: 'CLOSED',
      createdAt: daysAgo(19),
    });

    // 收款（10天前）
    const payment3 = await paymentRepo.save({
      orgId: 2,
      customerId: customer3.id,
      paymentNo: 'PAY-SM-001-001',
      bankRef: 'BANK-SM-001-001',
      amount: 600000,
      unappliedAmount: 0,
      paymentDate: daysAgo(10),
      paymentMethod: '银行转账',
      status: 'APPLIED',
      createdBy: 1,
      createdAt: daysAgo(10),
    });

    // 核销
    await applyRepo.save({
      orgId: 2,
      paymentId: payment3.id,
      invoiceId: invoice3.id,
      appliedAmount: 600000,
      operatorId: 1,
      remark: '高毛利产品（毛利率40%），提成权重高',
      createdAt: daysAgo(10),
    });

    console.log('  ✓ 创建订单: ORD-SM-001-001 (高毛利)');
  }

  // 场景B-2: 低毛利订单
  let customer4 = await customerRepo.findOne({ where: { customerCode: 'SM-002' } });
  if (!customer4) {
    customer4 = await customerRepo.save({
      orgId: 2,
      customerCode: 'SM-002',
      customerName: '家乐福超市（低毛利）',
      category: 'SUPERMARKET',
      contactPerson: '刘经理',
      contactPhone: '13800138004',
      address: '上海市浦东新区世纪大道456号',
      creditLimit: 10000000, // 10万元
      usedCredit: 0,
      status: 'ACTIVE',
      createdBy: 1,
    });
    console.log('  ✓ 创建客户: 家乐福超市（低毛利）');
  }

  // 订单4：15天前下单，低毛利产品
  let order4 = await orderRepo.findOne({ where: { orderNo: 'ORD-SM-002-001' } });
  if (!order4) {
    order4 = await orderRepo.save({
      orgId: 2,
      orderNo: 'ORD-SM-002-001',
      customerId: customer4.id,
      totalAmount: 800000, // 8000元
      status: 'FULFILLED',
      orderDate: daysAgo(15),
      deliveryAddress: '上海市浦东新区世纪大道456号',
      deliveryDate: daysAgo(14),
      createdBy: 1,
      reviewedBy: 1,
      reviewedAt: daysAgo(15),
      fulfilledBy: 1,
      fulfilledAt: daysAgo(14),
    });

    await orderItemRepo.save({
      orderId: order4.id,
      productId: 1, // 千张（薄）- 160g（低毛利）
      productName: '千张（薄）- 160g',
      sku: 'QZ-THIN-160G',
      unitPrice: 800,
      quantity: 1000,
      subtotal: 800000,
      createdBy: 1,
    });

    // 生成发票（14天前）
    const invoice4 = await invoiceRepo.save({
      orgId: 2,
      customerId: customer4.id,
      invoiceNo: 'INV-SM-002-001',
      orderId: order4.id,
      amount: 800000,
      taxAmount: 0,
      balance: 0,
      dueDate: daysAgo(14 - 60), // 商超账期60天
      status: 'CLOSED',
      createdAt: daysAgo(14),
    });

    // 收款（5天前）
    const payment4 = await paymentRepo.save({
      orgId: 2,
      customerId: customer4.id,
      paymentNo: 'PAY-SM-002-001',
      bankRef: 'BANK-SM-002-001',
      amount: 800000,
      unappliedAmount: 0,
      paymentDate: daysAgo(5),
      paymentMethod: '银行转账',
      status: 'APPLIED',
      createdBy: 1,
      createdAt: daysAgo(5),
    });

    // 核销
    await applyRepo.save({
      orgId: 2,
      paymentId: payment4.id,
      invoiceId: invoice4.id,
      appliedAmount: 800000,
      operatorId: 1,
      remark: '低毛利产品（毛利率15%），提成权重低',
      createdAt: daysAgo(5),
    });

    console.log('  ✓ 创建订单: ORD-SM-002-001 (低毛利)');
  }

  // ============================================================
  // Phase 4: 场景C - 电商型（ECOMMERCE）
  // ============================================================
  console.log('\n🛒 Phase 4: 场景C - 电商型（ECOMMERCE）');
  console.log('   验证：新客户开发奖励（1.5倍）\n');

  // 场景C: 3个新客户（在统计周期内创建）
  const newCustomers = [
    {
      code: 'EC-001',
      name: '淘宝店-千张专卖',
      phone: '13800138005',
      orderAmount: 200000, // 2000元
    },
    {
      code: 'EC-002',
      name: '京东店-豆制品旗舰店',
      phone: '13800138006',
      orderAmount: 350000, // 3500元
    },
    {
      code: 'EC-003',
      name: '拼多多店-千张直销',
      phone: '13800138007',
      orderAmount: 180000, // 1800元
    },
  ];

  for (let i = 0; i < newCustomers.length; i++) {
    const nc = newCustomers[i];
    
    let customer = await customerRepo.findOne({ where: { customerCode: nc.code } });
    if (!customer) {
      customer = await customerRepo.save({
        orgId: 2,
        customerCode: nc.code,
        customerName: nc.name,
        category: 'ECOMMERCE',
        contactPerson: '店主',
        contactPhone: nc.phone,
        address: '线上电商平台',
        creditLimit: 2000000, // 2万元
        usedCredit: 0,
        status: 'ACTIVE',
        createdBy: 1,
        createdAt: daysAgo(25 - i * 5), // 25天前、20天前、15天前创建
      });
      console.log(`  ✓ 创建新客户: ${nc.name} (${daysAgo(25 - i * 5).toISOString().split('T')[0]})`);
    }

    // 为每个新客户创建订单
    const orderNo = `ORD-${nc.code}-001`;
    let order = await orderRepo.findOne({ where: { orderNo } });
    if (!order) {
      order = await orderRepo.save({
        orgId: 2,
        orderNo,
        customerId: customer.id,
        totalAmount: nc.orderAmount,
        status: 'FULFILLED',
        orderDate: daysAgo(24 - i * 5),
        deliveryAddress: '线上电商平台',
        deliveryDate: daysAgo(23 - i * 5),
        createdBy: 1,
        reviewedBy: 1,
        reviewedAt: daysAgo(24 - i * 5),
        fulfilledBy: 1,
        fulfilledAt: daysAgo(23 - i * 5),
      });

      await orderItemRepo.save({
        orderId: order.id,
        productId: 2, // 千张（中）- 500g
        productName: '千张（中）- 500g',
        sku: 'QZ-MEDIUM-500G',
        unitPrice: 2500,
        quantity: Math.floor(nc.orderAmount / 2500),
        subtotal: nc.orderAmount,
        createdBy: 1,
      });

      // 生成发票
      const invoice = await invoiceRepo.save({
        orgId: 2,
        customerId: customer.id,
        invoiceNo: `INV-${nc.code}-001`,
        orderId: order.id,
        amount: nc.orderAmount,
        taxAmount: 0,
        balance: 0,
        dueDate: daysAgo(23 - i * 5 - 15), // 账期15天
        status: 'CLOSED',
        createdAt: daysAgo(23 - i * 5),
      });

      // 收款
      const payment = await paymentRepo.save({
        orgId: 2,
        customerId: customer.id,
        paymentNo: `PAY-${nc.code}-001`,
        bankRef: `BANK-${nc.code}-001`,
        amount: nc.orderAmount,
        unappliedAmount: 0,
        paymentDate: daysAgo(20 - i * 5),
        paymentMethod: '在线支付',
        status: 'APPLIED',
        createdBy: 1,
        createdAt: daysAgo(20 - i * 5),
      });

      // 核销
      await applyRepo.save({
        orgId: 2,
        paymentId: payment.id,
        invoiceId: invoice.id,
        appliedAmount: nc.orderAmount,
        operatorId: 1,
        remark: '新客户首单，提成奖励1.5倍',
        createdAt: daysAgo(20 - i * 5),
      });

      console.log(`  ✓ 创建订单: ${orderNo} (新客户首单)`);
    }
  }

  // ============================================================
  // Phase 5: 创建提成规则
  // ============================================================
  console.log('\n⚙️  Phase 5: 创建提成规则...');
  
  // 注意：sales_commission_rules表的创建和数据插入需要通过ops-frontend的UI或直接SQL
  console.log('  ⚠️  提成规则需要通过以下方式之一配置：');
  console.log('     1. 访问ops-frontend的"提成规则"页面手动配置');
  console.log('     2. 或执行以下SQL：');
  console.log(`
  INSERT INTO sales_commission_rules (org_id, rule_version, category, base_rate, rule_json, effective_from, created_by, created_at, updated_at)
  VALUES
  -- 地推型规则
  (2, '2026-V1-WET_MARKET', 'WET_MARKET', 0.02, 
   '{"collectionWeight": 0.30, "paymentDueDays": 30, "newCustomerBonus": 10000}',
   '2026-01-01', 1, NOW(), NOW()),
  
  -- 商超型规则
  (2, '2026-V1-SUPERMARKET', 'SUPERMARKET', 0.03,
   '{"marginWeight": 0.60, "paymentDueDays": 60, "newCustomerBonus": 15000}',
   '2026-01-01', 1, NOW(), NOW()),
  
  -- 电商型规则
  (2, '2026-V1-ECOMMERCE', 'ECOMMERCE', 0.025,
   '{"collectionWeight": 0.40, "paymentDueDays": 15, "newCustomerBonus": 20000}',
   '2026-01-01', 1, NOW(), NOW());
  `);

  await AppDataSource.destroy();
  console.log('\n✅ 数据种子注入完成！');
  console.log('\n📊 数据统计：');
  console.log('   - 场景A（地推型）：2个客户，2个订单（1个账期内，1个超期）');
  console.log('   - 场景B（商超型）：2个客户，2个订单（1个高毛利，1个低毛利）');
  console.log('   - 场景C（电商型）：3个新客户，3个订单（新客户开发奖励）');
  console.log('\n🎯 下一步：');
  console.log('   1. 访问ops-frontend的"提成规则"页面配置规则');
  console.log('   2. 访问"提成查询"页面验证计算结果');
  console.log('   3. 对比PPT中的公式，确认提成金额是否一致');
}

// 执行主函数
seedData()
  .then(() => {
    console.log('\n🎉 种子脚本执行成功！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 种子脚本执行失败：', error);
    process.exit(1);
  });
