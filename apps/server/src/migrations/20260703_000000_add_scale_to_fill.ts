import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "programs_blocks_image_block" ADD COLUMN IF NOT EXISTS "scale_to_fill" boolean DEFAULT true;
  `)
  await db.execute(sql`
    ALTER TABLE "programs_blocks_video_block" ADD COLUMN IF NOT EXISTS "scale_to_fill" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "programs_blocks_image_block" DROP COLUMN IF EXISTS "scale_to_fill";
  `)
  await db.execute(sql`
    ALTER TABLE "programs_blocks_video_block" DROP COLUMN IF EXISTS "scale_to_fill";
  `)
}
