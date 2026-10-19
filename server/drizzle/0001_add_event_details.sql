ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration_start" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration_end" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizer" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "contact_person" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "contact_phone" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "contact_email" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "location_name" text;
