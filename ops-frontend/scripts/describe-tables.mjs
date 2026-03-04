import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);
const tables = ['price_anomalies', 'customer_credit_scores', 'sales_commissions', 'payment_receipts', 'batch_trace'];

for (const table of tables) {
  const [rows] = await conn.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' ORDER BY ORDINAL_POSITION`);
  const cols = rows.map(r => r.COLUMN_NAME).join(', ');
  console.log(`${table}: ${cols}`);
}
await conn.end();
