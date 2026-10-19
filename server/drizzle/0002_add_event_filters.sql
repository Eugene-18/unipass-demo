ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "target" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "campus" text;
