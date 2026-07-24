import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "slides" (
      "id" serial PRIMARY KEY,
      "title" varchar NOT NULL,
      "design_json" jsonb NOT NULL DEFAULT '{"width":1920,"height":1080,"background":{"type":"color","color":"#000000"},"elements":[]}',
      "width" integer DEFAULT 1920,
      "height" integer DEFAULT 1080,
      "render_id" integer REFERENCES "media"("id") ON DELETE SET NULL,
      "department_id" integer REFERENCES "departments"("id") ON DELETE SET NULL,
      "created_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'slides_department_id_idx'
      ) THEN
        CREATE INDEX "slides_department_id_idx" ON "slides" ("department_id");
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'slides_created_by_id_idx'
      ) THEN
        CREATE INDEX "slides_created_by_id_idx" ON "slides" ("created_by_id");
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'slides_render_id_idx'
      ) THEN
        CREATE INDEX "slides_render_id_idx" ON "slides" ("render_id");
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "slides";
  `)
}
