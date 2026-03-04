/**
 * RC4 防超卖压测脚本
 * 
 * 模拟 100 个并发请求抢购 10 个库存的商品
 * 验证最终库存为 0 且只有 10 个订单成功
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// 解析连接字符串
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || '3306'),
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1).split('?')[0],
    ssl: url.includes('ssl=') ? { rejectUnauthorized: false } : undefined,
  };
}

async function main() {
  const config = parseDbUrl(DATABASE_URL);
  const pool = mysql.createPool({ ...config, connectionLimit: 120, waitForConnections: true });

  const TEST_PRODUCT_ID = 1;
  const INITIAL_STOCK = 10;
  const CONCURRENT_REQUESTS = 100;

  console.log('='.repeat(60));
  console.log('RC4 防超卖压测');
  console.log(`商品 ID: ${TEST_PRODUCT_ID}`);
  console.log(`初始库存: ${INITIAL_STOCK}`);
  console.log(`并发请求数: ${CONCURRENT_REQUESTS}`);
  console.log('='.repeat(60));

  // Step 1: 重置库存到 10
  await pool.execute(
    `UPDATE inventory SET total_stock = ?, reserved_stock = 0 WHERE product_id = ?`,
    [INITIAL_STOCK, TEST_PRODUCT_ID]
  );
  console.log(`\n[SETUP] 库存已重置为 ${INITIAL_STOCK}`);

  // 清理之前的测试流水
  await pool.execute(`DELETE FROM inventory_log WHERE remark LIKE '%压测%'`);

  // Step 2: 并发抢购（使用 SELECT FOR UPDATE 行级锁）
  let successCount = 0;
  let failCount = 0;
  const results = [];

  const startTime = Date.now();

  const tasks = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
    return (async () => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // 行级锁查询当前库存
        const [rows] = await conn.execute(
          `SELECT id, total_stock, reserved_stock, (total_stock - reserved_stock) AS available 
           FROM inventory WHERE product_id = ? FOR UPDATE`,
          [TEST_PRODUCT_ID]
        );

        const row = rows[0];
        if (!row || row.available < 1) {
          await conn.rollback();
          failCount++;
          results.push({ request: i + 1, status: 'FAIL', reason: '库存不足' });
          return;
        }

        // 扣减库存
        await conn.execute(
          `UPDATE inventory SET reserved_stock = reserved_stock + 1 WHERE product_id = ? AND (total_stock - reserved_stock) >= 1`,
          [TEST_PRODUCT_ID]
        );

        // 记录流水
        await conn.execute(
          `INSERT INTO inventory_log (inventory_id, product_id, type, quantity, before_stock, after_stock, operator_name, remark, created_at)
           VALUES (?, ?, 'RESERVE', -1, ?, ?, ?, ?, NOW())`,
          [row.id, TEST_PRODUCT_ID, row.available, row.available - 1, `压测请求#${i + 1}`, `压测并发抢购 #${i + 1}`]
        );

        await conn.commit();
        successCount++;
        results.push({ request: i + 1, status: 'SUCCESS' });
      } catch (err) {
        await conn.rollback();
        failCount++;
        results.push({ request: i + 1, status: 'ERROR', reason: err.message });
      } finally {
        conn.release();
      }
    })();
  });

  await Promise.all(tasks);
  const elapsed = Date.now() - startTime;

  // Step 3: 验证最终库存
  const [finalRows] = await pool.execute(
    `SELECT total_stock, reserved_stock, (total_stock - reserved_stock) AS available FROM inventory WHERE product_id = ?`,
    [TEST_PRODUCT_ID]
  );
  const finalStock = finalRows[0];

  console.log('\n' + '='.repeat(60));
  console.log('压测结果');
  console.log('='.repeat(60));
  console.log(`耗时: ${elapsed}ms`);
  console.log(`成功下单: ${successCount}`);
  console.log(`失败（库存不足）: ${failCount}`);
  console.log(`最终库存 - 总计: ${finalStock.total_stock}, 预扣减: ${finalStock.reserved_stock}, 可用: ${finalStock.available}`);

  // 验证
  const passed = successCount === INITIAL_STOCK && finalStock.available === 0;
  console.log('\n' + (passed ? '✅ 压测通过！' : '❌ 压测失败！'));
  console.log(`  期望成功: ${INITIAL_STOCK}, 实际成功: ${successCount}`);
  console.log(`  期望可用库存: 0, 实际可用库存: ${finalStock.available}`);
  console.log(`  超卖检测: ${successCount > INITIAL_STOCK ? '⚠️ 发生超卖！' : '✅ 无超卖'}`);

  // 打印部分结果
  console.log('\n前 15 个请求结果:');
  results.slice(0, 15).forEach(r => {
    console.log(`  请求 #${r.request}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
  });

  // Step 4: 恢复库存
  await pool.execute(
    `UPDATE inventory SET total_stock = 500, reserved_stock = 0 WHERE product_id = ?`,
    [TEST_PRODUCT_ID]
  );
  console.log('\n[CLEANUP] 库存已恢复为 500');

  await pool.end();
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error('压测脚本错误:', err);
  process.exit(1);
});
