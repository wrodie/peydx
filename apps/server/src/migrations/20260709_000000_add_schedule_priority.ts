import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop old numeric column if it exists from previous schema iteration
  await db.execute(sql`
    ALTER TABLE "schedule" DROP COLUMN IF EXISTS "priority";
  `)
  await db.execute(sql`
    ALTER TABLE "schedule" ADD COLUMN "priority" varchar DEFAULT 'normal' NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "schedule" DROP COLUMN IF EXISTS "priority";
  `)
}
