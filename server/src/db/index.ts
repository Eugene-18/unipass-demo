import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// 確保環境變數有讀到
if (!process.env.DATABASE_URL) {
  throw new Error('⚠️ 找不到 DATABASE_URL，請確認 .env 檔案設定是否正確');
}

// 建立 Neon Serverless HTTP 連線
const sql = neon(process.env.DATABASE_URL);

// 匯出 db 實例供整個專案使用，並載入 schema 讓 Drizzle 知道資料表結構
export const db = drizzle(sql, { schema });