import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE users SET role = 'standard' WHERE role = 'basic';
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'standard';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'basic';
  `)
}
