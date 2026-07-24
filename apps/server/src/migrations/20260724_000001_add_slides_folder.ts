import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add 'slides' to the folder type enum
  await db.execute(sql`
    ALTER TYPE "folders_type_enum" ADD VALUE IF NOT EXISTS 'slides';
  `)

  // Add folder_id column to slides table
  await db.execute(sql`
    ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "folder_id" integer REFERENCES "folders"("id") ON DELETE SET NULL;
  `)

  // Index the new column
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "slides_folder_id_idx" ON "slides" ("folder_id");
  `)

  // Drop the old department column (department is now inherited from folder)
  await db.execute(sql`
    ALTER TABLE "slides" DROP COLUMN IF EXISTS "department_id";
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "slides_department_id_idx";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "slides" DROP COLUMN IF EXISTS "folder_id";
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "slides_folder_id_idx";
  `)

  await db.execute(sql`
    ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "department_id" integer REFERENCES "departments"("id") ON DELETE SET NULL;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "slides_department_id_idx" ON "slides" ("department_id");
  `)
}
