// migrate.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('⚠️ 找不到 DATABASE_URL，請確認 .env 檔案設定是否正確');
}

// 遷移腳本只需要一條連線即可
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, 
});

const db = drizzle(pool);

async function runMigration() {
  console.log('⏳ 開始執行 PostgreSQL 資料庫遷移...');
  
  try {
    // 這裡會讀取由 drizzle-kit 產生的 SQL 遷移檔
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ 大功告成！資料庫結構已成功同步！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 遷移失敗:', error);
    process.exit(1);
  }
}

runMigration();