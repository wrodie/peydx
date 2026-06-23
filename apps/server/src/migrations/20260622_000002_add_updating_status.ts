import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_devices_status" ADD VALUE IF NOT EXISTS 'updating';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Cannot remove enum values in Postgres — leave as-is
}
