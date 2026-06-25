import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "programs_blocks_image_block"
      DROP CONSTRAINT "programs_blocks_image_block_image_id_media_id_fk",
      ADD CONSTRAINT "programs_blocks_image_block_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE cascade ON UPDATE no action;
  `)
  await db.execute(sql`
    ALTER TABLE "programs_blocks_video_block"
      DROP CONSTRAINT "programs_blocks_video_block_video_id_media_id_fk",
      ADD CONSTRAINT "programs_blocks_video_block_video_id_media_id_fk"
        FOREIGN KEY ("video_id") REFERENCES "public"."media"("id")
        ON DELETE cascade ON UPDATE no action;
  `)
  await db.execute(sql`
    ALTER TABLE "programs_blocks_audio_block"
      DROP CONSTRAINT "programs_blocks_audio_block_audio_id_media_id_fk",
      ADD CONSTRAINT "programs_blocks_audio_block_audio_id_media_id_fk"
        FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id")
        ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "programs_blocks_image_block"
      DROP CONSTRAINT "programs_blocks_image_block_image_id_media_id_fk",
      ADD CONSTRAINT "programs_blocks_image_block_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
  `)
  await db.execute(sql`
    ALTER TABLE "programs_blocks_video_block"
      DROP CONSTRAINT "programs_blocks_video_block_video_id_media_id_fk",
      ADD CONSTRAINT "programs_blocks_video_block_video_id_media_id_fk"
        FOREIGN KEY ("video_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
  `)
  await db.execute(sql`
    ALTER TABLE "programs_blocks_audio_block"
      DROP CONSTRAINT "programs_blocks_audio_block_audio_id_media_id_fk",
      ADD CONSTRAINT "programs_blocks_audio_block_audio_id_media_id_fk"
        FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
  `)
}
