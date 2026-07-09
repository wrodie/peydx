import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "schedule" ADD COLUMN IF NOT EXISTS "starttime_tz" varchar(100) DEFAULT 'Australia/Sydney' NOT NULL;
    ALTER TABLE "schedule" ADD COLUMN IF NOT EXISTS "endtime_tz" varchar(100) DEFAULT 'Australia/Sydney' NOT NULL;
    ALTER TABLE "schedule" ADD COLUMN IF NOT EXISTS "untildate_tz" varchar(100) DEFAULT 'Australia/Sydney' NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "schedule" DROP COLUMN IF EXISTS "starttime_tz";
    ALTER TABLE "schedule" DROP COLUMN IF EXISTS "endtime_tz";
    ALTER TABLE "schedule" DROP COLUMN IF EXISTS "untildate_tz";
  `)
}
