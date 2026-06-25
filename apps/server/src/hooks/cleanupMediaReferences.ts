import type { CollectionBeforeDeleteHook } from 'payload'
import { sql } from '@payloadcms/db-postgres'

export const cleanupMediaReferences: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const drizzle = (req.payload as any).db?.drizzle as { execute: (query: any) => Promise<any> } | undefined
  if (!drizzle) {
    req.payload.logger?.error?.({ mediaId: id }, '[cleanupMediaReferences] Database adapter not available')
    return
  }

  const affectedProgramIds: number[] = []

  try {
    // Step 1: Find affected program IDs
    const blockResult = await drizzle.execute(sql`
      SELECT DISTINCT _parent_id FROM "programs_blocks_image_block" WHERE "image_id" = ${id}
      UNION
      SELECT DISTINCT _parent_id FROM "programs_blocks_video_block" WHERE "video_id" = ${id}
      UNION
      SELECT DISTINCT _parent_id FROM "programs_blocks_audio_block" WHERE "audio_id" = ${id}
    `)
    const relsResult = await drizzle.execute(sql`
      SELECT DISTINCT "parent_id" FROM "programs_rels"
      WHERE "path" = 'bulkMedia' AND "media_id" = ${id}
    `)

    const blockRows: any[] = blockResult.rows ?? blockResult ?? []
    const relsRows: any[] = relsResult.rows ?? relsResult ?? []

    const programIds = new Set<number>()
    for (const row of blockRows) programIds.add(row._parent_id as number)
    for (const row of relsRows) programIds.add(row.parent_id as number)

    // Step 2: Delete block rows via Drizzle to prevent FK violations during DELETE FROM media
    await drizzle.execute(sql`DELETE FROM "programs_blocks_image_block" WHERE "image_id" = ${id}`)
    await drizzle.execute(sql`DELETE FROM "programs_blocks_video_block" WHERE "video_id" = ${id}`)
    await drizzle.execute(sql`DELETE FROM "programs_blocks_audio_block" WHERE "audio_id" = ${id}`)

    // Step 3: Delete rels rows for bulkMedia
    await drizzle.execute(sql`DELETE FROM "programs_rels" WHERE "path" = 'bulkMedia' AND "media_id" = ${id}`)

    // Step 4: Update affected programs' JSON data for clean state
    for (const programId of programIds) {
      try {
        const program = await req.payload.findByID({
          collection: 'programs',
          id: programId,
          depth: 0,
        })
        if (!program) continue

        let changed = false
        let slides = program.slides ? [...program.slides] : []

        slides = slides.filter((slide: any) => {
          if (slide.id === 'auto-end') return false
          if (slide.blockType === 'imageBlock' && (slide.image === id || slide.image?.id === id)) {
            changed = true
            return false
          }
          if (slide.blockType === 'videoBlock' && (slide.video === id || slide.video?.id === id)) {
            changed = true
            return false
          }
          return true
        })

        let bulkMedia: (number | { id: number })[] = program.bulkMedia ? [...program.bulkMedia] : []
        const beforeCount = bulkMedia.length
        bulkMedia = bulkMedia.filter((m: number | { id: number }) => {
          const mediaId = typeof m === 'object' ? m.id : m
          return mediaId !== id
        })
        if (bulkMedia.length < beforeCount) changed = true

        if (!changed) continue

        affectedProgramIds.push(program.id)

        await req.payload.update({
          collection: 'programs',
          id: program.id,
          data: {
            slides,
            bulkMedia,
          },
          context: { preventSync: true },
        })
      } catch (err) {
        req.payload.logger?.error?.(
          { programId, mediaId: id, err },
          '[cleanupMediaReferences] Failed to update program'
        )
      }
    }
  } catch (err) {
    req.payload.logger?.error?.(
      { mediaId: id, err },
      '[cleanupMediaReferences] Query failed'
    )
  }

  if (!req.context) req.context = {}
  req.context.affectedProgramIds = affectedProgramIds
}
