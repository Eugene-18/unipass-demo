ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "bluetooth_check_in_required" boolean DEFAULT false NOT NULL;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "bluetooth_beacon_name" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "bluetooth_service_uuid" text;
