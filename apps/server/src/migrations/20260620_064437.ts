import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_programs_blocks_image_block_transition" AS ENUM('fade', 'cut', 'slide');
  CREATE TYPE "public"."enum_programs_blocks_image_block_advance_mode" AS ENUM('timed', 'manual');
  CREATE TYPE "public"."enum_programs_blocks_video_block_transition" AS ENUM('fade', 'cut', 'slide');
  CREATE TYPE "public"."enum_programs_blocks_video_block_advance_mode" AS ENUM('timed', 'manual', 'onEnd');
  CREATE TYPE "public"."enum_programs_blocks_youtube_block_transition" AS ENUM('fade', 'cut', 'slide');
  CREATE TYPE "public"."enum_programs_blocks_youtube_block_advance_mode" AS ENUM('timed', 'manual', 'onEnd');
  CREATE TYPE "public"."enum_programs_blocks_audio_block_transition" AS ENUM('fade', 'cut', 'slide');
  CREATE TYPE "public"."enum_programs_blocks_audio_block_advance_mode" AS ENUM('timed', 'manual', 'onEnd');
  CREATE TYPE "public"."enum_programs_blocks_black_screen_block_transition" AS ENUM('fade', 'cut', 'slide');
  CREATE TYPE "public"."enum_programs_blocks_black_screen_block_advance_mode" AS ENUM('timed', 'manual');
  CREATE TYPE "public"."enum_programs_blocks_segment_block_advance_mode" AS ENUM('slides', 'timed', 'manual');
  CREATE TYPE "public"."enum_schedule_days_of_week" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
  CREATE TYPE "public"."enum_folders_type" AS ENUM('media', 'programs');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'basic');
  CREATE TYPE "public"."enum_devices_device_type" AS ENUM('hardware', 'browser');
  CREATE TYPE "public"."enum_devices_status" AS ENUM('online', 'offline', 'stale');
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"folder_id" integer,
  	"duration" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_full_h_d_url" varchar,
  	"sizes_full_h_d_width" numeric,
  	"sizes_full_h_d_height" numeric,
  	"sizes_full_h_d_mime_type" varchar,
  	"sizes_full_h_d_filesize" numeric,
  	"sizes_full_h_d_filename" varchar,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar
  );
  
  CREATE TABLE "programs_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"transition" "enum_programs_blocks_image_block_transition" DEFAULT 'fade',
  	"advance_mode" "enum_programs_blocks_image_block_advance_mode" DEFAULT 'timed' NOT NULL,
  	"duration" numeric DEFAULT 5,
  	"_movetosegment" varchar DEFAULT '__none__',
  	"block_name" varchar
  );
  
  CREATE TABLE "programs_blocks_video_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_id" integer NOT NULL,
  	"transition" "enum_programs_blocks_video_block_transition" DEFAULT 'fade',
  	"advance_mode" "enum_programs_blocks_video_block_advance_mode" DEFAULT 'onEnd' NOT NULL,
  	"duration" numeric DEFAULT 5,
  	"loop" boolean DEFAULT false,
  	"_movetosegment" varchar DEFAULT '__none__',
  	"block_name" varchar
  );
  
  CREATE TABLE "programs_blocks_youtube_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"youtube_id" varchar NOT NULL,
  	"video_title" varchar,
  	"transition" "enum_programs_blocks_youtube_block_transition" DEFAULT 'fade',
  	"advance_mode" "enum_programs_blocks_youtube_block_advance_mode" DEFAULT 'onEnd' NOT NULL,
  	"duration" numeric DEFAULT 5,
  	"loop" boolean DEFAULT false,
  	"_movetosegment" varchar DEFAULT '__none__',
  	"block_name" varchar
  );
  
  CREATE TABLE "programs_blocks_audio_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"audio_id" integer NOT NULL,
  	"transition" "enum_programs_blocks_audio_block_transition" DEFAULT 'fade',
  	"advance_mode" "enum_programs_blocks_audio_block_advance_mode" DEFAULT 'onEnd' NOT NULL,
  	"duration" numeric DEFAULT 5,
  	"loop" boolean DEFAULT false,
  	"_movetosegment" varchar DEFAULT '__none__',
  	"block_name" varchar
  );
  
  CREATE TABLE "programs_blocks_black_screen_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"transition" "enum_programs_blocks_black_screen_block_transition" DEFAULT 'fade',
  	"advance_mode" "enum_programs_blocks_black_screen_block_advance_mode" DEFAULT 'timed' NOT NULL,
  	"duration" numeric DEFAULT 5,
  	"_movetosegment" varchar DEFAULT '__none__',
  	"block_name" varchar
  );
  
  CREATE TABLE "programs_blocks_segment_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"background_audio_id" integer,
  	"loop" boolean DEFAULT false,
  	"advance_mode" "enum_programs_blocks_segment_block_advance_mode" DEFAULT 'slides',
  	"duration" numeric,
  	"block_name" varchar
  );
  
  CREATE TABLE "programs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"folder_id" integer,
  	"loop" boolean DEFAULT false,
  	"auto_black_end_slide" boolean DEFAULT true,
  	"available_from" timestamp(3) with time zone,
  	"available_until" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "programs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"devices_id" integer
  );
  
  CREATE TABLE "schedule_days_of_week" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_schedule_days_of_week",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "schedule" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"program_id" integer NOT NULL,
  	"start_time" timestamp(3) with time zone NOT NULL,
  	"end_time" timestamp(3) with time zone,
  	"until_date" timestamp(3) with time zone,
  	"department_id" integer,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "schedule_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"devices_id" integer
  );
  
  CREATE TABLE "departments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"parent_id" integer,
  	"type" "enum_folders_type" NOT NULL,
  	"department_id" integer,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'basic' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"departments_id" integer
  );
  
  CREATE TABLE "devices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"device_type" "enum_devices_device_type" DEFAULT 'hardware' NOT NULL,
  	"controlling_device_id" integer,
  	"last_heartbeat" timestamp(3) with time zone,
  	"current_program_id" integer,
  	"current_slide_index" numeric,
  	"status" "enum_devices_status" DEFAULT 'offline',
  	"browser_token" varchar,
  	"default_background_id" integer,
  	"hide_program_list" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  CREATE TABLE "devices_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"departments_id" integer
  );
  
  CREATE TABLE "integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  CREATE TABLE "integrations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"departments_id" integer
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"programs_id" integer,
  	"schedule_id" integer,
  	"departments_id" integer,
  	"folders_id" integer,
  	"users_id" integer,
  	"devices_id" integer,
  	"integrations_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"devices_id" integer,
  	"integrations_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_version" varchar DEFAULT 'v0.1.0' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_blocks_image_block" ADD CONSTRAINT "programs_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_blocks_image_block" ADD CONSTRAINT "programs_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_blocks_video_block" ADD CONSTRAINT "programs_blocks_video_block_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_blocks_video_block" ADD CONSTRAINT "programs_blocks_video_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_blocks_youtube_block" ADD CONSTRAINT "programs_blocks_youtube_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_blocks_audio_block" ADD CONSTRAINT "programs_blocks_audio_block_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_blocks_audio_block" ADD CONSTRAINT "programs_blocks_audio_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_blocks_black_screen_block" ADD CONSTRAINT "programs_blocks_black_screen_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_blocks_segment_block" ADD CONSTRAINT "programs_blocks_segment_block_background_audio_id_media_id_fk" FOREIGN KEY ("background_audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_blocks_segment_block" ADD CONSTRAINT "programs_blocks_segment_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_devices_fk" FOREIGN KEY ("devices_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "schedule_days_of_week" ADD CONSTRAINT "schedule_days_of_week_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."schedule"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "schedule" ADD CONSTRAINT "schedule_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedule" ADD CONSTRAINT "schedule_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedule" ADD CONSTRAINT "schedule_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedule_rels" ADD CONSTRAINT "schedule_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."schedule"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "schedule_rels" ADD CONSTRAINT "schedule_rels_devices_fk" FOREIGN KEY ("devices_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "folders" ADD CONSTRAINT "folders_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "devices" ADD CONSTRAINT "devices_controlling_device_id_devices_id_fk" FOREIGN KEY ("controlling_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "devices" ADD CONSTRAINT "devices_current_program_id_programs_id_fk" FOREIGN KEY ("current_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "devices" ADD CONSTRAINT "devices_default_background_id_media_id_fk" FOREIGN KEY ("default_background_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "devices_rels" ADD CONSTRAINT "devices_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "devices_rels" ADD CONSTRAINT "devices_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "integrations_rels" ADD CONSTRAINT "integrations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "integrations_rels" ADD CONSTRAINT "integrations_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_schedule_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedule"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_folders_fk" FOREIGN KEY ("folders_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_devices_fk" FOREIGN KEY ("devices_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_integrations_fk" FOREIGN KEY ("integrations_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_devices_fk" FOREIGN KEY ("devices_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_integrations_fk" FOREIGN KEY ("integrations_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_folder_idx" ON "media" USING btree ("folder_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_full_h_d_sizes_full_h_d_filename_idx" ON "media" USING btree ("sizes_full_h_d_filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "programs_blocks_image_block_order_idx" ON "programs_blocks_image_block" USING btree ("_order");
  CREATE INDEX "programs_blocks_image_block_parent_id_idx" ON "programs_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "programs_blocks_image_block_path_idx" ON "programs_blocks_image_block" USING btree ("_path");
  CREATE INDEX "programs_blocks_image_block_image_idx" ON "programs_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "programs_blocks_video_block_order_idx" ON "programs_blocks_video_block" USING btree ("_order");
  CREATE INDEX "programs_blocks_video_block_parent_id_idx" ON "programs_blocks_video_block" USING btree ("_parent_id");
  CREATE INDEX "programs_blocks_video_block_path_idx" ON "programs_blocks_video_block" USING btree ("_path");
  CREATE INDEX "programs_blocks_video_block_video_idx" ON "programs_blocks_video_block" USING btree ("video_id");
  CREATE INDEX "programs_blocks_youtube_block_order_idx" ON "programs_blocks_youtube_block" USING btree ("_order");
  CREATE INDEX "programs_blocks_youtube_block_parent_id_idx" ON "programs_blocks_youtube_block" USING btree ("_parent_id");
  CREATE INDEX "programs_blocks_youtube_block_path_idx" ON "programs_blocks_youtube_block" USING btree ("_path");
  CREATE INDEX "programs_blocks_audio_block_order_idx" ON "programs_blocks_audio_block" USING btree ("_order");
  CREATE INDEX "programs_blocks_audio_block_parent_id_idx" ON "programs_blocks_audio_block" USING btree ("_parent_id");
  CREATE INDEX "programs_blocks_audio_block_path_idx" ON "programs_blocks_audio_block" USING btree ("_path");
  CREATE INDEX "programs_blocks_audio_block_audio_idx" ON "programs_blocks_audio_block" USING btree ("audio_id");
  CREATE INDEX "programs_blocks_black_screen_block_order_idx" ON "programs_blocks_black_screen_block" USING btree ("_order");
  CREATE INDEX "programs_blocks_black_screen_block_parent_id_idx" ON "programs_blocks_black_screen_block" USING btree ("_parent_id");
  CREATE INDEX "programs_blocks_black_screen_block_path_idx" ON "programs_blocks_black_screen_block" USING btree ("_path");
  CREATE INDEX "programs_blocks_segment_block_order_idx" ON "programs_blocks_segment_block" USING btree ("_order");
  CREATE INDEX "programs_blocks_segment_block_parent_id_idx" ON "programs_blocks_segment_block" USING btree ("_parent_id");
  CREATE INDEX "programs_blocks_segment_block_path_idx" ON "programs_blocks_segment_block" USING btree ("_path");
  CREATE INDEX "programs_blocks_segment_block_background_audio_idx" ON "programs_blocks_segment_block" USING btree ("background_audio_id");
  CREATE INDEX "programs_folder_idx" ON "programs" USING btree ("folder_id");
  CREATE INDEX "programs_created_by_idx" ON "programs" USING btree ("created_by_id");
  CREATE INDEX "programs_updated_at_idx" ON "programs" USING btree ("updated_at");
  CREATE INDEX "programs_created_at_idx" ON "programs" USING btree ("created_at");
  CREATE INDEX "programs_rels_order_idx" ON "programs_rels" USING btree ("order");
  CREATE INDEX "programs_rels_parent_idx" ON "programs_rels" USING btree ("parent_id");
  CREATE INDEX "programs_rels_path_idx" ON "programs_rels" USING btree ("path");
  CREATE INDEX "programs_rels_media_id_idx" ON "programs_rels" USING btree ("media_id");
  CREATE INDEX "programs_rels_devices_id_idx" ON "programs_rels" USING btree ("devices_id");
  CREATE INDEX "schedule_days_of_week_order_idx" ON "schedule_days_of_week" USING btree ("order");
  CREATE INDEX "schedule_days_of_week_parent_idx" ON "schedule_days_of_week" USING btree ("parent_id");
  CREATE INDEX "schedule_program_idx" ON "schedule" USING btree ("program_id");
  CREATE INDEX "schedule_department_idx" ON "schedule" USING btree ("department_id");
  CREATE INDEX "schedule_created_by_idx" ON "schedule" USING btree ("created_by_id");
  CREATE INDEX "schedule_updated_at_idx" ON "schedule" USING btree ("updated_at");
  CREATE INDEX "schedule_created_at_idx" ON "schedule" USING btree ("created_at");
  CREATE INDEX "schedule_rels_order_idx" ON "schedule_rels" USING btree ("order");
  CREATE INDEX "schedule_rels_parent_idx" ON "schedule_rels" USING btree ("parent_id");
  CREATE INDEX "schedule_rels_path_idx" ON "schedule_rels" USING btree ("path");
  CREATE INDEX "schedule_rels_devices_id_idx" ON "schedule_rels" USING btree ("devices_id");
  CREATE INDEX "departments_updated_at_idx" ON "departments" USING btree ("updated_at");
  CREATE INDEX "departments_created_at_idx" ON "departments" USING btree ("created_at");
  CREATE INDEX "folders_parent_idx" ON "folders" USING btree ("parent_id");
  CREATE INDEX "folders_department_idx" ON "folders" USING btree ("department_id");
  CREATE INDEX "folders_updated_at_idx" ON "folders" USING btree ("updated_at");
  CREATE INDEX "folders_created_at_idx" ON "folders" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_departments_id_idx" ON "users_rels" USING btree ("departments_id");
  CREATE INDEX "devices_controlling_device_idx" ON "devices" USING btree ("controlling_device_id");
  CREATE INDEX "devices_current_program_idx" ON "devices" USING btree ("current_program_id");
  CREATE INDEX "devices_default_background_idx" ON "devices" USING btree ("default_background_id");
  CREATE INDEX "devices_updated_at_idx" ON "devices" USING btree ("updated_at");
  CREATE INDEX "devices_created_at_idx" ON "devices" USING btree ("created_at");
  CREATE INDEX "devices_rels_order_idx" ON "devices_rels" USING btree ("order");
  CREATE INDEX "devices_rels_parent_idx" ON "devices_rels" USING btree ("parent_id");
  CREATE INDEX "devices_rels_path_idx" ON "devices_rels" USING btree ("path");
  CREATE INDEX "devices_rels_departments_id_idx" ON "devices_rels" USING btree ("departments_id");
  CREATE INDEX "integrations_updated_at_idx" ON "integrations" USING btree ("updated_at");
  CREATE INDEX "integrations_created_at_idx" ON "integrations" USING btree ("created_at");
  CREATE INDEX "integrations_rels_order_idx" ON "integrations_rels" USING btree ("order");
  CREATE INDEX "integrations_rels_parent_idx" ON "integrations_rels" USING btree ("parent_id");
  CREATE INDEX "integrations_rels_path_idx" ON "integrations_rels" USING btree ("path");
  CREATE INDEX "integrations_rels_departments_id_idx" ON "integrations_rels" USING btree ("departments_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_programs_id_idx" ON "payload_locked_documents_rels" USING btree ("programs_id");
  CREATE INDEX "payload_locked_documents_rels_schedule_id_idx" ON "payload_locked_documents_rels" USING btree ("schedule_id");
  CREATE INDEX "payload_locked_documents_rels_departments_id_idx" ON "payload_locked_documents_rels" USING btree ("departments_id");
  CREATE INDEX "payload_locked_documents_rels_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("folders_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_devices_id_idx" ON "payload_locked_documents_rels" USING btree ("devices_id");
  CREATE INDEX "payload_locked_documents_rels_integrations_id_idx" ON "payload_locked_documents_rels" USING btree ("integrations_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_devices_id_idx" ON "payload_preferences_rels" USING btree ("devices_id");
  CREATE INDEX "payload_preferences_rels_integrations_id_idx" ON "payload_preferences_rels" USING btree ("integrations_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "media" CASCADE;
  DROP TABLE "programs_blocks_image_block" CASCADE;
  DROP TABLE "programs_blocks_video_block" CASCADE;
  DROP TABLE "programs_blocks_youtube_block" CASCADE;
  DROP TABLE "programs_blocks_audio_block" CASCADE;
  DROP TABLE "programs_blocks_black_screen_block" CASCADE;
  DROP TABLE "programs_blocks_segment_block" CASCADE;
  DROP TABLE "programs" CASCADE;
  DROP TABLE "programs_rels" CASCADE;
  DROP TABLE "schedule_days_of_week" CASCADE;
  DROP TABLE "schedule" CASCADE;
  DROP TABLE "schedule_rels" CASCADE;
  DROP TABLE "departments" CASCADE;
  DROP TABLE "folders" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "devices" CASCADE;
  DROP TABLE "devices_rels" CASCADE;
  DROP TABLE "integrations" CASCADE;
  DROP TABLE "integrations_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TYPE "public"."enum_programs_blocks_image_block_transition";
  DROP TYPE "public"."enum_programs_blocks_image_block_advance_mode";
  DROP TYPE "public"."enum_programs_blocks_video_block_transition";
  DROP TYPE "public"."enum_programs_blocks_video_block_advance_mode";
  DROP TYPE "public"."enum_programs_blocks_youtube_block_transition";
  DROP TYPE "public"."enum_programs_blocks_youtube_block_advance_mode";
  DROP TYPE "public"."enum_programs_blocks_audio_block_transition";
  DROP TYPE "public"."enum_programs_blocks_audio_block_advance_mode";
  DROP TYPE "public"."enum_programs_blocks_black_screen_block_transition";
  DROP TYPE "public"."enum_programs_blocks_black_screen_block_advance_mode";
  DROP TYPE "public"."enum_programs_blocks_segment_block_advance_mode";
  DROP TYPE "public"."enum_schedule_days_of_week";
  DROP TYPE "public"."enum_folders_type";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_devices_device_type";
  DROP TYPE "public"."enum_devices_status";`)
}
