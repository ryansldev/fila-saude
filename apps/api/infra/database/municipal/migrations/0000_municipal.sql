CREATE TYPE "public"."entry_state" AS ENUM('awaiting_referral', 'waiting', 'allocated', 'confirmed', 'in_reserve', 'in_queue', 'reassigned', 'archived', 'completed', 'cancelled', 'closed_without_care');--> statement-breakpoint
CREATE TYPE "public"."guardian_relationship" AS ENUM('legal_guardian', 'caregiver', 'family_or_friend');--> statement-breakpoint
CREATE TYPE "public"."reassigned_origin" AS ENUM('private', 'public', 'regulated');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('emergency', 'very_urgent', 'urgent', 'attention', 'routine');--> statement-breakpoint
CREATE TYPE "public"."service_mode" AS ENUM('direct', 'referral', 'regulated');--> statement-breakpoint
CREATE TYPE "public"."session_state" AS ENUM('planned', 'open', 'cancelled', 'closed');--> statement-breakpoint
CREATE TYPE "public"."session_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."occupation" AS ENUM('physician', 'nurse', 'nursing_technician', 'dentist', 'oral_health_assistant', 'community_health_agent', 'reception', 'pharmacist', 'psychologist', 'physiotherapist', 'nutritionist', 'social_worker');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('sms_management', 'sms_regulation', 'unit_manager', 'scheduler');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('triage', 'care');--> statement-breakpoint
CREATE TYPE "public"."unit_kind" AS ENUM('ubs', 'polyclinic', 'upa');--> statement-breakpoint
CREATE TABLE "audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"unit_id" uuid,
	"reason" text,
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "panel_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_user_email_unique" UNIQUE("email"),
	CONSTRAINT "staff_user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "staff_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"service_id" uuid NOT NULL,
	"local_person_id" uuid NOT NULL,
	"guardian_patient_id" text,
	"guardian_relationship" "guardian_relationship",
	"state" "entry_state" NOT NULL,
	"original_entry_date" timestamp with time zone NOT NULL,
	"classification" jsonb NOT NULL,
	"confirmed_risk" "risk_level",
	"priority" jsonb NOT NULL,
	"reassigned" "reassigned_origin",
	"refusals" integer DEFAULT 0 NOT NULL,
	"session_id" uuid,
	"allocated_at" timestamp with time zone,
	"asked_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"refused_sessions" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"birth_date" date NOT NULL,
	"cpf" text,
	"patient_id" text,
	"document_verified_by" text,
	"document_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"patient_id" text NOT NULL,
	"entry_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notice_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"requires_triage" boolean DEFAULT false NOT NULL,
	"mode" "service_mode" DEFAULT 'direct' NOT NULL,
	"average_triage_time_min" integer,
	"average_care_time_min" integer DEFAULT 15 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_prefix_service" UNIQUE("unit_id","prefix"),
	CONSTRAINT "service_prefix_format" CHECK ("service"."prefix" ~ '^[A-Z]{1,3}$')
);
--> statement-breakpoint
CREATE TABLE "session_day" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"day" jsonb NOT NULL,
	"qr_secret" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"slots" integer,
	"taken" integer DEFAULT 0 NOT NULL,
	"visibility" "session_visibility" DEFAULT 'private' NOT NULL,
	"waives_pre_registration" boolean DEFAULT false NOT NULL,
	"professional" text,
	"state" "session_state" DEFAULT 'planned' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_end_after_start" CHECK ("session"."end" > "session"."start"),
	CONSTRAINT "session_min_slots" CHECK ("session"."slots" is null or "session"."slots" >= 1),
	CONSTRAINT "session_taken_within_slots" CHECK ("session"."taken" >= 0 and ("session"."slots" is null or "session"."taken" <= "session"."slots")),
	CONSTRAINT "session_waiver_only_public" CHECK (not "session"."waives_pre_registration" or "session"."visibility" = 'public')
);
--> statement-breakpoint
CREATE TABLE "session_station" (
	"session_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	CONSTRAINT "session_station_session_id_station_id_pk" PRIMARY KEY("session_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "unit_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"unit_id" uuid NOT NULL,
	"occupation" "occupation" NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_unit_link" UNIQUE("user_id","unit_id","occupation")
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"unit_id" uuid,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "single_user_role" UNIQUE NULLS NOT DISTINCT("user_id","role","unit_id"),
	CONSTRAINT "user_role_scope" CHECK (("user_role"."role" in ('sms_management', 'sms_regulation')) = ("user_role"."unit_id" is null))
);
--> statement-breakpoint
CREATE TABLE "station" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stage" "stage" NOT NULL,
	"open" boolean DEFAULT false NOT NULL,
	"last_signal_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_service" (
	"station_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "station_service_station_id_service_id_pk" PRIMARY KEY("station_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "tv" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" char(6) NOT NULL,
	"token_hash" text NOT NULL,
	"unit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paired_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_signal_at" timestamp with time zone,
	CONSTRAINT "tv_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "unit_kind" DEFAULT 'ubs' NOT NULL,
	"cnes" text,
	"postal_code" text DEFAULT '' NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"number" text DEFAULT '' NOT NULL,
	"complement" text,
	"neighborhood" text DEFAULT '' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"time_zone" text NOT NULL,
	"time" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "panel_account" ADD CONSTRAINT "panel_account_user_id_staff_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_session" ADD CONSTRAINT "panel_session_user_id_staff_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_local_person_id_local_person_id_fk" FOREIGN KEY ("local_person_id") REFERENCES "public"."local_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_day" ADD CONSTRAINT "session_day_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_station" ADD CONSTRAINT "session_station_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_station" ADD CONSTRAINT "session_station_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_link" ADD CONSTRAINT "unit_link_user_id_staff_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_link" ADD CONSTRAINT "unit_link_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_staff_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_service" ADD CONSTRAINT "station_service_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_service" ADD CONSTRAINT "station_service_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv" ADD CONSTRAINT "tv_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "panel_account_user_idx" ON "panel_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "panel_session_user_idx" ON "panel_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "single_active_entry" ON "entry" USING btree ("service_id","local_person_id") WHERE "entry"."state" not in ('cancelled','completed','closed_without_care','archived');--> statement-breakpoint
CREATE UNIQUE INDEX "unique_cpf_local_person" ON "local_person" USING btree ("cpf") WHERE "local_person"."cpf" is not null;--> statement-breakpoint
CREATE INDEX "pending_notice_idx" ON "notice" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "code_tv_idx" ON "tv" USING btree ("code");