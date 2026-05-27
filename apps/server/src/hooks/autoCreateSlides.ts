import type { CollectionAfterChangeHook } from 'payload'

const toIds = (items: unknown): (string | number)[] => {
  if (!items || !Array.isArray(items)) return []
  return items.map((item) => (typeof item === 'object' && item !== null ? (item as { id: string | number }).id : item))
}

export const autoCreateSlides: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  const currentIds = toIds(doc.bulkMedia)
  const previousIds = toIds(previousDoc.bulkMedia)

  const newMediaIds = currentIds.filter((id) => !previousIds.includes(id))

  if (!newMediaIds.length) return doc

  req.payload.logger.info({ newMediaIds, programId: doc.id }, '[autoCreateSlides] creating slides from bulk media')

  const newBlocks = await Promise.all(
    newMediaIds.map(async (id) => {
      let media
      try {
        media = await req.payload.findByID({
          collection: 'media',
          id,
        })
      } catch (err) {
        req.payload.logger.error({ mediaId: id, err: String(err) }, '[autoCreateSlides] findByID FAILED')
        throw err
      }

      const isVideo = media.mimeType?.includes('video')

      return {
        blockType: isVideo ? 'videoBlock' : 'imageBlock',
        [isVideo ? 'video' : 'image']: id,
        advanceMode: isVideo ? 'onEnd' : 'timed',
        duration: isVideo ? undefined : 5,
        transition: 'fade',
      }
    }),
  )

  try {
    await req.payload.update({
      collection: 'programs',
      id: doc.id,
      data: {
        slides: [...(doc.slides || []), ...newBlocks],
        bulkMedia: [],
      },
      context: { preventSync: true },
      req,
    })
  } catch (err) {
    req.payload.logger.error({ docId: doc.id, err: String(err) }, '[autoCreateSlides] update FAILED')
    throw err
  }

  return doc
}
