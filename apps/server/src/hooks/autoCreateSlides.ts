import type { CollectionBeforeChangeHook } from 'payload'

const toIds = (items: unknown): (string | number)[] => {
  if (!items || !Array.isArray(items)) return []
  return items.map((item) => (typeof item === 'object' && item !== null ? (item as { id: string | number }).id : item))
}

export const autoCreateSlides: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const currentIds = toIds(data.bulkMedia)
  const previousIds = toIds(originalDoc.bulkMedia)

  const newMediaIds = currentIds.filter((id) => !previousIds.includes(id))

  if (!newMediaIds.length) return data

  req.payload.logger.info({ newMediaIds, programId: originalDoc.id }, '[autoCreateSlides] creating slides from bulk media')

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
        blockName: null,
        [isVideo ? 'video' : 'image']: id,
        advanceMode: isVideo ? 'onEnd' : 'timed',
        duration: isVideo ? null : 5,
        transition: 'fade',
      }
    }),
  )

  data.slides = [...(data.slides || originalDoc.slides || []), ...newBlocks]
  data.bulkMedia = []

  return data
}
