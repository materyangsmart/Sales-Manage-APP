import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ForbiddenException } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * 外部权限模型安全测试
 * 
 * 测试目标：
 * 1. customer A token 访问 customer B 资源 => 403
 * 2. customer A token 修改 customer B 资源 => 403
 * 3. 验证CustomerScope强制执行
 */
describe('外部权限模型安全 (e2e)', () => {
  let app: INestApplication;

  // 模拟两个客户的token
  const customerAToken = 'mock-customer-a-token'; // customerId = 1
  const customerBToken = 'mock-customer-b-token'; // customerId = 2

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('越权访问测试', () => {
    it('应该阻止customer A访问customer B的订单列表', async () => {
      // customer A尝试查询customer B的订单
      const response = await request(app.getHttpServer())
        .get('/api/external/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .query({ customerId: 2 }) // 尝试访问customer B的数据
        .expect(200); // 请求成功，但只返回customer A的数据

      // 验证返回的订单都属于customer A（customerId = 1）
      expect(response.body.items).toBeDefined();
      response.body.items.forEach((order) => {
        expect(order.customerId).toBe(1); // 只能看到自己的订单
      });
    });

    it('应该阻止customer A访问customer B的订单详情', async () => {
      // 假设订单ID=100属于customer B
      const orderIdBelongsToCustomerB = 100;

      // customer A尝试访问customer B的订单详情
      await request(app.getHttpServer())
        .get(`/api/external/orders/${orderIdBelongsToCustomerB}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(403); // 应该返回403 Forbidden
    });

    it('应该允许customer A访问自己的订单详情', async () => {
      // 假设订单ID=1属于customer A
      const orderIdBelongsToCustomerA = 1;

      // customer A访问自己的订单详情
      const response = await request(app.getHttpServer())
        .get(`/api/external/orders/${orderIdBelongsToCustomerA}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      // 验证订单属于customer A
      expect(response.body.customerId).toBe(1);
    });

    it('应该阻止customer B访问customer A的订单详情', async () => {
      // 假设订单ID=1属于customer A
      const orderIdBelongsToCustomerA = 1;

      // customer B尝试访问customer A的订单详情
      await request(app.getHttpServer())
        .get(`/api/external/orders/${orderIdBelongsToCustomerA}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .expect(403); // 应该返回403 Forbidden
    });
  });

  describe('CustomerScope强制执行测试', () => {
    it('应该忽略客户端传入的customerId参数', async () => {
      // customer A尝试通过query参数访问customer B的数据
      const response = await request(app.getHttpServer())
        .get('/api/external/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .query({
          customerId: 2, // 尝试访问customer B
          status: 'PENDING_REVIEW',
        })
        .expect(200);

      // 验证返回的订单都属于customer A（customerId = 1）
      // 客户端传入的customerId=2被忽略
      response.body.items.forEach((order) => {
        expect(order.customerId).toBe(1);
      });
    });

    it('应该在token缺少customerId时返回403', async () => {
      // 使用没有customerId的token
      const invalidToken = 'mock-token-without-customer-id';

      await request(app.getHttpServer())
        .get('/api/external/orders')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);
    });
  });

  describe('外部端权限矩阵测试', () => {
    it('应该阻止外部客户访问审计日志', async () => {
      // 外部客户尝试访问审计日志
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(403); // 审计日志是内部工具，外部客户不能访问
    });

    it('应该阻止外部客户创建订单', async () => {
      // 外部客户尝试创建订单（未来可能开放，但目前不允许）
      await request(app.getHttpServer())
        .post('/api/external/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orgId: 2,
          customerId: 1,
          orderDate: '2024-01-01',
          items: [{ productId: 1, quantity: 10 }],
        })
        .expect(404); // POST /api/external/orders 不存在（只读API）
    });

    it('应该阻止外部客户审核订单', async () => {
      // 外部客户尝试审核订单
      await request(app.getHttpServer())
        .post('/api/external/orders/review')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: 1,
          action: 'APPROVED',
        })
        .expect(404); // POST /api/external/orders/review 不存在
    });
  });

  describe('内部API隔离测试', () => {
    it('应该阻止外部客户访问内部订单API', async () => {
      // 外部客户尝试访问内部订单API
      await request(app.getHttpServer())
        .get('/api/internal/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(403); // 内部API只允许ADMIN/OPERATOR/AUDITOR访问
    });

    it('应该阻止外部客户创建内部订单', async () => {
      // 外部客户尝试创建内部订单
      await request(app.getHttpServer())
        .post('/api/internal/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orgId: 2,
          customerId: 1,
          orderDate: '2024-01-01',
          items: [{ productId: 1, quantity: 10 }],
        })
        .expect(403); // 内部API只允许ADMIN/OPERATOR访问
    });
  });
});
