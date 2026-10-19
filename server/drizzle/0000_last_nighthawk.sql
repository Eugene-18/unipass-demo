CREATE TABLE "bluetooth_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"mac_address" text,
	"device_name" text,
	"last_connected_at" text,
	CONSTRAINT "bluetooth_devices_mac_address_unique" UNIQUE("mac_address")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" text,
	"end_date" text,
	"status" text,
	"event_date" text,
	"location_lat" real,
	"location_lng" real,
	"allowed_distance" integer DEFAULT 500,
	"current_check_in_code" text DEFAULT '000000',
	"is_check_in_active" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "location_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"latitude" real,
	"longitude" real,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"otp_code" text,
	"expires_at" text,
	"is_used" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_id" integer,
	"probability_score" real,
	"predicted_status" text,
	"current_dynamic_rank" integer,
	"historical_reference" text,
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_id" integer,
	"status" text DEFAULT 'registered',
	"check_in_time" text,
	"custom_answers" text,
	"applied_at" text,
	"document_url" text,
	"preference_rank" integer,
	"amount" integer,
	"payment_time" text,
	"account_last_five" text,
	"is_checked_in" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"registration_id" integer,
	"reviewer_id" integer,
	"score" integer,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"google_id" text,
	"name" text NOT NULL,
	"role" text DEFAULT 'student',
	"created_at" timestamp DEFAULT now(),
	"password" text,
	"student_id" text,
	"password_reset_token" text,
	"password_reset_token_expiry" text,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "bluetooth_devices" ADD CONSTRAINT "bluetooth_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_logs" ADD CONSTRAINT "location_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;