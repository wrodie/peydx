import type { CollectionBeforeDeleteHook } from 'payload'

export const cleanupMediaReferences: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const programs = await req.payload.find({
    collection: 'programs',
    depth: 0,
    limit: 1000,
  })

  const affectedProgramIds: number[] = []

  for (const program of programs.docs) {
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
  }

  if (!req.context) req.context = {}
  req.context.affectedProgramIds = affectedProgramIds
}
