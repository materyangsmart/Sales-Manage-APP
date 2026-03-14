import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// 加载环境变量
config({ path: path.join(__dirname, '.env') });

// 配置开关
const CLEAR_DATA = process.env.CLEAR_DATA === 'true';
const BATCH_SIZE = 500;

// 业务参数
const MONTHLY_REVENUE = 50_000_000; // 月营业额：5000万
const MONTHS = 12;
const AVG_ORDER_VALUE = 15_000;

// 客户增长参数
const NEW_CUSTOMERS_PER_MONTH = {
  WET_MARKET: 50,
  SUPERMARKET: 5,
  WHOLESALE_B: 2,
};
const CHURN_RATE = 0.20;

// 回款核销比例
const PAYMENT_DISTRIBUTION = {
  ON_TIME: 0.60,
  OVERDUE: 0.20,
  PARTIAL: 0.10,
  PENDING: 0.10,
};

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_DATABASE || 'qianzhang_sales',
  synchronize: false,
});

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateCustomerCode(category: string, index: number): string {
  const prefix = {
    WET_MARKET: 'WM',
    SUPERMARKET: 'SM',
    WHOLESALE_B: 'WB',
    ECOMMERCE: 'EC',
  }[category] || 'CU';
  
  return `${prefix}${String(index).padStart(6, '0')}`;
}

async function clearOldData() {
  console.log('[清空数据] 开始清空旧数据...');
  
  const tables = [
    'ar_apply',
    'ar_payments',
    'ar_invoices',
    'order_items',
    'orders',
    'customers',
    'products',
  ];

  for (const table of tables) {
    try {
      await dataSource.query(`DELETE FROM ${table}`);
      console.log(`[清空数据] 已清空表: ${table}`);
    } catch (error: any) {
      console.warn(`[清空数据] 清空表${table}失败:`, error.message);
    }
  }

  console.log('[清空数据] 清空完成');
}

async function createProducts() {
  console.log('[产品数据] 开始创建产品数据...');

  const products = [
    { name: '千张（标准装）', code: 'QZ-STD-001', price: 8.50, cost: 5.00 },
    { name: '千张（精品装）', code: 'QZ-PRE-001', price: 12.00, cost: 7.50 },
    { name: '豆腐皮（标准装）', code: 'DFP-STD-001', price: 7.00, cost: 4.20 },
    { name: '豆腐皮（精品装）', code: 'DFP-PRE-001', price: 10.50, cost: 6.50 },
    { name: '腐竹（标准装）', code: 'FZ-STD-001', price: 15.00, cost: 9.00 },
  ];

  const productIds: number[] = [];
  for (const prod of products) {
    const result = await dataSource.query(`
      INSERT INTO products (name, code, unit_price, unit_cost, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [prod.name, prod.code, prod.price, prod.cost]);
    productIds.push(result.insertId);
  }

  console.log(`[产品数据] 创建${productIds.length}个产品`);
  return productIds;
}

async function createCustomers() {
  console.log('[客户数据] 开始创建客户数据...');

  const customers: any[] = [];
  let customerIndex = 1;
  const orgId = 2; // 固定orgId

  for (let month = 0; month < MONTHS; month++) {
    const monthStart = new Date(2026, month, 1);
    const monthEnd = new Date(2026, month + 1, 0);

    // 创建菜市场客户
    for (let i = 0; i < NEW_CUSTOMERS_PER_MONTH.WET_MARKET; i++) {
      const createdAt = randomDate(monthStart, monthEnd);
      const isActive = Math.random() > (CHURN_RATE / 12) * (MONTHS - month);

      customers.push({
        orgId,
        customerCode: generateCustomerCode('WET_MARKET', customerIndex++),
        name: `${['李记', '王家', '张氏', '刘记', '陈记'][randomInt(0, 4)]}菜市场`,
        category: 'WET_MARKET',
        status: isActive ? 'ACTIVE' : 'INACTIVE',
        paymentTerms: 30,
        creditLimit: randomInt(50000, 200000),
        createdAt,
      });
    }

    // 创建商超客户
    for (let i = 0; i < NEW_CUSTOMERS_PER_MONTH.SUPERMARKET; i++) {
      const createdAt = randomDate(monthStart, monthEnd);
      const isActive = Math.random() > (CHURN_RATE / 12) * (MONTHS - month);

      customers.push({
        orgId,
        customerCode: generateCustomerCode('SUPERMARKET', customerIndex++),
        name: `${['华联', '世纪联华', '家乐福', '沃尔玛', '大润发'][randomInt(0, 4)]}${['上海', '杭州', '南京', '苏州'][randomInt(0, 3)]}店`,
        category: 'SUPERMARKET',
        status: isActive ? 'ACTIVE' : 'INACTIVE',
        paymentTerms: 60,
        creditLimit: randomInt(500000, 2000000),
        createdAt,
      });
    }

    // 创建批发商客户
    for (let i = 0; i < NEW_CUSTOMERS_PER_MONTH.WHOLESALE_B; i++) {
      const createdAt = randomDate(monthStart, monthEnd);
      const isActive = Math.random() > (CHURN_RATE / 12) * (MONTHS - month);

      customers.push({
        orgId,
        customerCode: generateCustomerCode('WHOLESALE_B', customerIndex++),
        name: `${['东方', '华东', '江浙', '长三角'][randomInt(0, 3)]}食品批发`,
        category: 'WHOLESALE_B',
        status: isActive ? 'ACTIVE' : 'INACTIVE',
        paymentTerms: 45,
        creditLimit: randomInt(1000000, 5000000),
        createdAt,
      });
    }
  }

  console.log(`[客户数据] 准备插入${customers.length}个客户...`);

  const customerIds: number[] = [];
  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const values = batch.map(c => 
      `(${c.orgId}, '${c.customerCode}', '${c.name}', '${c.category}', '${c.status}', ${c.paymentTerms}, ${c.creditLimit}, '${c.createdAt.toISOString().slice(0, 19).replace('T', ' ')}')`
    ).join(',');

    const result = await dataSource.query(`
      INSERT INTO customers (org_id, customer_code, name, category, status, payment_terms, credit_limit, created_at)
      VALUES ${values}
    `);

    for (let j = 0; j < batch.length; j++) {
      customerIds.push(result.insertId + j);
    }

    console.log(`[客户数据] 已插入${Math.min(i + BATCH_SIZE, customers.length)}/${customers.length}个客户`);
  }

  console.log(`[客户数据] 客户创建完成，总计${customerIds.length}个`);
  return { customers, customerIds };
}

async function createOrders(customers: any[], productIds: number[]) {
  console.log('[订单数据] 开始创建订单数据...');

  const orders: any[] = [];
  const orderItems: any[] = [];
  let orderIndex = 1;
  const orgId = 2;

  const activeCustomers = customers.filter(c => c.status === 'ACTIVE');

  for (const customer of activeCustomers) {
    const customerCreatedAt = new Date(customer.createdAt);
    const yearEnd = new Date(2026, 11, 31);

    const monthsActive = Math.ceil((yearEnd.getTime() - customerCreatedAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
    const ordersPerMonth = randomInt(2, 5);
    const totalOrders = Math.min(ordersPerMonth * monthsActive, 60);

    for (let i = 0; i < totalOrders; i++) {
      const orderDate = randomDate(customerCreatedAt, yearEnd);
      const orderCode = `ORD-${String(orderIndex++).padStart(8, '0')}`;

      const numProducts = randomInt(2, 4);
      const selectedProducts: Array<{ productId: number; quantity: number }> = [];
      for (let j = 0; j < numProducts; j++) {
        const productId = productIds[randomInt(0, productIds.length - 1)];
        const quantity = randomInt(100, 1000);
        selectedProducts.push({ productId, quantity });
      }

      const productPrices = await dataSource.query(`
        SELECT id, unit_price, unit_cost FROM products WHERE id IN (${selectedProducts.map(p => p.productId).join(',')})
      `);

      let totalAmount = 0;
      let totalCost = 0;
      for (const sp of selectedProducts) {
        const product = productPrices.find((p: any) => p.id === sp.productId);
        totalAmount += product.unit_price * sp.quantity;
        totalCost += product.unit_cost * sp.quantity;
      }

      orders.push({
        orgId,
        customerId: customers.indexOf(customer) + 1,
        orderCode,
        orderDate,
        totalAmount,
        totalCost,
        status: 'FULFILLED',
        products: selectedProducts,
      });
    }
  }

  console.log(`[订单数据] 准备插入${orders.length}个订单...`);

  const orderIds: number[] = [];
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    const values = batch.map(o => 
      `(${o.orgId}, ${o.customerId}, '${o.orderCode}', '${o.orderDate.toISOString().slice(0, 19).replace('T', ' ')}', ${o.totalAmount}, '${o.status}')`
    ).join(',');

    const result = await dataSource.query(`
      INSERT INTO orders (org_id, customer_id, order_code, order_date, total_amount, status)
      VALUES ${values}
    `);

    for (let j = 0; j < batch.length; j++) {
      const orderId = result.insertId + j;
      orderIds.push(orderId);

      for (const product of batch[j].products) {
        orderItems.push({
          orderId,
          productId: product.productId,
          quantity: product.quantity,
        });
      }
    }

    console.log(`[订单数据] 已插入${Math.min(i + BATCH_SIZE, orders.length)}/${orders.length}个订单`);
  }

  console.log(`[订单数据] 准备插入${orderItems.length}个订单项...`);
  for (let i = 0; i < orderItems.length; i += BATCH_SIZE) {
    const batch = orderItems.slice(i, i + BATCH_SIZE);
    const values = batch.map(oi => 
      `(${oi.orderId}, ${oi.productId}, ${oi.quantity})`
    ).join(',');

    await dataSource.query(`
      INSERT INTO order_items (order_id, product_id, quantity)
      VALUES ${values}
    `);

    console.log(`[订单项] 已插入${Math.min(i + BATCH_SIZE, orderItems.length)}/${orderItems.length}个订单项`);
  }

  console.log(`[订单数据] 订单创建完成，总计${orderIds.length}个订单`);
  return { orders, orderIds };
}

async function createInvoices(orders: any[]) {
  console.log('[发票数据] 开始创建发票数据...');

  const invoices: any[] = [];
  let invoiceIndex = 1;
  const orgId = 2;

  for (const order of orders) {
    const invoiceCode = `INV-${String(invoiceIndex++).padStart(8, '0')}`;
    const invoiceDate = new Date(order.orderDate.getTime() + randomInt(1, 7) * 24 * 60 * 60 * 1000);

    invoices.push({
      orgId,
      customerId: order.customerId,
      orderId: orders.indexOf(order) + 1,
      invoiceCode,
      invoiceDate,
      amount: order.totalAmount,
      balance: order.totalAmount,
      status: 'OPEN',
    });
  }

  console.log(`[发票数据] 准备插入${invoices.length}个发票...`);

  const invoiceIds: number[] = [];
  for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
    const batch = invoices.slice(i, i + BATCH_SIZE);
    const values = batch.map(inv => 
      `(${inv.orgId}, ${inv.customerId}, ${inv.orderId}, '${inv.invoiceCode}', '${inv.invoiceDate.toISOString().slice(0, 19).replace('T', ' ')}', ${inv.amount}, ${inv.balance}, '${inv.status}')`
    ).join(',');

    const result = await dataSource.query(`
      INSERT INTO ar_invoices (org_id, customer_id, order_id, invoice_code, invoice_date, amount, balance, status)
      VALUES ${values}
    `);

    for (let j = 0; j < batch.length; j++) {
      invoiceIds.push(result.insertId + j);
    }

    console.log(`[发票数据] 已插入${Math.min(i + BATCH_SIZE, invoices.length)}/${invoices.length}个发票`);
  }

  console.log(`[发票数据] 发票创建完成，总计${invoiceIds.length}个`);
  return { invoices, invoiceIds };
}

async function createPaymentsAndApplications(invoices: any[], customers: any[]) {
  console.log('[回款数据] 开始创建回款和核销数据...');

  const payments: any[] = [];
  const applications: any[] = [];
  let paymentIndex = 1;
  const orgId = 2;

  const invoicesByCustomer = new Map<number, any[]>();
  for (const invoice of invoices) {
    if (!invoicesByCustomer.has(invoice.customerId)) {
      invoicesByCustomer.set(invoice.customerId, []);
    }
    invoicesByCustomer.get(invoice.customerId)!.push(invoice);
  }

  for (const [customerId, customerInvoices] of invoicesByCustomer) {
    const customer = customers[customerId - 1];
    if (!customer) continue;

    customerInvoices.sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime());

    const onTimeCount = Math.floor(customerInvoices.length * PAYMENT_DISTRIBUTION.ON_TIME);
    const overdueCount = Math.floor(customerInvoices.length * PAYMENT_DISTRIBUTION.OVERDUE);
    const partialCount = Math.floor(customerInvoices.length * PAYMENT_DISTRIBUTION.PARTIAL);
    const pendingCount = customerInvoices.length - onTimeCount - overdueCount - partialCount;

    let invoiceIdx = 0;

    // 按时回款
    for (let i = 0; i < onTimeCount; i++) {
      const invoice = customerInvoices[invoiceIdx++];
      const paymentDate = new Date(invoice.invoiceDate.getTime() + randomInt(15, customer.paymentTerms) * 24 * 60 * 60 * 1000);
      const bankRef = `PAY-${String(paymentIndex++).padStart(8, '0')}`;

      payments.push({
        orgId,
        customerId: invoice.customerId,
        bankRef,
        paymentDate,
        amount: invoice.amount,
        unappliedAmount: 0,
        status: 'APPLIED',
      });

      applications.push({
        paymentId: payments.length,
        invoiceId: invoices.indexOf(invoice) + 1,
        appliedAmount: invoice.amount,
        appliedDate: paymentDate,
      });
    }

    // 逾期回款
    for (let i = 0; i < overdueCount; i++) {
      const invoice = customerInvoices[invoiceIdx++];
      const paymentDate = new Date(invoice.invoiceDate.getTime() + randomInt(customer.paymentTerms + 10, customer.paymentTerms + 90) * 24 * 60 * 60 * 1000);
      const bankRef = `PAY-${String(paymentIndex++).padStart(8, '0')}`;

      payments.push({
        orgId,
        customerId: invoice.customerId,
        bankRef,
        paymentDate,
        amount: invoice.amount,
        unappliedAmount: 0,
        status: 'APPLIED',
      });

      applications.push({
        paymentId: payments.length,
        invoiceId: invoices.indexOf(invoice) + 1,
        appliedAmount: invoice.amount,
        appliedDate: paymentDate,
      });
    }

    // 部分核销（一张水单对应五张发票）
    for (let i = 0; i < partialCount; i += 5) {
      const invoiceGroup = customerInvoices.slice(invoiceIdx, invoiceIdx + 5);
      invoiceIdx += invoiceGroup.length;

      const totalGroupAmount = invoiceGroup.reduce((sum, inv) => sum + inv.amount, 0);
      const paymentDate = new Date(Math.max(...invoiceGroup.map(inv => inv.invoiceDate.getTime())) + randomInt(20, 40) * 24 * 60 * 60 * 1000);
      const bankRef = `PAY-${String(paymentIndex++).padStart(8, '0')}`;

      payments.push({
        orgId,
        customerId: invoiceGroup[0].customerId,
        bankRef,
        paymentDate,
        amount: totalGroupAmount,
        unappliedAmount: 0,
        status: 'APPLIED',
      });

      for (const invoice of invoiceGroup) {
        applications.push({
          paymentId: payments.length,
          invoiceId: invoices.indexOf(invoice) + 1,
          appliedAmount: invoice.amount,
          appliedDate: paymentDate,
        });
      }
    }

    // 待核销
    for (let i = 0; i < pendingCount; i++) {
      const invoice = customerInvoices[invoiceIdx++];
      if (!invoice) break;

      const paymentDate = new Date(invoice.invoiceDate.getTime() + randomInt(5, 15) * 24 * 60 * 60 * 1000);
      const bankRef = `PAY-${String(paymentIndex++).padStart(8, '0')}`;

      payments.push({
        orgId,
        customerId: invoice.customerId,
        bankRef,
        paymentDate,
        amount: invoice.amount,
        unappliedAmount: invoice.amount,
        status: 'UNAPPLIED',
      });
    }
  }

  console.log(`[回款数据] 准备插入${payments.length}个回款...`);

  const paymentIds: number[] = [];
  for (let i = 0; i < payments.length; i += BATCH_SIZE) {
    const batch = payments.slice(i, i + BATCH_SIZE);
    const values = batch.map(p => 
      `(${p.orgId}, ${p.customerId}, '${p.bankRef}', '${p.paymentDate.toISOString().slice(0, 19).replace('T', ' ')}', ${p.amount}, ${p.unappliedAmount}, '${p.status}')`
    ).join(',');

    const result = await dataSource.query(`
      INSERT INTO ar_payments (org_id, customer_id, bank_ref, payment_date, amount, unapplied_amount, status)
      VALUES ${values}
    `);

    for (let j = 0; j < batch.length; j++) {
      paymentIds.push(result.insertId + j);
    }

    console.log(`[回款数据] 已插入${Math.min(i + BATCH_SIZE, payments.length)}/${payments.length}个回款`);
  }

  for (const app of applications) {
    app.paymentId = paymentIds[app.paymentId - 1];
  }

  console.log(`[核销数据] 准备插入${applications.length}个核销记录...`);

  for (let i = 0; i < applications.length; i += BATCH_SIZE) {
    const batch = applications.slice(i, i + BATCH_SIZE);
    const values = batch.map(app => 
      `(${app.paymentId}, ${app.invoiceId}, ${app.appliedAmount}, '${app.appliedDate.toISOString().slice(0, 19).replace('T', ' ')}')`
    ).join(',');

    await dataSource.query(`
      INSERT INTO ar_apply (payment_id, invoice_id, applied_amount, applied_date)
      VALUES ${values}
    `);

    console.log(`[核销数据] 已插入${Math.min(i + BATCH_SIZE, applications.length)}/${applications.length}个核销记录`);
  }

  console.log(`[回款数据] 回款和核销创建完成，总计${paymentIds.length}个回款，${applications.length}个核销记录`);
  return { payments, paymentIds, applications };
}

async function main() {
  console.log('========================================');
  console.log('全业务仿真系统 - 百万级数据注入');
  console.log('========================================');
  console.log(`清空旧数据: ${CLEAR_DATA ? '是' : '否'}`);
  console.log(`月营业额: ${(MONTHLY_REVENUE / 10000).toFixed(0)}万`);
  console.log(`年营业额: ${(MONTHLY_REVENUE * MONTHS / 100000000).toFixed(2)}亿`);
  console.log('========================================\n');

  try {
    await dataSource.initialize();
    console.log('[数据库] 连接成功\n');

    if (CLEAR_DATA) {
      await clearOldData();
      console.log('');
    }

    const productIds = await createProducts();
    console.log('');

    const { customers, customerIds } = await createCustomers();
    console.log('');

    const { orders, orderIds } = await createOrders(customers, productIds);
    console.log('');

    const { invoices, invoiceIds } = await createInvoices(orders);
    console.log('');

    const { payments, paymentIds, applications } = await createPaymentsAndApplications(invoices, customers);
    console.log('');

    console.log('========================================');
    console.log('数据注入完成！');
    console.log('========================================');
    console.log(`产品: ${productIds.length}个`);
    console.log(`客户: ${customerIds.length}个`);
    console.log(`订单: ${orderIds.length}笔`);
    console.log(`发票: ${invoiceIds.length}张`);
    console.log(`回款: ${paymentIds.length}笔`);
    console.log(`核销记录: ${applications.length}条`);
    console.log('========================================\n');

    console.log('[验证] 开始验证数据...');
    const orderCount = await dataSource.query('SELECT COUNT(*) as count FROM orders');
    const invoiceCount = await dataSource.query('SELECT COUNT(*) as count FROM ar_invoices');
    const paymentCount = await dataSource.query('SELECT COUNT(*) as count FROM ar_payments');
    
    console.log(`[验证] 订单数: ${orderCount[0].count}`);
    console.log(`[验证] 发票数: ${invoiceCount[0].count}`);
    console.log(`[验证] 回款数: ${paymentCount[0].count}`);
    console.log('[验证] 数据验证完成\n');

    console.log('✅ 全业务仿真系统数据注入成功！');

  } catch (error) {
    console.error('❌ 数据注入失败:', error);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('[数据库] 连接已关闭');
  }
}

main().catch(console.error);
