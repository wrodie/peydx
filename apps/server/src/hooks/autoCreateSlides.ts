import type { CollectionBeforeChangeHook } from 'payload'

const toIds = (items: unknown): (string | number)[] => {
  if (!items || !Array.isArray(items)) return []
  return items.map((item) => (typeof item === 'object' && item !== null ? (item as { id: string | number }).id : item))
}

async function createSlideFromMedia(id: string | number, req: any) {
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
  const isAudio = media.mimeType?.includes('audio')

  if (isAudio) {
    return {
      blockType: 'audioBlock',
      blockName: null,
      audio: id,
      advanceMode: 'onEnd',
      duration: null,
      transition: 'fade',
    }
  }

  return {
    blockType: isVideo ? 'videoBlock' : 'imageBlock',
    blockName: null,
    [isVideo ? 'video' : 'image']: id,
    advanceMode: isVideo ? 'onEnd' : 'manual',
    duration: null,
    transition: 'fade',
  }
}

export const autoCreateSlides: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  // Process top-level bulkMedia
  const currentIds = toIds(data.bulkMedia)
  const previousIds = toIds(originalDoc.bulkMedia)

  const newMediaIds = currentIds.filter((id) => !previousIds.includes(id))

  if (newMediaIds.length) {
    req.payload.logger.info({ newMediaIds, programId: originalDoc.id }, '[autoCreateSlides] creating slides from bulk media')

    const newBlocks = await Promise.all(
      newMediaIds.map((id) => createSlideFromMedia(id, req))
    )

    data.slides = [...(data.slides || originalDoc.slides || []), ...newBlocks]
    data.bulkMedia = []
  }

  // Process segment-level bulkMedia
  const slides = data.slides || originalDoc.slides
  if (slides && Array.isArray(slides)) {
    for (const item of slides) {
      if (item.blockType !== 'segmentBlock') continue
      if (!item.bulkMedia || !Array.isArray(item.bulkMedia) || item.bulkMedia.length === 0) continue

      const origSeg = (originalDoc.slides || []).find(
        (s: any) => s.blockType === 'segmentBlock' && s.id === item.id
      )
      const segCurrentIds = toIds(item.bulkMedia)
      const segPreviousIds = origSeg ? toIds(origSeg.bulkMedia) : []
      const segNewIds = segCurrentIds.filter((id: string | number) => !segPreviousIds.includes(id))

      if (segNewIds.length === 0) {
        item.bulkMedia = []
        continue
      }

      req.payload.logger.info(
        { newMediaIds: segNewIds, segmentName: item.name, programId: originalDoc.id },
        '[autoCreateSlides] creating slides from segment bulk media'
      )

      const segNewBlocks = await Promise.all(
        segNewIds.map((id: string | number) => createSlideFromMedia(id, req))
      )

      item.slides = [...(item.slides || []), ...segNewBlocks]
      item.bulkMedia = []
    }
  }

  return data
}
