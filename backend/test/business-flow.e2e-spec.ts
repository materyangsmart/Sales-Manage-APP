import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

/**
 * 业务闭环E2E测试
 * 
 * 测试完整的业务流程：
 * 1. 创建订单 (internal)
 * 2. 审核通过 (internal)
 * 3. Fulfill生成invoice (internal)
 * 4. 创建payment (internal)
 * 5. Apply核销 (internal)
 * 6. 验证状态变化
 * 7. 验证审计日志
 * 
 * 关键原则：
 * - 不依赖历史数据，测试自建数据
 * - 断言业务语义级，不只断言200
 * - 使用随机后缀避免冲突
 */

describe('Business Flow E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let internalToken: string;
  
  // 测试数据ID（动态生成）
  let testOrderId: number;
  let testInvoiceId: number;
  let testPaymentId: number;
  let testCustomerId: number;
  let testProductId: number;
  
  // 随机后缀避免冲突
  const randomSuffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // 生成internal token（模拟内部服务）
    // 注意：实际项目中应该使用JWT生成
    internalToken = 'Bearer test-internal-token';

    // 准备测试数据
    await prepareTestData();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanupTestData();
    await app.close();
  });

  /**
   * 准备测试数据
   */
  async function prepareTestData() {
    // 创建测试客户
    const customerResult = await dataSource.query(`
      INSERT INTO customers (name, code, contact_person, contact_phone, contact_email, address, org_id, status, created_at, updated_at)
      VALUES ('测试客户${randomSuffix}', 'TEST_CUST_${randomSuffix}', '测试联系人', '13800138000', 'test@example.com', '测试地址', 2, 'ACTIVE', NOW(), NOW())
    `);
    testCustomerId = customerResult.insertId;

    // 创建测试产品
    const productResult = await dataSource.query(`
      INSERT INTO products (name, code, category, unit, unit_price, stock, min_stock, description, status, created_at, updated_at)
      VALUES ('测试产品${randomSuffix}', 'TEST_PROD_${randomSuffix}', '测试分类', '箱', 100.00, 1000, 100, '测试产品描述', 'ACTIVE', NOW(), NOW())
    `);
    testProductId = productResult.insertId;
  }

  /**
   * 清理测试数据
   */
  async function cleanupTestData() {
    try {
      // 按照外键依赖顺序删除
      if (testOrderId) {
        await dataSource.query(`DELETE FROM order_items WHERE order_id = ?`, [testOrderId]);
        await dataSource.query(`DELETE FROM orders WHERE id = ?`, [testOrderId]);
      }
      if (testInvoiceId) {
        await dataSource.query(`DELETE FROM ar_invoices WHERE id = ?`, [testInvoiceId]);
      }
      if (testPaymentId) {
        await dataSource.query(`DELETE FROM ar_payments WHERE id = ?`, [testPaymentId]);
      }
      if (testCustomerId) {
        await dataSource.query(`DELETE FROM customers WHERE id = ?`, [testCustomerId]);
      }
      if (testProductId) {
        await dataSource.query(`DELETE FROM products WHERE id = ?`, [testProductId]);
      }
      
      // 清理审计日志
      await dataSource.query(`DELETE FROM audit_logs WHERE resource_type IN ('ORDER', 'INVOICE', 'PAYMENT') AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`);
    } catch (error) {
      console.error('清理测试数据失败:', error);
    }
  }

  describe('完整业务闭环', () => {
    it('应该完成：创建订单 → 审核 → fulfill → invoice → payment → apply → 审计', async () => {
      // ============================================
      // 步骤1: 创建订单 (internal)
      // ============================================
      const createOrderDto = {
        customerId: testCustomerId,
        orgId: 2,
        orderDate: new Date().toISOString(),
        totalAmount: 1000.00,
        status: 'PENDING_REVIEW',
        items: [
          {
            productId: testProductId,
            quantity: 10,
            unitPrice: 100.00,
            totalPrice: 1000.00,
          },
        ],
      };

      const createOrderResponse = await request(app.getHttpServer())
        .post('/internal/orders')
        .set('Authorization', internalToken)
        .send(createOrderDto)
        .expect(201);

      testOrderId = createOrderResponse.body.id;
      expect(testOrderId).toBeDefined();
      expect(createOrderResponse.body.status).toBe('PENDING_REVIEW');
      expect(createOrderResponse.body.totalAmount).toBe(1000.00);
      expect(createOrderResponse.body.customerId).toBe(testCustomerId);

      console.log(`✓ 步骤1完成: 创建订单 (ID: ${testOrderId})`);

      // ============================================
      // 步骤2: 审核通过 (internal)
      // ============================================
      const reviewOrderDto = {
        action: 'APPROVE',
        reviewComment: '测试审核通过',
      };

      const reviewOrderResponse = await request(app.getHttpServer())
        .post(`/internal/orders/${testOrderId}/review`)
        .set('Authorization', internalToken)
        .send(reviewOrderDto)
        .expect(200);

      expect(reviewOrderResponse.body.status).toBe('APPROVED');
      expect(reviewOrderResponse.body.reviewComment).toBe('测试审核通过');
      expect(reviewOrderResponse.body.reviewedAt).toBeDefined();
      expect(reviewOrderResponse.body.reviewedBy).toBeDefined();

      console.log(`✓ 步骤2完成: 审核通过 (状态: ${reviewOrderResponse.body.status})`);

      // ============================================
      // 步骤3: Fulfill生成invoice (internal)
      // ============================================
      const fulfillOrderResponse = await request(app.getHttpServer())
        .post(`/internal/orders/${testOrderId}/fulfill`)
        .set('Authorization', internalToken)
        .expect(200);

      expect(fulfillOrderResponse.body.status).toBe('FULFILLED');
      expect(fulfillOrderResponse.body.fulfilledAt).toBeDefined();
      expect(fulfillOrderResponse.body.fulfilledBy).toBeDefined();

      console.log(`✓ 步骤3完成: Fulfill订单 (状态: ${fulfillOrderResponse.body.status})`);

      // 查询生成的invoice
      const invoicesResponse = await request(app.getHttpServer())
        .get(`/internal/ar/invoices?orgId=2`)
        .set('Authorization', internalToken)
        .expect(200);

      const generatedInvoice = invoicesResponse.body.data.find(
        (inv: any) => inv.orderId === testOrderId,
      );
      expect(generatedInvoice).toBeDefined();
      expect(generatedInvoice.status).toBe('OPEN');
      expect(generatedInvoice.totalAmount).toBe(1000.00);
      expect(generatedInvoice.balance).toBe(1000.00);

      testInvoiceId = generatedInvoice.id;
      console.log(`✓ 步骤3验证: Invoice已生成 (ID: ${testInvoiceId}, 状态: OPEN, 余额: ${generatedInvoice.balance})`);

      // ============================================
      // 步骤4: 创建payment (internal)
      // ============================================
      const createPaymentDto = {
        customerId: testCustomerId,
        orgId: 2,
        paymentNo: `PAY-TEST-${randomSuffix}`,
        paymentDate: new Date().toISOString(),
        amount: 1000.00,
        paymentMethod: 'BANK_TRANSFER',
        status: 'UNAPPLIED',
        unappliedAmount: 1000.00,
      };

      const createPaymentResponse = await request(app.getHttpServer())
        .post('/internal/ar/payments')
        .set('Authorization', internalToken)
        .send(createPaymentDto)
        .expect(201);

      testPaymentId = createPaymentResponse.body.id;
      expect(testPaymentId).toBeDefined();
      expect(createPaymentResponse.body.status).toBe('UNAPPLIED');
      expect(createPaymentResponse.body.unappliedAmount).toBe(1000.00);

      console.log(`✓ 步骤4完成: 创建Payment (ID: ${testPaymentId}, 未核销金额: ${createPaymentResponse.body.unappliedAmount})`);

      // ============================================
      // 步骤5: Apply核销 (全额核销)
      // ============================================
      const applyPaymentDto = {
        invoiceId: testInvoiceId,
        appliedAmount: 1000.00,
      };

      const applyPaymentResponse = await request(app.getHttpServer())
        .post(`/internal/ar/payments/${testPaymentId}/apply`)
        .set('Authorization', internalToken)
        .send(applyPaymentDto)
        .expect(200);

      expect(applyPaymentResponse.body.status).toBe('APPLIED');
      expect(applyPaymentResponse.body.unappliedAmount).toBe(0);

      console.log(`✓ 步骤5完成: 核销完成 (Payment状态: APPLIED, 未核销金额: 0)`);

      // ============================================
      // 步骤6: 验证Invoice状态变化
      // ============================================
      const invoiceAfterApply = await request(app.getHttpServer())
        .get(`/internal/ar/invoices/${testInvoiceId}`)
        .set('Authorization', internalToken)
        .expect(200);

      expect(invoiceAfterApply.body.status).toBe('CLOSED');
      expect(invoiceAfterApply.body.balance).toBe(0);

      console.log(`✓ 步骤6完成: Invoice状态已更新 (状态: CLOSED, 余额: 0)`);

      // ============================================
      // 步骤7: 验证审计日志
      // ============================================
      const auditLogsResponse = await request(app.getHttpServer())
        .get(`/internal/audit-logs?resourceType=ORDER&resourceId=${testOrderId}`)
        .set('Authorization', internalToken)
        .expect(200);

      const auditLogs = auditLogsResponse.body.data;
      expect(auditLogs.length).toBeGreaterThanOrEqual(3);

      // 验证关键事件
      const createEvent = auditLogs.find((log: any) => log.action === 'CREATE');
      const reviewEvent = auditLogs.find((log: any) => log.action === 'REVIEW');
      const fulfillEvent = auditLogs.find((log: any) => log.action === 'FULFILL');

      expect(createEvent).toBeDefined();
      expect(createEvent.resourceType).toBe('ORDER');
      expect(createEvent.resourceId).toBe(testOrderId);

      expect(reviewEvent).toBeDefined();
      expect(reviewEvent.resourceType).toBe('ORDER');
      expect(reviewEvent.resourceId).toBe(testOrderId);

      expect(fulfillEvent).toBeDefined();
      expect(fulfillEvent.resourceType).toBe('ORDER');
      expect(fulfillEvent.resourceId).toBe(testOrderId);

      console.log(`✓ 步骤7完成: 审计日志验证通过 (共${auditLogs.length}条记录)`);

      // 验证Payment审计日志
      const paymentAuditLogsResponse = await request(app.getHttpServer())
        .get(`/internal/audit-logs?resourceType=PAYMENT&resourceId=${testPaymentId}`)
        .set('Authorization', internalToken)
        .expect(200);

      const paymentAuditLogs = paymentAuditLogsResponse.body.data;
      const createPaymentEvent = paymentAuditLogs.find((log: any) => log.action === 'CREATE_PAYMENT');
      const applyEvent = paymentAuditLogs.find((log: any) => log.action === 'APPLY');

      expect(createPaymentEvent).toBeDefined();
      expect(applyEvent).toBeDefined();

      console.log(`✓ 步骤7验证: Payment审计日志完整 (CREATE_PAYMENT + APPLY)`);

      // ============================================
      // 最终验证：业务闭环完整性
      // ============================================
      console.log('\n========================================');
      console.log('业务闭环E2E测试完成！');
      console.log('========================================');
      console.log(`订单ID: ${testOrderId}`);
      console.log(`Invoice ID: ${testInvoiceId}`);
      console.log(`Payment ID: ${testPaymentId}`);
      console.log('订单状态: PENDING_REVIEW → APPROVED → FULFILLED');
      console.log('Invoice状态: OPEN → CLOSED');
      console.log('Payment状态: UNAPPLIED → APPLIED');
      console.log('审计日志: 完整记录所有关键事件');
      console.log('========================================\n');
    });

    it('应该支持部分核销', async () => {
      // ============================================
      // 准备：创建新订单和invoice
      // ============================================
      const createOrderDto = {
        customerId: testCustomerId,
        orgId: 2,
        orderDate: new Date().toISOString(),
        totalAmount: 2000.00,
        status: 'PENDING_REVIEW',
        items: [
          {
            productId: testProductId,
            quantity: 20,
            unitPrice: 100.00,
            totalPrice: 2000.00,
          },
        ],
      };

      const createOrderResponse = await request(app.getHttpServer())
        .post('/internal/orders')
        .set('Authorization', internalToken)
        .send(createOrderDto)
        .expect(201);

      const orderId = createOrderResponse.body.id;

      // 审核
      await request(app.getHttpServer())
        .post(`/internal/orders/${orderId}/review`)
        .set('Authorization', internalToken)
        .send({ action: 'APPROVE', reviewComment: '测试审核' })
        .expect(200);

      // Fulfill
      await request(app.getHttpServer())
        .post(`/internal/orders/${orderId}/fulfill`)
        .set('Authorization', internalToken)
        .expect(200);

      // 获取invoice
      const invoicesResponse = await request(app.getHttpServer())
        .get(`/internal/ar/invoices?orgId=2`)
        .set('Authorization', internalToken)
        .expect(200);

      const invoice = invoicesResponse.body.data.find(
        (inv: any) => inv.orderId === orderId,
      );
      const invoiceId = invoice.id;

      // 创建payment
      const createPaymentDto = {
        customerId: testCustomerId,
        orgId: 2,
        paymentNo: `PAY-PARTIAL-${randomSuffix}`,
        paymentDate: new Date().toISOString(),
        amount: 2000.00,
        paymentMethod: 'BANK_TRANSFER',
        status: 'UNAPPLIED',
        unappliedAmount: 2000.00,
      };

      const createPaymentResponse = await request(app.getHttpServer())
        .post('/internal/ar/payments')
        .set('Authorization', internalToken)
        .send(createPaymentDto)
        .expect(201);

      const paymentId = createPaymentResponse.body.id;

      // ============================================
      // 测试：部分核销（核销1000，剩余1000）
      // ============================================
      const applyPaymentDto = {
        invoiceId: invoiceId,
        appliedAmount: 1000.00,
      };

      const applyPaymentResponse = await request(app.getHttpServer())
        .post(`/internal/ar/payments/${paymentId}/apply`)
        .set('Authorization', internalToken)
        .send(applyPaymentDto)
        .expect(200);

      // 验证Payment状态
      expect(applyPaymentResponse.body.status).toBe('PARTIAL');
      expect(applyPaymentResponse.body.unappliedAmount).toBe(1000.00);

      console.log(`✓ 部分核销测试: Payment状态 = PARTIAL, 未核销金额 = 1000`);

      // 验证Invoice状态
      const invoiceAfterPartialApply = await request(app.getHttpServer())
        .get(`/internal/ar/invoices/${invoiceId}`)
        .set('Authorization', internalToken)
        .expect(200);

      expect(invoiceAfterPartialApply.body.status).toBe('OPEN');
      expect(invoiceAfterPartialApply.body.balance).toBe(1000.00);

      console.log(`✓ 部分核销测试: Invoice状态 = OPEN, 余额 = 1000`);

      // 清理
      await dataSource.query(`DELETE FROM order_items WHERE order_id = ?`, [orderId]);
      await dataSource.query(`DELETE FROM orders WHERE id = ?`, [orderId]);
      await dataSource.query(`DELETE FROM ar_invoices WHERE id = ?`, [invoiceId]);
      await dataSource.query(`DELETE FROM ar_payments WHERE id = ?`, [paymentId]);
    });
  });
});
