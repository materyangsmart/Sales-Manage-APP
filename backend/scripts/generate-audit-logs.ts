import { DataSource } from 'typeorm';
import { AuditLog } from '../src/modules/ar/entities/audit-log.entity';

async function generateAuditLogs() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'qianzhang_sales_test',
    entities: [AuditLog],
    synchronize: false,
  });

  await dataSource.initialize();

  const auditLogRepository = dataSource.getRepository(AuditLog);

  console.log('开始生成100,000条审计日志...');

  const batchSize = 1000;
  const totalRecords = 100000;
  const batches = totalRecords / batchSize;

  const actions = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'FULFILL', 'APPLY', 'QUERY', 'LOGIN', 'LOGOUT'];
  const resourceTypes = ['Order', 'Payment', 'Invoice', 'Customer', 'Product'];
  const userIds = Array.from({ length: 100 }, (_, i) => i + 1);

  for (let batch = 0; batch < batches; batch++) {
    const logs: Array<{
      userId: number;
      action: string;
      resourceType: string;
      resourceId: string;
      oldValue: string;
      newValue: string;
      createdAt: Date;
    }> = [];

    for (let i = 0; i < batchSize; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      const resourceId = Math.floor(Math.random() * 10000) + 1;

      // 生成最近90天内的随机时间
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(Math.floor(Math.random() * 24));
      createdAt.setMinutes(Math.floor(Math.random() * 60));

      logs.push({
        userId,
        action,
        resourceType,
        resourceId: resourceId.toString(),
        oldValue: JSON.stringify({ status: 'OLD' }),
        newValue: JSON.stringify({ status: 'NEW' }),
        createdAt,
      });
    }

    await auditLogRepository.insert(logs as any);

    console.log(`已生成 ${(batch + 1) * batchSize} / ${totalRecords} 条记录`);
  }

  console.log('✅ 数据生成完成！');

  await dataSource.destroy();
}

generateAuditLogs().catch((error) => {
  console.error('❌ 数据生成失败:', error);
  process.exit(1);
});
