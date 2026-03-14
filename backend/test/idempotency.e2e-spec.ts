import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Idempotency Interceptor (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // 清理测试数据
    await dataSource.query('DELETE FROM audit_logs WHERE idempotency_key IS NOT NULL');
    await dataSource.query('DELETE FROM ar_payments WHERE payment_no LIKE "IDEM-TEST-%"');
  });

  describe('POST /ar/payments (createPayment with idempotency)', () => {
    const idempotencyKey = `test-${Date.now()}-${Math.random()}`;
    const paymentDto = {
      orgId: 2,
      customerId: 1,
      paymentNo: `IDEM-TEST-${Date.now()}`,
      bankRef: `BANK-REF-${Date.now()}`,
      amount: 10000,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'BANK_TRANSFER',
      createdBy: 1,
    };

    it('应该在第一次请求时创建收款单并保存到audit_logs', async () => {
      const response = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.paymentNo).toBe(paymentDto.paymentNo);
      expect(response.body.amount).toBe(paymentDto.amount);

      // 验证audit_logs中有记录
      const auditLog = await dataSource.query(
        'SELECT * FROM audit_logs WHERE idempotency_key = ?',
        [idempotencyKey],
      );

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].idempotency_key).toBe(idempotencyKey);
      expect(auditLog[0].response_data).toBeTruthy();
    });

    it('应该在第二次相同请求时返回缓存的响应，而不重复创建', async () => {
      // 第一次请求
      const firstResponse = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      const firstPaymentId = firstResponse.body.id;

      // 第二次请求（相同的Idempotency-Key）
      const secondResponse = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 应该返回相同的响应
      expect(secondResponse.body.id).toBe(firstPaymentId);
      expect(secondResponse.body.paymentNo).toBe(paymentDto.paymentNo);

      // 验证数据库中只有一条记录
      const payments = await dataSource.query(
        'SELECT * FROM ar_payments WHERE payment_no = ?',
        [paymentDto.paymentNo],
      );

      expect(payments).toHaveLength(1);
      expect(payments[0].id).toBe(firstPaymentId);
    });

    it('应该在第三次相同请求时仍然返回缓存的响应', async () => {
      // 第一次请求
      const firstResponse = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      const firstPaymentId = firstResponse.body.id;

      // 第二次请求
      await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 第三次请求
      const thirdResponse = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 应该返回相同的响应
      expect(thirdResponse.body.id).toBe(firstPaymentId);

      // 验证数据库中仍然只有一条记录
      const payments = await dataSource.query(
        'SELECT * FROM ar_payments WHERE payment_no = ?',
        [paymentDto.paymentNo],
      );

      expect(payments).toHaveLength(1);
    });

    it('应该在不同的Idempotency-Key时创建不同的记录', async () => {
      const idempotencyKey1 = `test-1-${Date.now()}-${Math.random()}`;
      const idempotencyKey2 = `test-2-${Date.now()}-${Math.random()}`;

      const paymentDto1 = {
        ...paymentDto,
        paymentNo: `IDEM-TEST-1-${Date.now()}`,
        bankRef: `BANK-REF-1-${Date.now()}`,
      };

      const paymentDto2 = {
        ...paymentDto,
        paymentNo: `IDEM-TEST-2-${Date.now()}`,
        bankRef: `BANK-REF-2-${Date.now()}`,
      };

      // 第一个请求
      const response1 = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey1)
        .send(paymentDto1)
        .expect(201);

      // 第二个请求（不同的Idempotency-Key）
      const response2 = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey2)
        .send(paymentDto2)
        .expect(201);

      // 应该创建两条不同的记录
      expect(response1.body.id).not.toBe(response2.body.id);
      expect(response1.body.paymentNo).toBe(paymentDto1.paymentNo);
      expect(response2.body.paymentNo).toBe(paymentDto2.paymentNo);

      // 验证audit_logs中有两条记录
      const auditLogs = await dataSource.query(
        'SELECT * FROM audit_logs WHERE idempotency_key IN (?, ?)',
        [idempotencyKey1, idempotencyKey2],
      );

      expect(auditLogs).toHaveLength(2);
    });

    it('应该在缺少Idempotency-Key时返回400错误', async () => {
      const response = await request(app.getHttpServer())
        .post('/ar/payments')
        // 不设置Idempotency-Key
        .send(paymentDto)
        .expect(400);

      expect(response.body.message).toContain('Missing Idempotency-Key header');
    });
  });

  describe('audit_logs.idempotencyKey 唯一性', () => {
    it('应该确保idempotencyKey字段有唯一索引', async () => {
      // 查询数据库索引
      const indexes = await dataSource.query(`
        SHOW INDEX FROM audit_logs WHERE Column_name = 'idempotency_key'
      `);

      expect(indexes).toBeTruthy();
      expect(indexes.length).toBeGreaterThan(0);

      // 检查是否有唯一索引
      const uniqueIndex = indexes.find((idx: any) => idx.Non_unique === 0);
      expect(uniqueIndex).toBeTruthy();
    });

    it('应该在尝试插入重复的idempotencyKey时抛出错误', async () => {
      const idempotencyKey = `test-duplicate-${Date.now()}`;

      // 第一次插入
      await dataSource.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, idempotency_key, created_at)
         VALUES (1, 'TEST', 'TEST', '1', ?, NOW())`,
        [idempotencyKey],
      );

      // 第二次插入相同的idempotencyKey应该失败
      await expect(
        dataSource.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, idempotency_key, created_at)
           VALUES (1, 'TEST', 'TEST', '2', ?, NOW())`,
          [idempotencyKey],
        ),
      ).rejects.toThrow();
    });
  });

  describe('responseData 复用路径', () => {
    const idempotencyKey = `test-response-${Date.now()}-${Math.random()}`;
    const paymentDto = {
      orgId: 2,
      customerId: 1,
      paymentNo: `IDEM-TEST-RESP-${Date.now()}`,
      bankRef: `BANK-REF-RESP-${Date.now()}`,
      amount: 20000,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'BANK_TRANSFER',
      createdBy: 1,
    };

    it('应该在第一次请求后正确保存responseData', async () => {
      const response = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 查询audit_logs
      const auditLog = await dataSource.query(
        'SELECT * FROM audit_logs WHERE idempotency_key = ?',
        [idempotencyKey],
      );

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].response_data).toBeTruthy();

      // 解析responseData
      const responseData = JSON.parse(auditLog[0].response_data);
      expect(responseData.id).toBe(response.body.id);
      expect(responseData.paymentNo).toBe(paymentDto.paymentNo);
      expect(responseData.amount).toBe(paymentDto.amount);
    });

    it('应该在第二次请求时从responseData返回完全相同的响应', async () => {
      // 第一次请求
      const firstResponse = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 第二次请求
      const secondResponse = await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 响应应该完全相同
      expect(secondResponse.body).toEqual(firstResponse.body);

      // 验证所有关键字段
      expect(secondResponse.body.id).toBe(firstResponse.body.id);
      expect(secondResponse.body.paymentNo).toBe(firstResponse.body.paymentNo);
      expect(secondResponse.body.amount).toBe(firstResponse.body.amount);
      expect(secondResponse.body.unappliedAmount).toBe(
        firstResponse.body.unappliedAmount,
      );
      expect(secondResponse.body.status).toBe(firstResponse.body.status);
    });

    it('应该在responseData复用时不执行业务逻辑', async () => {
      // 第一次请求
      await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 记录当前的audit_logs数量
      const auditLogsBefore = await dataSource.query(
        'SELECT COUNT(*) as count FROM audit_logs',
      );
      const countBefore = auditLogsBefore[0].count;

      // 第二次请求（应该直接返回缓存，不执行业务逻辑）
      await request(app.getHttpServer())
        .post('/ar/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // 验证audit_logs数量没有增加（说明没有执行业务逻辑）
      const auditLogsAfter = await dataSource.query(
        'SELECT COUNT(*) as count FROM audit_logs',
      );
      const countAfter = auditLogsAfter[0].count;

      expect(countAfter).toBe(countBefore);
    });
  });

  describe('并发请求幂等性', () => {
    it('应该在并发请求时只创建一条记录', async () => {
      const idempotencyKey = `test-concurrent-${Date.now()}-${Math.random()}`;
      const paymentDto = {
        orgId: 2,
        customerId: 1,
        paymentNo: `IDEM-TEST-CONC-${Date.now()}`,
        bankRef: `BANK-REF-CONC-${Date.now()}`,
        amount: 30000,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'BANK_TRANSFER',
        createdBy: 1,
      };

      // 并发发送3个相同的请求
      const requests = Array(3)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/ar/payments')
            .set('Idempotency-Key', idempotencyKey)
            .send(paymentDto),
        );

      const responses = await Promise.all(requests);

      // 所有响应应该返回相同的ID
      const firstId = responses[0].body.id;
      responses.forEach((response) => {
        expect(response.body.id).toBe(firstId);
      });

      // 验证数据库中只有一条记录
      const payments = await dataSource.query(
        'SELECT * FROM ar_payments WHERE payment_no = ?',
        [paymentDto.paymentNo],
      );

      expect(payments).toHaveLength(1);
    });
  });
});
