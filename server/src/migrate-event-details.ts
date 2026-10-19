import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('找不到 DATABASE_URL，請確認 .env 檔案設定是否正確');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

async function migrateEventDetails() {
  const migrationSql = readFileSync(
    resolve(__dirname, '../drizzle/0001_add_event_details.sql'),
    'utf8',
  );
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');
    console.log('活動欄位已安全升級；既有活動資料未被刪除或覆寫。');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateEventDetails().catch((error: unknown) => {
  console.error('活動欄位升級失敗:', error);
  process.exitCode = 1;
});
