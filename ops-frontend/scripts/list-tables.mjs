import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);
const [rows] = await conn.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME");
console.log("Tables in database:");
for (const r of rows) {
  console.log(`  - ${r.TABLE_NAME}`);
}
await conn.end();
