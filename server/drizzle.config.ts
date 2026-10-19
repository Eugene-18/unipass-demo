import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  schema: "./src/db/schema.ts",  // 確保指向你正確的 schema 路徑
  out: "./drizzle",              // 產出的 SQL 資料夾
  dialect: "postgresql",         // 🔥 關鍵：告訴 Drizzle 我們現在用 PostgreSQL
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});